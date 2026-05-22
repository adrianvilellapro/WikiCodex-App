UPDATE clases
SET rasgos = COALESCE(
  (
    SELECT jsonb_agg(element - 'rasgoGuardable')
    FROM jsonb_array_elements(rasgos::jsonb) AS element
  ),
  '[]'::jsonb
)
WHERE rasgos::jsonb @? '$[*].rasgoGuardable';

UPDATE subclases
SET rasgos = COALESCE(
  (
    SELECT jsonb_agg(element - 'rasgoGuardable')
    FROM jsonb_array_elements(rasgos::jsonb) AS element
  ),
  '[]'::jsonb
)
WHERE rasgos::jsonb @? '$[*].rasgoGuardable';

UPDATE dotes
SET datos_fuente = datos_fuente::jsonb - 'rasgoGuardable'
WHERE datos_fuente::jsonb ? 'rasgoGuardable';
