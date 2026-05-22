const { Router } = require('express')
const { z } = require('zod')

const { prisma } = require('../lib/prisma')
const { asyncHandler } = require('../lib/async-handler')
const { requireAuth } = require('../middlewares/auth.middleware')
const { validate } = require('../middlewares/validate.middleware')
const {
  getCampaignRoleContext,
  requireCampaignReadAccess,
  requireCampaignManageAccess,
} = require('../services/campaign-access.service')
const { createHttpError } = require('../lib/errors')
const { logEntityChange } = require('../lib/audit')
const {
  assertManagedImageUrl,
  cleanupCloudinaryAssets,
} = require('../lib/media')
const {
  buildVisibleCharacterWhere,
  listVisibleCharactersPage,
} = require('../services/character-list.service')
const {
  getCharacterAccessContext,
} = require('../services/character-access.service')
const { listVisibleObjects } = require('../services/object.service')
const { listVisiblePlaces } = require('../services/place.service')
const { listPowers } = require('../services/power.service')
const { listSpells } = require('../services/spell.service')
const {
  notifyCampaignPlayerAdded,
  notifyCampaignPlayerRemoved,
  notifyCampaignSessionCreated,
} = require('../services/notification.service')
const {
  NON_ADMIN_USER_WHERE,
  serializeVisibleUser,
} = require('../lib/user-visibility')

const campaignsRouter = Router()

const nullableText = z.string().trim().max(5000).nullable().optional()
const nullableUrl = z.string().url().nullable().optional()
const nullableUuid = z.string().uuid().nullable().optional()
const nullableDate = z
  .string()
  .trim()
  .regex(/^\d{4}-\d{2}-\d{2}$/u)
  .nullable()
  .optional()

const campaignBaseSchema = z.object({
  nombre: z.string().trim().min(1).max(120),
  descripcion: nullableText,
  imagenUrl: nullableUrl,
  privacidadCodigo: z.enum(['publica', 'privada']).optional(),
})

const narrativeBaseSchema = z.object({
  nombre: z.string().trim().min(1).max(160),
  descripcion: nullableText,
  imagenUrl: nullableUrl,
})

const adventurePayloadSchema = narrativeBaseSchema.strict()

const arcPayloadSchema = narrativeBaseSchema
  .extend({
    aventuraId: nullableUuid,
    fechaInicio: nullableDate,
    fechaFin: nullableDate,
  })
  .strict()

const sessionPayloadSchema = narrativeBaseSchema
  .extend({
    aventuraId: nullableUuid,
    arcoId: nullableUuid,
    jugadaEn: z
      .string()
      .trim()
      .regex(/^\d{4}-\d{2}-\d{2}$/u),
  })
  .strict()

const sessionDetailPayloadSchema = sessionPayloadSchema
  .extend({
    galeriaImagenes: z
      .array(
        z
          .object({
            imagenUrl: z.string().url(),
            titulo: z.string().trim().max(120).optional().nullable(),
          })
          .strict()
      )
      .optional(),
    temasMusicales: z
      .array(
        z
          .object({
            titulo: z.string().trim().max(120).optional().nullable(),
            musicaUrl: z.string().url(),
          })
          .strict()
      )
      .optional(),
    personajeIds: z.array(z.string().uuid()).optional(),
  })
  .strict()

const createCampaignSchema = z.object({
  body: campaignBaseSchema.strict(),
  params: z.object({}).strict(),
  query: z.object({}).strict(),
})

const updateCampaignSchema = z.object({
  body: campaignBaseSchema.partial().strict(),
  params: z.object({
    campaignId: z.string().uuid(),
  }),
  query: z.object({}).strict(),
})

const campaignIdSchema = z.object({
  body: z.object({}).strict(),
  params: z.object({
    campaignId: z.string().uuid(),
  }),
  query: z.object({}).strict(),
})

async function assertCampaignNameAvailable(nombre, excludeCampaignId = null) {
  const existingCampaign = await prisma.campanas.findFirst({
    where: {
      nombre: { equals: nombre, mode: 'insensitive' },
      ...(excludeCampaignId ? { id: { not: excludeCampaignId } } : {}),
    },
    select: { id: true },
  })

  if (existingCampaign) {
    throw createHttpError(
      409,
      'Ya existe una campaña con ese nombre. Elige otro nombre para distinguirla.'
    )
  }
}

const campaignPlayerSchema = z.object({
  body: z
    .object({
      usuarioId: z.string().uuid(),
    })
    .strict(),
  params: z.object({
    campaignId: z.string().uuid(),
  }),
  query: z.object({}).strict(),
})

const removeCampaignPlayerSchema = z.object({
  body: z.object({}).strict(),
  params: z.object({
    campaignId: z.string().uuid(),
    userId: z.string().uuid(),
  }),
  query: z.object({}).strict(),
})

const adventureCreateSchema = z.object({
  body: adventurePayloadSchema,
  params: z.object({
    campaignId: z.string().uuid(),
  }),
  query: z.object({}).strict(),
})

const adventureUpdateSchema = z.object({
  body: adventurePayloadSchema.partial().strict(),
  params: z.object({
    campaignId: z.string().uuid(),
    adventureId: z.string().uuid(),
  }),
  query: z.object({}).strict(),
})

const adventureDeleteSchema = z.object({
  body: z.object({}).strict(),
  params: z.object({
    campaignId: z.string().uuid(),
    adventureId: z.string().uuid(),
  }),
  query: z.object({}).strict(),
})

const arcCreateSchema = z.object({
  body: arcPayloadSchema,
  params: z.object({
    campaignId: z.string().uuid(),
  }),
  query: z.object({}).strict(),
})

const arcUpdateSchema = z.object({
  body: arcPayloadSchema.partial().strict(),
  params: z.object({
    campaignId: z.string().uuid(),
    arcId: z.string().uuid(),
  }),
  query: z.object({}).strict(),
})

const arcDeleteSchema = z.object({
  body: z.object({}).strict(),
  params: z.object({
    campaignId: z.string().uuid(),
    arcId: z.string().uuid(),
  }),
  query: z.object({}).strict(),
})

const sessionCreateSchema = z.object({
  body: sessionPayloadSchema,
  params: z.object({
    campaignId: z.string().uuid(),
  }),
  query: z.object({}).strict(),
})

const sessionUpdateSchema = z.object({
  body: sessionPayloadSchema.partial().strict(),
  params: z.object({
    campaignId: z.string().uuid(),
    sessionId: z.string().uuid(),
  }),
  query: z.object({}).strict(),
})

const sessionDetailUpdateSchema = z.object({
  body: sessionDetailPayloadSchema.partial().strict(),
  params: z.object({
    campaignId: z.string().uuid(),
    sessionId: z.string().uuid(),
  }),
  query: z.object({}).strict(),
})

const sessionDeleteSchema = z.object({
  body: z.object({}).strict(),
  params: z.object({
    campaignId: z.string().uuid(),
    sessionId: z.string().uuid(),
  }),
  query: z.object({}).strict(),
})

