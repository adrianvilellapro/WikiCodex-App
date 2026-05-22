ALTER TABLE personajes
    ALTER COLUMN edad TYPE BIGINT,
    ALTER COLUMN altura_metros TYPE NUMERIC(12,2),
    ALTER COLUMN peso_kg TYPE NUMERIC(12,2),
    ALTER COLUMN puntos_golpe TYPE BIGINT,
    ALTER COLUMN clase_armadura TYPE BIGINT,
    ALTER COLUMN velocidad_pies TYPE BIGINT,
    ALTER COLUMN velocidad_metros TYPE NUMERIC(15,2),
    ALTER COLUMN iniciativa TYPE BIGINT,
    ALTER COLUMN percepcion_pasiva TYPE BIGINT,
    ALTER COLUMN investigacion_pasiva TYPE BIGINT,
    ALTER COLUMN puntos_experiencia TYPE BIGINT;

ALTER TABLE personajes
    DROP CONSTRAINT IF EXISTS ck_personajes_nombre_longitud,
    DROP CONSTRAINT IF EXISTS ck_personajes_titulo_longitud,
    DROP CONSTRAINT IF EXISTS ck_personajes_editor_limites;

ALTER TABLE personajes
    ADD CONSTRAINT ck_personajes_nombre_longitud
        CHECK (char_length(nombre) <= 250),
    ADD CONSTRAINT ck_personajes_titulo_longitud
        CHECK (titulo IS NULL OR char_length(titulo) <= 400),
    ADD CONSTRAINT ck_personajes_editor_limites
        CHECK (
            (edad IS NULL OR (edad >= 0 AND edad <= 9999999999999))
            AND (altura_metros IS NULL OR (altura_metros >= 0 AND altura_metros <= 9999999999))
            AND (peso_kg IS NULL OR (peso_kg >= 0 AND peso_kg <= 9999999999))
            AND (puntos_golpe IS NULL OR (puntos_golpe >= 0 AND puntos_golpe <= 9999999999))
            AND (clase_armadura IS NULL OR (clase_armadura >= 0 AND clase_armadura <= 9999999999))
            AND (velocidad_pies IS NULL OR (velocidad_pies >= 0 AND velocidad_pies <= 9999999999999))
            AND (velocidad_metros IS NULL OR (velocidad_metros >= 0 AND velocidad_metros <= 9999999999999))
            AND (bonificador_competencia IS NULL OR (bonificador_competencia >= 0 AND bonificador_competencia <= 1000))
            AND (iniciativa IS NULL OR (iniciativa >= 0 AND iniciativa <= 9999999999))
            AND (percepcion_pasiva IS NULL OR (percepcion_pasiva >= 0 AND percepcion_pasiva <= 9999999999))
            AND (investigacion_pasiva IS NULL OR (investigacion_pasiva >= 0 AND investigacion_pasiva <= 9999999999))
            AND (puntos_experiencia IS NULL OR (puntos_experiencia >= 0 AND puntos_experiencia <= 9999999999))
            AND (fuerza IS NULL OR (fuerza >= 0 AND fuerza <= 10000))
            AND (destreza IS NULL OR (destreza >= 0 AND destreza <= 10000))
            AND (constitucion IS NULL OR (constitucion >= 0 AND constitucion <= 10000))
            AND (inteligencia IS NULL OR (inteligencia >= 0 AND inteligencia <= 10000))
            AND (sabiduria IS NULL OR (sabiduria >= 0 AND sabiduria <= 10000))
            AND (carisma IS NULL OR (carisma >= 0 AND carisma <= 10000))
            AND (salvacion_fuerza IS NULL OR (salvacion_fuerza >= 0 AND salvacion_fuerza <= 100000))
            AND (salvacion_destreza IS NULL OR (salvacion_destreza >= 0 AND salvacion_destreza <= 100000))
            AND (salvacion_constitucion IS NULL OR (salvacion_constitucion >= 0 AND salvacion_constitucion <= 100000))
            AND (salvacion_inteligencia IS NULL OR (salvacion_inteligencia >= 0 AND salvacion_inteligencia <= 100000))
            AND (salvacion_sabiduria IS NULL OR (salvacion_sabiduria >= 0 AND salvacion_sabiduria <= 100000))
            AND (salvacion_carisma IS NULL OR (salvacion_carisma >= 0 AND salvacion_carisma <= 100000))
        );

ALTER TABLE clases
    DROP CONSTRAINT IF EXISTS ck_clases_nombre_longitud;

ALTER TABLE subclases
    DROP CONSTRAINT IF EXISTS ck_subclases_nombre_longitud;

ALTER TABLE personaje_clases
    DROP CONSTRAINT IF EXISTS ck_personaje_clases_nivel_limite;

ALTER TABLE clases
    ADD CONSTRAINT ck_clases_nombre_longitud
        CHECK (char_length(nombre) <= 100);

ALTER TABLE subclases
    ADD CONSTRAINT ck_subclases_nombre_longitud
        CHECK (char_length(nombre) <= 100);

ALTER TABLE personaje_clases
    ADD CONSTRAINT ck_personaje_clases_nivel_limite
        CHECK (nivel_clase >= 1 AND nivel_clase <= 1000);
