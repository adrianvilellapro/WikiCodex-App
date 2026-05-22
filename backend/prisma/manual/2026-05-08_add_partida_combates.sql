CREATE TABLE IF NOT EXISTS partida_combates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  partida_id uuid NOT NULL,
  creado_por_usuario_id uuid NOT NULL,
  nombre text NOT NULL,
  snapshot jsonb NOT NULL,
  estadisticas jsonb NOT NULL DEFAULT '{}'::jsonb,
  creado_en timestamptz(6) NOT NULL DEFAULT now(),
  actualizado_en timestamptz(6) NOT NULL DEFAULT now(),
  CONSTRAINT fk_partida_combates_partida
    FOREIGN KEY (partida_id)
    REFERENCES partidas(id)
    ON DELETE CASCADE
    ON UPDATE NO ACTION,
  CONSTRAINT fk_partida_combates_creado_por
    FOREIGN KEY (creado_por_usuario_id)
    REFERENCES usuarios(id)
    ON DELETE NO ACTION
    ON UPDATE NO ACTION
);

CREATE INDEX IF NOT EXISTS idx_partida_combates_partida_creado
  ON partida_combates(partida_id, creado_en);