const combatSnapshotSchema = z
  .object({
    id: z.string().trim().max(120).optional().nullable(),
    name: z.string().trim().min(1).max(180),
    createdAt: z.string().trim().max(80).optional().nullable(),
    finishedAt: z.string().trim().max(80).optional().nullable(),
    round: z.coerce.number().int().min(1).max(9999).optional(),
    turnCount: z.coerce.number().int().min(0).max(999999).optional(),
    combatants: z
      .array(z.record(z.string(), z.unknown()))
      .max(200)
      .optional()
      .default([]),
    events: z.array(z.record(z.string(), z.unknown())).max(5000).optional(),
  })
  .passthrough()

const combatStatsSchema = z.record(z.string(), z.unknown()).optional()

const sessionCombatCreateSchema = z.object({
  body: z
    .object({
      nombre: z.string().trim().min(1).max(180),
      snapshot: combatSnapshotSchema,
      estadisticas: combatStatsSchema,
    })
    .strict(),
  params: z.object({
    campaignId: z.string().uuid(),
    sessionId: z.string().uuid(),
  }),
  query: z.object({}).strict(),
})

const sessionCombatDeleteSchema = z.object({
  body: z.object({}).strict(),
  params: z.object({
    campaignId: z.string().uuid(),
    sessionId: z.string().uuid(),
    combatId: z.string().uuid(),
  }),
  query: z.object({}).strict(),
})

const listCampaignEntriesSchema = z.object({
  body: z.object({}).strict(),
  params: z.object({
    campaignId: z.string().uuid(),
  }),
  query: z.object({
    limit: z.coerce.number().int().min(1).max(100).optional(),
    cursor: z
      .union([z.string().trim().min(1), z.coerce.number().int().min(0)])
      .optional(),
    q: z.string().trim().max(120).optional(),
  }),
})

function toDateOnly(value) {
  if (!value) {
    return null
  }

  return new Date(`${value}T00:00:00.000Z`)
}

function serializeUser(user) {
  return serializeVisibleUser(user)
}

function serializePlayer(membership) {
  const usuario = serializeUser(membership.usuarios)

  if (!usuario) {
    return null
  }

  return {
    id: membership.id,
    usuarioId: membership.usuario_id,
    unidoEn: membership.unido_en,
    usuario,
  }
}

async function getDistinctCampaignContentCounts(campaignIds = []) {
  const ids = [...new Set(campaignIds.filter(Boolean))]

  if (!ids.length) {
    return new Map()
  }

  const countsByCampaignId = new Map(
    ids.map((id) => [
      id,
      {
        objectIds: new Set(),
        placeIds: new Set(),
      },
    ])
  )

  const [legacyObjects, linkedObjects, legacyPlaces, linkedPlaces] =
    await Promise.all([
      prisma.objetos.findMany({
        where: {
          campana_id: { in: ids },
        },
        select: {
          id: true,
          campana_id: true,
        },
      }),
      prisma.objeto_campanas.findMany({
        where: {
          campana_id: { in: ids },
        },
        select: {
          objeto_id: true,
          campana_id: true,
        },
      }),
      prisma.lugares.findMany({
        where: {
          campana_id: { in: ids },
        },
        select: {
          id: true,
          campana_id: true,
        },
      }),
      prisma.lugar_campanas.findMany({
        where: {
          campana_id: { in: ids },
        },
        select: {
          lugar_id: true,
          campana_id: true,
        },
      }),
    ])

  for (const object of legacyObjects) {
    countsByCampaignId.get(object.campana_id)?.objectIds.add(object.id)
  }

  for (const relation of linkedObjects) {
    countsByCampaignId
      .get(relation.campana_id)
      ?.objectIds.add(relation.objeto_id)
  }

  for (const place of legacyPlaces) {
    countsByCampaignId.get(place.campana_id)?.placeIds.add(place.id)
  }

  for (const relation of linkedPlaces) {
    countsByCampaignId.get(relation.campana_id)?.placeIds.add(relation.lugar_id)
  }

  return new Map(
    [...countsByCampaignId.entries()].map(([id, counts]) => [
      id,
      {
        totalObjetos: counts.objectIds.size,
        totalLugares: counts.placeIds.size,
      },
    ])
  )
}

function serializeCampaign(campaign, req, distinctCounts = null) {
  const roleContext = getCampaignRoleContext(campaign, req)
  const counters = campaign._count || {}
  const privacyCode = campaign.privacidad_codigo || 'publica'
  const isPrivate = privacyCode === 'privada'

  return {
    id: campaign.id,
    nombre: campaign.nombre,
    descripcion: campaign.descripcion,
    imagenUrl: campaign.imagen_url,
    masterUsuarioId: campaign.master_usuario_id,
    creadoPorUsuarioId: campaign.creado_por_usuario_id,
    creadoEn: campaign.creado_en,
    actualizadoEn: campaign.actualizado_en,
    estado: 'activa',
    privacidad: {
      codigo: privacyCode,
      nombre: isPrivate ? 'Privada' : 'Pública',
      descripcion: isPrivate
        ? 'Solo master, administradores y jugadores pueden ver la campaña y su contenido.'
        : 'La campaña es visible, y sus elementos respetan su propia privacidad.',
    },
    rolEnCampaña: roleContext.roleInCampaign,
    rolEnCampana: roleContext.roleInCampaign,
    puedeGestionar: roleContext.isMaster,
    esMiembro: roleContext.isMember,
    totalJugadores: counters.campana_jugadores || 0,
    totalAventuras: counters.aventuras || 0,
    totalArcos: counters.arcos || 0,
    totalPartidas: counters.partidas || 0,
    totalPersonajes: counters.personajes || 0,
    totalObjetos:
      distinctCounts?.totalObjetos ??
      (counters.objetos || 0) + (counters.objeto_campanas || 0),
    totalLugares:
      distinctCounts?.totalLugares ??
      (counters.lugares || 0) + (counters.lugar_campanas || 0),
    master: serializeUser(
      campaign.usuarios_campanas_master_usuario_idTousuarios
    ),
  }
}

function serializeAdventure(adventure) {
  return {
    id: adventure.id,
    campanaId: adventure.campana_id,
    nombre: adventure.nombre,
    descripcion: adventure.descripcion,
    imagenUrl: adventure.imagen_url,
    creadoEn: adventure.creado_en,
    actualizadoEn: adventure.actualizado_en,
    totalArcos: adventure._count?.arcos || 0,
    totalPartidas: adventure._count?.partidas || 0,
  }
}

function serializeArc(arc) {
  return {
    id: arc.id,
    campanaId: arc.campana_id,
    aventuraId: arc.aventura_id,
    nombre: arc.nombre,
    descripcion: arc.descripcion,
    imagenUrl: arc.imagen_url,
    fechaInicio: arc.fecha_inicio,
    fechaFin: arc.fecha_fin,
    creadoEn: arc.creado_en,
    actualizadoEn: arc.actualizado_en,
    aventura: arc.aventuras
      ? {
          id: arc.aventuras.id,
          nombre: arc.aventuras.nombre,
        }
      : null,
    totalPartidas: arc._count?.partidas || 0,
  }
}

