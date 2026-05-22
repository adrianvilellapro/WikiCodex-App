const { createHttpError } = require('../lib/errors')
const { prisma } = require('../lib/prisma')
const { serializeVisibleUser } = require('../lib/user-visibility')
const {
  getCampaignWithMembership,
  getCampaignRoleContext,
} = require('./campaign-access.service')
const {
  getObjectAccessContext,
  getObjectInclude,
  serializeObject,
} = require('./object.service')
const {
  getPowerAccessContext,
  getPowerInclude,
  serializePower,
} = require('./power.service')

function serializeNullableNumber(value) {
  if (value === null || value === undefined) {
    return null
  }

  return Number(value)
}

async function getCharacterWithContext(characterId, userId) {
  return prisma.personajes.findUnique({
    where: { id: characterId },
    include: {
      tiers_personaje: {
        select: {
          id: true,
          nombre: true,
          orden_visualizacion: true,
        },
      },
      estados_personaje: {
        select: {
          id: true,
          codigo: true,
          nombre: true,
        },
      },
      campanas: {
        select: {
          id: true,
          nombre: true,
          master_usuario_id: true,
          privacidad_codigo: true,
          campana_jugadores: {
            where: { usuario_id: userId },
            select: { usuario_id: true },
          },
        },
      },
      aventuras: {
        select: {
          id: true,
          nombre: true,
        },
      },
      partidas_personajes_partida_aparicion_idTopartidas: {
        select: {
          id: true,
          nombre: true,
          jugada_en: true,
        },
      },
      partidas_personajes_partida_defuncion_idTopartidas: {
        select: {
          id: true,
          nombre: true,
          jugada_en: true,
        },
      },
      permisos_personaje: {
        where: { usuario_id: userId },
        select: {
          nivel_acceso_codigo: true,
        },
      },
      personaje_clases: {
        orderBy: [{ nivel_clase: 'desc' }, { creado_en: 'asc' }],
        include: {
          clases: {
            select: {
              id: true,
              nombre: true,
            },
          },
          subclases: {
            select: {
              id: true,
              nombre: true,
            },
          },
        },
      },
      personaje_rasgos: {
        orderBy: [{ orden_visualizacion: 'asc' }, { creado_en: 'asc' }],
        include: {
          rasgos: {
            include: {
              tipos_rasgo: {
                select: {
                  id: true,
                  nombre: true,
                  orden_visualizacion: true,
                },
              },
            },
          },
        },
      },
      personaje_imagenes: {
        orderBy: [{ orden_visualizacion: 'asc' }, { creado_en: 'asc' }],
        select: {
          id: true,
          imagen_url: true,
          orden_visualizacion: true,
        },
      },
      personaje_temas_musicales: {
        orderBy: [{ orden_visualizacion: 'asc' }, { creado_en: 'asc' }],
        select: {
          id: true,
          titulo: true,
          musica_url: true,
          orden_visualizacion: true,
        },
      },
      personaje_hechizos: {
        orderBy: [{ orden_visualizacion: 'asc' }, { creado_en: 'asc' }],
        include: {
          hechizos: true,
        },
      },
      personaje_objetos: {
        orderBy: [{ orden_visualizacion: 'asc' }, { creado_en: 'asc' }],
        include: {
          objetos: {
            include: getObjectInclude(userId),
          },
        },
      },
      personaje_poderes: {
        orderBy: [{ orden_visualizacion: 'asc' }, { creado_en: 'asc' }],
        include: {
          poderes: {
            include: getPowerInclude(userId),
          },
        },
      },
      asignaciones_categoria_personaje: {
        orderBy: { creado_en: 'asc' },
        include: {
          categorias_personaje: {
            select: {
              id: true,
              nombre: true,
              campana_origen_id: true,
              es_relevante_para_campana_origen: true,
            },
          },
        },
      },
      usuarios_personajes_propietario_usuario_idTousuarios: {
        select: {
          id: true,
          nombre_usuario: true,
          imagen_perfil_url: true,
          roles: {
            select: {
              codigo: true,
              nombre: true,
            },
          },
        },
      },
      usuarios_personajes_creado_por_usuario_idTousuarios: {
        select: {
          id: true,
          nombre_usuario: true,
          imagen_perfil_url: true,
          roles: {
            select: {
              codigo: true,
              nombre: true,
            },
          },
        },
      },
    },
  })
}

