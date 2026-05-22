CREATE INDEX IF NOT EXISTS idx_personajes_archive_criatura_creado
  ON personajes (es_criatura, creado_en DESC, id DESC);

CREATE INDEX IF NOT EXISTS idx_personajes_archive_tier_creado
  ON personajes (tier_id, creado_en DESC, id DESC);

CREATE INDEX IF NOT EXISTS idx_personajes_archive_estado_creado
  ON personajes (estado_id, creado_en DESC, id DESC);

CREATE INDEX IF NOT EXISTS idx_personajes_archive_edad
  ON personajes (edad, id);

CREATE INDEX IF NOT EXISTS idx_personajes_archive_altura
  ON personajes (altura_metros, id);

CREATE INDEX IF NOT EXISTS idx_personajes_archive_peso
  ON personajes (peso_kg, id);

CREATE INDEX IF NOT EXISTS idx_asignaciones_categoria_personaje_categoria_personaje
  ON asignaciones_categoria_personaje (categoria_id, personaje_id);
