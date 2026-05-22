-- Otros poderes: categorias propias, privacidad, campanas multiples y permisos.

ALTER TABLE poderes
  ADD COLUMN IF NOT EXISTS ambito_visibilidad_codigo text NOT NULL DEFAULT 'usuarios_seleccionados',
  ADD COLUMN IF NOT EXISTS nombre_normalizado text;

ALTER TABLE poderes ALTER COLUMN campana_id DROP NOT NULL;
ALTER TABLE poderes ALTER COLUMN descripcion TYPE text;

UPDATE poderes
SET nombre_normalizado = lower(nombre)
WHERE nombre_normalizado IS NULL;

ALTER TABLE poderes
  DROP CONSTRAINT IF EXISTS fk_poderes_campana;

ALTER TABLE poderes
  ADD CONSTRAINT fk_poderes_campana
  FOREIGN KEY (campana_id)
  REFERENCES campanas(id)
  ON DELETE SET NULL;

CREATE TABLE IF NOT EXISTS categorias_poder (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  campana_origen_id uuid NULL,
  creado_por_usuario_id uuid NULL,
  nombre text NOT NULL UNIQUE,
  descripcion text NULL,
  es_relevante_para_campana_origen boolean NOT NULL DEFAULT false,
  creado_en timestamptz NOT NULL DEFAULT now(),
  actualizado_en timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT fk_categorias_poder_campana_origen
    FOREIGN KEY (campana_origen_id) REFERENCES campanas(id) ON UPDATE NO ACTION,
  CONSTRAINT fk_categorias_poder_creado_por
    FOREIGN KEY (creado_por_usuario_id) REFERENCES usuarios(id) ON UPDATE NO ACTION
);

CREATE TABLE IF NOT EXISTS asignaciones_categoria_poder (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  poder_id uuid NOT NULL,
  categoria_id uuid NOT NULL,
  creado_en timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT fk_asignaciones_categoria_poder_poder
    FOREIGN KEY (poder_id) REFERENCES poderes(id) ON DELETE CASCADE ON UPDATE NO ACTION,
  CONSTRAINT fk_asignaciones_categoria_poder_categoria
    FOREIGN KEY (categoria_id) REFERENCES categorias_poder(id) ON DELETE CASCADE ON UPDATE NO ACTION,
  CONSTRAINT uq_asignaciones_categoria_poder UNIQUE (poder_id, categoria_id)
);

CREATE TABLE IF NOT EXISTS permisos_poder (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  poder_id uuid NOT NULL,
  usuario_id uuid NOT NULL,
  nivel_acceso_codigo text NOT NULL,
  otorgado_por_usuario_id uuid NOT NULL,
  creado_en timestamptz NOT NULL DEFAULT now(),
  actualizado_en timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT fk_permisos_poder_poder
    FOREIGN KEY (poder_id) REFERENCES poderes(id) ON DELETE CASCADE ON UPDATE NO ACTION,
  CONSTRAINT fk_permisos_poder_usuario
    FOREIGN KEY (usuario_id) REFERENCES usuarios(id) ON DELETE CASCADE ON UPDATE NO ACTION,
  CONSTRAINT fk_permisos_poder_otorgado_por
    FOREIGN KEY (otorgado_por_usuario_id) REFERENCES usuarios(id) ON UPDATE NO ACTION,
  CONSTRAINT fk_permisos_poder_nivel_acceso
    FOREIGN KEY (nivel_acceso_codigo) REFERENCES niveles_acceso(codigo) ON UPDATE NO ACTION,
  CONSTRAINT uq_permisos_poder UNIQUE (poder_id, usuario_id)
);

CREATE TABLE IF NOT EXISTS poder_campanas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  poder_id uuid NOT NULL,
  campana_id uuid NOT NULL,
  creado_en timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT fk_poder_campanas_poder
    FOREIGN KEY (poder_id) REFERENCES poderes(id) ON DELETE CASCADE ON UPDATE NO ACTION,
  CONSTRAINT fk_poder_campanas_campana
    FOREIGN KEY (campana_id) REFERENCES campanas(id) ON DELETE CASCADE ON UPDATE NO ACTION,
  CONSTRAINT uq_poder_campanas UNIQUE (poder_id, campana_id)
);

INSERT INTO poder_campanas (poder_id, campana_id)
SELECT id, campana_id
FROM poderes
WHERE campana_id IS NOT NULL
ON CONFLICT DO NOTHING;

CREATE INDEX IF NOT EXISTS idx_asignaciones_categoria_poder_categoria_id
  ON asignaciones_categoria_poder(categoria_id);
CREATE INDEX IF NOT EXISTS idx_permisos_poder_poder_id
  ON permisos_poder(poder_id);
CREATE INDEX IF NOT EXISTS idx_permisos_poder_usuario_id
  ON permisos_poder(usuario_id);
CREATE INDEX IF NOT EXISTS idx_permisos_poder_usuario_nivel_poder
  ON permisos_poder(usuario_id, nivel_acceso_codigo, poder_id);
CREATE INDEX IF NOT EXISTS idx_poder_campanas_campana_id
  ON poder_campanas(campana_id);
CREATE INDEX IF NOT EXISTS idx_poder_campanas_poder_id
  ON poder_campanas(poder_id);
CREATE INDEX IF NOT EXISTS idx_poderes_visibilidad_creado_en_id
  ON poderes(ambito_visibilidad_codigo, creado_en, id);
CREATE INDEX IF NOT EXISTS idx_poderes_creador_creado_en_id
  ON poderes(creado_por_usuario_id, creado_en, id);
CREATE INDEX IF NOT EXISTS idx_poderes_nombre_normalizado
  ON poderes(nombre_normalizado);
