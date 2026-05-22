const fs = require('fs')
const path = require('path')

const dotenv = require('dotenv')
const { PrismaClient } = require('@prisma/client')
const { PrismaPg } = require('@prisma/adapter-pg')
const { Pool } = require('pg')

const { hashValue } = require('../src/lib/password')

dotenv.config({ path: path.join(__dirname, '..', '.env') })

const EXPECTED_PROJECT_REF = process.env.SUPABASE_PROJECT_REF
const sourceUrl = process.env.LOCAL_DATABASE_URL || process.env.DATABASE_URL
const targetUrl = process.env.TARGET_DATABASE_URL
const adminUsername = process.env.ADMIN_BOOTSTRAP_USERNAME || 'AdMegamaster'
const adminPassword = process.env.ADMIN_BOOTSTRAP_PASSWORD
const registrationCode = process.env.ACCOUNT_REGISTRATION_CODE

function assertConfig() {
  if (!sourceUrl) {
    throw new Error('LOCAL_DATABASE_URL o DATABASE_URL local no esta definido.')
  }

  if (!targetUrl) {
    throw new Error('TARGET_DATABASE_URL no esta definido.')
  }

  if (!EXPECTED_PROJECT_REF || !targetUrl.includes(EXPECTED_PROJECT_REF)) {
    throw new Error('El destino no coincide con SUPABASE_PROJECT_REF.')
  }

  if (!adminPassword) {
    throw new Error('ADMIN_BOOTSTRAP_PASSWORD no esta definido.')
  }

  if (!registrationCode) {
    throw new Error('ACCOUNT_REGISTRATION_CODE no esta definido.')
  }

  if (sourceUrl === targetUrl) {
    throw new Error('Origen y destino no pueden ser la misma base de datos.')
  }
}

function createPrisma(connectionString, { ssl = false } = {}) {
  const pool = new Pool({
    connectionString,
    ...(ssl ? { ssl: { rejectUnauthorized: false } } : {}),
  })
  const adapter = new PrismaPg(pool)
  const client = new PrismaClient({
    adapter,
    log: ['warn', 'error'],
  })

  return { client, pool }
}

function batch(items, size = 200) {
  const batches = []
  for (let index = 0; index < items.length; index += size) {
    batches.push(items.slice(index, index + size))
  }
  return batches
}

async function createManyInBatches(client, delegateName, rows, size = 200) {
  if (!rows.length) {
    return 0
  }

  let total = 0
  for (const group of batch(rows, size)) {
    const result = await client[delegateName].createMany({
      data: group,
      skipDuplicates: true,
    })
    total += result.count
  }

  return total
}

async function truncatePublicTables(target) {
  const rows = await target.$queryRaw`
    SELECT tablename
    FROM pg_tables
    WHERE schemaname = 'public'
      AND tablename <> '_prisma_migrations'
      AND tablename <> 'spatial_ref_sys'
  `

  if (!rows.length) {
    return 0
  }

  const tableList = rows
    .map((row) => `"public"."${String(row.tablename).replaceAll('"', '""')}"`)
    .join(', ')

  await target.$executeRawUnsafe(
    `TRUNCATE TABLE ${tableList} RESTART IDENTITY CASCADE`
  )

  return rows.length
}

async function applySqlFile(target, relativePath) {
  const sqlPath = path.join(__dirname, '..', relativePath)
  const sql = fs.readFileSync(sqlPath, 'utf8')
  await target.$executeRawUnsafe(sql)
}

async function copyLookupTables(source, target) {
  const tableMap = [
    ['roles', 'roles'],
    ['niveles_acceso', 'niveles_acceso'],
    ['ambitos_visibilidad_personaje', 'ambitos_visibilidad_personaje'],
    ['estados_personaje', 'estados_personaje'],
    ['tiers_personaje', 'tiers_personaje'],
    ['tiers_objeto', 'tiers_objeto'],
    ['tipos_entidad', 'tipos_entidad'],
    ['tipos_lugar', 'tipos_lugar'],
    ['tipos_objeto', 'tipos_objeto'],
    ['tipos_rasgo', 'tipos_rasgo'],
    ['tipos_rasgo_objeto', 'tipos_rasgo_objeto'],
    ['tipos_relacion_wiki', 'tipos_relacion_wiki'],
  ]
  const summary = {}

  for (const [sourceDelegate, targetDelegate] of tableMap) {
    const rows = await source[sourceDelegate].findMany()
    summary[targetDelegate] = await createManyInBatches(
      target,
      targetDelegate,
      rows
    )
  }

  await target.roles.upsert({
    where: { codigo: 'administrador' },
    update: { nombre: 'Administrador' },
    create: { codigo: 'administrador', nombre: 'Administrador' },
  })
  await target.roles.upsert({
    where: { codigo: 'jugador' },
    update: { nombre: 'Jugador' },
    create: { codigo: 'jugador', nombre: 'Jugador' },
  })

  return summary
}

