const { prisma } = require('./prisma')

const actionTypeMap = {
  create: 'crear',
  update: 'actualizar',
  delete: 'eliminar',
  restore: 'restaurar',
  permission_change: 'cambio_permiso',
  comment: 'comentario',
  relation_create: 'crear_relacion',
  relation_delete: 'eliminar_relacion',
  crear: 'crear',
  actualizar: 'actualizar',
  eliminar: 'eliminar',
  restaurar: 'restaurar',
  cambio_permiso: 'cambio_permiso',
  comentario: 'comentario',
  crear_relacion: 'crear_relacion',
  eliminar_relacion: 'eliminar_relacion',
}

async function findEntityRegistryId(tipoEntidadCodigo, entidadPk) {
  const entityRecord = await prisma.registro_entidades.findUnique({
    where: {
      tipo_entidad_codigo_entidad_pk: {
        tipo_entidad_codigo: tipoEntidadCodigo,
        entidad_pk: entidadPk,
      },
    },
    select: {
      id: true,
    },
  })

  return entityRecord?.id || null
}

async function logEntityChange({
  tipoEntidadCodigo,
  entidadPk,
  actorUsuarioId,
  tipoAccion,
  nombreCampo,
  resumen,
  valorAnterior,
  valorNuevo,
}) {
  const registroEntidadId = await findEntityRegistryId(
    tipoEntidadCodigo,
    entidadPk
  )
  const tipoAccionNormalizado = actionTypeMap[tipoAccion]

  if (!registroEntidadId || !tipoAccionNormalizado) {
    return null
  }

  return prisma.historial_cambios.create({
    data: {
      registro_entidad_id: registroEntidadId,
      actor_usuario_id: actorUsuarioId || null,
      tipo_accion: tipoAccionNormalizado,
      nombre_campo: nombreCampo || null,
      resumen: resumen || null,
      valor_anterior: valorAnterior || undefined,
      valor_nuevo: valorNuevo || undefined,
    },
  })
}

module.exports = {
  logEntityChange,
}
