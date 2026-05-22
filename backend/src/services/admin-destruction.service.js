const crypto = require('crypto')

const { env } = require('../config/env')
const { prisma } = require('../lib/prisma')
const { createHttpError } = require('../lib/errors')

const TRANSACTION_OPTIONS = {
  maxWait: 10000,
  timeout: 60000,
}

const FAVORITE_TYPE_BY_REGISTRY_TYPE = {
  personaje: 'character',
  objeto: 'object',
  lugar: 'place',
}

function uniqueIds(ids) {
  return [...new Set((ids || []).filter(Boolean).map(String))]
}

function idsFromRows(rows) {
  return uniqueIds((rows || []).map((row) => row.id))
}

function safeCompareSecret(left, right) {
  const leftBuffer = Buffer.from(String(left || ''), 'utf8')
  const rightBuffer = Buffer.from(String(right || ''), 'utf8')

  if (leftBuffer.length !== rightBuffer.length) {
    return false
  }

  return crypto.timingSafeEqual(leftBuffer, rightBuffer)
}

function assertDestructivePassword(password) {
  if (!safeCompareSecret(password, env.ADMIN_DESTRUCTIVE_PASSWORD)) {
    throw createHttpError(403, 'La contrasena destructiva no es correcta.')
  }
}

async function deleteManyByIds(tx, delegateName, ids) {
  const safeIds = uniqueIds(ids)
  if (!safeIds.length) {
    return 0
  }

  const result = await tx[delegateName].deleteMany({
    where: { id: { in: safeIds } },
  })

  return result.count
}

async function deleteEntityAuxiliaryRows(tx, groups) {
  for (const group of groups) {
    const ids = uniqueIds(group.ids)
    if (!ids.length) {
      continue
    }

    const favoriteType = FAVORITE_TYPE_BY_REGISTRY_TYPE[group.type]
    if (favoriteType) {
      await tx.favoritos_usuario.deleteMany({
        where: {
          tipo_entidad: favoriteType,
          entidad_id: { in: ids },
        },
      })
    }

    await tx.registro_entidades.deleteMany({
      where: {
        tipo_entidad_codigo: group.type,
        entidad_pk: { in: ids },
      },
    })
  }
}

async function detachRegistryFromCampaign(tx, groups) {
  for (const group of groups) {
    const ids = uniqueIds(group.ids)
    if (!ids.length) {
      continue
    }

    await tx.registro_entidades.updateMany({
      where: {
        tipo_entidad_codigo: group.type,
        entidad_pk: { in: ids },
      },
      data: {
        campana_id: null,
        aventura_id: null,
      },
    })
  }
}

async function clearCharacterSessionReferences(tx, sessionIds) {
  const safeSessionIds = uniqueIds(sessionIds)
  if (!safeSessionIds.length) {
    return
  }

  await tx.personajes.updateMany({
    where: { partida_aparicion_id: { in: safeSessionIds } },
    data: { partida_aparicion_id: null },
  })
  await tx.personajes.updateMany({
    where: { partida_defuncion_id: { in: safeSessionIds } },
    data: { partida_defuncion_id: null },
  })
}

async function clearCharacterBaseReferences(tx, characterIds) {
  const safeCharacterIds = uniqueIds(characterIds)
  if (!safeCharacterIds.length) {
    return
  }

  await tx.personajes.updateMany({
    where: { personaje_base_id: { in: safeCharacterIds } },
    data: { personaje_base_id: null },
  })
}

async function getCampaignObjectSets(tx, campaignId) {
  const allRows = await tx.$queryRaw`
    SELECT DISTINCT o.id::text AS id
    FROM objetos o
    WHERE o.campana_id = ${campaignId}::uuid
      OR EXISTS (
        SELECT 1
        FROM objeto_campanas oc
        WHERE oc.objeto_id = o.id
          AND oc.campana_id = ${campaignId}::uuid
      )
  `
  const deleteRows = await tx.$queryRaw`
    SELECT DISTINCT o.id::text AS id
    FROM objetos o
    WHERE (
        o.campana_id = ${campaignId}::uuid
        OR EXISTS (
          SELECT 1
          FROM objeto_campanas oc
          WHERE oc.objeto_id = o.id
            AND oc.campana_id = ${campaignId}::uuid
        )
      )
      AND NOT (
        (o.campana_id IS NOT NULL AND o.campana_id <> ${campaignId}::uuid)
        OR EXISTS (
          SELECT 1
          FROM objeto_campanas oc2
          WHERE oc2.objeto_id = o.id
            AND oc2.campana_id <> ${campaignId}::uuid
        )
      )
  `

  const all = idsFromRows(allRows)
  const toDelete = idsFromRows(deleteRows)
  const deleteSet = new Set(toDelete)

  return {
    all,
    toDelete,
    toDetach: all.filter((id) => !deleteSet.has(id)),
  }
}

