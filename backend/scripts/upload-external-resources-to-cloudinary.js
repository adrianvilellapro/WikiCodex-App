const fs = require('fs')
const path = require('path')

const { EXTERNAL_RESOURCE_FILES } = require('../src/config/external-resources')
const {
  EXTERNAL_RESOURCE_FOLDER,
  getExternalResourcePublicId,
} = require('../src/lib/external-resource-cloudinary')
const { cloudinary } = require('../src/lib/cloudinary')

const RESOURCE_DIRECTORY = path.resolve(__dirname, '../resources/external')

async function uploadResource(fileName) {
  const filePath = path.join(RESOURCE_DIRECTORY, fileName)

  if (!fs.existsSync(filePath)) {
    throw new Error(`No existe el PDF local: ${filePath}`)
  }

  return cloudinary.uploader.upload(filePath, {
    resource_type: 'raw',
    public_id: getExternalResourcePublicId(fileName),
    overwrite: true,
    use_filename: false,
    unique_filename: false,
  })
}

async function main() {
  console.log(`Subiendo PDFs a Cloudinary: ${EXTERNAL_RESOURCE_FOLDER}`)
  const failedUploads = []

  for (const fileName of EXTERNAL_RESOURCE_FILES) {
    try {
      const result = await uploadResource(fileName)

      console.log(`${fileName} -> ${result.secure_url}`)
    } catch (error) {
      failedUploads.push({ fileName, message: error.message })
      console.error(`${fileName} -> ERROR: ${error.message}`)
    }
  }

  if (failedUploads.length > 0) {
    throw new Error(
      `No se pudieron subir ${failedUploads.length} recurso(s). Revisa el limite de tamano de Cloudinary o reduce esos PDFs.`
    )
  }
}

main().catch((error) => {
  console.error(error)
  process.exitCode = 1
})
