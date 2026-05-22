const { prisma } = require('../lib/prisma')
const { createHttpError } = require('../lib/errors')
const { logEntityChange } = require('../lib/audit')
const {
  getCampaignRoleContext,
  getCampaignWithMembership,
} = require('./campaign-access.service')
const {
  getCharacterAccessContext,
  serializeCharacter,
} = require('./character-access.service')

const sourceCharacterInclude = {
  permisos_personaje: {
    select: {
      nivel_acceso_codigo: true,
      usuario_id: true,
    },
  },
  asignaciones_categoria_personaje: {
    select: {
      categoria_id: true,
    },
  },
  personaje_clases: {
    select: {
      clase_id: true,
      subclase_id: true,
      nivel_clase: true,
    },
  },
  personaje_imagenes: {
    select: {
      imagen_url: true,
      orden_visualizacion: true,
    },
  },
  personaje_rasgos: {
    select: {
      rasgo_id: true,
      orden_visualizacion: true,
    },
  },
  personaje_temas_musicales: {
    select: {
      musica_url: true,
      orden_visualizacion: true,
    },
  },
}

function buildCharacterCloneData({
  sourceCharacter,
  actorUserId,
  targetCampaignId,
  targetAdventureId,
  targetOwnerUserId,
  targetVisibilityCode,
  copyRelations = true,
  linkAsVersion = false,
  explicitBaseCharacterId = null,
  overrides = {},
}) {
  const preserveCampaignScopedReferences =
    sourceCharacter.campana_id === targetCampaignId

  const baseCharacterId = explicitBaseCharacterId
    ? explicitBaseCharacterId
    : linkAsVersion
      ? sourceCharacter.id
      : null

  const ownerUserId =
    targetOwnerUserId !== undefined
      ? targetOwnerUserId
      : sourceCharacter.propietario_usuario_id || actorUserId

  const createData = {
    campana_id: targetCampaignId,
    aventura_id:
      targetAdventureId !== undefined
        ? targetAdventureId
        : preserveCampaignScopedReferences
          ? sourceCharacter.aventura_id
          : null,
    creado_por_usuario_id: actorUserId,
    propietario_usuario_id: ownerUserId,
    tier_id: sourceCharacter.tier_id,
    estado_id: sourceCharacter.estado_id,
    ambito_visibilidad_codigo:
      targetVisibilityCode || sourceCharacter.ambito_visibilidad_codigo,
    personaje_base_id: baseCharacterId,
    nombre: overrides.nombre ?? sourceCharacter.nombre,
    titulo: overrides.titulo ?? sourceCharacter.titulo,
    imagen_principal_url:
      overrides.imagenPrincipalUrl ?? sourceCharacter.imagen_principal_url,
    descripcion: overrides.descripcion ?? sourceCharacter.descripcion,
    lore: overrides.lore ?? sourceCharacter.lore,
    edad: overrides.edad ?? sourceCharacter.edad,
    altura_metros: overrides.alturaMetros ?? sourceCharacter.altura_metros,
    peso_kg: overrides.pesoKg ?? sourceCharacter.peso_kg,
    es_criatura: sourceCharacter.es_criatura,
    puntos_golpe: overrides.puntosGolpe ?? sourceCharacter.puntos_golpe,
    clase_armadura: overrides.claseArmadura ?? sourceCharacter.clase_armadura,
    velocidad_pies: overrides.velocidadPies ?? sourceCharacter.velocidad_pies,
    velocidad_metros:
      overrides.velocidadMetros ?? sourceCharacter.velocidad_metros,
    bonificador_competencia:
      overrides.bonificadorCompetencia ??
      sourceCharacter.bonificador_competencia,
    iniciativa: overrides.iniciativa ?? sourceCharacter.iniciativa,
    percepcion_pasiva:
      overrides.percepcionPasiva ?? sourceCharacter.percepcion_pasiva,
    investigacion_pasiva:
      overrides.investigacionPasiva ?? sourceCharacter.investigacion_pasiva,
    puntos_experiencia:
      overrides.puntosExperiencia ?? sourceCharacter.puntos_experiencia,
    fuerza: overrides.fuerza ?? sourceCharacter.fuerza,
    destreza: overrides.destreza ?? sourceCharacter.destreza,
    constitucion: overrides.constitucion ?? sourceCharacter.constitucion,
    inteligencia: overrides.inteligencia ?? sourceCharacter.inteligencia,
    sabiduria: overrides.sabiduria ?? sourceCharacter.sabiduria,
    carisma: overrides.carisma ?? sourceCharacter.carisma,
    partida_aparicion_id: preserveCampaignScopedReferences
      ? sourceCharacter.partida_aparicion_id
      : null,
    partida_defuncion_id: preserveCampaignScopedReferences
      ? sourceCharacter.partida_defuncion_id
      : null,
  }

  if (!copyRelations) {
    return createData
  }

  return {
    ...createData,
    asignaciones_categoria_personaje: {
      create: sourceCharacter.asignaciones_categoria_personaje.map((item) => ({
        categoria_id: item.categoria_id,
      })),
    },
    personaje_clases: {
      create: sourceCharacter.personaje_clases.map((item) => ({
        clase_id: item.clase_id,
        subclase_id: item.subclase_id,
        nivel_clase: item.nivel_clase,
      })),
    },
    personaje_imagenes: {
      create: sourceCharacter.personaje_imagenes.map((item) => ({
        imagen_url: item.imagen_url,
        orden_visualizacion: item.orden_visualizacion,
      })),
    },
    personaje_rasgos: {
      create: sourceCharacter.personaje_rasgos.map((item) => ({
        rasgo_id: item.rasgo_id,
        orden_visualizacion: item.orden_visualizacion,
      })),
    },
    personaje_temas_musicales: {
      create: sourceCharacter.personaje_temas_musicales.map((item) => ({
        musica_url: item.musica_url,
        orden_visualizacion: item.orden_visualizacion,
      })),
    },
  }
}

