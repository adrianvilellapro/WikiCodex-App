const ADMIN_ROLE_CODE = 'administrador'

const NON_ADMIN_USER_WHERE = {
  roles: {
    codigo: {
      not: ADMIN_ROLE_CODE,
    },
  },
}

const VISIBLE_USER_SELECT = {
  id: true,
  nombre_usuario: true,
  imagen_perfil_url: true,
  roles: {
    select: {
      codigo: true,
      nombre: true,
    },
  },
}

function isAdminUser(user) {
  return user?.roles?.codigo === ADMIN_ROLE_CODE
}

function serializeVisibleUser(user, { includeRole = true } = {}) {
  if (!user || isAdminUser(user)) {
    return null
  }

  const payload = {
    id: user.id,
    nombreUsuario: user.nombre_usuario,
    imagenPerfilUrl: user.imagen_perfil_url,
  }

  if (includeRole) {
    payload.rol = user.roles
      ? {
          codigo: user.roles.codigo,
          nombre: user.roles.nombre,
        }
      : null
  }

  return payload
}

module.exports = {
  NON_ADMIN_USER_WHERE,
  VISIBLE_USER_SELECT,
  isAdminUser,
  serializeVisibleUser,
}