async function getCampaignPlaceSets(tx, campaignId) {
  const allRows = await tx.$queryRaw`
    SELECT DISTINCT l.id::text AS id
    FROM lugares l
    WHERE l.campana_id = ${campaignId}::uuid
      OR EXISTS (
        SELECT 1
        FROM lugar_campanas lc
        WHERE lc.lugar_id = l.id
          AND lc.campana_id = ${campaignId}::uuid
      )
  `
  const deleteRows = await tx.$queryRaw`
    SELECT DISTINCT l.id::text AS id
    FROM lugares l
    WHERE (
        l.campana_id = ${campaignId}::uuid
        OR EXISTS (
          SELECT 1
          FROM lugar_campanas lc
          WHERE lc.lugar_id = l.id
            AND lc.campana_id = ${campaignId}::uuid
        )
      )
      AND NOT (
        (l.campana_id IS NOT NULL AND l.campana_id <> ${campaignId}::uuid)
        OR EXISTS (
          SELECT 1
          FROM lugar_campanas lc2
          WHERE lc2.lugar_id = l.id
            AND lc2.campana_id <> ${campaignId}::uuid
        )
      )
  `

  const all = idsFromRows(allRows)
  const toDelete = idsFromRows(deleteRows)
  const deleteSet = new Set(toDelete)

  return {
    all,
    toDelete,
    toDetach: all.filter((id) => !deleteSet.has(id)),
  }
}

async function getCampaignPowerSets(tx, campaignId) {
  const allRows = await tx.$queryRaw`
    SELECT DISTINCT p.id::text AS id
    FROM poderes p
    WHERE p.campana_id = ${campaignId}::uuid
      OR EXISTS (
        SELECT 1
        FROM poder_campanas pc
        WHERE pc.poder_id = p.id
          AND pc.campana_id = ${campaignId}::uuid
      )
  `
  const deleteRows = await tx.$queryRaw`
    SELECT DISTINCT p.id::text AS id
    FROM poderes p
    WHERE (
        p.campana_id = ${campaignId}::uuid
        OR EXISTS (
          SELECT 1
          FROM poder_campanas pc
          WHERE pc.poder_id = p.id
            AND pc.campana_id = ${campaignId}::uuid
        )
      )
      AND NOT (
        (p.campana_id IS NOT NULL AND p.campana_id <> ${campaignId}::uuid)
        OR EXISTS (
          SELECT 1
          FROM poder_campanas pc2
          WHERE pc2.poder_id = p.id
            AND pc2.campana_id <> ${campaignId}::uuid
        )
      )
  `

  const all = idsFromRows(allRows)
  const toDelete = idsFromRows(deleteRows)
  const deleteSet = new Set(toDelete)

  return {
    all,
    toDelete,
    toDetach: all.filter((id) => !deleteSet.has(id)),
  }
}

async function getCampaignSpellSets(tx, campaignId) {
  const allRows = await tx.$queryRaw`
    SELECT DISTINCT h.id::text AS id
    FROM hechizos h
    INNER JOIN hechizo_campanas hc ON hc.hechizo_id = h.id
    WHERE hc.campana_id = ${campaignId}::uuid
  `
  const deleteRows = await tx.$queryRaw`
    SELECT DISTINCT h.id::text AS id
    FROM hechizos h
    INNER JOIN hechizo_campanas hc ON hc.hechizo_id = h.id
    WHERE hc.campana_id = ${campaignId}::uuid
      AND COALESCE(h.origen, 'usuario') <> 'sistema'
      AND NOT EXISTS (
        SELECT 1
        FROM hechizo_campanas hc2
        WHERE hc2.hechizo_id = h.id
          AND hc2.campana_id <> ${campaignId}::uuid
      )
  `

  const all = idsFromRows(allRows)
  const toDelete = idsFromRows(deleteRows)
  const deleteSet = new Set(toDelete)

  return {
    all,
    toDelete,
    toDetach: all.filter((id) => !deleteSet.has(id)),
  }
}

