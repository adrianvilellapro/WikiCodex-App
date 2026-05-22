const { pool, prisma } = require('../lib/prisma')
const { createHttpError } = require('../lib/errors')
const {
  assertManagedImageUrl,
  cleanupCloudinaryAssets,
} = require('../lib/media')
const {
  getCampaignRoleContext,
  getCampaignWithMembership,
} = require('./campaign-access.service')
const {
  requireCharacterEditAccess,
  requireCharacterViewAccess,
  serializeCharacterDetail,
} = require('./character-access.service')
const {
  buildVisibleObjectWhere,
  getObjectAccessContext,
  getObjectInclude,
  serializeObject,
} = require('./object.service')
const {
  buildVisiblePowerWhere,
  getPowerAccessContext,
  getPowerInclude,
  serializePower,
} = require('./power.service')
const { getSavedSpellsForEditor } = require('./spell.service')
const { NON_ADMIN_USER_WHERE } = require('../lib/user-visibility')

const characterTierCatalog = [
  'Desconocido',
  'No Luchadores',
  'F',
  'E',
  'D',
  'C',
  'B',
  'A',
  'S',
  'SS',
  'SSS',
  'SSSS',
  'SSSSS',
  'Extremo',
  'Supremo',
  'Deus Ex Machina',
  'Omnipotente',
]
const characterTraitTypeCatalog = [
  {
    nombre: 'Habilidades',
    ordenVisualizacion: 140,
  },
]
const deprecatedCharacterTraitTypeNames = ['Pruebas Wiki']
const CLASS_NAME_MAX_LENGTH = 100
const SUBCLASS_NAME_MAX_LENGTH = 100
const MAX_CLASS_LEVEL = 1000

function normalizeLooseText(value) {
  return String(value || '')
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .trim()
    .toLowerCase()
}

