const { pool } = require('../lib/prisma')

const VISIBLE_PERMISSION_CODES = ['completo', 'full', 'vista_previa', 'preview']
const PUBLIC_VISIBILITY_CODES = ['campana_completo', 'campana_vista_previa']
const SEARCH_TYPES = [
  'character',
  'object',
  'place',
  'spell',
  'campaign',
  'user',
]

function normalizeSearchTerm(value) {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim()
    .replace(/\s+/g, ' ')
}

function escapeLikeTerm(value) {
  return value.replace(/[\\%_]/g, (match) => `\\${match}`)
}

function getNameMatchSql(columnSql) {
  return `
    (
      ($5::boolean = true AND public.wikicodex_search_normalize(${columnSql}) LIKE $3 || '%' ESCAPE '\\')
      OR
      ($5::boolean = false AND public.wikicodex_search_normalize(${columnSql}) LIKE '%' || $3 || '%' ESCAPE '\\')
    )
  `
}

function getNameOrderSql(columnSql) {
  return `
    CASE
      WHEN public.wikicodex_search_normalize(${columnSql}) = $2 THEN 0
      WHEN public.wikicodex_search_normalize(${columnSql}) LIKE $3 || '%' ESCAPE '\\' THEN 1
      ELSE 2
    END,
    ${columnSql} ASC
  `
}

function adminBypassSql(alias) {
  return `($4::boolean = true OR ${alias})`
}

function characterVisibilitySql() {
  return adminBypassSql(`
    p.propietario_usuario_id = $1::uuid
    OR EXISTS (
      SELECT 1
      FROM permisos_personaje pp
      WHERE pp.personaje_id = p.id
        AND pp.usuario_id = $1::uuid
        AND pp.nivel_acceso_codigo = ANY($7::text[])
    )
    OR EXISTS (
      SELECT 1
      FROM campanas c
      WHERE c.id = p.campana_id
        AND c.master_usuario_id = $1::uuid
    )
    OR (
      p.ambito_visibilidad_codigo = ANY($8::text[])
      AND EXISTS (
        SELECT 1
        FROM campanas c
        WHERE c.id = p.campana_id
          AND (
            c.master_usuario_id = $1::uuid
            OR c.privacidad_codigo = 'publica'
            OR EXISTS (
              SELECT 1
              FROM campana_jugadores cj
              WHERE cj.campana_id = c.id
                AND cj.usuario_id = $1::uuid
            )
          )
      )
    )
  `)
}

function objectVisibilitySql() {
  return adminBypassSql(`
    o.creado_por_usuario_id = $1::uuid
    OR EXISTS (
      SELECT 1
      FROM permisos_objeto po
      WHERE po.objeto_id = o.id
        AND po.usuario_id = $1::uuid
        AND po.nivel_acceso_codigo = ANY($7::text[])
    )
    OR EXISTS (
      SELECT 1
      FROM objeto_campanas oc
      JOIN campanas c ON c.id = oc.campana_id
      WHERE oc.objeto_id = o.id
        AND (
          c.master_usuario_id = $1::uuid
          OR EXISTS (
            SELECT 1 FROM campana_jugadores cj
            WHERE cj.campana_id = c.id AND cj.usuario_id = $1::uuid
          )
        )
    )
    OR EXISTS (
      SELECT 1
      FROM campanas c
      WHERE c.id = o.campana_id
        AND (
          c.master_usuario_id = $1::uuid
          OR EXISTS (
            SELECT 1 FROM campana_jugadores cj
            WHERE cj.campana_id = c.id AND cj.usuario_id = $1::uuid
          )
        )
    )
    OR (
      o.ambito_visibilidad_codigo = ANY($8::text[])
      AND (
        (o.campana_id IS NULL AND NOT EXISTS (
          SELECT 1 FROM objeto_campanas oc WHERE oc.objeto_id = o.id
        ))
        OR EXISTS (
          SELECT 1
          FROM objeto_campanas oc
          JOIN campanas c ON c.id = oc.campana_id
          WHERE oc.objeto_id = o.id
            AND (
              c.master_usuario_id = $1::uuid
              OR c.privacidad_codigo = 'publica'
              OR EXISTS (
                SELECT 1 FROM campana_jugadores cj
                WHERE cj.campana_id = c.id AND cj.usuario_id = $1::uuid
              )
            )
        )
        OR EXISTS (
          SELECT 1
          FROM campanas c
          WHERE c.id = o.campana_id
            AND (
              c.master_usuario_id = $1::uuid
              OR c.privacidad_codigo = 'publica'
              OR EXISTS (
                SELECT 1 FROM campana_jugadores cj
                WHERE cj.campana_id = c.id AND cj.usuario_id = $1::uuid
              )
            )
        )
      )
    )
  `)
}

