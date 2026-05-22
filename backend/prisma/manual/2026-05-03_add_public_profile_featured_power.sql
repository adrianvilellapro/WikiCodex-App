ALTER TABLE perfiles_publicos_usuario
  ADD COLUMN IF NOT EXISTS poder_destacado_id uuid NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'fk_perfiles_publicos_usuario_poder_destacado'
  ) THEN
    ALTER TABLE perfiles_publicos_usuario
      ADD CONSTRAINT fk_perfiles_publicos_usuario_poder_destacado
      FOREIGN KEY (poder_destacado_id)
      REFERENCES poderes(id)
      ON DELETE SET NULL
      ON UPDATE NO ACTION;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_perfiles_publicos_usuario_poder_destacado_id
  ON perfiles_publicos_usuario(poder_destacado_id);