async function copySystemCategories(source, target) {
  const [objectCategories, characterCategories, powerCategories] =
    await Promise.all([
      source.categorias_objeto.findMany({
        where: { campana_origen_id: null, creado_por_usuario_id: null },
      }),
      source.categorias_personaje.findMany({
        where: { campana_origen_id: null, creado_por_usuario_id: null },
      }),
      source.categorias_poder.findMany({
        where: { campana_origen_id: null, creado_por_usuario_id: null },
      }),
    ])

  return {
    categorias_objeto: await createManyInBatches(
      target,
      'categorias_objeto',
      objectCategories
    ),
    categorias_personaje: await createManyInBatches(
      target,
      'categorias_personaje',
      characterCategories
    ),
    categorias_poder: await createManyInBatches(
      target,
      'categorias_poder',
      powerCategories
    ),
  }
}

async function copyClasses(source, target) {
  const classes = await source.clases.findMany({
    orderBy: [{ nombre: 'asc' }, { id: 'asc' }],
  })
  const classIds = classes.map((item) => item.id)
  const subclasses = classIds.length
    ? await source.subclases.findMany({
        where: { clase_id: { in: classIds } },
        orderBy: [{ nombre: 'asc' }, { id: 'asc' }],
      })
    : []

  const safeClasses = classes.map((item) => ({
    ...item,
    creado_por_usuario_id: null,
  }))

  return {
    clases: await createManyInBatches(target, 'clases', safeClasses, 100),
    subclases: await createManyInBatches(target, 'subclases', subclasses, 100),
  }
}

async function copyFeats(source, target) {
  const feats = await source.dotes.findMany({
    orderBy: [{ nombre: 'asc' }, { id: 'asc' }],
  })
  const safeFeats = feats.map((item) => ({
    ...item,
    creado_por_usuario_id: null,
  }))

  return {
    dotes: await createManyInBatches(target, 'dotes', safeFeats, 100),
  }
}

async function copySystemSpells(source, target) {
  const spells = await source.hechizos.findMany({
    where: { origen: 'sistema' },
    orderBy: [{ nivel: 'asc' }, { nombre: 'asc' }, { id: 'asc' }],
  })
  const safeSpells = spells.map((item) => ({
    ...item,
    creado_por_usuario_id: null,
  }))

  return {
    hechizos_sistema: await createManyInBatches(
      target,
      'hechizos',
      safeSpells,
      100
    ),
  }
}

async function createRegistrationConfig(target) {
  await target.configuracionRegistro.create({
    data: {
      max_usuarios: 25,
      registro_habilitado: true,
      hash_clave_registro: await hashValue(registrationCode),
    },
  })
}

async function createProductionAdmin(target) {
  const adminRole = await target.roles.findUnique({
    where: { codigo: 'administrador' },
  })

  if (!adminRole) {
    throw new Error('No existe el rol administrador tras el seed.')
  }

  await target.usuarios.create({
    data: {
      rol_id: adminRole.id,
      nombre_usuario: adminUsername,
      hash_contrasena: await hashValue(adminPassword),
    },
  })
}

async function countTarget(target) {
  const [
    users,
    campaigns,
    characters,
    objects,
    places,
    powers,
    userSpells,
    systemSpells,
    classes,
    feats,
  ] = await Promise.all([
    target.usuarios.count(),
    target.campanas.count(),
    target.personajes.count(),
    target.objetos.count(),
    target.lugares.count(),
    target.poderes.count(),
    target.hechizos.count({ where: { origen: { not: 'sistema' } } }),
    target.hechizos.count({ where: { origen: 'sistema' } }),
    target.clases.count(),
    target.dotes.count(),
  ])

  return {
    usuarios: users,
    campanas: campaigns,
    personajes: characters,
    objetos: objects,
    lugares: places,
    poderes: powers,
    hechizosUsuario: userSpells,
    hechizosSistema: systemSpells,
    clases: classes,
    dotes: feats,
  }
}

async function main() {
  assertConfig()

  const sourceHandle = createPrisma(sourceUrl)
  const targetHandle = createPrisma(targetUrl, { ssl: true })
  const source = sourceHandle.client
  const target = targetHandle.client

  try {
    const truncatedTables = await truncatePublicTables(target)

    await applySqlFile(
      target,
      'prisma/manual/2026-05-04_global_search_indexes.sql'
    )
    await applySqlFile(
      target,
      'prisma/manual/2026-05-09_comments_one_per_user.sql'
    )

    const lookup = await copyLookupTables(source, target)
    const categories = await copySystemCategories(source, target)
    const classes = await copyClasses(source, target)
    const feats = await copyFeats(source, target)
    const spells = await copySystemSpells(source, target)

    await createRegistrationConfig(target)
    await createProductionAdmin(target)

    const counts = await countTarget(target)

    console.log(
      JSON.stringify(
        {
          ok: true,
          truncatedTables,
          copied: {
            ...lookup,
            ...categories,
            ...classes,
            ...feats,
            ...spells,
          },
          counts,
        },
        null,
        2
      )
    )
  } finally {
    await source.$disconnect()
    await target.$disconnect()
    await sourceHandle.pool.end()
    await targetHandle.pool.end()
  }
}

main().catch((error) => {
  console.error(error.message)
  process.exit(1)
})