function serializeSession(session) {
  return {
    id: session.id,
    campanaId: session.campana_id,
    aventuraId: session.aventura_id,
    arcoId: session.arco_id,
    nombre: session.nombre,
    descripcion: session.descripcion,
    imagenUrl: session.imagen_url,
    jugadaEn: session.jugada_en,
    creadoEn: session.creado_en,
    actualizadoEn: session.actualizado_en,
    aventura: session.aventuras
      ? {
          id: session.aventuras.id,
          nombre: session.aventuras.nombre,
        }
      : null,
    arco: session.arcos
      ? {
          id: session.arcos.id,
          nombre: session.arcos.nombre,
        }
      : null,
  }
}

function calculateCombatStatsFromSnapshot(
  snapshot,
  visibleCombatantIds = null
) {
  const events = Array.isArray(snapshot?.events) ? snapshot.events : []
  const isVisible = (combatantId) =>
    !visibleCombatantIds ||
    !combatantId ||
    visibleCombatantIds.has(String(combatantId))
  const stats = {
    danoTotal: 0,
    curacionTotal: 0,
    inconscientes: 0,
    muertes: 0,
    reanimaciones: 0,
    turnos: Number(snapshot?.turnCount || 0),
  }

  for (const event of events) {
    if (!isVisible(event.combatantId)) {
      continue
    }

    const amount = Number(event.amount || 0)

    if (event.type === 'damage' && Number.isFinite(amount)) {
      stats.danoTotal += amount
    } else if (event.type === 'healing' && Number.isFinite(amount)) {
      stats.curacionTotal += amount
    } else if (event.type === 'unconscious') {
      stats.inconscientes += 1
    } else if (event.type === 'death') {
      stats.muertes += 1
    } else if (event.type === 'revive') {
      stats.reanimaciones += 1
    }
  }

  return stats
}

async function serializeCombatsForViewer(combats, req) {
  const safeCombats = combats || []
  const characterIds = [
    ...new Set(
      safeCombats.flatMap((combat) =>
        (combat.snapshot?.combatants || [])
          .map((combatant) => combatant.characterId)
          .filter(Boolean)
      )
    ),
  ]
  const characters = characterIds.length
    ? await prisma.personajes.findMany({
        where: { id: { in: characterIds } },
        include: {
          campanas: {
            include: {
              campana_jugadores: {
                where: { usuario_id: req.auth.userId },
                select: { usuario_id: true },
              },
            },
          },
          permisos_personaje: {
            where: { usuario_id: req.auth.userId },
            select: { nivel_acceso_codigo: true },
          },
        },
      })
    : []
  const charactersById = new Map(
    characters.map((character) => [character.id, character])
  )

  return safeCombats.map((combat) => {
    const visibleFullCombatantIds = new Set()
    const snapshot = combat.snapshot || {}
    const combatants = (snapshot.combatants || []).map((combatant) => {
      if (!combatant.characterId || combatant.isCustom) {
        visibleFullCombatantIds.add(String(combatant.id))
        return {
          ...combatant,
          visibilidadCombate: 'full',
        }
      }

      const character = charactersById.get(combatant.characterId)

      if (!character) {
        return {
          id: combatant.id,
          characterId: combatant.characterId,
          name: 'Contenido no disponible',
          visibilidadCombate: 'none',
          accesoRestringido: true,
        }
      }

      const access = getCharacterAccessContext(
        character,
        character.campanas,
        req
      )

      if (access.viewMode === 'full') {
        visibleFullCombatantIds.add(String(combatant.id))
        return {
          ...combatant,
          visibilidadCombate: 'full',
          puedeAbrirFicha: true,
        }
      }

      if (access.viewMode === 'preview') {
        return {
          id: combatant.id,
          characterId: combatant.characterId,
          name: combatant.name,
          imageUrl: combatant.imageUrl,
          title: combatant.title,
          visibilidadCombate: 'preview',
          accesoRestringido: true,
        }
      }

      return {
        id: combatant.id,
        characterId: combatant.characterId,
        name: 'Contenido no disponible',
        visibilidadCombate: 'none',
        accesoRestringido: true,
      }
    })
    const visibleEvents = (snapshot.events || []).filter((event) =>
      visibleFullCombatantIds.has(String(event.combatantId))
    )

    return {
      id: combat.id,
      partidaId: combat.partida_id,
      nombre: combat.nombre,
      creadoEn: combat.creado_en,
      actualizadoEn: combat.actualizado_en,
      estadisticas: calculateCombatStatsFromSnapshot(
        snapshot,
        visibleFullCombatantIds
      ),
      snapshot: {
        ...snapshot,
        combatants,
        events: visibleEvents,
      },
    }
  })
}

async function getSessionCombatsForDetail(sessionId) {
  if (typeof prisma.partida_combates?.findMany !== 'function') {
    return []
  }

  try {
    return await prisma.partida_combates.findMany({
      where: { partida_id: sessionId },
      orderBy: [{ creado_en: 'desc' }],
    })
  } catch (error) {
    if (error?.code === 'P2021' || error?.code === 'P2022') {
      return []
    }

    throw error
  }
}

async function serializeSessionDetail(session, req) {
  const base = serializeSession(session)
  const roleContext = getCampaignRoleContext(session.campanas, req)
  const sessionCombats =
    session.partida_combates || (await getSessionCombatsForDetail(session.id))

  return {
    ...base,
    puedeGestionar: roleContext.isMaster,
    creador: serializeUser(session.usuarios),
    campana: session.campanas
      ? {
          id: session.campanas.id,
          nombre: session.campanas.nombre,
        }
      : null,
    galeriaImagenes: (session.partida_imagenes || []).map((image) => ({
      id: image.id,
      imagenUrl: image.imagen_url,
      titulo: image.titulo,
      ordenVisualizacion: image.orden_visualizacion,
    })),
    temasMusicales: (session.partida_temas_musicales || []).map((item) => ({
      id: item.id,
      titulo: item.titulo,
      musicaUrl: item.musica_url,
      ordenVisualizacion: item.orden_visualizacion,
    })),
    personajes: (session.partida_personajes || []).map((item) => ({
      id: item.personajes.id,
      nombre: item.personajes.nombre,
      titulo: item.personajes.titulo,
      imagenPrincipalUrl: item.personajes.imagen_principal_url,
      ordenVisualizacion: item.orden_visualizacion,
    })),
    combates: await serializeCombatsForViewer(sessionCombats, req),
  }
}

function getSessionDetailInclude(userId) {
  return {
    aventuras: { select: { id: true, nombre: true } },
    arcos: { select: { id: true, nombre: true } },
    usuarios: { include: { roles: true } },
    campanas: {
      include: {
        campana_jugadores: {
          where: { usuario_id: userId },
          select: { usuario_id: true },
        },
      },
    },
    partida_imagenes: {
      orderBy: [{ orden_visualizacion: 'asc' }, { creado_en: 'asc' }],
    },
    partida_temas_musicales: {
      orderBy: [{ orden_visualizacion: 'asc' }, { creado_en: 'asc' }],
    },
    partida_personajes: {
      orderBy: [{ orden_visualizacion: 'asc' }, { creado_en: 'asc' }],
      include: {
        personajes: {
          select: {
            id: true,
            nombre: true,
            titulo: true,
            imagen_principal_url: true,
          },
        },
      },
    },
  }
}

