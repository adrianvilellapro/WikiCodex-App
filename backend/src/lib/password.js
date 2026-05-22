const bcrypt = require('bcryptjs')

const SALT_ROUNDS = 12

async function hashValue(value) {
  return bcrypt.hash(value, SALT_ROUNDS)
}

async function verifyValue(value, hash) {
  return bcrypt.compare(value, hash)
}

module.exports = {
  hashValue,
  verifyValue,
}
