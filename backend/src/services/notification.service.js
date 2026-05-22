const { prisma } = require('../lib/prisma')

const NOTIFICATION_TYPES = {
  CAMPAIGN_PLAYER_ADDED: 'campaign_player_added',
  CAMPAIGN_PLAYER_REMOVED: 'campaign_player_removed',
  CAMPAIGN_SESSION_CREATED: 'campaign_session_created',
  CAMPAIGN_ENTRY_CREATED: 'campaign_entry_created',
  ELEMENT_COMMENT_CREATED: 'element_comment_created',
}

const NOTIFICATION_RETENTION_DAYS = 30
const CLEANUP_INTERVAL_MS = 24 * 60 * 60 * 1000
let cleanupInterval = null

function getRetentionDate() {
  return new Date(
    Date.now() - NOTIFICATION_RETENTION_DAYS * 24 * 60 * 60 * 1000
  )
}

function serializeNotification(item) {
  return {
    id: item.id,
    tipo: item.tipo,
    titulo: item.titulo,
    mensaje: item.mensaje,
    urlDestino: item.url_destino,
    leida: item.leida,
    metadata: item.metadata || {},
    creadoEn: item.creado_en,
  }
}

function uniqueUserIds(userIds) {
  return [...new Set((userIds || []).filter(Boolean))]
}

async function cleanupOldNotifications() {
  await prisma.notificaciones.deleteMany({
    where: {
      creado_en: {
        lt: getRetentionDate(),
      },
    },
  })
}

function startNotificationCleanupJob() {
  if (cleanupInterval) {
    return cleanupInterval
  }

  cleanupOldNotifications().catch((error) => {
    console.warn('No se pudieron limpiar notificaciones antiguas:', error)
  })

  cleanupInterval = setInterval(() => {
    cleanupOldNotifications().catch((error) => {
      console.warn('No se pudieron limpiar notificaciones antiguas:', error)
    })
  }, CLEANUP_INTERVAL_MS)

  cleanupInterval.unref?.()
  return cleanupInterval
}

async function createNotification({
  usuarioId,
  tipo,
  titulo,
  mensaje = null,
  urlDestino = null,
  metadata = {},
  tx = prisma,
}) {
  if (!usuarioId || !tipo || !titulo) {
    return null
  }

  return tx.notificaciones.create({
    data: {
      usuario_id: usuarioId,
      tipo,
      titulo,
      mensaje,
      url_destino: urlDestino,
      metadata,
    },
  })
}

async function createNotificationsForUsers({
  usuarioIds,
  tipo,
  titulo,
  mensaje = null,
  urlDestino = null,
  metadata = {},
  actorUsuarioId = null,
  tx = prisma,
}) {
  const recipients = uniqueUserIds(usuarioIds).filter(
    (usuarioId) => usuarioId !== actorUsuarioId
  )

  if (!recipients.length || !tipo || !titulo) {
    return { count: 0 }
  }

  return tx.notificaciones.createMany({
    data: recipients.map((usuarioId) => ({
      usuario_id: usuarioId,
      tipo,
      titulo,
      mensaje,
      url_destino: urlDestino,
      metadata,
    })),
  })
}

async function notifyCampaignPlayerAdded({
  campaign,
  usuarioId,
  actorUsuarioId,
}) {
  return createNotification({
    usuarioId,
    tipo: NOTIFICATION_TYPES.CAMPAIGN_PLAYER_ADDED,
    titulo: 'Te han añadido a una campaña',
    mensaje: `Ahora formas parte de ${campaign.nombre}.`,
    urlDestino: `/app/campanas/${campaign.id}`,
    metadata: {
      campaignId: campaign.id,
      campaignName: campaign.nombre,
      actorUsuarioId,
    },
  })
}

async function notifyCampaignPlayerRemoved({
  campaign,
  usuarioId,
  actorUsuarioId,
}) {
  return createNotification({
    usuarioId,
    tipo: NOTIFICATION_TYPES.CAMPAIGN_PLAYER_REMOVED,
    titulo: 'Te han quitado de una campaña',
    mensaje: `Ya no figuras como jugador en ${campaign.nombre}.`,
    urlDestino: `/app/campanas/${campaign.id}`,
    metadata: {
      campaignId: campaign.id,
      campaignName: campaign.nombre,
      actorUsuarioId,
    },
  })
}

async function notifyCampaignSessionCreated({
  campaignId,
  campaignName,
  sessionId,
  sessionName,
  actorUsuarioId,
}) {
  const players = await prisma.campana_jugadores.findMany({
    where: { campana_id: campaignId },
    select: { usuario_id: true },
  })

  return createNotificationsForUsers({
    usuarioIds: players.map((player) => player.usuario_id),
    actorUsuarioId,
    tipo: NOTIFICATION_TYPES.CAMPAIGN_SESSION_CREATED,
    titulo: 'Nueva partida creada',
    mensaje: `Se ha creado "${sessionName}" en ${campaignName}.`,
    urlDestino: `/app/campanas/${campaignId}/partidas/${sessionId}`,
    metadata: {
      campaignId,
      campaignName,
      sessionId,
      sessionName,
    },
  })
}