async function getCampaignDetail(campaignId, req) {
  const campaign = await prisma.campanas.findUnique({
    where: { id: campaignId },
    include: {
      usuarios_campanas_master_usuario_idTousuarios: {
        include: { roles: true },
      },
      campana_jugadores: {
        include: {
          usuarios: {
            include: {
              roles: true,
            },
          },
        },
        orderBy: {
          unido_en: 'asc',
        },
      },
      aventuras: {
        include: {
          _count: {
            select: {
              arcos: true,
              partidas: true,
            },
          },
        },
        orderBy: [{ creado_en: 'desc' }, { nombre: 'asc' }],
      },
      arcos: {
        include: {
          aventuras: {
            select: {
              id: true,
              nombre: true,
            },
          },
          _count: {
            select: {
              partidas: true,
            },
          },
        },
        orderBy: [{ creado_en: 'desc' }, { nombre: 'asc' }],
      },
      partidas: {
        include: {
          aventuras: {
            select: {
              id: true,
              nombre: true,
            },
          },
          arcos: {
            select: {
              id: true,
              nombre: true,
            },
          },
        },
        orderBy: [{ jugada_en: 'desc' }, { creado_en: 'desc' }],
      },
      _count: {
        select: {
          campana_jugadores: true,
          aventuras: true,
          arcos: true,
          partidas: true,
          personajes: true,
          objetos: true,
          objeto_campanas: true,
          lugares: true,
          lugar_campanas: true,
        },
      },
    },
  })

  if (!campaign) {
    throw createHttpError(404, 'La campaña indicada no existe.')
  }

  const distinctCounts = await getDistinctCampaignContentCounts([campaignId])

  return {
    item: serializeCampaign(campaign, req, distinctCounts.get(campaignId)),
    jugadores: campaign.campana_jugadores.map(serializePlayer).filter(Boolean),
    aventuras: campaign.aventuras.map(serializeAdventure),
    arcos: campaign.arcos.map(serializeArc),
    partidas: campaign.partidas.map(serializeSession),
  }
}

async function assertAdventureBelongsToCampaign(adventureId, campaignId) {
  if (!adventureId) {
    return null
  }

  const adventure = await prisma.aventuras.findFirst({
    where: { id: adventureId, campana_id: campaignId },
    select: { id: true },
  })

  if (!adventure) {
    throw createHttpError(
      400,
      'La aventura seleccionada no pertenece a esta campaña.'
    )
  }

  return adventure.id
}

async function assertArcBelongsToCampaign(arcId, campaignId) {
  if (!arcId) {
    return null
  }

  const arc = await prisma.arcos.findFirst({
    where: { id: arcId, campana_id: campaignId },
    select: { id: true },
  })

  if (!arc) {
    throw createHttpError(
      400,
      'El arco seleccionado no pertenece a esta campaña.'
    )
  }

  return arc.id
}

async function resolveSessionLinks({ campaignId, aventuraId, arcoId }) {
  const arc = arcoId
    ? await prisma.arcos.findFirst({
        where: { id: arcoId, campana_id: campaignId },
        select: { id: true, aventura_id: true },
      })
    : null

  if (arcoId && !arc) {
    throw createHttpError(
      400,
      'El arco seleccionado no pertenece a esta campaña.'
    )
  }

  const adventureId = await assertAdventureBelongsToCampaign(
    aventuraId || arc?.aventura_id || null,
    campaignId
  )

  if (arc?.aventura_id && aventuraId && arc.aventura_id !== aventuraId) {
    throw createHttpError(
      400,
      'La partida no puede pertenecer a una aventura distinta de la aventura del arco seleccionado.'
    )
  }

  return {
    adventureId,
    arcId: arc?.id || null,
  }
}

async function serializeAndReturnDetail(res, campaignId, req) {
  const detail = await getCampaignDetail(campaignId, req)
  res.json(detail)
}

campaignsRouter.use(requireAuth)

campaignsRouter.get(
  '/',
  asyncHandler(async (req, res) => {
    const where =
      req.auth.roleCode === 'administrador'
        ? {}
        : {
            OR: [
              { master_usuario_id: req.auth.userId },
              { privacidad_codigo: 'publica' },
              {
                campana_jugadores: {
                  some: {
                    usuario_id: req.auth.userId,
                  },
                },
              },
            ],
          }

    const campaigns = await prisma.campanas.findMany({
      where,
      include: {
        usuarios_campanas_master_usuario_idTousuarios: {
          include: { roles: true },
        },
        campana_jugadores: {
          where: { usuario_id: req.auth.userId },
          select: {
            usuario_id: true,
          },
        },
        _count: {
          select: {
            campana_jugadores: true,
            aventuras: true,
            arcos: true,
            partidas: true,
            personajes: true,
            objetos: true,
            objeto_campanas: true,
            lugares: true,
            lugar_campanas: true,
          },
        },
      },
      orderBy: {
        actualizado_en: 'desc',
      },
    })

    const distinctCounts = await getDistinctCampaignContentCounts(
      campaigns.map((campaign) => campaign.id)
    )

    res.json({
      items: campaigns.map((campaign) =>
        serializeCampaign(campaign, req, distinctCounts.get(campaign.id))
      ),
    })
  })
)

campaignsRouter.get(
  '/user-options',
  asyncHandler(async (_req, res) => {
    const users = await prisma.usuarios.findMany({
      where: NON_ADMIN_USER_WHERE,
      include: {
        roles: true,
      },
      orderBy: {
        nombre_usuario: 'asc',
      },
    })

    res.json({
      items: users.map(serializeUser),
    })
  })
)

campaignsRouter.post(
  '/',
  validate(createCampaignSchema),
  asyncHandler(async (req, res) => {
    const data = req.validated.body

    await assertCampaignNameAvailable(data.nombre)

    await assertManagedImageUrl(data.imagenUrl, {
      entityLabel: 'La imagen de campaña',
    })

    const campaign = await prisma.campanas.create({
      data: {
        nombre: data.nombre,
        descripcion: data.descripcion || null,
        imagen_url: data.imagenUrl || null,
        privacidad_codigo: data.privacidadCodigo || 'publica',
        master_usuario_id: req.auth.userId,
        creado_por_usuario_id: req.auth.userId,
      },
    })

    await logEntityChange({
      tipoEntidadCodigo: 'campana',
      entidadPk: campaign.id,
      actorUsuarioId: req.auth.userId,
      tipoAccion: 'create',
      resumen: 'Campaña creada desde la API específica.',
      valorNuevo: {
        nombre: campaign.nombre,
      },
    })

    const detail = await getCampaignDetail(campaign.id, req)
    res.status(201).json(detail)
  })
)

campaignsRouter.get(
  '/:campaignId',
  validate(campaignIdSchema),
  asyncHandler(async (req, res) => {
    const { campaignId } = req.validated.params
    await requireCampaignReadAccess(campaignId, req)
    await serializeAndReturnDetail(res, campaignId, req)
  })
)