async function detachSurvivingCampaignEntities(tx, campaignId, sets) {
  if (sets.objects.toDetach.length) {
    await tx.objetos.updateMany({
      where: {
        id: { in: sets.objects.toDetach },
        campana_id: campaignId,
      },
      data: {
        campana_id: null,
        aventura_id: null,
      },
    })
  }

  if (sets.places.toDetach.length) {
    await tx.lugares.updateMany({
      where: {
        id: { in: sets.places.toDetach },
        campana_id: campaignId,
      },
      data: {
        campana_id: null,
        aventura_id: null,
      },
    })
  }

  if (sets.powers.toDetach.length) {
    await tx.poderes.updateMany({
      where: {
        id: { in: sets.powers.toDetach },
        campana_id: campaignId,
      },
      data: {
        campana_id: null,
        aventura_id: null,
      },
    })
  }
}

async function deleteCampaignInTransaction(tx, campaignId) {
  const campaign = await tx.campanas.findUnique({
    where: { id: campaignId },
    select: {
      id: true,
      nombre: true,
      master_usuario_id: true,
      creado_por_usuario_id: true,
    },
  })

  if (!campaign) {
    throw createHttpError(404, 'Campana no encontrada.')
  }

  const [
    characters,
    sessions,
    adventures,
    arcs,
    concepts,
    objects,
    places,
    powers,
    spells,
  ] = await Promise.all([
    tx.personajes.findMany({
      where: { campana_id: campaignId },
      select: { id: true },
    }),
    tx.partidas.findMany({
      where: { campana_id: campaignId },
      select: { id: true },
    }),
    tx.aventuras.findMany({
      where: { campana_id: campaignId },
      select: { id: true },
    }),
    tx.arcos.findMany({
      where: { campana_id: campaignId },
      select: { id: true },
    }),
    tx.conceptos.findMany({
      where: { campana_id: campaignId },
      select: { id: true },
    }),
    getCampaignObjectSets(tx, campaignId),
    getCampaignPlaceSets(tx, campaignId),
    getCampaignPowerSets(tx, campaignId),
    getCampaignSpellSets(tx, campaignId),
  ])

  const characterIds = idsFromRows(characters)
  const sessionIds = idsFromRows(sessions)
  const adventureIds = idsFromRows(adventures)
  const arcIds = idsFromRows(arcs)
  const conceptIds = idsFromRows(concepts)

  await clearCharacterSessionReferences(tx, sessionIds)
  await clearCharacterBaseReferences(tx, characterIds)
  await detachSurvivingCampaignEntities(tx, campaignId, {
    objects,
    places,
    powers,
  })
  await detachRegistryFromCampaign(tx, [
    { type: 'objeto', ids: objects.toDetach },
    { type: 'lugar', ids: places.toDetach },
    { type: 'poder', ids: powers.toDetach },
    { type: 'hechizo', ids: spells.toDetach },
  ])
  await deleteEntityAuxiliaryRows(tx, [
    { type: 'campana', ids: [campaignId] },
    { type: 'personaje', ids: characterIds },
    { type: 'partida', ids: sessionIds },
    { type: 'aventura', ids: adventureIds },
    { type: 'arco', ids: arcIds },
    { type: 'concepto', ids: conceptIds },
    { type: 'objeto', ids: objects.toDelete },
    { type: 'lugar', ids: places.toDelete },
    { type: 'poder', ids: powers.toDelete },
    { type: 'hechizo', ids: spells.toDelete },
  ])

  await deleteManyByIds(tx, 'hechizos', spells.toDelete)
  await deleteManyByIds(tx, 'poderes', powers.toDelete)
  await deleteManyByIds(tx, 'objetos', objects.toDelete)
  await deleteManyByIds(tx, 'lugares', places.toDelete)

  await tx.categorias_objeto.deleteMany({
    where: { campana_origen_id: campaignId },
  })
  await tx.categorias_personaje.deleteMany({
    where: { campana_origen_id: campaignId },
  })
  await tx.categorias_poder.deleteMany({
    where: { campana_origen_id: campaignId },
  })

  await tx.campanas.delete({ where: { id: campaignId } })

  return {
    campaign,
    summary: {
      personajes: characterIds.length,
      partidas: sessionIds.length,
      aventuras: adventureIds.length,
      arcos: arcIds.length,
      conceptos: conceptIds.length,
      objetosBorrados: objects.toDelete.length,
      objetosDesvinculados: objects.toDetach.length,
      lugaresBorrados: places.toDelete.length,
      lugaresDesvinculados: places.toDetach.length,
      poderesBorrados: powers.toDelete.length,
      poderesDesvinculados: powers.toDetach.length,
      hechizosBorrados: spells.toDelete.length,
      hechizosDesvinculados: spells.toDetach.length,
    },
  }
}

