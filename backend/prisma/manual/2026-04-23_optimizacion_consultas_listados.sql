BEGIN;

CREATE INDEX IF NOT EXISTS idx_permisos_personaje_usuario_nivel_personaje
  ON permisos_personaje (usuario_id, nivel_acceso_codigo, personaje_id);

CREATE INDEX IF NOT EXISTS idx_personajes_creado_en_id
  ON personajes (creado_en DESC, id DESC);

CREATE INDEX IF NOT EXISTS idx_personajes_creador_creado_en_id
  ON personajes (creado_por_usuario_id, creado_en DESC, id DESC);

CREATE INDEX IF NOT EXISTS idx_personajes_propietario_creado_en_id
  ON personajes (propietario_usuario_id, creado_en DESC, id DESC);

CREATE INDEX IF NOT EXISTS idx_personajes_visibilidad_creado_en_id
  ON personajes (ambito_visibilidad_codigo, creado_en DESC, id DESC);

COMMIT;
