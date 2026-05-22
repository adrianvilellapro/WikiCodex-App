const { createHttpError } = require('../lib/errors')
const { prisma } = require('../lib/prisma')
const {
  requireCharacterViewAccess,
  serializeCharacter,
} = require('./character-access.service')
const { requireObjectViewAccess, serializeObject } = require('./object.service')
const { requirePlaceViewAccess, serializePlace } = require('./place.service')

const FAVORITE_ENTITY_TYPES = ['character', 'object', 'place']

function assertFavoriteEntityType(entityType) {
  if (!FAVORITE_ENTITY_TYPES.includes(entityType)) {
    throw createHttpError(400, 'El tipo de favorito indicado no es valido.')
  }
}

function buildFavoriteUrl(entityType, entityId) {
  if (entityType === 'character') {
    return `/app/personajes/${entityId}`
  }

  if (entityType === 'object') {
    return `/app/objetos/${entityId}`
  }

  return `/app/lugares/${entityId}`
}

function serializeFavoriteFromEntity({ favorite, entityType, entity }) {
  return {
    id: favorite.id,
    entityType,
    entityId: entity.id,
    nombre: entity.nombre,
    subtitulo: entity.subtitulo || '',
    imagenUrl: entity.imagenPrincipalUrl || null,
    modoVista: entity.modoVista || 'full',
    urlDestino: buildFavoriteUrl(entityType, entity.id),
    creadoEn: favorite.creado_en,
  }
}

async function getVisibleFavoriteEntity({ req, entityType, entityId }) {
  assertFavoriteEntityType(entityType)

  if (entityType === 'character') {
    const context = await requireCharacterViewAccess(entityId, req)
    const character = serializeCharacter(context.character, context.access)

    return {
      id: character.id,
      nombre: character.nombre,
      subtitulo: character.titulo || character.campana?.nombre || 'Personaje',
      imagenPrincipalUrl: character.imagenPrincipalUrl,
      modoVista: character.modoVista,
    }
  }

  if (entityType === 'object') {
    const context = await requireObjectViewAccess(entityId, req)
    const object = serializeObject(context.object, context.access)

    return {
      id: object.id,
      nombre: object.nombre,
      subtitulo: object.tier?.nombre || 'Objeto',
      imagenPrincipalUrl: object.imagenPrincipalUrl,
      modoVista: object.modoVista,
    }
  }

  const context = await requirePlaceViewAccess(entityId, req)
  const place = serializePlace(context.place, context.access)

  return {
    id: place.id,
    nombre: place.nombre,
    subtitulo: place.tipo?.nombre || 'Lugar',
    imagenPrincipalUrl: place.imagenPrincipalUrl,
    modoVista: place.modoVista,
  }
}

async function listFavoritesForUser({ req, limit = 20 }) {
  const safeLimit = Math.max(1, Math.min(limit, 200))
  const candidates = await prisma.favoritos_usuario.findMany({
    where: { usuario_id: req.auth.userId },
    orderBy: [{ creado_en: 'desc' }, { id: 'desc' }],
    take: safeLimit * 3,
  })
  const items = []

  for (const favorite of candidates) {
    if (items.length >= safeLimit) {
      break
    }

    try {
      const entity = await getVisibleFavoriteEntity({
        req,
        entityType: favorite.tipo_entidad,
        entityId: favorite.entidad_id,
      })

      items.push(
        serializeFavoriteFromEntity({
          favorite,
          entityType: favorite.tipo_entidad,
          entity,
        })
      )
    } catch (error) {
      if (
        error.status === 400 ||
        error.status === 404 ||
        error.status === 403
      ) {
        await prisma.favoritos_usuario.deleteMany({
          where: { id: favorite.id, usuario_id: req.auth.userId },
        })
        continue
      }

      throw error
    }
  }

  return {
    items,
    meta: {
      limit: safeLimit,
      returned: items.length,
    },
  }
}

async function getFavoriteStatus({ req, entityType, entityId }) {
  await getVisibleFavoriteEntity({ req, entityType, entityId })

  const total = await prisma.favoritos_usuario.count({
    where: {
      usuario_id: req.auth.userId,
      tipo_entidad: entityType,
      entidad_id: entityId,
    },
  })

  return { favorito: total > 0 }
}

async function setFavorite({ req, entityType, entityId, favorito }) {
  assertFavoriteEntityType(entityType)

  if (!favorito) {
    await prisma.favoritos_usuario.deleteMany({
      where: {
        usuario_id: req.auth.userId,
        tipo_entidad: entityType,
        entidad_id: entityId,
      },
    })

    return { favorito: false }
  }

  await getVisibleFavoriteEntity({ req, entityType, entityId })

  await prisma.favoritos_usuario.upsert({
    where: {
      usuario_id_tipo_entidad_entidad_id: {
        usuario_id: req.auth.userId,
        tipo_entidad: entityType,
        entidad_id: entityId,
      },
    },
    update: {},
    create: {
      usuario_id: req.auth.userId,
      tipo_entidad: entityType,
      entidad_id: entityId,
    },
  })

  return { favorito: true }
}

module.exports = {
  FAVORITE_ENTITY_TYPES,
  getFavoriteStatus,
  listFavoritesForUser,
  setFavorite,
}
