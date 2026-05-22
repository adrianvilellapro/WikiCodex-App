const { prisma } = require('../lib/prisma')
const { hashValue } = require('../lib/password')
const { env } = require('../config/env')

async function getRegistrationConfig() {
  const currentConfig = await prisma.configuracionRegistro.findFirst()

  if (currentConfig) {
    return currentConfig
  }

  return prisma.configuracionRegistro.create({
    data: {
      max_usuarios: 25,
      registro_habilitado: true,
      hash_clave_registro: await hashValue(env.ACCOUNT_REGISTRATION_CODE),
    },
  })
}

async function updateRegistrationCode(newCode) {
  const currentConfig = await getRegistrationConfig()

  return prisma.configuracionRegistro.update({
    where: { id: currentConfig.id },
    data: {
      hash_clave_registro: await hashValue(newCode),
    },
  })
}

async function getRegistrationCapacity() {
  const [config, totalUsuarios] = await Promise.all([
    getRegistrationConfig(),
    prisma.usuarios.count(),
  ])

  const plazasRestantes = Math.max(config.max_usuarios - totalUsuarios, 0)
  const limiteAlcanzado = totalUsuarios >= config.max_usuarios

  return {
    config,
    totalUsuarios,
    plazasRestantes,
    limiteAlcanzado,
  }
}

module.exports = {
  getRegistrationCapacity,
  getRegistrationConfig,
  updateRegistrationCode,
}