async function requireTargetCampaignCharacterCreateAccess({
  campaignId,
  req,
  ownerUserId,
}) {
  const campaign = await getCampaignWithMembership(campaignId, req.auth.userId)

  if (!campaign) {
    throw createHttpError(404, 'La campana de destino no existe.')
  }

  const context = getCampaignRoleContext(campaign, req)

  if (!context.isMember) {
    throw createHttpError(
      403,
      'Debes pertenecer a la campana de destino para crear o clonar personajes.'
    )
  }

  if (ownerUserId && ownerUserId !== req.auth.userId && !context.isMaster) {
    throw createHttpError(
      403,
      'Solo el master de la campana de destino puede asignar el personaje a otro usuario.'
    )
  }

  return {
    campaign,
    context,
  }
}

async function createCharacterFromSource({
  sourceCharacterId,
  req,
  targetCampaignId,
  targetAdventureId,
  targetOwnerUserId,
  targetVisibilityCode,
  copyRelations = true,
  linkAsVersion = false,
  explicitBaseCharacterId = null,
  overrides = {},
  auditSummary,
}) {
  const sourceCharacter = await prisma.personajes.findUnique({
    where: { id: sourceCharacterId },
    include: sourceCharacterInclude,
  })

  if (!sourceCharacter) {
    throw createHttpError(404, 'El personaje origen no existe.')
  }

  const { context: targetCampaignContext } =
    await requireTargetCampaignCharacterCreateAccess({
      campaignId: targetCampaignId,
      req,
      ownerUserId: targetOwnerUserId,
    })

  const createdCharacter = await prisma.personajes.create({
    data: buildCharacterCloneData({
      sourceCharacter,
      actorUserId: req.auth.userId,
      targetCampaignId,
      targetAdventureId,
      targetOwnerUserId,
      targetVisibilityCode,
      copyRelations,
      linkAsVersion,
      explicitBaseCharacterId,
      overrides,
    }),
    include: {
      permisos_personaje: {
        where: { usuario_id: req.auth.userId },
        select: { nivel_acceso_codigo: true },
      },
    },
  })

  await logEntityChange({
    tipoEntidadCodigo: 'personaje',
    entidadPk: createdCharacter.id,
    actorUsuarioId: req.auth.userId,
    tipoAccion: 'create',
    resumen: auditSummary,
    valorNuevo: {
      personajeOrigenId: sourceCharacterId,
      campanaDestinoId: targetCampaignId,
      personajeBaseId: createdCharacter.personaje_base_id,
      nombre: createdCharacter.nombre,
      copiaRelaciones: copyRelations,
    },
  })

  return {
    character: createdCharacter,
    access: {
      ...targetCampaignContext,
      isOwner: createdCharacter.propietario_usuario_id === req.auth.userId,
      canView: true,
      canEdit: true,
      viewMode: 'full',
    },
  }
}

