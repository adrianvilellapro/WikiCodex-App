const { prisma } = require('../lib/prisma')
const { createHttpError } = require('../lib/errors')
const { serializeVisibleUser, isAdminUser } = require('../lib/user-visibility')
const {
  getCampaignRoleContext,
  isGlobalAdmin,
} = require('./campaign-access.service')
const { requireCharacterViewAccess } = require('./character-access.service')
const { requireObjectViewAccess } = require('./object.service')
const { requirePlaceViewAccess } = require('./place.service')
const { requirePowerViewAccess } = require('./power.service')
const { notifyElementCommentCreated } = require('./notification.service')

const COMMENT_MAX_LENGTH = 250

const COMMENT_TARGETS = {
  personaje: {
    entityCode: 'personaje',
    entityName: 'Personaje',
  },
  objeto: {
    entityCode: 'objeto',
    entityName: 'Objeto',
  },
  lugar: {
    entityCode: 'lugar',
    entityName: 'Lugar',
  },
  partida: {
    entityCode: 'partida',
    entityName: 'Partida',
  },
  usuario: {
    entityCode: 'usuario',
    entityName: 'Usuario',
  },
  poder: {
    entityCode: 'poder',
    entityName: 'Poder',
  },
}

function normalizeCommentContent(value) {
  const content = String(value || '').trim()

  if (!content) {
    throw createHttpError(400, 'El comentario no puede estar vacío.')
  }

  if (content.length > COMMENT_MAX_LENGTH) {
    throw createHttpError(
      400,
      `El comentario no puede superar ${COMMENT_MAX_LENGTH} caracteres.`
    )
  }

  return content
}

function assertKnownTarget(targetType) {
  const target = COMMENT_TARGETS[targetType]

  if (!target) {
    throw createHttpError(404, 'El tipo de elemento no admite comentarios.')
  }

  return target
}

function getTargetModeratorFlag(target, req) {
  return Boolean(
    isGlobalAdmin(req) ||
    target.canModerate ||
    (target.ownerUserId && target.ownerUserId === req.auth.userId)
  )
}

async function resolveSessionTarget(targetId, req) {
  const session = await prisma.partidas.findUnique({
    where: { id: targetId },
    include: {
      campanas: {
        include: {
          campana_jugadores: {
            where: { usuario_id: req.auth.userId },
            select: { usuario_id: true },
          },
        },
      },
    },
  })

  if (!session || !session.campanas) {
    throw createHttpError(404, 'La partida indicada no existe.')
  }

  const campaignContext = getCampaignRoleContext(session.campanas, req)

  if (!campaignContext.canRead) {
    throw createHttpError(403, 'No tienes permiso para ver esta partida.')
  }

  return {
    targetType: 'partida',
    targetId: session.id,
    entityCode: 'partida',
    entityName: 'Partida',
    targetName: session.nombre,
    targetLabel: 'partida',
    urlDestino: `/app/campanas/${session.campana_id}/partidas/${session.id}`,
    campanaId: session.campana_id,
    aventuraId: session.aventura_id,
    ownerUserId: session.creado_por_usuario_id,
    canModerate:
      campaignContext.isMaster ||
      session.creado_por_usuario_id === req.auth.userId,
  }
}

async function resolveUserProfileTarget(targetId, req) {
  const user = await prisma.usuarios.findUnique({
    where: { id: targetId },
    include: {
      roles: {
        select: {
          codigo: true,
          nombre: true,
        },
      },
    },
  })

  if (!user || isAdminUser(user)) {
    throw createHttpError(404, 'El perfil indicado no existe.')
  }

  return {
    targetType: 'usuario',
    targetId: user.id,
    entityCode: 'usuario',
    entityName: 'Usuario',
    targetName: user.nombre_usuario,
    targetLabel: 'perfil',
    urlDestino: `/app/perfiles/${user.id}`,
    ownerUserId: user.id,
    canModerate: user.id === req.auth.userId,
  }
}