function placeVisibilitySql() {
  return adminBypassSql(`
    l.creado_por_usuario_id = $1::uuid
    OR EXISTS (
      SELECT 1
      FROM permisos_lugar pl
      WHERE pl.lugar_id = l.id
        AND pl.usuario_id = $1::uuid
        AND pl.nivel_acceso_codigo = ANY($7::text[])
    )
    OR EXISTS (
      SELECT 1
      FROM lugar_campanas lc
      JOIN campanas c ON c.id = lc.campana_id
      WHERE lc.lugar_id = l.id
        AND (
          c.master_usuario_id = $1::uuid
          OR EXISTS (
            SELECT 1 FROM campana_jugadores cj
            WHERE cj.campana_id = c.id AND cj.usuario_id = $1::uuid
          )
        )
    )
    OR EXISTS (
      SELECT 1
      FROM campanas c
      WHERE c.id = l.campana_id
        AND (
          c.master_usuario_id = $1::uuid
          OR EXISTS (
            SELECT 1 FROM campana_jugadores cj
            WHERE cj.campana_id = c.id AND cj.usuario_id = $1::uuid
          )
        )
    )
    OR (
      l.ambito_visibilidad_codigo = ANY($8::text[])
      AND (
        (l.campana_id IS NULL AND NOT EXISTS (
          SELECT 1 FROM lugar_campanas lc WHERE lc.lugar_id = l.id
        ))
        OR EXISTS (
          SELECT 1
          FROM lugar_campanas lc
          JOIN campanas c ON c.id = lc.campana_id
          WHERE lc.lugar_id = l.id
            AND (
              c.master_usuario_id = $1::uuid
              OR c.privacidad_codigo = 'publica'
              OR EXISTS (
                SELECT 1 FROM campana_jugadores cj
                WHERE cj.campana_id = c.id AND cj.usuario_id = $1::uuid
              )
            )
        )
        OR EXISTS (
          SELECT 1
          FROM campanas c
          WHERE c.id = l.campana_id
            AND (
              c.master_usuario_id = $1::uuid
              OR c.privacidad_codigo = 'publica'
              OR EXISTS (
                SELECT 1 FROM campana_jugadores cj
                WHERE cj.campana_id = c.id AND cj.usuario_id = $1::uuid
              )
            )
        )
      )
    )
  `)
}

function spellVisibilitySql() {
  return adminBypassSql(`
    s.es_publico = true
    OR s.creado_por_usuario_id = $1::uuid
    OR EXISTS (
      SELECT 1
      FROM hechizos_guardados_usuario hgu
      WHERE hgu.hechizo_id = s.id
        AND hgu.usuario_id = $1::uuid
    )
    OR EXISTS (
      SELECT 1
      FROM hechizo_campanas hc
      JOIN campanas c ON c.id = hc.campana_id
      WHERE hc.hechizo_id = s.id
        AND (
          c.master_usuario_id = $1::uuid
          OR EXISTS (
            SELECT 1 FROM campana_jugadores cj
            WHERE cj.campana_id = c.id AND cj.usuario_id = $1::uuid
          )
        )
    )
    OR EXISTS (
      SELECT 1
      FROM personaje_hechizos ph
      JOIN personajes p ON p.id = ph.personaje_id
      JOIN campanas c ON c.id = p.campana_id
      WHERE ph.hechizo_id = s.id
        AND c.master_usuario_id = $1::uuid
    )
    OR EXISTS (
      SELECT 1
      FROM objeto_hechizos oh
      JOIN objetos o ON o.id = oh.objeto_id
      WHERE oh.hechizo_id = s.id
        AND (
          o.creado_por_usuario_id = $1::uuid
          OR EXISTS (
            SELECT 1
            FROM campanas c
            WHERE c.id = o.campana_id
              AND c.master_usuario_id = $1::uuid
          )
          OR EXISTS (
            SELECT 1
            FROM objeto_campanas oc
            JOIN campanas c ON c.id = oc.campana_id
            WHERE oc.objeto_id = o.id
              AND c.master_usuario_id = $1::uuid
          )
        )
    )
  `)
}

