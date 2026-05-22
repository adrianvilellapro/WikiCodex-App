function errorHandler(error, _req, res, _next) {
  void _next
  let status = error.status || 500
  let message = error.message || 'Ha ocurrido un error inesperado.'

  if (error.name === 'ZodError') {
    status = 400
    message = 'Los datos enviados no son validos.'
  }

  if (error.code === 'P2002') {
    status = 409
    message = 'Ya existe un registro con un valor unico duplicado.'
  }

  if (error.code === 'P2025') {
    status = 404
    message = 'No se ha encontrado el registro solicitado.'
  }

  const isProduction = process.env.NODE_ENV === 'production'

  if (isProduction && status >= 500) {
    message = 'Ha ocurrido un error inesperado.'
  }

  const payload = {
    message,
  }

  if (!isProduction && error.details) {
    payload.details = error.details
  }

  if (error.issues && (!isProduction || status < 500)) {
    payload.details = error.issues
  }

  if (!isProduction && error.stack) {
    payload.stack = error.stack
  }

  res.status(status).json(payload)
}

module.exports = {
  errorHandler,
}