async function createCharacterVersion({
  sourceCharacterId,
  req,
  targetCampaignId,
  targetAdventureId,
  targetOwnerUserId,
  targetVisibilityCode,
  copyRelations = true,
  overrides = {},
}) {
  return createCharacterFromSource({
    sourceCharacterId,
    req,
    targetCampaignId,
    targetAdventureId,
    targetOwnerUserId,
    targetVisibilityCode,
    copyRelations,
    linkAsVersion: true,
    auditSummary: 'Nueva version de personaje creada desde la API.',
    overrides,
  })
}

async function cloneCharacter({
  sourceCharacterId,
  req,
  targetCampaignId,
  targetAdventureId,
  targetOwnerUserId,
  targetVisibilityCode,
  copyRelations = true,
  linkAsVersion = false,
  explicitBaseCharacterId = null,
  overrides = {},
}) {
  return createCharacterFromSource({
    sourceCharacterId,
    req,
    targetCampaignId,
    targetAdventureId,
    targetOwnerUserId,
    targetVisibilityCode,
    copyRelations,
    linkAsVersion,
    explicitBaseCharacterId,
    auditSummary: 'Clon de personaje creado desde la API.',
    overrides,
  })
}

async function serializeVisibleVersionCharacter(character, req) {
  const campaign = await getCampaignWithMembership(
    character.campana_id,
    req.auth.userId
  )

  if (!campaign) {
    return null
  }

  const access = getCharacterAccessContext(character, campaign, req)

  if (!access.canView) {
    return null
  }

  return serializeCharacter(character, access)
}

async function listCharacterVersions({ characterId, req }) {
  const currentCharacter = await prisma.personajes.findUnique({
    where: { id: characterId },
    include: {
      permisos_personaje: {
        where: { usuario_id: req.auth.userId },
        select: { nivel_acceso_codigo: true },
      },
    },
  })

  if (!currentCharacter) {
    throw createHttpError(404, 'El personaje indicado no existe.')
  }

  const versionQueryFilters = [{ personaje_base_id: characterId }]

  if (currentCharacter.personaje_base_id) {
    versionQueryFilters.push({ id: currentCharacter.personaje_base_id })
    versionQueryFilters.push({
      personaje_base_id: currentCharacter.personaje_base_id,
      NOT: { id: characterId },
    })
  }

  const relatedCharacters = await prisma.personajes.findMany({
    where: {
      OR: versionQueryFilters,
    },
    include: {
      permisos_personaje: {
        where: { usuario_id: req.auth.userId },
        select: { nivel_acceso_codigo: true },
      },
    },
    orderBy: {
      creado_en: 'asc',
    },
  })

  const baseCharacter = currentCharacter.personaje_base_id
    ? relatedCharacters.find(
        (item) => item.id === currentCharacter.personaje_base_id
      ) || null
    : null

  const directVersions = relatedCharacters.filter(
    (item) => item.personaje_base_id === characterId
  )

  const siblingVersions = currentCharacter.personaje_base_id
    ? relatedCharacters.filter(
        (item) =>
          item.personaje_base_id === currentCharacter.personaje_base_id &&
          item.id !== characterId
      )
    : []

  const [baseItem, directVersionItems, siblingVersionItems] = await Promise.all(
    [
      baseCharacter
        ? serializeVisibleVersionCharacter(baseCharacter, req)
        : null,
      Promise.all(
        directVersions.map((item) =>
          serializeVisibleVersionCharacter(item, req)
        )
      ),
      Promise.all(
        siblingVersions.map((item) =>
          serializeVisibleVersionCharacter(item, req)
        )
      ),
    ]
  )

  return {
    personajeBase: baseItem,
    versionesDerivadas: directVersionItems.filter(Boolean),
    versionesHermana: siblingVersionItems.filter(Boolean),
  }
}

module.exports = {
  cloneCharacter,
  createCharacterVersion,
  listCharacterVersions,
}