function powerVisibilitySql() {
  return adminBypassSql(`
    p.creado_por_usuario_id = $1::uuid
    OR EXISTS (
      SELECT 1
      FROM permisos_poder pp
      WHERE pp.poder_id = p.id
        AND pp.usuario_id = $1::uuid
        AND pp.nivel_acceso_codigo = ANY($7::text[])
    )
    OR EXISTS (
      SELECT 1
      FROM campanas c
      WHERE c.id = p.campana_id
        AND c.master_usuario_id = $1::uuid
    )
    OR EXISTS (
      SELECT 1
      FROM poder_campanas pc
      JOIN campanas c ON c.id = pc.campana_id
      WHERE pc.poder_id = p.id
        AND c.master_usuario_id = $1::uuid
    )
    OR (
      p.ambito_visibilidad_codigo = ANY($8::text[])
      AND (
        (p.campana_id IS NULL AND NOT EXISTS (
          SELECT 1 FROM poder_campanas pc WHERE pc.poder_id = p.id
        ))
        OR EXISTS (
          SELECT 1
          FROM campanas c
          WHERE c.id = p.campana_id
            AND (
              c.master_usuario_id = $1::uuid
              OR c.privacidad_codigo = 'publica'
              OR EXISTS (
                SELECT 1 FROM campana_jugadores cj
                WHERE cj.campana_id = c.id AND cj.usuario_id = $1::uuid
              )
            )
        )
        OR EXISTS (
          SELECT 1
          FROM poder_campanas pc
          JOIN campanas c ON c.id = pc.campana_id
          WHERE pc.poder_id = p.id
            AND (
              c.master_usuario_id = $1::uuid
              OR c.privacidad_codigo = 'publica'
              OR EXISTS (
                SELECT 1 FROM campana_jugadores cj
                WHERE cj.campana_id = c.id AND cj.usuario_id = $1::uuid
              )
            )
        )
      )
    )
  `)
}

function campaignVisibilitySql() {
  return adminBypassSql(`
    c.master_usuario_id = $1::uuid
    OR c.privacidad_codigo = 'publica'
    OR EXISTS (
      SELECT 1
      FROM campana_jugadores cj
      WHERE cj.campana_id = c.id
        AND cj.usuario_id = $1::uuid
    )
  `)
}

function getHighestSqlParam(sql) {
  const matches = [...sql.matchAll(/\$(\d+)/g)]
  return matches.reduce(
    (highest, match) => Math.max(highest, Number(match[1])),
    0
  )
}

async function runSearchQuery({
  sql,
  userId,
  term,
  escapedTerm,
  prefixOnly,
  isAdmin,
  limit,
}) {
  const params = [
    userId,
    term,
    escapedTerm,
    isAdmin,
    prefixOnly,
    limit,
    VISIBLE_PERMISSION_CODES,
    PUBLIC_VISIBILITY_CODES,
  ]
  const result = await pool.query(sql, params.slice(0, getHighestSqlParam(sql)))

  return result.rows
}

function buildEntityQuery({
  table,
  alias,
  type,
  nameColumn,
  urlExpression,
  visibilitySql,
}) {
  return `
    SELECT
      '${type}' AS type,
      ${alias}.id::text AS id,
      ${nameColumn}::text AS name,
      ${urlExpression} AS url
    FROM ${table} ${alias}
    WHERE ${getNameMatchSql(nameColumn)}
      AND (${visibilitySql})
    ORDER BY ${getNameOrderSql(nameColumn)}
    LIMIT $6
  `
}

