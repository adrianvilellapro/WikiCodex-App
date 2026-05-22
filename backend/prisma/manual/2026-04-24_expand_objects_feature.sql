ALTER TABLE objetos
    ADD COLUMN IF NOT EXISTS objeto_base_id UUID,
    ADD COLUMN IF NOT EXISTS ambito_visibilidad_codigo TEXT NOT NULL DEFAULT 'privado',
    ADD COLUMN IF NOT EXISTS tipo_magico_codigo TEXT NOT NULL DEFAULT 'no_magico',
    ADD COLUMN IF NOT EXISTS modificador_valor INTEGER,
    ADD COLUMN IF NOT EXISTS modificador_tipo_codigo TEXT,
    ADD COLUMN IF NOT EXISTS modificador_otro TEXT;

ALTER TABLE objetos
    ALTER COLUMN campana_id DROP NOT NULL;

INSERT INTO tiers_objeto (nombre, orden_visualizacion)
SELECT tier.nombre, tier.orden_visualizacion
FROM (
    VALUES
        ('Comun', 1),
        ('Poco Comun', 2),
        ('Raro', 3),
        ('Muy Raro', 4),
        ('Legendario', 5)
) AS tier(nombre, orden_visualizacion)
WHERE NOT EXISTS (
    SELECT 1
    FROM tiers_objeto existing
    WHERE existing.nombre = tier.nombre
);

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conname = 'fk_objetos_base'
    ) THEN
        ALTER TABLE objetos
            ADD CONSTRAINT fk_objetos_base
            FOREIGN KEY (objeto_base_id) REFERENCES objetos(id) ON DELETE SET NULL;
    END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_objetos_objeto_base_id
    ON objetos (objeto_base_id);

CREATE INDEX IF NOT EXISTS idx_objetos_visibilidad_creado_en_id
    ON objetos (ambito_visibilidad_codigo, creado_en, id);

CREATE INDEX IF NOT EXISTS idx_objetos_creador_creado_en_id
    ON objetos (creado_por_usuario_id, creado_en, id);

CREATE TABLE IF NOT EXISTS objeto_campanas (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    objeto_id UUID NOT NULL,
    campana_id UUID NOT NULL,
    creado_en TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT fk_objeto_campanas_objeto
        FOREIGN KEY (objeto_id) REFERENCES objetos(id) ON DELETE CASCADE,
    CONSTRAINT fk_objeto_campanas_campana
        FOREIGN KEY (campana_id) REFERENCES campanas(id) ON DELETE CASCADE,
    CONSTRAINT uq_objeto_campanas UNIQUE (objeto_id, campana_id)
);

INSERT INTO objeto_campanas (objeto_id, campana_id)
SELECT id, campana_id
FROM objetos
ON CONFLICT ON CONSTRAINT uq_objeto_campanas DO NOTHING;

CREATE INDEX IF NOT EXISTS idx_objeto_campanas_campana_id
    ON objeto_campanas (campana_id);

CREATE INDEX IF NOT EXISTS idx_objeto_campanas_objeto_id
    ON objeto_campanas (objeto_id);

ALTER TABLE objeto_campanas
    DROP COLUMN IF EXISTS "usuariosId";

CREATE TABLE IF NOT EXISTS objeto_modificadores (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    objeto_id UUID NOT NULL,
    valor INTEGER NOT NULL,
    tipo_codigo TEXT NOT NULL,
    otro TEXT,
    orden_visualizacion INTEGER NOT NULL DEFAULT 0,
    creado_en TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT fk_objeto_modificadores_objeto
        FOREIGN KEY (objeto_id) REFERENCES objetos(id) ON DELETE CASCADE,
    CONSTRAINT uq_objeto_modificadores_tipo UNIQUE (objeto_id, tipo_codigo, otro)
);

INSERT INTO objeto_modificadores (
    objeto_id,
    valor,
    tipo_codigo,
    otro,
    orden_visualizacion
)
SELECT
    id,
    modificador_valor,
    modificador_tipo_codigo,
    modificador_otro,
    1
FROM objetos
WHERE modificador_valor IS NOT NULL
  AND modificador_tipo_codigo IS NOT NULL
ON CONFLICT DO NOTHING;

CREATE INDEX IF NOT EXISTS idx_objeto_modificadores_objeto_id
    ON objeto_modificadores (objeto_id);

CREATE TABLE IF NOT EXISTS permisos_objeto (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    objeto_id UUID NOT NULL,
    usuario_id UUID NOT NULL,
    nivel_acceso_codigo TEXT NOT NULL,
    otorgado_por_usuario_id UUID NOT NULL,
    creado_en TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    actualizado_en TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT fk_permisos_objeto_objeto
        FOREIGN KEY (objeto_id) REFERENCES objetos(id) ON DELETE CASCADE,
    CONSTRAINT fk_permisos_objeto_usuario
        FOREIGN KEY (usuario_id) REFERENCES usuarios(id) ON DELETE CASCADE,
    CONSTRAINT fk_permisos_objeto_otorgado_por
        FOREIGN KEY (otorgado_por_usuario_id) REFERENCES usuarios(id),
    CONSTRAINT fk_permisos_objeto_nivel_acceso
        FOREIGN KEY (nivel_acceso_codigo) REFERENCES niveles_acceso(codigo),
    CONSTRAINT uq_permisos_objeto UNIQUE (objeto_id, usuario_id)
);

CREATE INDEX IF NOT EXISTS idx_permisos_objeto_objeto_id
    ON permisos_objeto (objeto_id);

CREATE INDEX IF NOT EXISTS idx_permisos_objeto_usuario_id
    ON permisos_objeto (usuario_id);

CREATE INDEX IF NOT EXISTS idx_permisos_objeto_usuario_nivel_objeto
    ON permisos_objeto (usuario_id, nivel_acceso_codigo, objeto_id);

CREATE TABLE IF NOT EXISTS tipos_rasgo_objeto (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    nombre TEXT NOT NULL UNIQUE,
    orden_visualizacion INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS objeto_rasgos (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    objeto_id UUID NOT NULL,
    tipo_rasgo_id UUID NOT NULL,
    nombre TEXT NOT NULL,
    descripcion TEXT NOT NULL,
    orden_visualizacion INTEGER NOT NULL DEFAULT 0,
    creado_en TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT fk_objeto_rasgos_objeto
        FOREIGN KEY (objeto_id) REFERENCES objetos(id) ON DELETE CASCADE,
    CONSTRAINT fk_objeto_rasgos_tipo
        FOREIGN KEY (tipo_rasgo_id) REFERENCES tipos_rasgo_objeto(id)
);

CREATE INDEX IF NOT EXISTS idx_objeto_rasgos_objeto_id
    ON objeto_rasgos (objeto_id);

CREATE INDEX IF NOT EXISTS idx_objeto_rasgos_tipo_rasgo_id
    ON objeto_rasgos (tipo_rasgo_id);
