CREATE OR REPLACE FUNCTION validar_jerarquia_personaje()
RETURNS TRIGGER AS $$
DECLARE
    campana_partida_aparicion_id UUID;
    campana_partida_defuncion_id UUID;
BEGIN
    IF NEW.personaje_base_id IS NOT NULL THEN
        IF NOT EXISTS (
            SELECT 1
            FROM personajes
            WHERE id = NEW.personaje_base_id
        ) THEN
            RAISE EXCEPTION 'El personaje base % no existe', NEW.personaje_base_id;
        END IF;
    END IF;

    IF NEW.partida_aparicion_id IS NOT NULL THEN
        SELECT campana_id
        INTO campana_partida_aparicion_id
        FROM partidas
        WHERE id = NEW.partida_aparicion_id;

        IF NOT FOUND THEN
            RAISE EXCEPTION 'La partida de aparicion % no existe', NEW.partida_aparicion_id;
        END IF;

        IF campana_partida_aparicion_id <> NEW.campana_id THEN
            RAISE EXCEPTION
                'La partida de aparicion % debe pertenecer a la misma campana que el personaje',
                NEW.partida_aparicion_id;
        END IF;
    END IF;

    IF NEW.partida_defuncion_id IS NOT NULL THEN
        SELECT campana_id
        INTO campana_partida_defuncion_id
        FROM partidas
        WHERE id = NEW.partida_defuncion_id;

        IF NOT FOUND THEN
            RAISE EXCEPTION 'La partida de defuncion % no existe', NEW.partida_defuncion_id;
        END IF;

        IF campana_partida_defuncion_id <> NEW.campana_id THEN
            RAISE EXCEPTION
                'La partida de defuncion % debe pertenecer a la misma campana que el personaje',
                NEW.partida_defuncion_id;
        END IF;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;