function slugifyLooseText(value) {
  return normalizeLooseText(value)
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

function escapeLikeTerm(value) {
  return String(value || '').replace(/[\\%_]/g, (match) => `\\${match}`)
}

async function findLinkableAssetIdsByName({ tableName, query }) {
  const term = normalizeLooseText(query)

  if (!term) {
    return null
  }

  const escapedTerm = escapeLikeTerm(term)
  const prefixOnly = term.length < 3
  const { rows } = await pool.query(
    `
      SELECT id::text
      FROM ${tableName}
      WHERE (
        ($2::boolean = true AND public.wikicodex_search_normalize(nombre) LIKE $1 || '%' ESCAPE '\\')
        OR
        ($2::boolean = false AND public.wikicodex_search_normalize(nombre) LIKE '%' || $1 || '%' ESCAPE '\\')
      )
      LIMIT 10000
    `,
    [escapedTerm, prefixOnly]
  )

  return rows.map((row) => row.id)
}

function isDeprecatedCharacterTraitTypeName(name) {
  const normalizedName = normalizeLooseText(name)

  return deprecatedCharacterTraitTypeNames.some(
    (deprecatedName) => normalizeLooseText(deprecatedName) === normalizedName
  )
}

function filterActiveCharacterTraitTypes(traitTypes) {
  return traitTypes.filter(
    (item) => !isDeprecatedCharacterTraitTypeName(item.nombre)
  )
}

function filterActiveReusableTraits(traits) {
  return traits.filter(
    (item) => !isDeprecatedCharacterTraitTypeName(item.tipos_rasgo?.nombre)
  )
}

function toNullableBigInt(value) {
  if (value === null || value === undefined) {
    return null
  }

  return BigInt(value)
}

function pickCoreValue(core, fieldName, currentValue) {
  return Object.prototype.hasOwnProperty.call(core, fieldName)
    ? core[fieldName]
    : currentValue
}

async function ensureCharacterTierCatalog() {
  for (const [index, name] of characterTierCatalog.entries()) {
    const existing = await prisma.tiers_personaje.findFirst({
      where: { nombre: name },
      select: { id: true },
    })

    if (existing) {
      await prisma.tiers_personaje.update({
        where: { id: existing.id },
        data: { orden_visualizacion: index + 1 },
      })
      continue
    }

    await prisma.tiers_personaje.create({
      data: {
        nombre: name,
        orden_visualizacion: index + 1,
      },
    })
  }
}

async function ensureCharacterTraitTypeCatalog() {
  const deprecatedTypes = await prisma.tipos_rasgo.findMany({
    where: {
      OR: deprecatedCharacterTraitTypeNames.flatMap((name) => [
        { nombre: name },
        { nombre: name.toLowerCase() },
      ]),
    },
    select: {
      id: true,
      _count: {
        select: { rasgos: true },
      },
    },
  })

  for (const type of deprecatedTypes) {
    if (type._count.rasgos === 0) {
      await prisma.tipos_rasgo.delete({ where: { id: type.id } })
    }
  }

  for (const item of characterTraitTypeCatalog) {
    const existing = await prisma.tipos_rasgo.findFirst({
      where: { nombre: item.nombre },
      select: { id: true },
    })

    if (existing) {
      await prisma.tipos_rasgo.update({
        where: { id: existing.id },
        data: { orden_visualizacion: item.ordenVisualizacion },
      })
      continue
    }

    await prisma.tipos_rasgo.create({
      data: {
        nombre: item.nombre,
        orden_visualizacion: item.ordenVisualizacion,
      },
    })
  }
}

function normalizeEditorPrivacyInput(privacy = {}) {
  const mode = privacy.mode || 'private'
  const permissions = Array.isArray(privacy.userPermissions)
    ? privacy.userPermissions
    : []

  if (mode === 'public') {
    return {
      visibilityCode: 'campana_completo',
      explicitPermissions: [],
    }
  }

  if (mode === 'preview') {
    return {
      visibilityCode: 'campana_vista_previa',
      explicitPermissions: [],
    }
  }

  if (mode === 'custom') {
    return {
      visibilityCode: 'usuarios_seleccionados',
      explicitPermissions: permissions.filter(
        (item) =>
          item?.usuarioId &&
          item.nivelAccesoCodigo &&
          item.nivelAccesoCodigo !== 'sin_acceso'
      ),
    }
  }

  return {
    visibilityCode: 'privado',
    explicitPermissions: [],
  }
}

async function getEditableCampaignOptions(req, currentCampaignId = null) {
  const campaigns =
    req.auth.roleCode === 'administrador'
      ? await prisma.campanas.findMany({
          orderBy: { nombre: 'asc' },
          include: {
            aventuras: {
              orderBy: { nombre: 'asc' },
              select: { id: true, nombre: true, campana_id: true },
            },
            partidas: {
              orderBy: [{ jugada_en: 'desc' }, { nombre: 'asc' }],
              select: {
                id: true,
                nombre: true,
                campana_id: true,
                aventura_id: true,
                arco_id: true,
                jugada_en: true,
              },
            },
          },
        })
      : await prisma.campanas.findMany({
          where: {
            OR: [
              { master_usuario_id: req.auth.userId },
              {
                campana_jugadores: {
                  some: { usuario_id: req.auth.userId },
                },
              },
            ],
          },
          orderBy: { nombre: 'asc' },
          include: {
            aventuras: {
              orderBy: { nombre: 'asc' },
              select: { id: true, nombre: true, campana_id: true },
            },
            partidas: {
              orderBy: [{ jugada_en: 'desc' }, { nombre: 'asc' }],
              select: {
                id: true,
                nombre: true,
                campana_id: true,
                aventura_id: true,
                arco_id: true,
                jugada_en: true,
              },
            },
            campana_jugadores: {
              select: { usuario_id: true },
            },
          },
        })

  let editableCampaigns = campaigns

  if (
    currentCampaignId &&
    !campaigns.some((campaign) => campaign.id === currentCampaignId)
  ) {
    const currentCampaign = await prisma.campanas.findUnique({
      where: { id: currentCampaignId },
      include: {
        aventuras: {
          orderBy: { nombre: 'asc' },
          select: { id: true, nombre: true, campana_id: true },
        },
        partidas: {
          orderBy: [{ jugada_en: 'desc' }, { nombre: 'asc' }],
          select: {
            id: true,
            nombre: true,
            campana_id: true,
            aventura_id: true,
            arco_id: true,
            jugada_en: true,
          },
        },
      },
    })

    if (currentCampaign) {
      editableCampaigns = [...campaigns, currentCampaign]
    }
  }

  return editableCampaigns.map((campaign) => ({
    id: campaign.id,
    nombre: campaign.nombre,
    aventuras: campaign.aventuras.map((adventure) => ({
      id: adventure.id,
      nombre: adventure.nombre,
      campanaId: adventure.campana_id,
    })),
    partidas: campaign.partidas.map((session) => ({
      id: session.id,
      nombre: session.nombre,
      campanaId: session.campana_id,
      aventuraId: session.aventura_id,
      arcoId: session.arco_id,
      jugadaEn: session.jugada_en,
    })),
  }))
}

async function getCharacterEditorMetadata({ characterId, req }) {
  const context = await requireCharacterEditAccess(characterId, req)
  await ensureCharacterTierCatalog()
  await ensureCharacterTraitTypeCatalog()

  const [
    users,
    campaigns,
    states,
    tiers,
    traitTypes,
    categories,
    accessLevels,
    ownedCharacters,
    reusableTraits,
    savedSpells,
  ] = await Promise.all([
    prisma.usuarios.findMany({
      where: NON_ADMIN_USER_WHERE,
      orderBy: { nombre_usuario: 'asc' },
      include: {
        roles: {
          select: {
            codigo: true,
            nombre: true,
          },
        },
      },
    }),
    getEditableCampaignOptions(req, context.character.campana_id),
    prisma.estados_personaje.findMany({
      orderBy: { nombre: 'asc' },
      select: { id: true, codigo: true, nombre: true },
    }),
    prisma.tiers_personaje.findMany({
      orderBy: [{ orden_visualizacion: 'asc' }, { nombre: 'asc' }],
      select: { id: true, nombre: true, orden_visualizacion: true },
    }),
    prisma.tipos_rasgo.findMany({
      orderBy: [{ orden_visualizacion: 'asc' }, { nombre: 'asc' }],
      select: { id: true, nombre: true, orden_visualizacion: true },
    }),
    prisma.categorias_personaje.findMany({
      orderBy: { nombre: 'asc' },
      select: {
        id: true,
        nombre: true,
        campana_origen_id: true,
        es_relevante_para_campana_origen: true,
      },
    }),
    prisma.niveles_acceso.findMany({
      orderBy: { nombre: 'asc' },
      select: { codigo: true, nombre: true, descripcion: true },
    }),
    prisma.personajes.findMany({
      where: {
        propietario_usuario_id: req.auth.userId,
      },
      orderBy: [{ nombre: 'asc' }, { creado_en: 'asc' }],
      select: {
        id: true,
        nombre: true,
        titulo: true,
        personaje_base_id: true,
        imagen_principal_url: true,
        creado_en: true,
      },
    }),
    prisma.rasgos.findMany({
      where: {
        creador_usuario_id: req.auth.userId,
        es_reutilizable: true,
      },
      orderBy: [
        { tipos_rasgo: { orden_visualizacion: 'asc' } },
        { nombre: 'asc' },
      ],
      select: {
        id: true,
        tipo_rasgo_id: true,
        nombre: true,
        descripcion: true,
        es_reutilizable: true,
        creado_en: true,
        actualizado_en: true,
        origen_tipo: true,
        origen_entidad_id: true,
        origen_entidad_nombre: true,
        origen_grupo_id: true,
        origen_rasgo_clave: true,
        origen_rasgo_nombre: true,
        origen_datos: true,
        tipos_rasgo: {
          select: {
            id: true,
            nombre: true,
            orden_visualizacion: true,
          },
        },
      },
    }),
    getSavedSpellsForEditor(req.auth.userId),
  ])

  const explicitPermissions = await prisma.permisos_personaje.findMany({
    where: { personaje_id: characterId },
    select: {
      id: true,
      usuario_id: true,
      nivel_acceso_codigo: true,
    },
    orderBy: { creado_en: 'asc' },
  })

  const classes = await prisma.clases.findMany({
    orderBy: { nombre: 'asc' },
    select: { id: true, nombre: true },
  })

  const subclasses = await prisma.subclases.findMany({
    orderBy: { nombre: 'asc' },
    select: { id: true, nombre: true, clase_id: true },
  })

  return {
    item: serializeCharacterDetail(context.character, context.access, req),
    editor: {
      usuarios: users.map((user) => ({
        id: user.id,
        nombreUsuario: user.nombre_usuario,
        imagenPerfilUrl: user.imagen_perfil_url,
        rol: user.roles
          ? {
              codigo: user.roles.codigo,
              nombre: user.roles.nombre,
            }
          : null,
      })),
      campanas: campaigns,
      estados: states.map((item) => ({
        id: item.id,
        codigo: item.codigo,
        nombre: item.nombre,
      })),
      tiers: tiers.map((item) => ({
        id: item.id,
        nombre: item.nombre,
        ordenVisualizacion: item.orden_visualizacion,
      })),
      tiposRasgo: filterActiveCharacterTraitTypes(traitTypes).map((item) => ({
        id: item.id,
        nombre: item.nombre,
        ordenVisualizacion: item.orden_visualizacion,
      })),
      categorias: categories.map((item) => ({
        id: item.id,
        nombre: item.nombre,
        campanaOrigenId: item.campana_origen_id,
        esRelevanteParaCampanaOrigen: item.es_relevante_para_campana_origen,
      })),
      nivelesAcceso: accessLevels.map((item) => ({
        codigo: item.codigo,
        nombre: item.nombre,
        descripcion: item.descripcion,
      })),
      permisosActuales: explicitPermissions.map((item) => ({
        id: item.id,
        usuarioId: item.usuario_id,
        nivelAccesoCodigo: item.nivel_acceso_codigo,
      })),
      clases: classes.map((item) => ({
        id: item.id,
        nombre: item.nombre,
      })),
      subclases: subclasses.map((item) => ({
        id: item.id,
        nombre: item.nombre,
        claseId: item.clase_id,
      })),
      personajesPropios: ownedCharacters.map((item) => ({
        id: item.id,
        nombre: item.nombre,
        titulo: item.titulo,
        personajeBaseId: item.personaje_base_id,
        imagenPrincipalUrl: item.imagen_principal_url,
        creadoEn: item.creado_en,
      })),
      rasgosGuardados: filterActiveReusableTraits(reusableTraits).map(
        (item) => ({
          id: item.id,
          tipoRasgoId: item.tipo_rasgo_id,
          nombre: item.nombre,
          descripcion: item.descripcion,
          esReutilizable: item.es_reutilizable,
          creadoEn: item.creado_en,
          actualizadoEn: item.actualizado_en,
          origenTipo: item.origen_tipo || 'usuario',
          origenEntidadId: item.origen_entidad_id,
          origenEntidadNombre: item.origen_entidad_nombre,
          origenGrupoId: item.origen_grupo_id,
          origenRasgoClave: item.origen_rasgo_clave,
          origenRasgoNombre: item.origen_rasgo_nombre,
          origenDatos: item.origen_datos || {},
          tipoRasgo: item.tipos_rasgo
            ? {
                id: item.tipos_rasgo.id,
                nombre: item.tipos_rasgo.nombre,
                ordenVisualizacion: item.tipos_rasgo.orden_visualizacion,
              }
            : null,
        })
      ),
      hechizosGuardados: savedSpells,
    },
  }
}

async function getCharacterCreationEditorMetadata({ req }) {
  await ensureCharacterTierCatalog()
  await ensureCharacterTraitTypeCatalog()

  const [
    users,
    campaigns,
    states,
    tiers,
    traitTypes,
    categories,
    accessLevels,
    ownedCharacters,
    reusableTraits,
    classes,
    subclasses,
    savedSpells,
  ] = await Promise.all([
    prisma.usuarios.findMany({
      where: NON_ADMIN_USER_WHERE,
      orderBy: { nombre_usuario: 'asc' },
      include: {
        roles: {
          select: {
            codigo: true,
            nombre: true,
          },
        },
      },
    }),
    getEditableCampaignOptions(req),
    prisma.estados_personaje.findMany({
      orderBy: { nombre: 'asc' },
      select: { id: true, codigo: true, nombre: true },
    }),
    prisma.tiers_personaje.findMany({
      orderBy: [{ orden_visualizacion: 'asc' }, { nombre: 'asc' }],
      select: { id: true, nombre: true, orden_visualizacion: true },
    }),
    prisma.tipos_rasgo.findMany({
      orderBy: [{ orden_visualizacion: 'asc' }, { nombre: 'asc' }],
      select: { id: true, nombre: true, orden_visualizacion: true },
    }),
    prisma.categorias_personaje.findMany({
      orderBy: { nombre: 'asc' },
      select: {
        id: true,
        nombre: true,
        campana_origen_id: true,
        es_relevante_para_campana_origen: true,
      },
    }),
    prisma.niveles_acceso.findMany({
      orderBy: { nombre: 'asc' },
      select: { codigo: true, nombre: true, descripcion: true },
    }),
    prisma.personajes.findMany({
      where: {
        propietario_usuario_id: req.auth.userId,
      },
      orderBy: [{ nombre: 'asc' }, { creado_en: 'asc' }],
      select: {
        id: true,
        nombre: true,
        titulo: true,
        personaje_base_id: true,
        imagen_principal_url: true,
        creado_en: true,
      },
    }),
    prisma.rasgos.findMany({
      where: {
        creador_usuario_id: req.auth.userId,
        es_reutilizable: true,
      },
      orderBy: [
        { tipos_rasgo: { orden_visualizacion: 'asc' } },
        { nombre: 'asc' },
      ],
      select: {
        id: true,
        tipo_rasgo_id: true,
        nombre: true,
        descripcion: true,
        es_reutilizable: true,
        creado_en: true,
        actualizado_en: true,
        origen_tipo: true,
        origen_entidad_id: true,
        origen_entidad_nombre: true,
        origen_grupo_id: true,
        origen_rasgo_clave: true,
        origen_rasgo_nombre: true,
        origen_datos: true,
        tipos_rasgo: {
          select: {
            id: true,
            nombre: true,
            orden_visualizacion: true,
          },
        },
      },
    }),
    prisma.clases.findMany({
      orderBy: { nombre: 'asc' },
      select: { id: true, nombre: true },
    }),
    prisma.subclases.findMany({
      orderBy: { nombre: 'asc' },
      select: { id: true, nombre: true, clase_id: true },
    }),
    getSavedSpellsForEditor(req.auth.userId),
  ])

  return {
    editor: {
      usuarios: users.map((user) => ({
        id: user.id,
        nombreUsuario: user.nombre_usuario,
        imagenPerfilUrl: user.imagen_perfil_url,
        rol: user.roles
          ? {
              codigo: user.roles.codigo,
              nombre: user.roles.nombre,
            }
          : null,
      })),
      campanas: campaigns,
      estados: states.map((item) => ({
        id: item.id,
        codigo: item.codigo,
        nombre: item.nombre,
      })),
      tiers: tiers.map((item) => ({
        id: item.id,
        nombre: item.nombre,
        ordenVisualizacion: item.orden_visualizacion,
      })),
      tiposRasgo: filterActiveCharacterTraitTypes(traitTypes).map((item) => ({
        id: item.id,
        nombre: item.nombre,
        ordenVisualizacion: item.orden_visualizacion,
      })),
      categorias: categories.map((item) => ({
        id: item.id,
        nombre: item.nombre,
        campanaOrigenId: item.campana_origen_id,
        esRelevanteParaCampanaOrigen: item.es_relevante_para_campana_origen,
      })),
      nivelesAcceso: accessLevels.map((item) => ({
        codigo: item.codigo,
        nombre: item.nombre,
        descripcion: item.descripcion,
      })),
      permisosActuales: [],
      clases: classes.map((item) => ({
        id: item.id,
        nombre: item.nombre,
      })),
      subclases: subclasses.map((item) => ({
        id: item.id,
        nombre: item.nombre,
        claseId: item.clase_id,
      })),
      personajesPropios: ownedCharacters.map((item) => ({
        id: item.id,
        nombre: item.nombre,
        titulo: item.titulo,
        personajeBaseId: item.personaje_base_id,
        imagenPrincipalUrl: item.imagen_principal_url,
        creadoEn: item.creado_en,
      })),
      rasgosGuardados: filterActiveReusableTraits(reusableTraits).map(
        (item) => ({
          id: item.id,
          tipoRasgoId: item.tipo_rasgo_id,
          nombre: item.nombre,
          descripcion: item.descripcion,
          esReutilizable: item.es_reutilizable,
          creadoEn: item.creado_en,
          actualizadoEn: item.actualizado_en,
          origenTipo: item.origen_tipo || 'usuario',
          origenEntidadId: item.origen_entidad_id,
          origenEntidadNombre: item.origen_entidad_nombre,
          origenGrupoId: item.origen_grupo_id,
          origenRasgoClave: item.origen_rasgo_clave,
          origenRasgoNombre: item.origen_rasgo_nombre,
          origenDatos: item.origen_datos || {},
          tipoRasgo: item.tipos_rasgo
            ? {
                id: item.tipos_rasgo.id,
                nombre: item.tipos_rasgo.nombre,
                ordenVisualizacion: item.tipos_rasgo.orden_visualizacion,
              }
            : null,
        })
      ),
      hechizosGuardados: savedSpells,
    },
  }
}

async function resolveEditableAdventureId({
  campaignId,
  adventureId,
  allowClearInvalid = false,
}) {
  if (!adventureId) {
    return null
  }

  const adventure = await prisma.aventuras.findFirst({
    where: {
      id: adventureId,
      campana_id: campaignId,
    },
    select: { id: true },
  })

  if (adventure) {
    return adventure.id
  }

  if (allowClearInvalid) {
    return null
  }

  throw createHttpError(
    400,
    'La aventura seleccionada no pertenece a la campana elegida.'
  )
}

async function resolveEditableSessionId({
  campaignId,
  sessionId,
  fieldLabel,
  allowClearInvalid = false,
}) {
  if (!sessionId) {
    return null
  }

  const session = await prisma.partidas.findFirst({
    where: {
      id: sessionId,
      campana_id: campaignId,
    },
    select: { id: true },
  })

  if (session) {
    return session.id
  }

  if (allowClearInvalid) {
    return null
  }

  throw createHttpError(
    400,
    `${fieldLabel} debe pertenecer a la campana elegida.`
  )
}

async function isUserInCampaign({ campaignId, userId }) {
  if (!campaignId || !userId) {
    return false
  }

  const campaign = await prisma.campanas.findFirst({
    where: {
      id: campaignId,
      OR: [
        { master_usuario_id: userId },
        {
          campana_jugadores: {
            some: { usuario_id: userId },
          },
        },
      ],
    },
    select: { id: true },
  })

  return Boolean(campaign)
}

async function assertEditableVersionBase({
  characterId,
  baseCharacterId,
  currentBaseCharacterId,
  actorUserId,
}) {
  if (!baseCharacterId) {
    return null
  }

  if (baseCharacterId === characterId) {
    throw createHttpError(400, 'Un personaje no puede ser version de si mismo.')
  }

  if (baseCharacterId === currentBaseCharacterId) {
    const existingBaseCharacter = await prisma.personajes.findUnique({
      where: { id: baseCharacterId },
      select: {
        id: true,
        personaje_base_id: true,
      },
    })

    if (!existingBaseCharacter) {
      throw createHttpError(400, 'La version base seleccionada ya no existe.')
    }

    return existingBaseCharacter
  }

  const baseCharacter = await prisma.personajes.findFirst({
    where: {
      id: baseCharacterId,
      propietario_usuario_id: actorUserId,
    },
    select: {
      id: true,
      personaje_base_id: true,
    },
  })

  if (!baseCharacter) {
    throw createHttpError(
      400,
      'Solo puedes vincular este personaje como version de otro personaje tuyo.'
    )
  }

  let currentAncestorId = baseCharacter.personaje_base_id
  const visitedIds = new Set([baseCharacter.id])

  while (currentAncestorId) {
    if (currentAncestorId === characterId) {
      throw createHttpError(
        400,
        'No puedes crear un ciclo entre versiones de personaje.'
      )
    }

    if (visitedIds.has(currentAncestorId)) {
      throw createHttpError(
        400,
        'La cadena de versiones seleccionada no es valida.'
      )
    }

    visitedIds.add(currentAncestorId)

    const ancestor = await prisma.personajes.findUnique({
      where: { id: currentAncestorId },
      select: { personaje_base_id: true },
    })

    currentAncestorId = ancestor?.personaje_base_id || null
  }

  return baseCharacter
}

function buildTraitDraftEntries(traitGroups = []) {
  const entries = []
  let order = 0

  for (const group of traitGroups) {
    if (!group?.tipoRasgoId || !Array.isArray(group.rasgos)) {
      continue
    }

    for (const trait of group.rasgos) {
      if (!trait?.nombre?.trim() || !trait?.descripcion?.trim()) {
        continue
      }

      entries.push({
        id: trait.id || null,
        tipoRasgoId: group.tipoRasgoId,
        nombre: trait.nombre.trim(),
        descripcion: trait.descripcion,
        esReutilizable: Boolean(trait.esReutilizable),
        origenTipo: trait.origenTipo?.trim?.() || null,
        origenEntidadId: trait.origenEntidadId || null,
        origenEntidadNombre: trait.origenEntidadNombre?.trim?.() || null,
        origenGrupoId: trait.origenGrupoId?.trim?.() || null,
        origenRasgoClave: trait.origenRasgoClave?.trim?.() || null,
        origenRasgoNombre: trait.origenRasgoNombre?.trim?.() || null,
        origenDatos:
          trait.origenDatos &&
          typeof trait.origenDatos === 'object' &&
          !Array.isArray(trait.origenDatos)
            ? trait.origenDatos
            : {},
        ordenVisualizacion: order,
      })
      order += 1
    }
  }

  return entries
}

function buildReusableTraitKey({ tipoRasgoId, nombre, descripcion }) {
  return [
    tipoRasgoId,
    String(nombre || '')
      .trim()
      .toLocaleLowerCase('es'),
    String(descripcion || '')
      .trim()
      .toLocaleLowerCase('es'),
  ].join('::')
}

function normalizeSpellSlots(value = {}) {
  const slots = {}

  for (let level = 1; level <= 10; level += 1) {
    const amount = Number(value?.[level] ?? value?.[`nivel${level}`] ?? 0)

    if (Number.isInteger(amount) && amount > 0) {
      slots[level] = Math.min(amount, 999)
    }
  }

  return slots
}

function normalizeLinkedObjectEntries(value = []) {
  if (!Array.isArray(value)) {
    return []
  }

  const seen = new Set()
  const entries = []

  for (const item of value) {
    const objetoId = String(item?.objetoId || item?.id || '').trim()

    if (!objetoId || seen.has(objetoId)) {
      continue
    }

    seen.add(objetoId)
    entries.push({
      objetoId,
      mostrarRasgosEnFicha: Boolean(item?.mostrarRasgosEnFicha),
      ordenVisualizacion: entries.length,
    })
  }

  return entries
}

function normalizeLinkedPowerEntries(value = []) {
  if (!Array.isArray(value)) {
    return []
  }

  const seen = new Set()
  const entries = []

  for (const item of value) {
    const poderId = String(item?.poderId || item?.id || '').trim()

    if (!poderId || seen.has(poderId)) {
      continue
    }

    seen.add(poderId)
    entries.push({
      poderId,
      ordenVisualizacion: entries.length,
    })
  }

  return entries
}

async function assertFullVisibleObjects(req, entries) {
  if (!entries.length) {
    return
  }

  const ids = entries.map((entry) => entry.objetoId)
  const objects = await prisma.objetos.findMany({
    where: { id: { in: ids } },
    include: getObjectInclude(req.auth.userId),
  })
  const objectById = new Map(objects.map((object) => [object.id, object]))

  for (const id of ids) {
    const object = objectById.get(id)

    if (!object) {
      throw createHttpError(404, 'Uno de los objetos enlazados no existe.')
    }

    const access = getObjectAccessContext(object, req)

    if (access.viewMode !== 'full') {
      throw createHttpError(
        403,
        'Solo puedes enlazar objetos que puedas ver de forma completa.'
      )
    }
  }
}

async function assertFullVisiblePowers(req, entries) {
  if (!entries.length) {
    return
  }

  const ids = entries.map((entry) => entry.poderId)
  const powers = await prisma.poderes.findMany({
    where: { id: { in: ids } },
    include: getPowerInclude(req.auth.userId),
  })
  const powerById = new Map(powers.map((power) => [power.id, power]))

  for (const id of ids) {
    const power = powerById.get(id)

    if (!power) {
      throw createHttpError(404, 'Uno de los poderes enlazados no existe.')
    }

    const access = getPowerAccessContext(power, req)

    if (access.viewMode !== 'full') {
      throw createHttpError(
        403,
        'Solo puedes enlazar poderes que puedas ver de forma completa.'
      )
    }
  }
}

async function searchLinkableCharacterObjects({ req, query = '', limit = 20 }) {
  const safeLimit = Math.max(1, Math.min(Number(limit || 20), 30))
  const matchingIds = await findLinkableAssetIdsByName({
    tableName: 'objetos',
    query,
  })
  const baseWhere = matchingIds ? { id: { in: matchingIds } } : {}
  const visibilityWhere =
    req.auth.roleCode === 'administrador'
      ? {}
      : buildVisibleObjectWhere(req.auth.userId)
  const where =
    Object.keys(baseWhere).length && Object.keys(visibilityWhere).length
      ? { AND: [baseWhere, visibilityWhere] }
      : Object.keys(baseWhere).length
        ? baseWhere
        : visibilityWhere

  const objects = await prisma.objetos.findMany({
    where,
    include: getObjectInclude(req.auth.userId),
    orderBy: [{ nombre: 'asc' }, { creado_en: 'desc' }],
    take: safeLimit * 2,
  })

  return objects
    .map((object) => {
      const access = getObjectAccessContext(object, req)

      if (access.viewMode !== 'full') {
        return null
      }

      return serializeObject(object, access)
    })
    .filter(Boolean)
    .slice(0, safeLimit)
}

async function searchLinkableCharacterPowers({ req, query = '', limit = 20 }) {
  const safeLimit = Math.max(1, Math.min(Number(limit || 20), 30))
  const matchingIds = await findLinkableAssetIdsByName({
    tableName: 'poderes',
    query,
  })
  const baseWhere = matchingIds ? { id: { in: matchingIds } } : {}
  const where = buildVisiblePowerWhere(req, baseWhere)

  const powers = await prisma.poderes.findMany({
    where,
    include: getPowerInclude(req.auth.userId),
    orderBy: [{ nombre: 'asc' }, { creado_en: 'desc' }],
    take: safeLimit * 2,
  })

  return powers
    .map((power) => {
      const access = getPowerAccessContext(power, req)

      if (access.viewMode !== 'full') {
        return null
      }

      return serializePower(power, req, access)
    })
    .filter(Boolean)
    .slice(0, safeLimit)
}

async function resolveCharacterCategoryIds({
  tx,
  categoryEntries,
  actorUserId,
  targetCampaignId,
}) {
  if (!categoryEntries.length) {
    return []
  }

  const existingCategories = await tx.categorias_personaje.findMany({
    select: {
      id: true,
      nombre: true,
    },
  })

  const categoriesById = new Map(
    existingCategories.map((item) => [item.id, item])
  )
  const categoriesByNormalizedName = new Map(
    existingCategories.map((item) => [normalizeLooseText(item.nombre), item])
  )

  const resolvedIds = []

  for (const entry of categoryEntries) {
    const trimmedName = entry?.nombre?.trim()

    if (!trimmedName) {
      continue
    }

    const existingById = entry.id ? categoriesById.get(entry.id) : null
    const existingByName =
      categoriesByNormalizedName.get(normalizeLooseText(trimmedName)) || null
    const existingCategory = existingById || existingByName

    if (existingCategory) {
      resolvedIds.push(existingCategory.id)
      continue
    }

    const createdCategory = await tx.categorias_personaje.create({
      data: {
        nombre: trimmedName,
        campana_origen_id: targetCampaignId,
        creado_por_usuario_id: actorUserId,
      },
      select: { id: true, nombre: true },
    })

    categoriesById.set(createdCategory.id, createdCategory)
    categoriesByNormalizedName.set(
      normalizeLooseText(createdCategory.nombre),
      createdCategory
    )
    resolvedIds.push(createdCategory.id)
  }

  return [...new Set(resolvedIds)]
}

async function resolveCharacterClasses(tx, classEntries = []) {
  const resolvedEntries = []

  for (const entry of classEntries) {
    const className = entry?.claseNombre?.trim().slice(0, CLASS_NAME_MAX_LENGTH)
    const subclassName = entry?.subclaseNombre
      ?.trim()
      .slice(0, SUBCLASS_NAME_MAX_LENGTH)
    const level = Math.min(Number(entry?.nivelClase), MAX_CLASS_LEVEL)

    if (!className || !Number.isInteger(level) || level < 1) {
      continue
    }

    const allClasses = await tx.clases.findMany({
      where: { es_catalogo: false },
      select: { id: true, nombre: true },
    })

    let characterClass =
      allClasses.find(
        (item) =>
          normalizeLooseText(item.nombre) === normalizeLooseText(className)
      ) || null

    if (!characterClass) {
      characterClass = await tx.clases.create({
        data: {
          nombre: className,
          nombre_normalizado: normalizeLooseText(className).replace(
            /[^a-z0-9]+/g,
            ' '
          ),
          slug: slugifyLooseText(className),
          idioma_codigo: 'es',
          fuente: 'personaje_manual',
          edicion: 'personaje',
          es_catalogo: false,
        },
        select: { id: true, nombre: true },
      })
    }

    let subclassId = null

    if (subclassName) {
      const existingSubclasses = await tx.subclases.findMany({
        where: { clase_id: characterClass.id },
        select: { id: true, nombre: true },
      })

      let subclass =
        existingSubclasses.find(
          (item) =>
            normalizeLooseText(item.nombre) === normalizeLooseText(subclassName)
        ) || null

      if (!subclass) {
        subclass = await tx.subclases.create({
          data: {
            clase_id: characterClass.id,
            nombre: subclassName,
            nombre_normalizado: normalizeLooseText(subclassName).replace(
              /[^a-z0-9]+/g,
              ' '
            ),
            slug: slugifyLooseText(subclassName),
            fuente: 'personaje_manual',
          },
          select: { id: true, nombre: true },
        })
      }

      subclassId = subclass.id
    }

    resolvedEntries.push({
      claseId: characterClass.id,
      subclaseId: subclassId,
      nivelClase: level,
    })
  }

  return resolvedEntries
}

async function saveCharacterEditorDraft({ characterId, req, payload }) {
  await requireCharacterEditAccess(characterId, req)

  const current = await prisma.personajes.findUnique({
    where: { id: characterId },
    include: {
      permisos_personaje: true,
      asignaciones_categoria_personaje: true,
      personaje_clases: true,
      personaje_imagenes: true,
      personaje_temas_musicales: true,
      personaje_hechizos: true,
      personaje_rasgos: {
        include: {
          rasgos: true,
        },
      },
    },
  })

  const nextCore = payload.core || {}
  const hasCategories = Array.isArray(payload.categorias)
  const nextCategories = hasCategories
    ? payload.categorias.filter((item) => item?.nombre?.trim())
    : []
  const hasClasses = Array.isArray(payload.clases)
  const nextClasses = hasClasses ? payload.clases : []
  const hasMusic = Array.isArray(payload.temasMusicales)
  const nextMusic = hasMusic ? payload.temasMusicales : []
  const hasGallery = Array.isArray(payload.galeriaImagenes)
  const nextGallery = hasGallery ? payload.galeriaImagenes : []
  const hasTraits = Array.isArray(payload.rasgosAgrupados)
  const nextTraitEntries = hasTraits
    ? buildTraitDraftEntries(payload.rasgosAgrupados)
    : []
  const hasSpells = Array.isArray(payload.hechizos)
  const nextSpellIds = hasSpells
    ? [
        ...new Set(
          payload.hechizos.map((item) => item?.hechizoId).filter(Boolean)
        ),
      ]
    : []
  const nextSpellSlots = normalizeSpellSlots(payload.hechizosSlots)
  const hasLinkedObjects = Array.isArray(payload.objetos)
  const nextLinkedObjects = hasLinkedObjects
    ? normalizeLinkedObjectEntries(payload.objetos)
    : []
  const hasLinkedPowers = Array.isArray(payload.poderes)
  const nextLinkedPowers = hasLinkedPowers
    ? normalizeLinkedPowerEntries(payload.poderes)
    : []
  const hasPrivacy = Boolean(payload.privacidad)
  const privacy = hasPrivacy
    ? normalizeEditorPrivacyInput(payload.privacidad)
    : normalizeEditorPrivacyInput({
        mode:
          current.ambito_visibilidad_codigo === 'campana_completo'
            ? 'public'
            : current.ambito_visibilidad_codigo === 'usuarios_seleccionados'
              ? 'custom'
              : 'private',
        userPermissions: current.permisos_personaje.map((permission) => ({
          usuarioId: permission.usuario_id,
          nivelAccesoCodigo: permission.nivel_acceso_codigo,
        })),
      })

  const coreValues = {
    campanaId: pickCoreValue(nextCore, 'campanaId', current.campana_id),
    aventuraId: pickCoreValue(nextCore, 'aventuraId', current.aventura_id),
    partidaAparicionId: pickCoreValue(
      nextCore,
      'partidaAparicionId',
      current.partida_aparicion_id
    ),
    partidaDefuncionId: pickCoreValue(
      nextCore,
      'partidaDefuncionId',
      current.partida_defuncion_id
    ),
    propietarioUsuarioId: pickCoreValue(
      nextCore,
      'propietarioUsuarioId',
      current.propietario_usuario_id
    ),
    personajeBaseId: pickCoreValue(
      nextCore,
      'personajeBaseId',
      current.personaje_base_id
    ),
    tierId: pickCoreValue(nextCore, 'tierId', current.tier_id),
    estadoId: pickCoreValue(nextCore, 'estadoId', current.estado_id),
    nombre: pickCoreValue(nextCore, 'nombre', current.nombre),
    titulo: pickCoreValue(nextCore, 'titulo', current.titulo),
    imagenPrincipalUrl: pickCoreValue(
      nextCore,
      'imagenPrincipalUrl',
      current.imagen_principal_url
    ),
    descripcion: pickCoreValue(nextCore, 'descripcion', current.descripcion),
    lore: pickCoreValue(nextCore, 'lore', current.lore),
    edad: pickCoreValue(nextCore, 'edad', current.edad),
    alturaMetros: pickCoreValue(
      nextCore,
      'alturaMetros',
      current.altura_metros
    ),
    pesoKg: pickCoreValue(nextCore, 'pesoKg', current.peso_kg),
    esCriatura: pickCoreValue(nextCore, 'esCriatura', current.es_criatura),
    puntosGolpe: pickCoreValue(nextCore, 'puntosGolpe', current.puntos_golpe),
    claseArmadura: pickCoreValue(
      nextCore,
      'claseArmadura',
      current.clase_armadura
    ),
    velocidadPies: pickCoreValue(
      nextCore,
      'velocidadPies',
      current.velocidad_pies
    ),
    velocidadMetros: pickCoreValue(
      nextCore,
      'velocidadMetros',
      current.velocidad_metros
    ),
    bonificadorCompetencia: pickCoreValue(
      nextCore,
      'bonificadorCompetencia',
      current.bonificador_competencia
    ),
    iniciativa: pickCoreValue(nextCore, 'iniciativa', current.iniciativa),
    percepcionPasiva: pickCoreValue(
      nextCore,
      'percepcionPasiva',
      current.percepcion_pasiva
    ),
    investigacionPasiva: pickCoreValue(
      nextCore,
      'investigacionPasiva',
      current.investigacion_pasiva
    ),
    puntosExperiencia: pickCoreValue(
      nextCore,
      'puntosExperiencia',
      current.puntos_experiencia
    ),
    fuerza: pickCoreValue(nextCore, 'fuerza', current.fuerza),
    destreza: pickCoreValue(nextCore, 'destreza', current.destreza),
    constitucion: pickCoreValue(nextCore, 'constitucion', current.constitucion),
    inteligencia: pickCoreValue(nextCore, 'inteligencia', current.inteligencia),
    sabiduria: pickCoreValue(nextCore, 'sabiduria', current.sabiduria),
    carisma: pickCoreValue(nextCore, 'carisma', current.carisma),
    salvacionFuerza: pickCoreValue(
      nextCore,
      'salvacionFuerza',
      current.salvacion_fuerza
    ),
    salvacionDestreza: pickCoreValue(
      nextCore,
      'salvacionDestreza',
      current.salvacion_destreza
    ),
    salvacionConstitucion: pickCoreValue(
      nextCore,
      'salvacionConstitucion',
      current.salvacion_constitucion
    ),
    salvacionInteligencia: pickCoreValue(
      nextCore,
      'salvacionInteligencia',
      current.salvacion_inteligencia
    ),
    salvacionSabiduria: pickCoreValue(
      nextCore,
      'salvacionSabiduria',
      current.salvacion_sabiduria
    ),
    salvacionCarisma: pickCoreValue(
      nextCore,
      'salvacionCarisma',
      current.salvacion_carisma
    ),
    competenciaSalvacionFuerza: pickCoreValue(
      nextCore,
      'competenciaSalvacionFuerza',
      current.competencia_salvacion_fuerza
    ),
    competenciaSalvacionDestreza: pickCoreValue(
      nextCore,
      'competenciaSalvacionDestreza',
      current.competencia_salvacion_destreza
    ),
    competenciaSalvacionConstitucion: pickCoreValue(
      nextCore,
      'competenciaSalvacionConstitucion',
      current.competencia_salvacion_constitucion
    ),
    competenciaSalvacionInteligencia: pickCoreValue(
      nextCore,
      'competenciaSalvacionInteligencia',
      current.competencia_salvacion_inteligencia
    ),
    competenciaSalvacionSabiduria: pickCoreValue(
      nextCore,
      'competenciaSalvacionSabiduria',
      current.competencia_salvacion_sabiduria
    ),
    competenciaSalvacionCarisma: pickCoreValue(
      nextCore,
      'competenciaSalvacionCarisma',
      current.competencia_salvacion_carisma
    ),
  }

  const targetCampaignId = coreValues.campanaId
  const targetOwnerUserId = coreValues.propietarioUsuarioId
  const canStoreReusableTraits = targetOwnerUserId === req.auth.userId

  if (!targetOwnerUserId) {
    throw createHttpError(
      400,
      'Todo personaje debe pertenecer a un usuario propietario.'
    )
  }

  const targetCampaign = await getCampaignWithMembership(
    targetCampaignId,
    req.auth.userId
  )

  if (!targetCampaign) {
    throw createHttpError(404, 'La campana seleccionada no existe.')
  }

  const targetCampaignContext = getCampaignRoleContext(targetCampaign, req)
  const isKeepingCurrentCampaign = targetCampaignId === current.campana_id
  const isCurrentOwner = current.propietario_usuario_id === req.auth.userId
  const isAssigningToAnotherUser =
    targetOwnerUserId && targetOwnerUserId !== req.auth.userId
  const canAssignAsCampaignManager =
    targetCampaignContext.isMaster || req.auth.roleCode === 'administrador'
  const canTransferOwnCharacterToCampaignMember =
    isAssigningToAnotherUser &&
    isCurrentOwner &&
    (await isUserInCampaign({
      campaignId: targetCampaignId,
      userId: targetOwnerUserId,
    }))

  if (
    !targetCampaignContext.isMember &&
    !(isKeepingCurrentCampaign && isCurrentOwner)
  ) {
    throw createHttpError(
      403,
      'Debes pertenecer a la campana de destino para mover o guardar este personaje.'
    )
  }

  if (
    isAssigningToAnotherUser &&
    !canAssignAsCampaignManager &&
    !canTransferOwnCharacterToCampaignMember
  ) {
    throw createHttpError(
      403,
      'Solo puedes ceder tu personaje a usuarios que pertenezcan a la campana de destino.',
      { code: 'CHARACTER_OWNER_TARGET_NOT_IN_CAMPAIGN' }
    )
  }

  const campaignChanged = targetCampaignId !== current.campana_id
  const resolvedAdventureId = await resolveEditableAdventureId({
    campaignId: targetCampaignId,
    adventureId: coreValues.aventuraId,
    allowClearInvalid:
      campaignChanged || coreValues.aventuraId === current.aventura_id,
  })
  const resolvedAppearanceSessionId = await resolveEditableSessionId({
    campaignId: targetCampaignId,
    sessionId: coreValues.partidaAparicionId,
    allowClearInvalid:
      campaignChanged ||
      coreValues.partidaAparicionId === current.partida_aparicion_id,
    fieldLabel: 'La partida de aparición',
  })
  const resolvedDeathSessionId = await resolveEditableSessionId({
    campaignId: targetCampaignId,
    sessionId: coreValues.partidaDefuncionId,
    allowClearInvalid:
      campaignChanged ||
      coreValues.partidaDefuncionId === current.partida_defuncion_id,
    fieldLabel: 'La partida de defunción',
  })

  await assertEditableVersionBase({
    characterId,
    baseCharacterId: coreValues.personajeBaseId,
    currentBaseCharacterId: current.personaje_base_id,
    actorUserId: req.auth.userId,
  })

  const previousImageUrls = [
    current.imagen_principal_url,
    ...current.personaje_imagenes.map((item) => item.imagen_url),
  ].filter(Boolean)
  const previousImageUrlSet = new Set(previousImageUrls)

  if (
    coreValues.imagenPrincipalUrl &&
    coreValues.imagenPrincipalUrl !== current.imagen_principal_url
  ) {
    await assertManagedImageUrl(coreValues.imagenPrincipalUrl, {
      entityLabel: 'La imagen principal del personaje',
    })
  }

  for (const image of nextGallery) {
    if (!image.imagenUrl || previousImageUrlSet.has(image.imagenUrl)) {
      continue
    }

    await assertManagedImageUrl(image.imagenUrl, {
      entityLabel: 'La imagen de la galeria del personaje',
    })
  }

  if (hasLinkedObjects) {
    await assertFullVisibleObjects(req, nextLinkedObjects)
  }

  if (hasLinkedPowers) {
    await assertFullVisiblePowers(req, nextLinkedPowers)
  }

  const nextImageUrls = [
    coreValues.imagenPrincipalUrl,
    ...(hasGallery
      ? nextGallery.map((item) => item.imagenUrl)
      : current.personaje_imagenes.map((item) => item.imagen_url)),
  ].filter(Boolean)
  const removedImageUrls = previousImageUrls.filter(
    (url) => !nextImageUrls.includes(url)
  )

  const previousAttachedTraitIds = current.personaje_rasgos.map(
    (item) => item.rasgo_id
  )
  const payloadTraitIds = nextTraitEntries
    .map((entry) => entry.id)
    .filter(Boolean)
  const reusableTraitRecords = payloadTraitIds.length
    ? await prisma.rasgos.findMany({
        where: {
          id: { in: payloadTraitIds },
          creador_usuario_id: req.auth.userId,
          es_reutilizable: true,
        },
      })
    : []
  const reusableTraitCandidates = nextTraitEntries.filter(
    (entry) => canStoreReusableTraits && entry.esReutilizable
  )
  const existingReusableDuplicates = reusableTraitCandidates.length
    ? await prisma.rasgos.findMany({
        where: {
          creador_usuario_id: req.auth.userId,
          es_reutilizable: true,
          OR: reusableTraitCandidates.map((entry) => ({
            tipo_rasgo_id: entry.tipoRasgoId,
            nombre: entry.nombre,
            descripcion: entry.descripcion,
          })),
        },
      })
    : []
  const reusableDuplicateIdsByKey = new Map(
    existingReusableDuplicates.map((trait) => [
      buildReusableTraitKey({
        tipoRasgoId: trait.tipo_rasgo_id,
        nombre: trait.nombre,
        descripcion: trait.descripcion,
      }),
      trait.id,
    ])
  )
  const existingTraitIds = new Map([
    ...current.personaje_rasgos.map((item) => [item.rasgo_id, item.rasgos]),
    ...reusableTraitRecords.map((item) => [item.id, item]),
  ])

  const finalTraitIds = []

  await prisma.$transaction(async (tx) => {
    const resolvedCategoryIds = hasCategories
      ? await resolveCharacterCategoryIds({
          tx,
          categoryEntries: nextCategories,
          actorUserId: req.auth.userId,
          targetCampaignId,
        })
      : []
    const resolvedClasses = hasClasses
      ? await resolveCharacterClasses(tx, nextClasses)
      : []

    await tx.personajes.update({
      where: { id: characterId },
      data: {
        campana_id: targetCampaignId,
        aventura_id: resolvedAdventureId || null,
        partida_aparicion_id: resolvedAppearanceSessionId || null,
        partida_defuncion_id: resolvedDeathSessionId || null,
        propietario_usuario_id: targetOwnerUserId,
        personaje_base_id: coreValues.personajeBaseId || null,
        hechizos_slots: nextSpellSlots,
        tier_id: coreValues.tierId || null,
        estado_id: coreValues.estadoId || null,
        ambito_visibilidad_codigo: privacy.visibilityCode,
        nombre: coreValues.nombre,
        titulo: coreValues.titulo || null,
        imagen_principal_url: coreValues.imagenPrincipalUrl || null,
        descripcion: coreValues.descripcion || null,
        lore: coreValues.lore || null,
        edad: toNullableBigInt(coreValues.edad),
        altura_metros: coreValues.alturaMetros ?? null,
        peso_kg: coreValues.pesoKg ?? null,
        es_criatura: Boolean(coreValues.esCriatura),
        puntos_golpe: toNullableBigInt(coreValues.puntosGolpe),
        clase_armadura: toNullableBigInt(coreValues.claseArmadura),
        velocidad_pies: toNullableBigInt(coreValues.velocidadPies),
        velocidad_metros: coreValues.velocidadMetros ?? null,
        bonificador_competencia: coreValues.bonificadorCompetencia ?? null,
        iniciativa: toNullableBigInt(coreValues.iniciativa),
        percepcion_pasiva: toNullableBigInt(coreValues.percepcionPasiva),
        investigacion_pasiva: toNullableBigInt(coreValues.investigacionPasiva),
        puntos_experiencia: toNullableBigInt(coreValues.puntosExperiencia),
        fuerza: coreValues.fuerza ?? null,
        destreza: coreValues.destreza ?? null,
        constitucion: coreValues.constitucion ?? null,
        inteligencia: coreValues.inteligencia ?? null,
        sabiduria: coreValues.sabiduria ?? null,
        carisma: coreValues.carisma ?? null,
        salvacion_fuerza: coreValues.salvacionFuerza ?? null,
        salvacion_destreza: coreValues.salvacionDestreza ?? null,
        salvacion_constitucion: coreValues.salvacionConstitucion ?? null,
        salvacion_inteligencia: coreValues.salvacionInteligencia ?? null,
        salvacion_sabiduria: coreValues.salvacionSabiduria ?? null,
        salvacion_carisma: coreValues.salvacionCarisma ?? null,
        competencia_salvacion_fuerza: Boolean(
          coreValues.competenciaSalvacionFuerza
        ),
        competencia_salvacion_destreza: Boolean(
          coreValues.competenciaSalvacionDestreza
        ),
        competencia_salvacion_constitucion: Boolean(
          coreValues.competenciaSalvacionConstitucion
        ),
        competencia_salvacion_inteligencia: Boolean(
          coreValues.competenciaSalvacionInteligencia
        ),
        competencia_salvacion_sabiduria: Boolean(
          coreValues.competenciaSalvacionSabiduria
        ),
        competencia_salvacion_carisma: Boolean(
          coreValues.competenciaSalvacionCarisma
        ),
      },
    })

    if (hasCategories) {
      await tx.asignaciones_categoria_personaje.deleteMany({
        where: { personaje_id: characterId },
      })

      if (resolvedCategoryIds.length) {
        await tx.asignaciones_categoria_personaje.createMany({
          data: resolvedCategoryIds.map((categoryId) => ({
            personaje_id: characterId,
            categoria_id: categoryId,
          })),
        })
      }
    }

    const sessionIdsToAttach = [
      resolvedAppearanceSessionId,
      resolvedDeathSessionId,
    ].filter(Boolean)

    const staleSessionLinks = await tx.partida_personajes.findMany({
      where: {
        personaje_id: characterId,
        partidas: {
          campana_id: { not: targetCampaignId },
        },
      },
      select: { id: true },
    })

    if (staleSessionLinks.length) {
      await tx.partida_personajes.deleteMany({
        where: {
          id: { in: staleSessionLinks.map((item) => item.id) },
        },
      })
    }

    if (sessionIdsToAttach.length) {
      await tx.partida_personajes.createMany({
        data: [...new Set(sessionIdsToAttach)].map((sessionId) => ({
          partida_id: sessionId,
          personaje_id: characterId,
        })),
        skipDuplicates: true,
      })
    }

    if (hasClasses) {
      await tx.personaje_clases.deleteMany({
        where: { personaje_id: characterId },
      })

      if (resolvedClasses.length) {
        await tx.personaje_clases.createMany({
          data: resolvedClasses.map((item) => ({
            personaje_id: characterId,
            clase_id: item.claseId,
            subclase_id: item.subclaseId || null,
            nivel_clase: Number(item.nivelClase),
          })),
        })
      }
    }

    if (hasMusic) {
      await tx.personaje_temas_musicales.deleteMany({
        where: { personaje_id: characterId },
      })

      if (nextMusic.length) {
        await tx.personaje_temas_musicales.createMany({
          data: nextMusic
            .filter((item) => item.musicaUrl?.trim())
            .map((item, index) => ({
              personaje_id: characterId,
              titulo: item.titulo?.trim() || null,
              musica_url: item.musicaUrl.trim(),
              orden_visualizacion: index,
            })),
        })
      }
    }

    if (hasGallery) {
      await tx.personaje_imagenes.deleteMany({
        where: { personaje_id: characterId },
      })

      if (nextGallery.length) {
        await tx.personaje_imagenes.createMany({
          data: nextGallery
            .filter((item) => item.imagenUrl?.trim())
            .map((item, index) => ({
              personaje_id: characterId,
              imagen_url: item.imagenUrl.trim(),
              orden_visualizacion: index,
            })),
        })
      }
    }

    if (hasPrivacy) {
      await tx.permisos_personaje.deleteMany({
        where: { personaje_id: characterId },
      })

      const filteredExplicitPermissions = privacy.explicitPermissions.filter(
        (item) => item.usuarioId !== targetOwnerUserId
      )

      if (filteredExplicitPermissions.length) {
        await tx.permisos_personaje.createMany({
          data: filteredExplicitPermissions.map((item) => ({
            personaje_id: characterId,
            usuario_id: item.usuarioId,
            nivel_acceso_codigo: item.nivelAccesoCodigo,
            otorgado_por_usuario_id: req.auth.userId,
          })),
        })
      }
    }

    if (hasTraits) {
      for (const entry of nextTraitEntries) {
        let traitId = entry.id || null
        const existingTrait = traitId ? existingTraitIds.get(traitId) : null
        const reusableDuplicateId =
          canStoreReusableTraits && entry.esReutilizable
            ? reusableDuplicateIdsByKey.get(
                buildReusableTraitKey({
                  tipoRasgoId: entry.tipoRasgoId,
                  nombre: entry.nombre,
                  descripcion: entry.descripcion,
                })
              )
            : null

        if (reusableDuplicateId && reusableDuplicateId !== traitId) {
          finalTraitIds.push({
            rasgoId: reusableDuplicateId,
            ordenVisualizacion: entry.ordenVisualizacion,
          })
          continue
        }

        if (existingTrait) {
          const wasPreviouslyAttached =
            previousAttachedTraitIds.includes(traitId)
          const reusedWithoutChanges =
            !wasPreviouslyAttached &&
            existingTrait.tipo_rasgo_id === entry.tipoRasgoId &&
            existingTrait.nombre === entry.nombre &&
            existingTrait.descripcion === entry.descripcion &&
            Boolean(existingTrait.es_reutilizable) ===
              Boolean(entry.esReutilizable)

          if (reusedWithoutChanges) {
            finalTraitIds.push({
              rasgoId: traitId,
              ordenVisualizacion: entry.ordenVisualizacion,
            })
            continue
          }

          const linkedCount = await tx.personaje_rasgos.count({
            where: { rasgo_id: traitId },
          })

          if (wasPreviouslyAttached && linkedCount <= 1) {
            await tx.rasgos.update({
              where: { id: traitId },
              data: {
                tipo_rasgo_id: entry.tipoRasgoId,
                nombre: entry.nombre,
                descripcion: entry.descripcion,
                es_reutilizable: canStoreReusableTraits && entry.esReutilizable,
                origen_tipo: entry.origenTipo,
                origen_entidad_id: entry.origenEntidadId,
                origen_entidad_nombre: entry.origenEntidadNombre,
                origen_grupo_id: entry.origenGrupoId,
                origen_rasgo_clave: entry.origenRasgoClave,
                origen_rasgo_nombre: entry.origenRasgoNombre,
                origen_datos: entry.origenDatos,
              },
            })
          } else {
            const duplicated = await tx.rasgos.create({
              data: {
                tipo_rasgo_id: entry.tipoRasgoId,
                creador_usuario_id: req.auth.userId,
                nombre: entry.nombre,
                descripcion: entry.descripcion,
                es_reutilizable: canStoreReusableTraits && entry.esReutilizable,
                origen_tipo: entry.origenTipo,
                origen_entidad_id: entry.origenEntidadId,
                origen_entidad_nombre: entry.origenEntidadNombre,
                origen_grupo_id: entry.origenGrupoId,
                origen_rasgo_clave: entry.origenRasgoClave,
                origen_rasgo_nombre: entry.origenRasgoNombre,
                origen_datos: entry.origenDatos,
              },
            })

            traitId = duplicated.id
          }
        } else {
          const createdTrait = await tx.rasgos.create({
            data: {
              tipo_rasgo_id: entry.tipoRasgoId,
              creador_usuario_id: req.auth.userId,
              nombre: entry.nombre,
              descripcion: entry.descripcion,
              es_reutilizable: canStoreReusableTraits && entry.esReutilizable,
              origen_tipo: entry.origenTipo,
              origen_entidad_id: entry.origenEntidadId,
              origen_entidad_nombre: entry.origenEntidadNombre,
              origen_grupo_id: entry.origenGrupoId,
              origen_rasgo_clave: entry.origenRasgoClave,
              origen_rasgo_nombre: entry.origenRasgoNombre,
              origen_datos: entry.origenDatos,
            },
          })

          traitId = createdTrait.id
        }

        finalTraitIds.push({
          rasgoId: traitId,
          ordenVisualizacion: entry.ordenVisualizacion,
        })
      }

      await tx.personaje_rasgos.deleteMany({
        where: { personaje_id: characterId },
      })

      if (finalTraitIds.length) {
        await tx.personaje_rasgos.createMany({
          data: finalTraitIds.map((item) => ({
            personaje_id: characterId,
            rasgo_id: item.rasgoId,
            orden_visualizacion: item.ordenVisualizacion,
          })),
        })
      }

      const orphanTraitIds = previousAttachedTraitIds.filter(
        (traitId) => !finalTraitIds.some((item) => item.rasgoId === traitId)
      )

      if (orphanTraitIds.length) {
        await tx.rasgos.deleteMany({
          where: {
            id: { in: orphanTraitIds },
            es_reutilizable: false,
            personaje_rasgos: {
              none: {},
            },
          },
        })
      }
    }

    if (hasSpells) {
      await tx.personaje_hechizos.deleteMany({
        where: { personaje_id: characterId },
      })

      if (nextSpellIds.length) {
        const visibleSpells = await tx.hechizos.findMany({
          where: {
            id: { in: nextSpellIds },
            OR: [
              { es_publico: true },
              { creado_por_usuario_id: req.auth.userId },
              {
                hechizos_guardados_usuario: {
                  some: { usuario_id: req.auth.userId },
                },
              },
            ],
          },
          select: { id: true },
        })
        const visibleSpellIds = new Set(visibleSpells.map((item) => item.id))

        await tx.personaje_hechizos.createMany({
          data: nextSpellIds
            .filter((spellId) => visibleSpellIds.has(spellId))
            .map((spellId, index) => ({
              personaje_id: characterId,
              hechizo_id: spellId,
              orden_visualizacion: index,
            })),
          skipDuplicates: true,
        })
      }
    }

    if (hasLinkedObjects) {
      await tx.personaje_objetos.deleteMany({
        where: { personaje_id: characterId },
      })

      if (nextLinkedObjects.length) {
        await tx.personaje_objetos.createMany({
          data: nextLinkedObjects.map((item) => ({
            personaje_id: characterId,
            objeto_id: item.objetoId,
            mostrar_rasgos_en_ficha: item.mostrarRasgosEnFicha,
            orden_visualizacion: item.ordenVisualizacion,
          })),
          skipDuplicates: true,
        })
      }
    }

    if (hasLinkedPowers) {
      await tx.personaje_poderes.deleteMany({
        where: { personaje_id: characterId },
      })

      if (nextLinkedPowers.length) {
        await tx.personaje_poderes.createMany({
          data: nextLinkedPowers.map((item) => ({
            personaje_id: characterId,
            poder_id: item.poderId,
            orden_visualizacion: item.ordenVisualizacion,
          })),
          skipDuplicates: true,
        })
      }
    }
  })

  if (removedImageUrls.length) {
    await cleanupCloudinaryAssets(removedImageUrls)
  }

  const updatedContext = await requireCharacterViewAccess(characterId, req)

  return {
    item: serializeCharacterDetail(
      updatedContext.character,
      updatedContext.access,
      req
    ),
  }
}

async function setCharacterObjectTraitDisplay({
  characterId,
  objectId,
  req,
  mostrarRasgosEnFicha,
}) {
  const context = await requireCharacterViewAccess(characterId, req)

  if (context.access.viewMode !== 'full') {
    throw createHttpError(
      403,
      'Solo puedes configurar objetos de personajes que puedas ver completos.'
    )
  }

  const link = await prisma.personaje_objetos.findFirst({
    where: {
      personaje_id: characterId,
      objeto_id: objectId,
    },
    include: {
      objetos: {
        include: getObjectInclude(req.auth.userId),
      },
    },
  })

  if (!link) {
    throw createHttpError(404, 'El objeto no esta enlazado a este personaje.')
  }

  const objectAccess = getObjectAccessContext(link.objetos, req)

  if (objectAccess.viewMode !== 'full') {
    throw createHttpError(
      403,
      'Solo puedes mostrar rasgos de objetos que puedas ver completos.'
    )
  }

  await prisma.personaje_objetos.update({
    where: { id: link.id },
    data: {
      mostrar_rasgos_en_ficha: Boolean(mostrarRasgosEnFicha),
    },
  })

  const updatedContext = await requireCharacterViewAccess(characterId, req)

  return {
    item: serializeCharacterDetail(
      updatedContext.character,
      updatedContext.access,
      req
    ),
  }
}

module.exports = {
  getCharacterCreationEditorMetadata,
  getCharacterEditorMetadata,
  saveCharacterEditorDraft,
  searchLinkableCharacterObjects,
  searchLinkableCharacterPowers,
  setCharacterObjectTraitDisplay,
}