campaignsRouter.patch(
  '/:campaignId',
  validate(updateCampaignSchema),
  asyncHandler(async (req, res) => {
    const { campaignId } = req.validated.params
    const data = req.validated.body
    await requireCampaignManageAccess(campaignId, req)

    if (data.nombre !== undefined) {
      await assertCampaignNameAvailable(data.nombre, campaignId)
    }

    const existingCampaign = await prisma.campanas.findUnique({
      where: { id: campaignId },
      select: {
        imagen_url: true,
      },
    })

    await assertManagedImageUrl(data.imagenUrl, {
      entityLabel: 'La imagen de campaña',
    })

    const updatedCampaign = await prisma.campanas.update({
      where: { id: campaignId },
      data: {
        nombre: data.nombre,
        descripcion:
          data.descripcion === undefined ? undefined : data.descripcion || null,
        imagen_url:
          data.imagenUrl === undefined ? undefined : data.imagenUrl || null,
        privacidad_codigo: data.privacidadCodigo,
        actualizado_en: new Date(),
      },
    })

    if (
      data.imagenUrl !== undefined &&
      existingCampaign?.imagen_url &&
      existingCampaign.imagen_url !== updatedCampaign.imagen_url
    ) {
      await cleanupCloudinaryAssets([existingCampaign.imagen_url])
    }

    await logEntityChange({
      tipoEntidadCodigo: 'campana',
      entidadPk: campaignId,
      actorUsuarioId: req.auth.userId,
      tipoAccion: 'update',
      resumen: 'Campaña actualizada.',
      valorNuevo: data,
    })

    await serializeAndReturnDetail(res, campaignId, req)
  })
)

campaignsRouter.delete(
  '/:campaignId',
  validate(campaignIdSchema),
  asyncHandler(async (req) => {
    await requireCampaignManageAccess(req.validated.params.campaignId, req)
    throw createHttpError(
      403,
      'La eliminación manual de campañas está deshabilitada. Se gestionará desde administración.'
    )
  })
)

campaignsRouter.get(
  '/:campaignId/characters',
  validate(listCampaignEntriesSchema),
  asyncHandler(async (req, res) => {
    const { campaignId } = req.validated.params
    const limit = req.validated.query.limit || 10
    const cursor = req.validated.query.cursor || null
    await requireCampaignReadAccess(campaignId, req)

    const search = req.validated.query.q || ''
    const searchWhere = search
      ? {
          OR: [
            { nombre: { contains: search, mode: 'insensitive' } },
            { titulo: { contains: search, mode: 'insensitive' } },
          ],
        }
      : {}
    const baseWhere = { campana_id: campaignId, ...searchWhere }
    const totalVisible =
      req.auth.roleCode === 'administrador'
        ? await prisma.personajes.count({ where: baseWhere })
        : await prisma.personajes.count({
            where: buildVisibleCharacterWhere(req.auth.userId, baseWhere),
          })
    const page = await listVisibleCharactersPage({
      req,
      baseWhere,
      limit,
      cursor,
    })

    res.json({
      items: page.items,
      meta: {
        limit,
        returned: page.items.length,
        totalVisible,
        nextCursor: page.nextCursor,
        hasMore: page.hasMore,
      },
    })
  })
)

campaignsRouter.get(
  '/:campaignId/objects',
  validate(listCampaignEntriesSchema),
  asyncHandler(async (req, res) => {
    const { campaignId } = req.validated.params
    await requireCampaignReadAccess(campaignId, req)

    const result = await listVisibleObjects({
      req,
      limit: req.validated.query.limit || 10,
      cursor: Number(req.validated.query.cursor || 0),
      baseWhere: {
        OR: [
          { campana_id: campaignId },
          { objeto_campanas: { some: { campana_id: campaignId } } },
        ],
      },
    })

    res.json(result)
  })
)

campaignsRouter.get(
  '/:campaignId/places',
  validate(listCampaignEntriesSchema),
  asyncHandler(async (req, res) => {
    const { campaignId } = req.validated.params
    await requireCampaignReadAccess(campaignId, req)

    const result = await listVisiblePlaces({
      req,
      limit: req.validated.query.limit || 10,
      cursor: Number(req.validated.query.cursor || 0),
      baseWhere: {
        OR: [
          { campana_id: campaignId },
          { lugar_campanas: { some: { campana_id: campaignId } } },
        ],
      },
    })

    res.json(result)
  })
)

campaignsRouter.get(
  '/:campaignId/spells',
  validate(listCampaignEntriesSchema),
  asyncHandler(async (req, res) => {
    const { campaignId } = req.validated.params
    await requireCampaignReadAccess(campaignId, req)

    const result = await listSpells({
      req,
      limit: req.validated.query.limit || 10,
      cursor: Number(req.validated.query.cursor || 0),
      filters: {
        q: req.validated.query.q,
        campaignId,
      },
    })

    res.json(result)
  })
)

campaignsRouter.get(
  '/:campaignId/powers',
  validate(listCampaignEntriesSchema),
  asyncHandler(async (req, res) => {
    const { campaignId } = req.validated.params
    await requireCampaignReadAccess(campaignId, req)

    const result = await listPowers({
      req,
      limit: req.validated.query.limit || 10,
      cursor: Number(req.validated.query.cursor || 0),
      filters: {
        q: req.validated.query.q,
        campaignId,
      },
    })

    res.json(result)
  })
)

campaignsRouter.get(
  '/:campaignId/players',
  validate(campaignIdSchema),
  asyncHandler(async (req, res) => {
    const { campaignId } = req.validated.params
    await requireCampaignReadAccess(campaignId, req)

    const players = await prisma.campana_jugadores.findMany({
      where: {
        campana_id: campaignId,
      },
      include: {
        usuarios: {
          include: {
            roles: true,
          },
        },
      },
      orderBy: {
        unido_en: 'asc',
      },
    })

    res.json({
      items: players.map(serializePlayer),
    })
  })
)

campaignsRouter.post(
  '/:campaignId/players',
  validate(campaignPlayerSchema),
  asyncHandler(async (req, res) => {
    const { campaignId } = req.validated.params
    const { usuarioId } = req.validated.body
    const campaign = await requireCampaignManageAccess(campaignId, req)

    if (campaign.master_usuario_id === usuarioId) {
      throw createHttpError(
        400,
        'El master principal ya forma parte de la campaña.'
      )
    }

    const user = await prisma.usuarios.findUnique({
      where: { id: usuarioId },
      include: {
        roles: true,
      },
    })

    if (!user) {
      throw createHttpError(404, 'El usuario indicado no existe.')
    }

    if (user.roles.codigo === 'administrador') {
      throw createHttpError(
        400,
        'No es necesario añadir administradores como jugadores de campaña.'
      )
    }

    const existingMembership = await prisma.campana_jugadores.findFirst({
      where: {
        campana_id: campaignId,
        usuario_id: usuarioId,
      },
      include: {
        usuarios: {
          include: {
            roles: true,
          },
        },
      },
    })
    const player =
      existingMembership ||
      (await prisma.campana_jugadores.create({
        data: {
          campana_id: campaignId,
          usuario_id: usuarioId,
        },
        include: {
          usuarios: {
            include: {
              roles: true,
            },
          },
        },
      }))

    await logEntityChange({
      tipoEntidadCodigo: 'campana',
      entidadPk: campaignId,
      actorUsuarioId: req.auth.userId,
      tipoAccion: 'permission_change',
      resumen: 'Jugador añadido a la campaña.',
      valorNuevo: {
        usuarioId,
      },
    })

    if (!existingMembership) {
      await notifyCampaignPlayerAdded({
        campaign,
        usuarioId,
        actorUsuarioId: req.auth.userId,
      }).catch((error) => {
        console.warn(
          'No se pudo crear la notificación de jugador añadido:',
          error
        )
      })
    }

    res.status(201).json({
      item: serializePlayer(player),
    })
  })
)