function getCharacterAccessContext(character, campaign, req) {
  const campaignContext = getCampaignRoleContext(campaign, req)
  const explicitPermission =
    character.permisos_personaje[0]?.nivel_acceso_codigo || null
  const isOwner = character.propietario_usuario_id === req.auth.userId
  const isPublicPreview =
    character.ambito_visibilidad_codigo === 'campana_vista_previa'
  const isPublicFull =
    character.ambito_visibilidad_codigo === 'campana_completo'

  let canView = false
  let canEdit = false
  let viewMode = 'none'

  if (campaignContext.isMaster || isOwner) {
    canView = true
    canEdit = true
    viewMode = 'full'
  } else if (
    explicitPermission === 'full' ||
    explicitPermission === 'completo'
  ) {
    canView = true
    canEdit = false
    viewMode = 'full'
  } else if (
    explicitPermission === 'vista_previa' ||
    explicitPermission === 'preview'
  ) {
    canView = true
    canEdit = false
    viewMode = 'preview'
  } else if (campaignContext.canRead && isPublicFull) {
    canView = true
    canEdit = false
    viewMode = 'full'
  } else if (campaignContext.canRead && isPublicPreview) {
    canView = true
    canEdit = false
    viewMode = 'preview'
  }

  return {
    ...campaignContext,
    isOwner,
    explicitPermission,
    isPublicPreview,
    isPublicFull,
    canView,
    canEdit,
    viewMode,
  }
}

async function requireCharacterViewAccess(characterId, req) {
  const character = await getCharacterWithContext(characterId, req.auth.userId)

  if (!character) {
    throw createHttpError(404, 'El personaje indicado no existe.')
  }

  const campaign = await getCampaignWithMembership(
    character.campana_id,
    req.auth.userId
  )

  if (!campaign) {
    throw createHttpError(404, 'La campana del personaje ya no existe.')
  }

  const access = getCharacterAccessContext(character, campaign, req)

  if (!access.canView) {
    throw createHttpError(403, 'No tienes permiso para ver este personaje.')
  }

  return {
    character,
    campaign,
    access,
  }
}

async function requireCharacterEditAccess(characterId, req) {
  const context = await requireCharacterViewAccess(characterId, req)

  if (!context.access.canEdit) {
    throw createHttpError(403, 'No tienes permiso para editar este personaje.')
  }

  return context
}

function serializeCharacter(character, access) {
  const base = {
    id: character.id,
    campanaId: character.campana_id,
    aventuraId: character.aventura_id,
    propietarioUsuarioId: character.propietario_usuario_id,
    personajeBaseId: character.personaje_base_id,
    esVersion: Boolean(character.personaje_base_id),
    hechizosSlots: character.hechizos_slots || {},
    nombre: character.nombre,
    titulo: character.titulo,
    descripcion: character.descripcion,
    imagenPrincipalUrl: character.imagen_principal_url,
    ambitoVisibilidadCodigo: character.ambito_visibilidad_codigo,
    creadoEn: character.creado_en,
    actualizadoEn: character.actualizado_en,
    modoVista: access.viewMode,
  }

  if (access.viewMode === 'preview') {
    return base
  }

  return {
    ...base,
    lore: character.lore,
    edad: serializeNullableNumber(character.edad),
    alturaMetros:
      character.altura_metros === null || character.altura_metros === undefined
        ? null
        : Number(character.altura_metros),
    pesoKg:
      character.peso_kg === null || character.peso_kg === undefined
        ? null
        : Number(character.peso_kg),
    esCriatura: character.es_criatura,
    puntosGolpe: serializeNullableNumber(character.puntos_golpe),
    claseArmadura: serializeNullableNumber(character.clase_armadura),
    velocidadPies: serializeNullableNumber(character.velocidad_pies),
    velocidadMetros:
      character.velocidad_metros === null ||
      character.velocidad_metros === undefined
        ? null
        : Number(character.velocidad_metros),
    bonificadorCompetencia: serializeNullableNumber(
      character.bonificador_competencia
    ),
    iniciativa: serializeNullableNumber(character.iniciativa),
    percepcionPasiva: serializeNullableNumber(character.percepcion_pasiva),
    investigacionPasiva: serializeNullableNumber(
      character.investigacion_pasiva
    ),
    puntosExperiencia: serializeNullableNumber(character.puntos_experiencia),
    fuerza: character.fuerza,
    destreza: character.destreza,
    constitucion: character.constitucion,
    inteligencia: character.inteligencia,
    sabiduria: character.sabiduria,
    carisma: character.carisma,
    salvacionFuerza: character.salvacion_fuerza,
    salvacionDestreza: character.salvacion_destreza,
    salvacionConstitucion: character.salvacion_constitucion,
    salvacionInteligencia: character.salvacion_inteligencia,
    salvacionSabiduria: character.salvacion_sabiduria,
    salvacionCarisma: character.salvacion_carisma,
    competenciaSalvacionFuerza: character.competencia_salvacion_fuerza,
    competenciaSalvacionDestreza: character.competencia_salvacion_destreza,
    competenciaSalvacionConstitucion:
      character.competencia_salvacion_constitucion,
    competenciaSalvacionInteligencia:
      character.competencia_salvacion_inteligencia,
    competenciaSalvacionSabiduria: character.competencia_salvacion_sabiduria,
    competenciaSalvacionCarisma: character.competencia_salvacion_carisma,
    partidaAparicionId: character.partida_aparicion_id,
    partidaDefuncionId: character.partida_defuncion_id,
  }
}