async function searchGlobal({ req, query, limit = 6, types = SEARCH_TYPES }) {
  const term = normalizeSearchTerm(query)

  if (!term) {
    return { items: [], grouped: {}, meta: { query: term, returned: 0 } }
  }

  const safeLimit = Math.max(1, Math.min(Number(limit || 6), 10))
  const prefixOnly = term.length < 3
  const escapedTerm = escapeLikeTerm(term)
  const isAdmin = req.auth.roleCode === 'administrador'
  const enabledTypes = new Set(
    types.filter((type) => SEARCH_TYPES.includes(type))
  )
  const queryConfigs = [
    {
      type: 'character',
      sql: buildEntityQuery({
        table: 'personajes',
        alias: 'p',
        type: 'character',
        nameColumn: 'p.nombre',
        urlExpression: "'/app/personajes/' || p.id::text",
        visibilitySql: characterVisibilitySql(),
      }),
    },
    {
      type: 'object',
      sql: buildEntityQuery({
        table: 'objetos',
        alias: 'o',
        type: 'object',
        nameColumn: 'o.nombre',
        urlExpression: "'/app/objetos/' || o.id::text",
        visibilitySql: objectVisibilitySql(),
      }),
    },
    {
      type: 'place',
      sql: buildEntityQuery({
        table: 'lugares',
        alias: 'l',
        type: 'place',
        nameColumn: 'l.nombre',
        urlExpression: "'/app/lugares/' || l.id::text",
        visibilitySql: placeVisibilitySql(),
      }),
    },
    {
      type: 'spell',
      sql: buildEntityQuery({
        table: 'hechizos',
        alias: 's',
        type: 'spell',
        nameColumn: 's.nombre',
        urlExpression: "'/app/poderes/hechizos/' || s.id::text",
        visibilitySql: spellVisibilitySql(),
      }),
    },
    {
      type: 'power',
      sql: buildEntityQuery({
        table: 'poderes',
        alias: 'p',
        type: 'power',
        nameColumn: 'p.nombre',
        urlExpression: "'/app/poderes/otros/' || p.id::text",
        visibilitySql: powerVisibilitySql(),
      }),
    },
    {
      type: 'campaign',
      sql: buildEntityQuery({
        table: 'campanas',
        alias: 'c',
        type: 'campaign',
        nameColumn: 'c.nombre',
        urlExpression: "'/app/campanas/' || c.id::text",
        visibilitySql: campaignVisibilitySql(),
      }),
    },
    {
      type: 'user',
      sql: `
        SELECT
          'user' AS type,
          u.id::text AS id,
          u.nombre_usuario::text AS name,
          '/app/perfiles/' || u.id::text AS url
        FROM usuarios u
        JOIN roles r ON r.id = u.rol_id
        WHERE ${getNameMatchSql('u.nombre_usuario::text')}
          AND r.codigo <> 'administrador'
          AND $1::uuid IS NOT NULL
          AND $4::boolean IN (true, false)
        ORDER BY ${getNameOrderSql('u.nombre_usuario::text')}
        LIMIT $6
      `,
    },
  ].filter((config) => enabledTypes.has(config.type))

  const results = await Promise.all(
    queryConfigs.map(async (config) => [
      config.type,
      await runSearchQuery({
        sql: config.sql,
        userId: req.auth.userId,
        term,
        escapedTerm,
        prefixOnly,
        isAdmin,
        limit: safeLimit,
      }),
    ])
  )

  const grouped = {}
  const items = []

  for (const [type, rows] of results) {
    grouped[type] = rows
    items.push(...rows)
  }

  return {
    items,
    grouped,
    meta: {
      query: term,
      perTypeLimit: safeLimit,
      prefixOnly,
      returned: items.length,
    },
  }
}

module.exports = {
  SEARCH_TYPES,
  searchGlobal,
}