campaignsRouter.delete(
  '/:campaignId/players/:userId',
  validate(removeCampaignPlayerSchema),
  asyncHandler(async (req, res) => {
    const { campaignId, userId } = req.validated.params
    const campaign = await requireCampaignManageAccess(campaignId, req)

    if (campaign.master_usuario_id === userId) {
      throw createHttpError(
        400,
        'No puedes eliminar al master principal de la campaña desde esta ruta.'
      )
    }

    const membership = await prisma.campana_jugadores.findFirst({
      where: {
        campana_id: campaignId,
        usuario_id: userId,
      },
      select: {
        id: true,
      },
    })

    if (!membership) {
      throw createHttpError(
        404,
        'Ese usuario no figura como jugador de esta campaña.'
      )
    }

    await prisma.campana_jugadores.delete({
      where: {
        id: membership.id,
      },
    })

    await logEntityChange({
      tipoEntidadCodigo: 'campana',
      entidadPk: campaignId,
      actorUsuarioId: req.auth.userId,
      tipoAccion: 'permission_change',
      resumen: 'Jugador eliminado de la campaña.',
      valorNuevo: {
        usuarioId: userId,
      },
    })

    await notifyCampaignPlayerRemoved({
      campaign,
      usuarioId: userId,
      actorUsuarioId: req.auth.userId,
    }).catch((error) => {
      console.warn(
        'No se pudo crear la notificación de jugador eliminado:',
        error
      )
    })

    res.status(204).send()
  })
)

campaignsRouter.get(
  '/:campaignId/adventures',
  validate(campaignIdSchema),
  asyncHandler(async (req, res) => {
    const { campaignId } = req.validated.params
    await requireCampaignReadAccess(campaignId, req)

    const adventures = await prisma.aventuras.findMany({
      where: {
        campana_id: campaignId,
      },
      include: {
        _count: {
          select: {
            arcos: true,
            partidas: true,
          },
        },
      },
      orderBy: {
        creado_en: 'desc',
      },
    })

    res.json({
      items: adventures.map(serializeAdventure),
    })
  })
)

campaignsRouter.post(
  '/:campaignId/adventures',
  validate(adventureCreateSchema),
  asyncHandler(async (req, res) => {
    const { campaignId } = req.validated.params
    const data = req.validated.body
    await requireCampaignManageAccess(campaignId, req)

    await assertManagedImageUrl(data.imagenUrl, {
      entityLabel: 'La imagen de aventura',
    })

    const adventure = await prisma.aventuras.create({
      data: {
        campana_id: campaignId,
        nombre: data.nombre,
        descripcion: data.descripcion || null,
        imagen_url: data.imagenUrl || null,
        creado_por_usuario_id: req.auth.userId,
      },
      include: {
        _count: {
          select: { arcos: true, partidas: true },
        },
      },
    })

    await logEntityChange({
      tipoEntidadCodigo: 'aventura',
      entidadPk: adventure.id,
      actorUsuarioId: req.auth.userId,
      tipoAccion: 'create',
      resumen: 'Aventura creada dentro de una campaña.',
      valorNuevo: {
        campanaId: campaignId,
        nombre: adventure.nombre,
      },
    })

    res.status(201).json({
      item: serializeAdventure(adventure),
    })
  })
)

campaignsRouter.patch(
  '/:campaignId/adventures/:adventureId',
  validate(adventureUpdateSchema),
  asyncHandler(async (req, res) => {
    const { campaignId, adventureId } = req.validated.params
    const data = req.validated.body
    await requireCampaignManageAccess(campaignId, req)
    await assertAdventureBelongsToCampaign(adventureId, campaignId)

    const previous = await prisma.aventuras.findUnique({
      where: { id: adventureId },
      select: { imagen_url: true },
    })

    await assertManagedImageUrl(data.imagenUrl, {
      entityLabel: 'La imagen de aventura',
    })

    const adventure = await prisma.aventuras.update({
      where: { id: adventureId },
      data: {
        nombre: data.nombre,
        descripcion:
          data.descripcion === undefined ? undefined : data.descripcion || null,
        imagen_url:
          data.imagenUrl === undefined ? undefined : data.imagenUrl || null,
        actualizado_en: new Date(),
      },
      include: {
        _count: {
          select: { arcos: true, partidas: true },
        },
      },
    })

    if (
      data.imagenUrl !== undefined &&
      previous?.imagen_url &&
      previous.imagen_url !== adventure.imagen_url
    ) {
      await cleanupCloudinaryAssets([previous.imagen_url])
    }

    res.json({ item: serializeAdventure(adventure) })
  })
)

campaignsRouter.delete(
  '/:campaignId/adventures/:adventureId',
  validate(adventureDeleteSchema),
  asyncHandler(async (req, res) => {
    const { campaignId, adventureId } = req.validated.params
    await requireCampaignManageAccess(campaignId, req)
    await assertAdventureBelongsToCampaign(adventureId, campaignId)

    const previous = await prisma.aventuras.findUnique({
      where: { id: adventureId },
      select: { imagen_url: true },
    })

    await prisma.aventuras.delete({ where: { id: adventureId } })
    await cleanupCloudinaryAssets([previous?.imagen_url])
    res.status(204).send()
  })
)

campaignsRouter.post(
  '/:campaignId/arcs',
  validate(arcCreateSchema),
  asyncHandler(async (req, res) => {
    const { campaignId } = req.validated.params
    const data = req.validated.body
    await requireCampaignManageAccess(campaignId, req)
    const adventureId = await assertAdventureBelongsToCampaign(
      data.aventuraId,
      campaignId
    )

    await assertManagedImageUrl(data.imagenUrl, {
      entityLabel: 'La imagen de arco',
    })

    const arc = await prisma.arcos.create({
      data: {
        campana_id: campaignId,
        aventura_id: adventureId,
        nombre: data.nombre,
        descripcion: data.descripcion || null,
        imagen_url: data.imagenUrl || null,
        fecha_inicio: toDateOnly(data.fechaInicio),
        fecha_fin: toDateOnly(data.fechaFin),
        creado_por_usuario_id: req.auth.userId,
      },
      include: {
        aventuras: { select: { id: true, nombre: true } },
        _count: { select: { partidas: true } },
      },
    })

    res.status(201).json({ item: serializeArc(arc) })
  })
)