async function resolveCommentTarget(targetType, targetId, req) {
  assertKnownTarget(targetType)

  if (targetType === 'personaje') {
    const { character, access } = await requireCharacterViewAccess(
      targetId,
      req
    )

    return {
      targetType,
      targetId: character.id,
      entityCode: 'personaje',
      entityName: 'Personaje',
      targetName: character.nombre,
      targetLabel: 'personaje',
      urlDestino: `/app/personajes/${character.id}`,
      campanaId: character.campana_id,
      aventuraId: character.aventura_id,
      ownerUserId: character.propietario_usuario_id,
      canModerate: access.canEdit,
    }
  }

  if (targetType === 'objeto') {
    const { object, access } = await requireObjectViewAccess(targetId, req)

    return {
      targetType,
      targetId: object.id,
      entityCode: 'objeto',
      entityName: 'Objeto',
      targetName: object.nombre,
      targetLabel: 'objeto',
      urlDestino: `/app/objetos/${object.id}`,
      campanaId: object.campana_id,
      aventuraId: object.aventura_id,
      ownerUserId: object.creado_por_usuario_id,
      canModerate: access.canEdit,
    }
  }

  if (targetType === 'lugar') {
    const { place, access } = await requirePlaceViewAccess(targetId, req)

    return {
      targetType,
      targetId: place.id,
      entityCode: 'lugar',
      entityName: 'Lugar',
      targetName: place.nombre,
      targetLabel: 'lugar',
      urlDestino: `/app/lugares/${place.id}`,
      campanaId: place.campana_id,
      aventuraId: place.aventura_id,
      ownerUserId: place.creado_por_usuario_id,
      canModerate: access.canEdit,
    }
  }

  if (targetType === 'poder') {
    const { power, access } = await requirePowerViewAccess({
      req,
      powerId: targetId,
    })

    return {
      targetType,
      targetId: power.id,
      entityCode: 'poder',
      entityName: 'Poder',
      targetName: power.nombre,
      targetLabel: 'poder',
      urlDestino: `/app/poderes/otros/${power.id}`,
      campanaId: power.campana_id,
      ownerUserId: power.creado_por_usuario_id,
      canModerate: access.canEdit,
    }
  }

  if (targetType === 'partida') {
    return resolveSessionTarget(targetId, req)
  }

  return resolveUserProfileTarget(targetId, req)
}

async function resolveTargetFromRegistry(registry, req) {
  return resolveCommentTarget(
    registry.tipo_entidad_codigo,
    registry.entidad_pk,
    req
  )
}

async function ensureRegistryForTarget(target) {
  await prisma.tipos_entidad.upsert({
    where: { codigo: target.entityCode },
    create: {
      codigo: target.entityCode,
      nombre: target.entityName,
    },
    update: {
      nombre: target.entityName,
    },
  })

  return prisma.registro_entidades.upsert({
    where: {
      tipo_entidad_codigo_entidad_pk: {
        tipo_entidad_codigo: target.entityCode,
        entidad_pk: target.targetId,
      },
    },
    create: {
      tipo_entidad_codigo: target.entityCode,
      entidad_pk: target.targetId,
      campana_id: target.campanaId || null,
      aventura_id: target.aventuraId || null,
    },
    update: {
      campana_id: target.campanaId || null,
      aventura_id: target.aventuraId || null,
    },
  })
}

function serializeComment(comment, req, target) {
  const isMine = comment.usuario_id === req.auth.userId
  const canModerateTarget = getTargetModeratorFlag(target, req)

  return {
    id: comment.id,
    contenido: comment.contenido,
    estaEditado: comment.esta_editado,
    creadoEn: comment.creado_en,
    actualizadoEn: comment.actualizado_en,
    autor: serializeVisibleUser(comment.usuarios),
    esMio: isMine,
    puedeEditar: isMine,
    puedeEliminar: isMine || canModerateTarget,
  }
}

