CREATE TABLE IF NOT EXISTS personaje_objetos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  personaje_id uuid NOT NULL,
  objeto_id uuid NOT NULL,
  mostrar_rasgos_en_ficha boolean NOT NULL DEFAULT false,
  orden_visualizacion integer NOT NULL DEFAULT 0,
  creado_en timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT fk_personaje_objetos_personaje
    FOREIGN KEY (personaje_id)
    REFERENCES personajes(id)
    ON DELETE CASCADE,
  CONSTRAINT fk_personaje_objetos_objeto
    FOREIGN KEY (objeto_id)
    REFERENCES objetos(id)
    ON DELETE CASCADE
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_personaje_objetos
  ON personaje_objetos(personaje_id, objeto_id);

CREATE INDEX IF NOT EXISTS idx_personaje_objetos_objeto_id
  ON personaje_objetos(objeto_id);

CREATE INDEX IF NOT EXISTS idx_personaje_objetos_personaje_orden
  ON personaje_objetos(personaje_id, orden_visualizacion);

CREATE TABLE IF NOT EXISTS personaje_poderes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  personaje_id uuid NOT NULL,
  poder_id uuid NOT NULL,
  orden_visualizacion integer NOT NULL DEFAULT 0,
  creado_en timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT fk_personaje_poderes_personaje
    FOREIGN KEY (personaje_id)
    REFERENCES personajes(id)
    ON DELETE CASCADE,
  CONSTRAINT fk_personaje_poderes_poder
    FOREIGN KEY (poder_id)
    REFERENCES poderes(id)
    ON DELETE CASCADE
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_personaje_poderes
  ON personaje_poderes(personaje_id, poder_id);

CREATE INDEX IF NOT EXISTS idx_personaje_poderes_personaje_orden
  ON personaje_poderes(personaje_id, orden_visualizacion);

CREATE INDEX IF NOT EXISTS idx_personaje_poderes_poder_id
  ON personaje_poderes(poder_id);