function normalizeTraitName(name) {
  if (!name) {
    return name
  }

  return name
    .replace(/\s*\?\s*[^?]+$/u, '')
    .replace(/\s*\|\s*[^|]+$/u, '')
    .trim()
}

function serializeLinkedObject(link, req) {
  const object = link?.objetos

  if (!object || !req) {
    return null
  }

  const access = getObjectAccessContext(object, req)

  if (access.viewMode !== 'full') {
    return null
  }

  return {
    ...serializeObject(object, access),
    linkId: link.id,
    objetoId: object.id,
    mostrarRasgosEnFicha: Boolean(link.mostrar_rasgos_en_ficha),
    ordenVisualizacion: link.orden_visualizacion,
  }
}

function serializeLinkedPower(link, req) {
  const power = link?.poderes

  if (!power || !req) {
    return null
  }

  const access = getPowerAccessContext(power, req)

  if (access.viewMode !== 'full') {
    return null
  }

  return {
    ...serializePower(power, req, access),
    linkId: link.id,
    poderId: power.id,
    ordenVisualizacion: link.orden_visualizacion,
  }
}

function serializeCharacterDetail(character, access, req = null) {
  const baseCharacter = serializeCharacter(character, access)

  const detail = {
    ...baseCharacter,
    puedeEditar: Boolean(access.canEdit),
    puedeEliminar: Boolean(access.canEdit),
    tier: character.tiers_personaje
      ? {
          id: character.tiers_personaje.id,
          nombre: character.tiers_personaje.nombre,
          ordenVisualizacion: character.tiers_personaje.orden_visualizacion,
        }
      : null,
    estado: character.estados_personaje
      ? {
          id: character.estados_personaje.id,
          codigo: character.estados_personaje.codigo,
          nombre: character.estados_personaje.nombre,
        }
      : null,
    campana: character.campanas
      ? {
          id: character.campanas.id,
          nombre: character.campanas.nombre,
        }
      : null,
    aventura: character.aventuras
      ? {
          id: character.aventuras.id,
          nombre: character.aventuras.nombre,
        }
      : null,
    propietario: serializeVisibleUser(
      character.usuarios_personajes_propietario_usuario_idTousuarios
    ),
    creadoPor: serializeVisibleUser(
      character.usuarios_personajes_creado_por_usuario_idTousuarios
    ),
  }

  if (access.viewMode === 'preview') {
    return detail
  }

  const clases = character.personaje_clases.map((item) => ({
    id: item.id,
    nivelClase: item.nivel_clase,
    clase: item.clases
      ? {
          id: item.clases.id,
          nombre: item.clases.nombre,
        }
      : null,
    subclase: item.subclases
      ? {
          id: item.subclases.id,
          nombre: item.subclases.nombre,
        }
      : null,
  }))

  const rasgosPorTipoMap = new Map()

  for (const item of character.personaje_rasgos) {
    const rasgo = item.rasgos
    const tipo = rasgo?.tipos_rasgo

    if (!rasgo || !tipo) {
      continue
    }

    if (!rasgosPorTipoMap.has(tipo.id)) {
      rasgosPorTipoMap.set(tipo.id, {
        id: tipo.id,
        nombre: tipo.nombre,
        ordenVisualizacion: tipo.orden_visualizacion,
        rasgos: [],
      })
    }

    rasgosPorTipoMap.get(tipo.id).rasgos.push({
      id: rasgo.id,
      nombre: normalizeTraitName(rasgo.nombre),
      descripcion: rasgo.descripcion,
      esReutilizable: rasgo.es_reutilizable,
      origenTipo: rasgo.origen_tipo || 'usuario',
      origenEntidadId: rasgo.origen_entidad_id,
      origenEntidadNombre: rasgo.origen_entidad_nombre,
      origenGrupoId: rasgo.origen_grupo_id,
      origenRasgoClave: rasgo.origen_rasgo_clave,
      origenRasgoNombre: rasgo.origen_rasgo_nombre,
      origenDatos: rasgo.origen_datos || {},
      ordenVisualizacion: item.orden_visualizacion,
    })
  }

  const rasgosAgrupados = [...rasgosPorTipoMap.values()]
    .map((grupo) => ({
      ...grupo,
      rasgos: grupo.rasgos.sort(
        (left, right) => left.ordenVisualizacion - right.ordenVisualizacion
      ),
    }))
    .sort((left, right) => left.ordenVisualizacion - right.ordenVisualizacion)

  return {
    ...detail,
    partidaAparicion:
      character.partidas_personajes_partida_aparicion_idTopartidas
        ? {
            id: character.partidas_personajes_partida_aparicion_idTopartidas.id,
            nombre:
              character.partidas_personajes_partida_aparicion_idTopartidas
                .nombre,
            jugadaEn:
              character.partidas_personajes_partida_aparicion_idTopartidas
                .jugada_en,
          }
        : null,
    partidaDefuncion:
      character.partidas_personajes_partida_defuncion_idTopartidas
        ? {
            id: character.partidas_personajes_partida_defuncion_idTopartidas.id,
            nombre:
              character.partidas_personajes_partida_defuncion_idTopartidas
                .nombre,
            jugadaEn:
              character.partidas_personajes_partida_defuncion_idTopartidas
                .jugada_en,
          }
        : null,
    clases,
    totalNivel: clases.reduce(
      (accumulator, item) => accumulator + item.nivelClase,
      0
    ),
    rasgosAgrupados,
    categorias: character.asignaciones_categoria_personaje
      .map((item) => item.categorias_personaje)
      .filter(Boolean)
      .map((categoria) => ({
        id: categoria.id,
        nombre: categoria.nombre,
        campanaOrigenId: categoria.campana_origen_id,
        esRelevanteParaCampanaOrigen:
          categoria.es_relevante_para_campana_origen,
      })),
    galeriaImagenes: character.personaje_imagenes.map((item) => ({
      id: item.id,
      imagenUrl: item.imagen_url,
      ordenVisualizacion: item.orden_visualizacion,
    })),
    temasMusicales: character.personaje_temas_musicales.map((item) => ({
      id: item.id,
      titulo: item.titulo,
      musicaUrl: item.musica_url,
      ordenVisualizacion: item.orden_visualizacion,
    })),
    hechizos: (character.personaje_hechizos || [])
      .map((item) =>
        item.hechizos
          ? {
              id: item.hechizos.id,
              nombre: item.hechizos.nombre,
              nivel: item.hechizos.nivel,
              escuela: item.hechizos.escuela,
              tipoCasteo: item.hechizos.tipo_casteo,
              concentracion: item.hechizos.concentracion,
              clases: item.hechizos.clases || [],
              descripcion: item.hechizos.descripcion,
              ordenVisualizacion: item.orden_visualizacion,
            }
          : null
      )
      .filter(Boolean),
    objetos: (character.personaje_objetos || [])
      .map((item) => serializeLinkedObject(item, req))
      .filter(Boolean),
    poderes: (character.personaje_poderes || [])
      .map((item) => serializeLinkedPower(item, req))
      .filter(Boolean),
  }
}

module.exports = {
  getCharacterAccessContext,
  requireCharacterEditAccess,
  requireCharacterViewAccess,
  serializeCharacter,
  serializeCharacterDetail,
}
