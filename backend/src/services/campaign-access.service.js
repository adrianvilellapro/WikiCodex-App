const { prisma } = require('../lib/prisma')
const { createHttpError } = require('../lib/errors')

async function getCampaignWithMembership(campaignId, userId) {
  return prisma.campanas.findUnique({
    where: { id: campaignId },
    include: {
      campana_jugadores: {
        where: { usuario_id: userId },
        select: {
          id: true,
          usuario_id: true,
        },
      },
    },
  })
}

function isGlobalAdmin(req) {
  return req.auth.roleCode === 'administrador'
}

function getCampaignRoleContext(campaign, req) {
  if (!campaign) {
    return {
      isAdmin: false,
      isMaster: false,
      isPlayer: false,
      isMember: false,
      isPublic: false,
      canRead: false,
      roleInCampaign: null,
    }
  }

  const isAdmin = isGlobalAdmin(req)
  const isMaster = isAdmin || campaign.master_usuario_id === req.auth.userId
  const isPlayer = campaign.campana_jugadores.some(
    (membership) => membership.usuario_id === req.auth.userId
  )
  const isPublic = campaign.privacidad_codigo !== 'privada'
  const isMember = isMaster || isPlayer
  const canRead = isMember || isPublic

  return {
    isAdmin,
    isMaster,
    isPlayer,
    isMember,
    isPublic,
    canRead,
    roleInCampaign: isMaster ? 'master' : isPlayer ? 'jugador' : 'visitante',
  }
}

function hasCampaignReadAccess(campaign, req) {
  return getCampaignRoleContext(campaign, req).canRead
}

function hasCampaignManageAccess(campaign, req) {
  return getCampaignRoleContext(campaign, req).isMaster
}

async function requireCampaignReadAccess(campaignId, req) {
  const campaign = await getCampaignWithMembership(campaignId, req.auth.userId)

  if (!campaign) {
    throw createHttpError(404, 'La campaña indicada no existe.')
  }

  if (!hasCampaignReadAccess(campaign, req)) {
    throw createHttpError(403, 'No tienes acceso a esta campaña.')
  }

  return campaign
}

async function requireCampaignManageAccess(campaignId, req) {
  const campaign = await getCampaignWithMembership(campaignId, req.auth.userId)

  if (!campaign) {
    throw createHttpError(404, 'La campaña indicada no existe.')
  }

  if (!hasCampaignManageAccess(campaign, req)) {
    throw createHttpError(
      403,
      'No tienes permisos para gestionar esta campaña.'
    )
  }

  return campaign
}

module.exports = {
  getCampaignRoleContext,
  getCampaignWithMembership,
  isGlobalAdmin,
  requireCampaignReadAccess,
  requireCampaignManageAccess,
}