async function deleteCampaignAsAdmin({ campaignId, claveDestructiva }) {
  assertDestructivePassword(claveDestructiva)

  return prisma.$transaction(
    async (tx) => deleteCampaignInTransaction(tx, campaignId),
    TRANSACTION_OPTIONS
  )
}

async function collectUserContentIds(tx, userId) {
  const campaignRows = await tx.campanas.findMany({
    where: {
      OR: [{ master_usuario_id: userId }, { creado_por_usuario_id: userId }],
    },
    select: { id: true },
  })

  return {
    campaignIds: idsFromRows(campaignRows),
  }
}

async function deletePermissionsGrantedByUser(tx, userId) {
  await Promise.all([
    tx.permisos_personaje.deleteMany({
      where: { otorgado_por_usuario_id: userId },
    }),
    tx.permisos_objeto.deleteMany({
      where: { otorgado_por_usuario_id: userId },
    }),
    tx.permisos_lugar.deleteMany({
      where: { otorgado_por_usuario_id: userId },
    }),
    tx.permisos_poder.deleteMany({
      where: { otorgado_por_usuario_id: userId },
    }),
  ])
}

async function deleteUserCategories(tx, userId) {
  const [objectCategories, characterCategories, powerCategories] =
    await Promise.all([
      tx.categorias_objeto.findMany({
        where: { creado_por_usuario_id: userId },
        select: { id: true },
      }),
      tx.categorias_personaje.findMany({
        where: { creado_por_usuario_id: userId },
        select: { id: true },
      }),
      tx.categorias_poder.findMany({
        where: { creado_por_usuario_id: userId },
        select: { id: true },
      }),
    ])

  const objectCategoryIds = idsFromRows(objectCategories)
  const characterCategoryIds = idsFromRows(characterCategories)
  const powerCategoryIds = idsFromRows(powerCategories)

  await deleteManyByIds(tx, 'categorias_objeto', objectCategoryIds)
  await deleteManyByIds(tx, 'categorias_personaje', characterCategoryIds)
  await deleteManyByIds(tx, 'categorias_poder', powerCategoryIds)

  return {
    categoriasObjeto: objectCategoryIds.length,
    categoriasPersonaje: characterCategoryIds.length,
    categoriasPoder: powerCategoryIds.length,
  }
}

