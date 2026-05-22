CREATE TABLE IF NOT EXISTS perfiles_publicos_usuario (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    usuario_id UUID NOT NULL UNIQUE,
    personaje_destacado_id UUID,
    descripcion TEXT,
    creado_en TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    actualizado_en TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT fk_perfiles_publicos_usuario_usuario
        FOREIGN KEY (usuario_id) REFERENCES usuarios(id) ON DELETE CASCADE,
    CONSTRAINT fk_perfiles_publicos_usuario_personaje_destacado
        FOREIGN KEY (personaje_destacado_id) REFERENCES personajes(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_perfiles_publicos_usuario_personaje_destacado_id
    ON perfiles_publicos_usuario (personaje_destacado_id);
