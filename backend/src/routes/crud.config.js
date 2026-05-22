const allRoles = ['administrador', 'master', 'jugador']
const staffRoles = ['administrador']
const adminRoles = ['administrador']
const dateOnlyPattern = /^\d{4}-\d{2}-\d{2}$/
const {
  assertManagedImageUrl,
  cleanupCloudinaryAssets,
} = require('../lib/media')

function withAuditDefaults(data, req, options = {}) {
  const nextData = { ...data }

  if (options.setCreatedBy && !nextData.creado_por_usuario_id) {
    nextData.creado_por_usuario_id = req.auth.userId
  }

  if (options.setCreator && !nextData.creador_usuario_id) {
    nextData.creador_usuario_id = req.auth.userId
  }

  if (options.setOwner && !nextData.propietario_usuario_id) {
    nextData.propietario_usuario_id = req.auth.userId
  }

  if (options.setGrantedBy && !nextData.otorgado_por_usuario_id) {
    nextData.otorgado_por_usuario_id = req.auth.userId
  }

  if (options.setMaster && !nextData.master_usuario_id) {
    nextData.master_usuario_id = req.auth.userId
  }

  return nextData
}

function normalizeDateFields(data, fieldNames) {
  const nextData = { ...data }

  for (const fieldName of fieldNames) {
    if (
      typeof nextData[fieldName] === 'string' &&
      dateOnlyPattern.test(nextData[fieldName])
    ) {
      nextData[fieldName] = `${nextData[fieldName]}T00:00:00.000Z`
    }
  }

  return nextData
}

function createSingleImageCleanupHook(fieldName) {
  return async ({ existing, updated }) => {
    if (!existing || !updated) {
      return
    }

    const previousUrl = existing[fieldName]
    const nextUrl = updated[fieldName]

    if (previousUrl && previousUrl !== nextUrl) {
      await cleanupCloudinaryAssets([previousUrl])
    }
  }
}

function createSingleImageValidationHook(fieldName, entityLabel) {
  return async ({ data }) => {
    await assertManagedImageUrl(data[fieldName], {
      entityLabel,
    })
  }
}

function createDeleteImageCleanupHook(fieldNames) {
  return async ({ existing }) => {
    if (!existing) {
      return
    }

    const urls = fieldNames
      .map((fieldName) => existing[fieldName])
      .flat()
      .filter(Boolean)

    await cleanupCloudinaryAssets(urls)
  }
}

