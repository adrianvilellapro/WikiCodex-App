const { rateLimit } = require('express-rate-limit')

const authRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 15,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    message:
      'Has realizado demasiados intentos de autenticacion. Espera unos minutos.',
  },
})

const registrationRateLimit = rateLimit({
  windowMs: 60 * 60 * 1000,
  limit: 8,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    message:
      'Has intentado registrar demasiadas cuentas en poco tiempo. Intentalo mas tarde.',
  },
})

const apiRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 5000,
  standardHeaders: true,
  legacyHeaders: false,
  skip: (req) =>
    [req.path, req.originalUrl].some((path) =>
      [
        '/auth/login',
        '/auth/register',
        '/api/auth/login',
        '/api/auth/register',
      ].includes(path)
    ),
  message: {
    message:
      'Has superado el limite de peticiones a la API. Espera un momento.',
  },
})

module.exports = {
  authRateLimit,
  registrationRateLimit,
  apiRateLimit,
}