async function deleteUserAsAdmin({ userId, actorUserId, claveDestructiva }) {
  assertDestructivePassword(claveDestructiva)

  return prisma.$transaction(async (tx) => {
    const user = await tx.usuarios.findUnique({
      where: { id: userId },
      include: {
        roles: {
          select: {
            codigo: true,
            nombre: true,
          },
        },
      },
    })

    if (!user) {
      throw createHttpError(404, 'Usuario no encontrado.')
    }

    if (userId === actorUserId) {
      throw createHttpError(
        400,
        'No puedes borrar la cuenta administradora con la que has iniciado sesion.'
      )
    }

    if (user.roles?.codigo === 'administrador') {
      const remainingAdmins = await tx.usuarios.count({
        where: {
          id: { not: userId },
          roles: { codigo: 'administrador' },
        },
      })

      if (remainingAdmins <= 0) {
        throw createHttpError(400, 'No puedes borrar el ultimo administrador.')
      }
    }

    const { campaignIds } = await collectUserContentIds(tx, userId)
    const campaignSummaries = []
    for (const campaignId of campaignIds) {
      campaignSummaries.push(await deleteCampaignInTransaction(tx, campaignId))
    }

    const [
      characters,
      objects,
      places,
      powers,
      spells,
      adventures,
      arcs,
      concepts,
      sessions,
      classes,
      feats,
      traits,
    ] = await Promise.all([
      tx.personajes.findMany({
        where: {
          OR: [
            { creado_por_usuario_id: userId },
            { propietario_usuario_id: userId },
          ],
        },
        select: { id: true },
      }),
      tx.objetos.findMany({
        where: { creado_por_usuario_id: userId },
        select: { id: true },
      }),
      tx.lugares.findMany({
        where: { creado_por_usuario_id: userId },
        select: { id: true },
      }),
      tx.poderes.findMany({
        where: { creado_por_usuario_id: userId },
        select: { id: true },
      }),
      tx.hechizos.findMany({
        where: { creado_por_usuario_id: userId },
        select: { id: true },
      }),
      tx.aventuras.findMany({
        where: { creado_por_usuario_id: userId },
        select: { id: true },
      }),
      tx.arcos.findMany({
        where: { creado_por_usuario_id: userId },
        select: { id: true },
      }),
      tx.conceptos.findMany({
        where: { creado_por_usuario_id: userId },
        select: { id: true },
      }),
      tx.partidas.findMany({
        where: { creado_por_usuario_id: userId },
        select: { id: true },
      }),
      tx.clases.findMany({
        where: { creado_por_usuario_id: userId },
        select: { id: true },
      }),
      tx.dotes.findMany({
        where: { creado_por_usuario_id: userId },
        select: { id: true },
      }),
      tx.rasgos.findMany({
        where: { creador_usuario_id: userId },
        select: { id: true },
      }),
    ])

    const characterIds = idsFromRows(characters)
    const objectIds = idsFromRows(objects)
    const placeIds = idsFromRows(places)
    const powerIds = idsFromRows(powers)
    const spellIds = idsFromRows(spells)
    const adventureIds = idsFromRows(adventures)
    const arcIds = idsFromRows(arcs)
    const conceptIds = idsFromRows(concepts)
    const sessionIds = idsFromRows(sessions)
    const classIds = idsFromRows(classes)
    const featIds = idsFromRows(feats)
    const traitIds = idsFromRows(traits)

    await Promise.all([
      tx.historial_cambios.updateMany({
        where: { actor_usuario_id: userId },
        data: { actor_usuario_id: null },
      }),
      tx.comentarios.deleteMany({ where: { usuario_id: userId } }),
      tx.relaciones_wiki.deleteMany({
        where: { creado_por_usuario_id: userId },
      }),
      deletePermissionsGrantedByUser(tx, userId),
    ])

    await clearCharacterSessionReferences(tx, sessionIds)
    await clearCharacterBaseReferences(tx, characterIds)

    if (adventureIds.length) {
      await Promise.all([
        tx.partidas.updateMany({
          where: { aventura_id: { in: adventureIds } },
          data: { aventura_id: null },
        }),
        tx.arcos.updateMany({
          where: { aventura_id: { in: adventureIds } },
          data: { aventura_id: null },
        }),
      ])
    }

    if (arcIds.length) {
      await tx.partidas.updateMany({
        where: { arco_id: { in: arcIds } },
        data: { arco_id: null },
      })
    }

    if (classIds.length) {
      await tx.personaje_clases.deleteMany({
        where: { clase_id: { in: classIds } },
      })
    }

    await deleteEntityAuxiliaryRows(tx, [
      { type: 'usuario', ids: [userId] },
      { type: 'personaje', ids: characterIds },
      { type: 'objeto', ids: objectIds },
      { type: 'lugar', ids: placeIds },
      { type: 'poder', ids: powerIds },
      { type: 'hechizo', ids: spellIds },
      { type: 'aventura', ids: adventureIds },
      { type: 'arco', ids: arcIds },
      { type: 'concepto', ids: conceptIds },
      { type: 'partida', ids: sessionIds },
      { type: 'clase', ids: classIds },
      { type: 'dote', ids: featIds },
    ])

    const categorySummary = await deleteUserCategories(tx, userId)

    await tx.partida_combates.deleteMany({
      where: { creado_por_usuario_id: userId },
    })
    await deleteManyByIds(tx, 'partidas', sessionIds)
    await deleteManyByIds(tx, 'arcos', arcIds)
    await deleteManyByIds(tx, 'aventuras', adventureIds)
    await deleteManyByIds(tx, 'conceptos', conceptIds)
    await deleteManyByIds(tx, 'rasgos', traitIds)
    await deleteManyByIds(tx, 'hechizos', spellIds)
    await deleteManyByIds(tx, 'poderes', powerIds)
    await deleteManyByIds(tx, 'objetos', objectIds)
    await deleteManyByIds(tx, 'lugares', placeIds)
    await deleteManyByIds(tx, 'personajes', characterIds)
    await deleteManyByIds(tx, 'dotes', featIds)
    await deleteManyByIds(tx, 'clases', classIds)

    await tx.usuarios.delete({ where: { id: userId } })

    return {
      user,
      summary: {
        campanas: campaignIds.length,
        campanasDetalle: campaignSummaries.map((item) => ({
          id: item.campaign.id,
          nombre: item.campaign.nombre,
          resumen: item.summary,
        })),
        personajes: characterIds.length,
        objetos: objectIds.length,
        lugares: placeIds.length,
        poderes: powerIds.length,
        hechizos: spellIds.length,
        aventuras: adventureIds.length,
        arcos: arcIds.length,
        conceptos: conceptIds.length,
        partidas: sessionIds.length,
        clases: classIds.length,
        dotes: featIds.length,
        rasgos: traitIds.length,
        ...categorySummary,
      },
    }
  }, TRANSACTION_OPTIONS)
}