const resourceConfigs = {
  roles: {
    delegate: 'roles',
    readRoles: staffRoles,
    writeRoles: adminRoles,
    allowCreate: false,
    allowUpdate: false,
    allowDelete: false,
  },
  usuarios: {
    delegate: 'usuarios',
    readRoles: adminRoles,
    writeRoles: adminRoles,
    allowCreate: false,
    allowUpdate: false,
    allowDelete: false,
    hiddenFields: ['hash_contrasena'],
    include: {
      roles: {
        select: {
          id: true,
          codigo: true,
          nombre: true,
        },
      },
    },
  },
  campanas: {
    delegate: 'campanas',
    readRoles: allRoles,
    writeRoles: allRoles,
    transformCreate: (data, req) =>
      withAuditDefaults(data, req, {
        setCreatedBy: true,
        setMaster: true,
      }),
    beforeCreate: createSingleImageValidationHook(
      'imagen_url',
      'La imagen de campana'
    ),
    beforeUpdate: createSingleImageValidationHook(
      'imagen_url',
      'La imagen de campana'
    ),
    afterUpdate: createSingleImageCleanupHook('imagen_url'),
    afterDelete: createDeleteImageCleanupHook(['imagen_url']),
  },
  aventuras: {
    delegate: 'aventuras',
    readRoles: allRoles,
    writeRoles: allRoles,
    transformCreate: (data, req) =>
      withAuditDefaults(data, req, { setCreatedBy: true }),
  },
  arcos: {
    delegate: 'arcos',
    readRoles: allRoles,
    writeRoles: allRoles,
    transformCreate: (data, req) =>
      normalizeDateFields(
        withAuditDefaults(data, req, { setCreatedBy: true }),
        ['fecha_inicio', 'fecha_fin']
      ),
    transformUpdate: (data) =>
      normalizeDateFields(data, ['fecha_inicio', 'fecha_fin']),
  },
  partidas: {
    delegate: 'partidas',
    readRoles: allRoles,
    writeRoles: allRoles,
    transformCreate: (data, req) =>
      normalizeDateFields(
        withAuditDefaults(data, req, { setCreatedBy: true }),
        ['jugada_en']
      ),
    transformUpdate: (data) => normalizeDateFields(data, ['jugada_en']),
  },
  personajes: {
    delegate: 'personajes',
    readRoles: allRoles,
    writeRoles: allRoles,
    allowCreate: false,
    allowUpdate: false,
    allowDelete: false,
    transformCreate: (data, req) =>
      withAuditDefaults(data, req, {
        setCreatedBy: true,
        setOwner: true,
      }),
  },
  objetos: {
    delegate: 'objetos',
    readRoles: allRoles,
    writeRoles: allRoles,
    transformCreate: (data, req) =>
      withAuditDefaults(data, req, { setCreatedBy: true }),
    beforeCreate: createSingleImageValidationHook(
      'imagen_url',
      'La imagen del objeto'
    ),
    beforeUpdate: createSingleImageValidationHook(
      'imagen_url',
      'La imagen del objeto'
    ),
    afterUpdate: createSingleImageCleanupHook('imagen_url'),
    afterDelete: createDeleteImageCleanupHook(['imagen_url']),
  },
  poderes: {
    delegate: 'poderes',
    readRoles: allRoles,
    writeRoles: allRoles,
    transformCreate: (data, req) =>
      withAuditDefaults(data, req, { setCreatedBy: true }),
    beforeCreate: createSingleImageValidationHook(
      'imagen_url',
      'La imagen del poder'
    ),
    beforeUpdate: createSingleImageValidationHook(
      'imagen_url',
      'La imagen del poder'
    ),
    afterUpdate: createSingleImageCleanupHook('imagen_url'),
    afterDelete: createDeleteImageCleanupHook(['imagen_url']),
  },
  conceptos: {
    delegate: 'conceptos',
    readRoles: allRoles,
    writeRoles: allRoles,
    transformCreate: (data, req) =>
      withAuditDefaults(data, req, { setCreatedBy: true }),
    beforeCreate: createSingleImageValidationHook(
      'imagen_url',
      'La imagen del concepto'
    ),
    beforeUpdate: createSingleImageValidationHook(
      'imagen_url',
      'La imagen del concepto'
    ),
    afterUpdate: createSingleImageCleanupHook('imagen_url'),
    afterDelete: createDeleteImageCleanupHook(['imagen_url']),
  },
  lugares: {
    delegate: 'lugares',
    readRoles: allRoles,
    writeRoles: allRoles,
    transformCreate: (data, req) =>
      withAuditDefaults(data, req, { setCreatedBy: true }),
    beforeCreate: createSingleImageValidationHook(
      'imagen_url',
      'La imagen del lugar'
    ),
    beforeUpdate: createSingleImageValidationHook(
      'imagen_url',
      'La imagen del lugar'
    ),
    afterUpdate: createSingleImageCleanupHook('imagen_url'),
    afterDelete: createDeleteImageCleanupHook(['imagen_url']),
  },
  rasgos: {
    delegate: 'rasgos',
    readRoles: allRoles,
    writeRoles: allRoles,
    allowCreate: false,
    allowUpdate: false,
    allowDelete: false,
    transformCreate: (data, req) =>
      withAuditDefaults(data, req, { setCreator: true }),
  },
  'categorias-personaje': {
    delegate: 'categorias_personaje',
    readRoles: allRoles,
    writeRoles: allRoles,
    transformCreate: (data, req) =>
      withAuditDefaults(data, req, { setCreatedBy: true }),
  },
  'categorias-objeto': {
    delegate: 'categorias_objeto',
    readRoles: allRoles,
    writeRoles: allRoles,
    transformCreate: (data, req) =>
      withAuditDefaults(data, req, { setCreatedBy: true }),
  },
  'tipos-rasgo': {
    delegate: 'tipos_rasgo',
    readRoles: allRoles,
    writeRoles: adminRoles,
  },
  'tiers-personaje': {
    delegate: 'tiers_personaje',
    readRoles: allRoles,
    writeRoles: adminRoles,
  },
  'tiers-objeto': {
    delegate: 'tiers_objeto',
    readRoles: allRoles,
    writeRoles: adminRoles,
  },
  'tipos-objeto': {
    delegate: 'tipos_objeto',
    readRoles: allRoles,
    writeRoles: adminRoles,
  },
  'estados-personaje': {
    delegate: 'estados_personaje',
    readRoles: allRoles,
    writeRoles: adminRoles,
  },
  'ambitos-visibilidad-personaje': {
    delegate: 'ambitos_visibilidad_personaje',
    primaryKey: 'codigo',
    readRoles: allRoles,
    writeRoles: adminRoles,
  },
  'niveles-acceso': {
    delegate: 'niveles_acceso',
    primaryKey: 'codigo',
    readRoles: allRoles,
    writeRoles: adminRoles,
  },
  'tipos-entidad': {
    delegate: 'tipos_entidad',
    primaryKey: 'codigo',
    readRoles: allRoles,
    writeRoles: adminRoles,
  },
  'tipos-relacion-wiki': {
    delegate: 'tipos_relacion_wiki',
    readRoles: allRoles,
    writeRoles: adminRoles,
  },
  clases: {
    delegate: 'clases',
    readRoles: allRoles,
    writeRoles: adminRoles,
  },
  subclases: {
    delegate: 'subclases',
    readRoles: allRoles,
    writeRoles: adminRoles,
  },
  'campana-jugadores': {
    delegate: 'campana_jugadores',
    readRoles: allRoles,
    writeRoles: allRoles,
  },
  'aventura-jugadores': {
    delegate: 'aventura_jugadores',
    readRoles: allRoles,
    writeRoles: allRoles,
  },
  'personaje-clases': {
    delegate: 'personaje_clases',
    readRoles: allRoles,
    writeRoles: allRoles,
    allowCreate: false,
    allowUpdate: false,
    allowDelete: false,
  },
  'personaje-imagenes': {
    delegate: 'personaje_imagenes',
    readRoles: allRoles,
    writeRoles: allRoles,
    allowCreate: false,
    allowUpdate: false,
    allowDelete: false,
    beforeCreate: createSingleImageValidationHook(
      'imagen_url',
      'La imagen de galeria del personaje'
    ),
    beforeUpdate: createSingleImageValidationHook(
      'imagen_url',
      'La imagen de galeria del personaje'
    ),
    afterUpdate: createSingleImageCleanupHook('imagen_url'),
    afterDelete: createDeleteImageCleanupHook(['imagen_url']),
  },
  'personaje-rasgos': {
    delegate: 'personaje_rasgos',
    readRoles: allRoles,
    writeRoles: allRoles,
    allowCreate: false,
    allowUpdate: false,
    allowDelete: false,
  },
  'personaje-temas-musicales': {
    delegate: 'personaje_temas_musicales',
    readRoles: allRoles,
    writeRoles: allRoles,
    allowCreate: false,
    allowUpdate: false,
    allowDelete: false,
  },
  'permisos-personaje': {
    delegate: 'permisos_personaje',
    readRoles: allRoles,
    writeRoles: allRoles,
    allowCreate: false,
    allowUpdate: false,
    allowDelete: false,
    transformCreate: (data, req) =>
      withAuditDefaults(data, req, { setGrantedBy: true }),
  },
  'asignaciones-categoria-personaje': {
    delegate: 'asignaciones_categoria_personaje',
    readRoles: allRoles,
    writeRoles: allRoles,
    allowCreate: false,
    allowUpdate: false,
    allowDelete: false,
  },
  'asignaciones-categoria-objeto': {
    delegate: 'asignaciones_categoria_objeto',
    readRoles: allRoles,
    writeRoles: allRoles,
  },
  comentarios: {
    delegate: 'comentarios',
    readRoles: adminRoles,
    writeRoles: adminRoles,
    allowCreate: false,
    allowUpdate: false,
    allowDelete: false,
  },
  'historial-cambios': {
    delegate: 'historial_cambios',
    readRoles: adminRoles,
    writeRoles: adminRoles,
    allowCreate: false,
    allowUpdate: false,
    allowDelete: false,
    transformCreate: (data, req) => ({
      ...data,
      actor_usuario_id: data.actor_usuario_id || req.auth.userId,
    }),
  },
  'registro-entidades': {
    delegate: 'registro_entidades',
    readRoles: adminRoles,
    writeRoles: adminRoles,
    allowCreate: false,
    allowUpdate: false,
    allowDelete: false,
  },
  'relaciones-wiki': {
    delegate: 'relaciones_wiki',
    readRoles: allRoles,
    writeRoles: allRoles,
    transformCreate: (data, req) => ({
      ...data,
      creado_por_usuario_id: data.creado_por_usuario_id || req.auth.userId,
    }),
  },
  'configuracion-registro': {
    delegate: 'configuracionRegistro',
    readRoles: adminRoles,
    writeRoles: adminRoles,
    hiddenFields: ['hash_clave_registro'],
    allowCreate: false,
    allowUpdate: false,
    allowDelete: false,
  },
}

module.exports = {
  resourceConfigs,
}