async function notifyMastersOfCampaignEntryCreated({
  entityType,
  entityId,
  entityName,
  campaignIds,
  actorUsuarioId,
}) {
  const uniqueCampaignIds = [...new Set((campaignIds || []).filter(Boolean))]

  if (!uniqueCampaignIds.length) {
    return { count: 0 }
  }

  const campaigns = await prisma.campanas.findMany({
    where: { id: { in: uniqueCampaignIds } },
    select: {
      id: true,
      nombre: true,
      master_usuario_id: true,
    },
  })

  if (!campaigns.length) {
    return { count: 0 }
  }

  const entityLabels = {
    character: 'personaje',
    object: 'objeto',
    place: 'lugar',
  }
  const entityPaths = {
    character: 'personajes',
    object: 'objetos',
    place: 'lugares',
  }
  const label = entityLabels[entityType] || 'elemento'
  const path = entityPaths[entityType] || ''
  const notifications = campaigns
    .filter((campaign) => campaign.master_usuario_id !== actorUsuarioId)
    .map((campaign) => ({
      usuarioId: campaign.master_usuario_id,
      campaign,
    }))

  if (!notifications.length) {
    return { count: 0 }
  }

  return prisma.notificaciones.createMany({
    data: notifications.map(({ usuarioId, campaign }) => ({
      usuario_id: usuarioId,
      tipo: NOTIFICATION_TYPES.CAMPAIGN_ENTRY_CREATED,
      titulo: `Nuevo ${label} en tu campaña`,
      mensaje: `Se ha creado "${entityName}" en ${campaign.nombre}.`,
      url_destino: path
        ? `/app/${path}/${entityId}`
        : `/app/campanas/${campaign.id}`,
      metadata: {
        entityType,
        entityId,
        entityName,
        campaignId: campaign.id,
        campaignName: campaign.nombre,
      },
    })),
  })
}

async function notifyElementCommentCreated({
  ownerUserId,
  actorUsuarioId,
  actorName,
  targetType,
  targetId,
  targetName,
  targetLabel = 'elemento',
  urlDestino,
}) {
  if (!ownerUserId || ownerUserId === actorUsuarioId) {
    return null
  }

  const safeTargetName = targetName || 'Sin nombre'
  const safeActorName = actorName || 'Alguien'

  return createNotification({
    usuarioId: ownerUserId,
    tipo: NOTIFICATION_TYPES.ELEMENT_COMMENT_CREATED,
    titulo: `Nuevo comentario en tu ${targetLabel}`,
    mensaje: `${safeActorName} ha comentado en "${safeTargetName}".`,
    urlDestino,
    metadata: {
      actorUsuarioId,
      targetType,
      targetId,
      targetName: safeTargetName,
      targetLabel,
    },
  })
}

async function listNotificationsForUser({ usuarioId, limit = 20 }) {
  const safeLimit = Math.max(1, Math.min(Number(limit) || 20, 50))
  const [total, unreadCount, items] = await Promise.all([
    prisma.notificaciones.count({ where: { usuario_id: usuarioId } }),
    prisma.notificaciones.count({
      where: { usuario_id: usuarioId, leida: false },
    }),
    prisma.notificaciones.findMany({
      where: { usuario_id: usuarioId },
      orderBy: [{ creado_en: 'desc' }, { id: 'desc' }],
      take: safeLimit,
    }),
  ])

  return {
    items: items.map(serializeNotification),
    meta: {
      total,
      unreadCount,
      limit: safeLimit,
    },
  }
}

async function getNotificationSummary(usuarioId) {
  const [total, unreadCount] = await Promise.all([
    prisma.notificaciones.count({ where: { usuario_id: usuarioId } }),
    prisma.notificaciones.count({
      where: { usuario_id: usuarioId, leida: false },
    }),
  ])

  return { total, unreadCount }
}

async function deleteNotificationForUser({ notificationId, usuarioId }) {
  return prisma.notificaciones.deleteMany({
    where: {
      id: notificationId,
      usuario_id: usuarioId,
    },
  })
}

async function deleteAllNotificationsForUser(usuarioId) {
  return prisma.notificaciones.deleteMany({
    where: {
      usuario_id: usuarioId,
    },
  })
}

module.exports = {
  NOTIFICATION_RETENTION_DAYS,
  NOTIFICATION_TYPES,
  cleanupOldNotifications,
  createNotification,
  createNotificationsForUsers,
  deleteAllNotificationsForUser,
  deleteNotificationForUser,
  getNotificationSummary,
  listNotificationsForUser,
  notifyCampaignPlayerAdded,
  notifyCampaignPlayerRemoved,
  notifyCampaignSessionCreated,
  notifyElementCommentCreated,
  notifyMastersOfCampaignEntryCreated,
  startNotificationCleanupJob,
}