function serializeAdminCampaign(campaign) {
  const counts = campaign._count || {}

  return {
    id: campaign.id,
    nombre: campaign.nombre,
    privacidadCodigo: campaign.privacidad_codigo,
    imagenUrl: campaign.imagen_url,
    creadoEn: campaign.creado_en,
    actualizadoEn: campaign.actualizado_en,
    master: campaign.usuarios_campanas_master_usuario_idTousuarios
      ? {
          id: campaign.usuarios_campanas_master_usuario_idTousuarios.id,
          nombreUsuario:
            campaign.usuarios_campanas_master_usuario_idTousuarios
              .nombre_usuario,
        }
      : null,
    creador: campaign.usuarios_campanas_creado_por_usuario_idTousuarios
      ? {
          id: campaign.usuarios_campanas_creado_por_usuario_idTousuarios.id,
          nombreUsuario:
            campaign.usuarios_campanas_creado_por_usuario_idTousuarios
              .nombre_usuario,
        }
      : null,
    conteos: {
      jugadores: counts.campana_jugadores || 0,
      aventuras: counts.aventuras || 0,
      arcos: counts.arcos || 0,
      partidas: counts.partidas || 0,
      personajes: counts.personajes || 0,
      conceptos: counts.conceptos || 0,
      objetos: (counts.objetos || 0) + (counts.objeto_campanas || 0),
      lugares: (counts.lugares || 0) + (counts.lugar_campanas || 0),
      poderes: (counts.poderes || 0) + (counts.poder_campanas || 0),
      hechizos: counts.hechizo_campanas || 0,
    },
  }
}

async function listAdminCampaigns() {
  const campaigns = await prisma.campanas.findMany({
    orderBy: [{ actualizado_en: 'desc' }, { nombre: 'asc' }],
    include: {
      usuarios_campanas_master_usuario_idTousuarios: {
        select: {
          id: true,
          nombre_usuario: true,
        },
      },
      usuarios_campanas_creado_por_usuario_idTousuarios: {
        select: {
          id: true,
          nombre_usuario: true,
        },
      },
      _count: {
        select: {
          campana_jugadores: true,
          aventuras: true,
          arcos: true,
          partidas: true,
          personajes: true,
          conceptos: true,
          objetos: true,
          objeto_campanas: true,
          lugares: true,
          lugar_campanas: true,
          poderes: true,
          poder_campanas: true,
          hechizo_campanas: true,
        },
      },
    },
  })

  return campaigns.map(serializeAdminCampaign)
}

module.exports = {
  assertDestructivePassword,
  deleteCampaignAsAdmin,
  deleteCampaignInTransaction,
  deleteUserAsAdmin,
  listAdminCampaigns,
}