campaignsRouter.patch(
  '/:campaignId/arcs/:arcId',
  validate(arcUpdateSchema),
  asyncHandler(async (req, res) => {
    const { campaignId, arcId } = req.validated.params
    const data = req.validated.body
    await requireCampaignManageAccess(campaignId, req)
    await assertArcBelongsToCampaign(arcId, campaignId)
    const adventureId = await assertAdventureBelongsToCampaign(
      data.aventuraId,
      campaignId
    )
    const previous = await prisma.arcos.findUnique({
      where: { id: arcId },
      select: { imagen_url: true },
    })

    await assertManagedImageUrl(data.imagenUrl, {
      entityLabel: 'La imagen de arco',
    })

    const arc = await prisma.arcos.update({
      where: { id: arcId },
      data: {
        nombre: data.nombre,
        descripcion:
          data.descripcion === undefined ? undefined : data.descripcion || null,
        imagen_url:
          data.imagenUrl === undefined ? undefined : data.imagenUrl || null,
        aventura_id:
          data.aventuraId === undefined ? undefined : adventureId || null,
        fecha_inicio:
          data.fechaInicio === undefined
            ? undefined
            : toDateOnly(data.fechaInicio),
        fecha_fin:
          data.fechaFin === undefined ? undefined : toDateOnly(data.fechaFin),
        actualizado_en: new Date(),
      },
      include: {
        aventuras: { select: { id: true, nombre: true } },
        _count: { select: { partidas: true } },
      },
    })

    if (
      data.imagenUrl !== undefined &&
      previous?.imagen_url &&
      previous.imagen_url !== arc.imagen_url
    ) {
      await cleanupCloudinaryAssets([previous.imagen_url])
    }

    res.json({ item: serializeArc(arc) })
  })
)

campaignsRouter.delete(
  '/:campaignId/arcs/:arcId',
  validate(arcDeleteSchema),
  asyncHandler(async (req, res) => {
    const { campaignId, arcId } = req.validated.params
    await requireCampaignManageAccess(campaignId, req)
    await assertArcBelongsToCampaign(arcId, campaignId)
    const previous = await prisma.arcos.findUnique({
      where: { id: arcId },
      select: { imagen_url: true },
    })

    await prisma.arcos.delete({ where: { id: arcId } })
    await cleanupCloudinaryAssets([previous?.imagen_url])
    res.status(204).send()
  })
)

campaignsRouter.post(
  '/:campaignId/sessions',
  validate(sessionCreateSchema),
  asyncHandler(async (req, res) => {
    const { campaignId } = req.validated.params
    const data = req.validated.body
    await requireCampaignManageAccess(campaignId, req)
    const { adventureId, arcId } = await resolveSessionLinks({
      campaignId,
      aventuraId: data.aventuraId,
      arcoId: data.arcoId,
    })

    await assertManagedImageUrl(data.imagenUrl, {
      entityLabel: 'La imagen de partida',
    })

    const session = await prisma.partidas.create({
      data: {
        campana_id: campaignId,
        aventura_id: adventureId,
        arco_id: arcId,
        nombre: data.nombre,
        descripcion: data.descripcion || null,
        imagen_url: data.imagenUrl || null,
        jugada_en: toDateOnly(data.jugadaEn),
        creado_por_usuario_id: req.auth.userId,
      },
      include: {
        aventuras: { select: { id: true, nombre: true } },
        arcos: { select: { id: true, nombre: true } },
        campanas: { select: { id: true, nombre: true } },
      },
    })

    await notifyCampaignSessionCreated({
      campaignId,
      campaignName: session.campanas?.nombre || 'la campaña',
      sessionId: session.id,
      sessionName: session.nombre,
      actorUsuarioId: req.auth.userId,
    }).catch((error) => {
      console.warn('No se pudo crear la notificación de partida:', error)
    })

    res.status(201).json({ item: serializeSession(session) })
  })
)

campaignsRouter.patch(
  '/:campaignId/sessions/:sessionId',
  validate(sessionUpdateSchema),
  asyncHandler(async (req, res) => {
    const { campaignId, sessionId } = req.validated.params
    const data = req.validated.body
    await requireCampaignManageAccess(campaignId, req)

    const previous = await prisma.partidas.findFirst({
      where: { id: sessionId, campana_id: campaignId },
      select: { id: true, imagen_url: true },
    })

    if (!previous) {
      throw createHttpError(404, 'La partida indicada no existe.')
    }

    const resolvedLinks =
      data.aventuraId === undefined && data.arcoId === undefined
        ? null
        : await resolveSessionLinks({
            campaignId,
            aventuraId: data.aventuraId,
            arcoId: data.arcoId,
          })

    await assertManagedImageUrl(data.imagenUrl, {
      entityLabel: 'La imagen de partida',
    })

    const session = await prisma.partidas.update({
      where: { id: sessionId },
      data: {
        nombre: data.nombre,
        descripcion:
          data.descripcion === undefined ? undefined : data.descripcion || null,
        imagen_url:
          data.imagenUrl === undefined ? undefined : data.imagenUrl || null,
        aventura_id:
          data.aventuraId === undefined && data.arcoId === undefined
            ? undefined
            : resolvedLinks?.adventureId || null,
        arco_id:
          data.aventuraId === undefined && data.arcoId === undefined
            ? undefined
            : resolvedLinks?.arcId || null,
        jugada_en:
          data.jugadaEn === undefined ? undefined : toDateOnly(data.jugadaEn),
        actualizado_en: new Date(),
      },
      include: {
        aventuras: { select: { id: true, nombre: true } },
        arcos: { select: { id: true, nombre: true } },
      },
    })

    if (
      data.imagenUrl !== undefined &&
      previous?.imagen_url &&
      previous.imagen_url !== session.imagen_url
    ) {
      await cleanupCloudinaryAssets([previous.imagen_url])
    }

    res.json({ item: serializeSession(session) })
  })
)

campaignsRouter.get(
  '/:campaignId/sessions/:sessionId/detail',
  validate(sessionDeleteSchema),
  asyncHandler(async (req, res) => {
    const { campaignId, sessionId } = req.validated.params
    await requireCampaignReadAccess(campaignId, req)

    const session = await prisma.partidas.findFirst({
      where: { id: sessionId, campana_id: campaignId },
      include: getSessionDetailInclude(req.auth.userId),
    })

    if (!session) {
      throw createHttpError(404, 'La partida indicada no existe.')
    }

    res.json({ item: await serializeSessionDetail(session, req) })
  })
)

