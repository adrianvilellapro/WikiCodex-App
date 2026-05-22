const EXTERNAL_RESOURCE_FILES = Object.freeze([
  'epic-characters-v3-1.pdf',
  'ficha-clasica-editable.pdf',
  'vieja-escuela-avanzado.pdf',
  'vieja-escuela-base.pdf',
  'vieja-escuela-ficha-personaje.pdf',
])

const EXTERNAL_RESOURCE_FILE_SET = new Set(EXTERNAL_RESOURCE_FILES)

function isExternalResourceFile(fileName) {
  return EXTERNAL_RESOURCE_FILE_SET.has(fileName)
}

module.exports = {
  EXTERNAL_RESOURCE_FILES,
  isExternalResourceFile,
}
