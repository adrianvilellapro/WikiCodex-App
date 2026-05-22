const jwt = require('jsonwebtoken')

const { env } = require('../config/env')

function signAccessToken(user, options = {}) {
  const adminSession = options.adminSession || null

  return jwt.sign(
    {
      sub: user.id,
      rolCodigo: user.roles.codigo,
      nombreUsuario: user.nombre_usuario,
      ...(adminSession
        ? {
            adminSessionId: adminSession.sessionId,
            adminTokenId: adminSession.tokenId,
            adminSession: true,
          }
        : {}),
    },
    env.JWT_SECRET,
    {
      expiresIn: options.expiresIn || env.JWT_EXPIRES_IN,
      issuer: env.JWT_ISSUER,
      audience: env.JWT_AUDIENCE,
    }
  )
}

function verifyAccessToken(token) {
  return jwt.verify(token, env.JWT_SECRET, {
    issuer: env.JWT_ISSUER,
    audience: env.JWT_AUDIENCE,
  })
}

module.exports = {
  signAccessToken,
  verifyAccessToken,
}
