-- Categorias de catalogo de clases y entidad publica de dotes.

ALTER TABLE clases
  ADD COLUMN IF NOT EXISTS categoria_catalogo text NULL;

UPDATE clases
SET categoria_catalogo = CASE
  WHEN edicion = 'one' THEN 'one'
  WHEN fuente = 'wikicodex' OR edicion = 'wikicodex' THEN 'wikicodex'
  WHEN lower(nombre) IN (
    'artificer',
    'barbarian',
    'bard',
    'cleric',
    'druid',
    'fighter',
    'monk',
    'paladin',
    'ranger',
    'rogue',
    'sorcerer',
    'warlock',
    'wizard',
    'artificiero',
    'barbaro',
    'bárbaro',
    'bardo',
    'clerigo',
    'clérigo',
    'druida',
    'guerrero',
    'monje',
    'paladin',
    'paladín',
    'explorador',
    'picaro',
    'pícaro',
    'hechicero',
    'brujo',
    'mago'
  ) THEN 'classic'
  ELSE 'misc'
END
WHERE es_catalogo = true;

CREATE INDEX IF NOT EXISTS idx_clases_categoria_idioma_nombre_id
  ON clases(categoria_catalogo, idioma_codigo, nombre, id);

CREATE TABLE IF NOT EXISTS dotes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  creado_por_usuario_id uuid NULL,
  nombre text NOT NULL,
  nombre_normalizado text NULL,
  slug text NULL,
  idioma_codigo text NOT NULL DEFAULT 'en',
  fuente text NULL,
  edicion text NULL,
  es_catalogo boolean NOT NULL DEFAULT true,
  categoria text NULL,
  prerrequisitos jsonb NOT NULL DEFAULT '[]'::jsonb,
  descripcion text NULL,
  resumen text NULL,
  beneficios jsonb NOT NULL DEFAULT '[]'::jsonb,
  datos_fuente jsonb NOT NULL DEFAULT '{}'::jsonb,
  creado_en timestamptz NOT NULL DEFAULT now(),
  actualizado_en timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT fk_dotes_creado_por
    FOREIGN KEY (creado_por_usuario_id)
    REFERENCES usuarios(id)
    ON DELETE SET NULL
    ON UPDATE NO ACTION
);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'uq_dotes_slug_idioma_fuente'
  ) THEN
    ALTER TABLE dotes
      ADD CONSTRAINT uq_dotes_slug_idioma_fuente
      UNIQUE (slug, idioma_codigo, fuente);
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_dotes_catalogo_idioma_nombre_id
  ON dotes(es_catalogo, idioma_codigo, nombre, id);
CREATE INDEX IF NOT EXISTS idx_dotes_creador_creado_en_id
  ON dotes(creado_por_usuario_id, creado_en, id);
CREATE INDEX IF NOT EXISTS idx_dotes_nombre_normalizado
  ON dotes(nombre_normalizado);