campaignsRouter.patch(
  '/:campaignId/sessions/:sessionId/detail',
  validate(sessionDetailUpdateSchema),
  asyncHandler(async (req, res) => {
    const { campaignId, sessionId } = req.validated.params
    const data = req.validated.body
    await requireCampaignManageAccess(campaignId, req)

    const previous = await prisma.partidas.findFirst({
      where: { id: sessionId, campana_id: campaignId },
      include: { partida_imagenes: true },
    })

    if (!previous) {
      throw createHttpError(404, 'La partida indicada no existe.')
    }

    const resolvedLinks =
      data.aventuraId === undefined && data.arcoId === undefined
        ? null
        : await resolveSessionLinks({
            campaignId,
            aventuraId: data.aventuraId,
            arcoId: data.arcoId,
          })

    const previousImageUrls = [
      previous.imagen_url,
      ...previous.partida_imagenes.map((image) => image.imagen_url),
    ].filter(Boolean)
    const previousImageUrlSet = new Set(previousImageUrls)
    const imagesToValidate = [
      ...(data.imagenUrl !== undefined &&
      data.imagenUrl &&
      !previousImageUrlSet.has(data.imagenUrl)
        ? [
            {
              imagenUrl: data.imagenUrl,
              entityLabel: 'La imagen de partida',
            },
          ]
        : []),
      ...(data.galeriaImagenes || [])
        .filter(
          (image) =>
            image.imagenUrl && !previousImageUrlSet.has(image.imagenUrl)
        )
        .map((image) => ({
          imagenUrl: image.imagenUrl,
          entityLabel: 'La imagen de galeria de la partida',
        })),
    ]

    await Promise.all(
      imagesToValidate.map((image) =>
        assertManagedImageUrl(image.imagenUrl, {
          entityLabel: image.entityLabel,
        })
      )
    )

    const uniqueCharacterIds = [...new Set(data.personajeIds || [])]

    if (uniqueCharacterIds.length) {
      const count = await prisma.personajes.count({
        where: { id: { in: uniqueCharacterIds }, campana_id: campaignId },
      })

      if (count !== uniqueCharacterIds.length) {
        throw createHttpError(
          400,
          'Alguno de los personajes no pertenece a esta campana.'
        )
      }
    }

    const session = await prisma.$transaction(async (tx) => {
      const updated = await tx.partidas.update({
        where: { id: sessionId },
        data: {
          nombre: data.nombre,
          descripcion:
            data.descripcion === undefined
              ? undefined
              : data.descripcion || null,
          imagen_url:
            data.imagenUrl === undefined ? undefined : data.imagenUrl || null,
          aventura_id:
            data.aventuraId === undefined && data.arcoId === undefined
              ? undefined
              : resolvedLinks?.adventureId || null,
          arco_id:
            data.aventuraId === undefined && data.arcoId === undefined
              ? undefined
              : resolvedLinks?.arcId || null,
          jugada_en:
            data.jugadaEn === undefined ? undefined : toDateOnly(data.jugadaEn),
          actualizado_en: new Date(),
        },
      })

      if (data.galeriaImagenes) {
        await tx.partida_imagenes.deleteMany({
          where: { partida_id: sessionId },
        })
        await tx.partida_imagenes.createMany({
          data: data.galeriaImagenes.map((image, index) => ({
            partida_id: sessionId,
            imagen_url: image.imagenUrl,
            titulo: image.titulo || null,
            orden_visualizacion: index,
          })),
        })
      }

      if (data.temasMusicales) {
        await tx.partida_temas_musicales.deleteMany({
          where: { partida_id: sessionId },
        })
        await tx.partida_temas_musicales.createMany({
          data: data.temasMusicales
            .filter((item) => item.musicaUrl?.trim())
            .map((item, index) => ({
              partida_id: sessionId,
              titulo: item.titulo || null,
              musica_url: item.musicaUrl.trim(),
              orden_visualizacion: index,
            })),
        })
      }

      if (data.personajeIds) {
        await tx.partida_personajes.deleteMany({
          where: { partida_id: sessionId },
        })
        await tx.partida_personajes.createMany({
          data: uniqueCharacterIds.map((personajeId, index) => ({
            partida_id: sessionId,
            personaje_id: personajeId,
            orden_visualizacion: index,
          })),
        })
      }

      return updated
    })

    const nextUrls = [
      session.imagen_url,
      ...(data.galeriaImagenes || []).map((image) => image.imagenUrl),
    ].filter(Boolean)

    await cleanupCloudinaryAssets(
      previousImageUrls.filter((url) => !nextUrls.includes(url))
    )

    const fresh = await prisma.partidas.findUnique({
      where: { id: sessionId },
      include: getSessionDetailInclude(req.auth.userId),
    })

    res.json({ item: await serializeSessionDetail(fresh, req) })
  })
)

campaignsRouter.post(
  '/:campaignId/sessions/:sessionId/combats',
  validate(sessionCombatCreateSchema),
  asyncHandler(async (req, res) => {
    const { campaignId, sessionId } = req.validated.params
    const data = req.validated.body
    const campaign = await requireCampaignReadAccess(campaignId, req)
    const roleContext = getCampaignRoleContext(campaign, req)

    if (!roleContext.isMember) {
      throw createHttpError(
        403,
        'Debes pertenecer a la campana para asociar combates a una partida.'
      )
    }

    const session = await prisma.partidas.findFirst({
      where: { id: sessionId, campana_id: campaignId },
      select: { id: true },
    })

    if (!session) {
      throw createHttpError(404, 'La partida indicada no existe.')
    }

    const combat = await prisma.partida_combates.create({
      data: {
        partida_id: sessionId,
        creado_por_usuario_id: req.auth.userId,
        nombre: data.nombre,
        snapshot: data.snapshot,
        estadisticas: data.estadisticas || {},
      },
    })

    const [item] = await serializeCombatsForViewer([combat], req)

    res.status(201).json({ item })
  })
)

campaignsRouter.delete(
  '/:campaignId/sessions/:sessionId/combats/:combatId',
  validate(sessionCombatDeleteSchema),
  asyncHandler(async (req, res) => {
    const { campaignId, sessionId, combatId } = req.validated.params
    const campaign = await requireCampaignReadAccess(campaignId, req)
    const roleContext = getCampaignRoleContext(campaign, req)
    const combat = await prisma.partida_combates.findFirst({
      where: {
        id: combatId,
        partida_id: sessionId,
        partidas: { campana_id: campaignId },
      },
      select: {
        id: true,
        creado_por_usuario_id: true,
      },
    })

    if (!combat) {
      throw createHttpError(404, 'El combate indicado no existe.')
    }

    if (
      !roleContext.isMaster &&
      combat.creado_por_usuario_id !== req.auth.userId
    ) {
      throw createHttpError(403, 'No tienes permisos para quitar este combate.')
    }

    await prisma.partida_combates.delete({ where: { id: combatId } })
    res.status(204).send()
  })
)

campaignsRouter.delete(
  '/:campaignId/sessions/:sessionId',
  validate(sessionDeleteSchema),
  asyncHandler(async (req, res) => {
    const { campaignId, sessionId } = req.validated.params
    await requireCampaignManageAccess(campaignId, req)
    const previous = await prisma.partidas.findFirst({
      where: { id: sessionId, campana_id: campaignId },
      select: { id: true, imagen_url: true },
    })

    if (!previous) {
      throw createHttpError(404, 'La partida indicada no existe.')
    }

    await prisma.partidas.delete({ where: { id: sessionId } })
    await cleanupCloudinaryAssets([previous?.imagen_url])
    res.status(204).send()
  })
)

module.exports = {
  campaignsRouter,
}
