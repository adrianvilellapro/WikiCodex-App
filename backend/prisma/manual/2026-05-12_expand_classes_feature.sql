-- Clases como entidad completa: idioma, campañas, contenido, rasgos e importación 5etools.

ALTER TABLE clases
  ADD COLUMN IF NOT EXISTS creado_por_usuario_id uuid NULL,
  ADD COLUMN IF NOT EXISTS nombre_normalizado text NULL,
  ADD COLUMN IF NOT EXISTS slug text NULL,
  ADD COLUMN IF NOT EXISTS idioma_codigo text NOT NULL DEFAULT 'en',
  ADD COLUMN IF NOT EXISTS fuente text NULL,
  ADD COLUMN IF NOT EXISTS edicion text NULL,
  ADD COLUMN IF NOT EXISTS descripcion text NULL,
  ADD COLUMN IF NOT EXISTS resumen text NULL,
  ADD COLUMN IF NOT EXISTS icono text NULL,
  ADD COLUMN IF NOT EXISTS dado_golpe_caras integer NULL,
  ADD COLUMN IF NOT EXISTS salvaciones jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS competencias jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS equipo_inicial jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS tabla jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS rasgos jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS datos_fuente jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS creado_en timestamptz NOT NULL DEFAULT now(),
  ADD COLUMN IF NOT EXISTS actualizado_en timestamptz NOT NULL DEFAULT now();

ALTER TABLE subclases
  ADD COLUMN IF NOT EXISTS nombre_normalizado text NULL,
  ADD COLUMN IF NOT EXISTS slug text NULL,
  ADD COLUMN IF NOT EXISTS fuente text NULL,
  ADD COLUMN IF NOT EXISTS descripcion text NULL,
  ADD COLUMN IF NOT EXISTS resumen text NULL,
  ADD COLUMN IF NOT EXISTS rasgos jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS datos_fuente jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS creado_en timestamptz NOT NULL DEFAULT now(),
  ADD COLUMN IF NOT EXISTS actualizado_en timestamptz NOT NULL DEFAULT now();

UPDATE clases
SET
  nombre_normalizado = COALESCE(nombre_normalizado, public.wikicodex_search_normalize(nombre)),
  slug = COALESCE(slug, public.wikicodex_search_normalize(nombre)),
  fuente = COALESCE(fuente, 'manual'),
  idioma_codigo = COALESCE(idioma_codigo, 'en')
WHERE nombre_normalizado IS NULL
   OR slug IS NULL
   OR fuente IS NULL
   OR idioma_codigo IS NULL;

UPDATE subclases
SET
  nombre_normalizado = COALESCE(nombre_normalizado, public.wikicodex_search_normalize(nombre)),
  slug = COALESCE(slug, public.wikicodex_search_normalize(nombre)),
  fuente = COALESCE(fuente, 'manual')
WHERE nombre_normalizado IS NULL
   OR slug IS NULL
   OR fuente IS NULL;

ALTER TABLE clases
  DROP CONSTRAINT IF EXISTS clases_nombre_key;

ALTER TABLE subclases
  DROP CONSTRAINT IF EXISTS uq_subclases_clase_nombre;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'fk_clases_creado_por'
  ) THEN
    ALTER TABLE clases
      ADD CONSTRAINT fk_clases_creado_por
      FOREIGN KEY (creado_por_usuario_id)
      REFERENCES usuarios(id)
      ON DELETE NO ACTION
      ON UPDATE NO ACTION;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'uq_clases_slug_idioma_fuente'
  ) THEN
    ALTER TABLE clases
      ADD CONSTRAINT uq_clases_slug_idioma_fuente
      UNIQUE (slug, idioma_codigo, fuente);
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'uq_subclases_clase_nombre_fuente'
  ) THEN
    ALTER TABLE subclases
      ADD CONSTRAINT uq_subclases_clase_nombre_fuente
      UNIQUE (clase_id, nombre, fuente);
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS clase_campanas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  clase_id uuid NOT NULL,
  campana_id uuid NOT NULL,
  creado_en timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT fk_clase_campanas_clase
    FOREIGN KEY (clase_id)
    REFERENCES clases(id)
    ON DELETE CASCADE
    ON UPDATE NO ACTION,
  CONSTRAINT fk_clase_campanas_campana
    FOREIGN KEY (campana_id)
    REFERENCES campanas(id)
    ON DELETE CASCADE
    ON UPDATE NO ACTION,
  CONSTRAINT uq_clase_campanas UNIQUE (clase_id, campana_id)
);

CREATE INDEX IF NOT EXISTS idx_clases_creador_creado_en_id
  ON clases(creado_por_usuario_id, creado_en, id);
CREATE INDEX IF NOT EXISTS idx_clases_idioma_nombre_id
  ON clases(idioma_codigo, nombre, id);
CREATE INDEX IF NOT EXISTS idx_clases_nombre_normalizado
  ON clases(nombre_normalizado);
CREATE INDEX IF NOT EXISTS idx_subclases_clase_nombre_id
  ON subclases(clase_id, nombre, id);
CREATE INDEX IF NOT EXISTS idx_subclases_nombre_normalizado
  ON subclases(nombre_normalizado);
CREATE INDEX IF NOT EXISTS idx_clase_campanas_campana_id
  ON clase_campanas(campana_id);
CREATE INDEX IF NOT EXISTS idx_clase_campanas_clase_id
  ON clase_campanas(clase_id);
