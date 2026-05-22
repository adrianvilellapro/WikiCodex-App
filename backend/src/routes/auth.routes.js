const { Router } = require('express')
const { z } = require('zod')

const { prisma } = require('../lib/prisma')
const { hashValue, verifyValue } = require('../lib/password')
const { signAccessToken } = require('../lib/jwt')
const { asyncHandler } = require('../lib/async-handler')
const { createHttpError } = require('../lib/errors')
const { validate } = require('../middlewares/validate.middleware')
const {
  authRateLimit,
  registrationRateLimit,
} = require('../middlewares/rate-limit.middleware')
const {
  getAttemptState,
  registerFailedAttempt,
  clearFailedAttempts,
} = require('../services/auth-throttle.service')
const {
  getRegistrationCapacity,
} = require('../services/registration-config.service')
const {
  requireAuth,
  authUserInclude,
} = require('../middlewares/auth.middleware')
const {
  createAdminSession,
  revokeAdminSession,
  rotateAdminSession,
} = require('../services/admin-session.service')
const { passwordSchema, usernameSchema } = require('./users.routes')

const authRouter = Router()

const registerSchema = z.object({
  body: z
    .object({
      nombreUsuario: usernameSchema,
      contrasena: passwordSchema,
      claveRegistro: passwordSchema,
    })
    .strict(),
  params: z.object({}).strict(),
  query: z.object({}).strict(),
})

const loginSchema = z.object({
  body: z
    .object({
      nombreUsuario: usernameSchema,
      contrasena: z.string().min(1),
    })
    .strict(),
  params: z.object({}).strict(),
  query: z.object({}).strict(),
})

function serializeUser(user) {
  return {
    id: user.id,
    nombreUsuario: user.nombre_usuario,
    imagenPerfilUrl: user.imagen_perfil_url,
    temaModo: user.tema_modo || 'light',
    temaColorHex: user.tema_color_hex || '#026b00',
    modoVisualFichas: user.modo_visual_fichas || 'wikicodex',
    creadoEn: user.creado_en,
    actualizadoEn: user.actualizado_en,
    rol: user.roles
      ? {
          id: user.roles.id,
          codigo: user.roles.codigo,
          nombre: user.roles.nombre,
        }
      : null,
  }
}

async function getPlayerRole() {
  const role = await prisma.roles.findUnique({
    where: { codigo: 'jugador' },
  })

  if (!role) {
    throw createHttpError(
      500,
      'No existe el rol "jugador" en la base de datos.'
    )
  }

  return role
}

authRouter.post(
  '/register',
  registrationRateLimit,
  validate(registerSchema),
  asyncHandler(async (req, res) => {
    const data = req.validated.body
    const nombreUsuario = data.nombreUsuario.trim()

    const existingUser = await prisma.usuarios.findUnique({
      where: { nombre_usuario: nombreUsuario },
      select: { id: true },
    })

    if (existingUser) {
      throw createHttpError(409, 'Ese nombre de usuario ya esta en uso.')
    }

    const [{ config, totalUsuarios, plazasRestantes }, playerRole] =
      await Promise.all([getRegistrationCapacity(), getPlayerRole()])

    if (!config.registro_habilitado) {
      throw createHttpError(
        403,
        'El registro de nuevas cuentas esta deshabilitado.'
      )
    }

    if (totalUsuarios >= config.max_usuarios) {
      throw createHttpError(
        403,
        'Se ha alcanzado el numero maximo de usuarios permitidos.',
        {
          maxUsuarios: config.max_usuarios,
          totalUsuarios,
          plazasRestantes,
          limiteAlcanzado: true,
        }
      )
    }

    const isRegistrationCodeValid = await verifyValue(
      data.claveRegistro,
      config.hash_clave_registro
    )

    if (!isRegistrationCodeValid) {
      throw createHttpError(403, 'La clave secreta de registro no es correcta.')
    }

    const user = await prisma.usuarios.create({
      data: {
        rol_id: playerRole.id,
        nombre_usuario: nombreUsuario,
        hash_contrasena: await hashValue(data.contrasena),
      },
      include: authUserInclude,
    })

    const token = signAccessToken(user)

    res.status(201).json({
      message: 'Cuenta normal creada correctamente.',
      token,
      usuario: serializeUser(user),
      capacidadRegistro: {
        maxUsuarios: config.max_usuarios,
        totalUsuarios: totalUsuarios + 1,
        plazasRestantes: Math.max(plazasRestantes - 1, 0),
        limiteAlcanzado: totalUsuarios + 1 >= config.max_usuarios,
      },
    })
  })
)

authRouter.post(
  '/login',
  authRateLimit,
  validate(loginSchema),
  asyncHandler(async (req, res) => {
    const data = req.validated.body
    const attemptState = getAttemptState(req, data.nombreUsuario)

    if (attemptState.isLocked) {
      throw createHttpError(
        429,
        'Has superado el numero maximo de intentos fallidos. Espera antes de volver a intentarlo.',
        {
          remainingMs: attemptState.remainingMs,
        }
      )
    }

    const user = await prisma.usuarios.findUnique({
      where: { nombre_usuario: data.nombreUsuario.trim() },
      include: authUserInclude,
    })

    if (!user) {
      registerFailedAttempt(req, data.nombreUsuario)
      throw createHttpError(401, 'Credenciales incorrectas.')
    }

    const isPasswordValid = await verifyValue(
      data.contrasena,
      user.hash_contrasena
    )

    if (!isPasswordValid) {
      registerFailedAttempt(req, data.nombreUsuario)
      throw createHttpError(401, 'Credenciales incorrectas.')
    }

    clearFailedAttempts(req, data.nombreUsuario)

    const isAdmin = user.roles.codigo === 'administrador'
    const adminSession = isAdmin ? await createAdminSession(user.id) : null
    const token = signAccessToken(user, {
      adminSession,
      expiresIn: isAdmin ? '5m' : undefined,
    })

    res.json({
      message: 'Sesion iniciada correctamente.',
      token,
      usuario: serializeUser(user),
      adminSession: adminSession
        ? {
            expiresAt: adminSession.expiresAt,
            tokenTtlMs: adminSession.tokenTtlMs,
            rotationIntervalMs: adminSession.rotationIntervalMs,
          }
        : null,
    })
  })
)

authRouter.post(
  '/admin-session/rotate',
  requireAuth,
  asyncHandler(async (req, res) => {
    if (req.auth.roleCode !== 'administrador') {
      throw createHttpError(
        403,
        'Solo una cuenta administradora puede rotar esta sesion.'
      )
    }

    const adminSession = await rotateAdminSession(
      req.auth.tokenPayload,
      req.auth.userId
    )
    const token = signAccessToken(req.user, {
      adminSession,
      expiresIn: '5m',
    })

    res.json({
      token,
      usuario: serializeUser(req.user),
      adminSession: {
        expiresAt: adminSession.expiresAt,
        tokenTtlMs: adminSession.tokenTtlMs,
        rotationIntervalMs: adminSession.rotationIntervalMs,
      },
    })
  })
)

authRouter.post(
  '/logout',
  requireAuth,
  asyncHandler(async (req, res) => {
    if (req.auth.roleCode === 'administrador') {
      await revokeAdminSession(req.auth.tokenPayload, req.auth.userId)
    }

    res.status(204).send()
  })
)

authRouter.get(
  '/me',
  requireAuth,
  asyncHandler(async (req, res) => {
    res.json({
      usuario: serializeUser(req.user),
    })
  })
)

module.exports = {
  authRouter,
}
