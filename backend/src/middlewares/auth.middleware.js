const { prisma } = require('../lib/prisma')
const { verifyAccessToken } = require('../lib/jwt')
const { asyncHandler } = require('../lib/async-handler')
const { createHttpError } = require('../lib/errors')
const { validateAdminSession } = require('../services/admin-session.service')

const authUserInclude = {
  roles: {
    select: {
      id: true,
      codigo: true,
      nombre: true,
    },
  },
}

const requireAuth = asyncHandler(async (req, _res, next) => {
  const authorization = req.headers.authorization

  if (!authorization || !authorization.startsWith('Bearer ')) {
    throw createHttpError(401, 'Debes enviar un token Bearer valido.')
  }

  const token = authorization.slice('Bearer '.length).trim()

  if (!token) {
    throw createHttpError(401, 'El token Bearer esta vacio.')
  }

  let payload
  try {
    payload = verifyAccessToken(token)
  } catch {
    throw createHttpError(401, 'El token no es valido o ha expirado.')
  }

  const user = await prisma.usuarios.findUnique({
    where: { id: payload.sub },
    include: authUserInclude,
  })

  if (!user) {
    throw createHttpError(401, 'El usuario del token ya no existe.')
  }

  if (user.roles.codigo === 'administrador') {
    await validateAdminSession(payload, user.id)
  }

  req.auth = {
    userId: user.id,
    roleCode: user.roles.codigo,
    username: user.nombre_usuario,
    tokenPayload: payload,
  }
  req.user = user

  next()
})

function requireRoles(...allowedRoles) {
  return (req, _res, next) => {
    if (!req.auth) {
      return next(createHttpError(500, 'Auth middleware no inicializado.'))
    }

    if (!allowedRoles.includes(req.auth.roleCode)) {
      return next(
        createHttpError(403, 'No tienes permisos para realizar esta accion.', {
          allowedRoles,
        })
      )
    }

    next()
  }
}

module.exports = {
  requireAuth,
  requireRoles,
  authUserInclude,
}
