const { z } = require('zod')

function validate(schema) {
  return (req, _res, next) => {
    const target = {
      body: req.body || {},
      params: req.params || {},
      query: req.query || {},
    }

    const result = schema.safeParse(target)

    if (!result.success) {
      const error = new Error('Los datos enviados no son validos.')
      error.status = 400
      error.issues = z.flattenError(result.error).fieldErrors
      return next(error)
    }

    req.validated = result.data
    next()
  }
}

module.exports = {
  validate,
}