async function listCommentsForTarget({ targetType, targetId, req }) {
  const target = await resolveCommentTarget(targetType, targetId, req)
  const registry = await ensureRegistryForTarget(target)
  const comments = await prisma.comentarios.findMany({
    where: {
      registro_entidad_id: registry.id,
      comentario_padre_id: null,
      esta_borrado: false,
    },
    include: {
      usuarios: {
        include: {
          roles: {
            select: {
              codigo: true,
              nombre: true,
            },
          },
        },
      },
    },
    orderBy: [{ creado_en: 'asc' }, { id: 'asc' }],
  })
  const items = comments.map((comment) =>
    serializeComment(comment, req, target)
  )

  return {
    items,
    miComentario: items.find((comment) => comment.esMio) || null,
    meta: {
      total: items.length,
      maxLength: COMMENT_MAX_LENGTH,
    },
  }
}

async function createCommentForTarget({
  targetType,
  targetId,
  contenido,
  req,
}) {
  const target = await resolveCommentTarget(targetType, targetId, req)
  const registry = await ensureRegistryForTarget(target)
  const content = normalizeCommentContent(contenido)
  const existing = await prisma.comentarios.findFirst({
    where: {
      registro_entidad_id: registry.id,
      usuario_id: req.auth.userId,
      comentario_padre_id: null,
      esta_borrado: false,
    },
    select: { id: true },
  })

  if (existing) {
    throw createHttpError(
      409,
      'Ya has comentado este elemento. Puedes editar o borrar tu comentario.'
    )
  }

  const comment = await prisma.comentarios.create({
    data: {
      registro_entidad_id: registry.id,
      usuario_id: req.auth.userId,
      contenido: content,
    },
    include: {
      usuarios: {
        include: {
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

  notifyElementCommentCreated({
    ownerUserId: target.ownerUserId,
    actorUsuarioId: req.auth.userId,
    actorName: comment.usuarios?.nombre_usuario,
    targetType: target.targetType,
    targetId: target.targetId,
    targetName: target.targetName,
    targetLabel: target.targetLabel,
    urlDestino: target.urlDestino,
  }).catch((error) => {
    console.warn('No se pudo crear la notificación del comentario:', error)
  })

  return serializeComment(comment, req, target)
}

async function getActiveComment(commentId) {
  const comment = await prisma.comentarios.findFirst({
    where: {
      id: commentId,
      comentario_padre_id: null,
      esta_borrado: false,
    },
    include: {
      registro_entidades: true,
      usuarios: {
        include: {
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

  if (!comment) {
    throw createHttpError(404, 'El comentario indicado no existe.')
  }

  return comment
}

async function updateComment({ commentId, contenido, req }) {
  const current = await getActiveComment(commentId)
  const target = await resolveTargetFromRegistry(
    current.registro_entidades,
    req
  )

  if (current.usuario_id !== req.auth.userId) {
    throw createHttpError(403, 'Solo puedes editar tus propios comentarios.')
  }

  const content = normalizeCommentContent(contenido)
  const comment = await prisma.comentarios.update({
    where: { id: current.id },
    data: {
      contenido: content,
      esta_editado: true,
      actualizado_en: new Date(),
    },
    include: {
      usuarios: {
        include: {
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

  return serializeComment(comment, req, target)
}

async function deleteComment({ commentId, req }) {
  const current = await getActiveComment(commentId)
  const target = await resolveTargetFromRegistry(
    current.registro_entidades,
    req
  )
  const isMine = current.usuario_id === req.auth.userId
  const canModerateTarget = getTargetModeratorFlag(target, req)

  if (!isMine && !canModerateTarget) {
    throw createHttpError(
      403,
      'Solo el autor o el dueño del elemento pueden borrar este comentario.'
    )
  }

  await prisma.comentarios.update({
    where: { id: current.id },
    data: {
      esta_borrado: true,
      borrado_en: new Date(),
      actualizado_en: new Date(),
    },
  })
}

module.exports = {
  COMMENT_MAX_LENGTH,
  COMMENT_TARGETS,
  createCommentForTarget,
  deleteComment,
  listCommentsForTarget,
  updateComment,
}
