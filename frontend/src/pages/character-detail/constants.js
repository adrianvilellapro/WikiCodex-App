export const abilityScoreEntries = [
  { key: 'fuerza', saveKey: 'salvacionFuerza', label: 'FUE' },
  { key: 'destreza', saveKey: 'salvacionDestreza', label: 'DES' },
  { key: 'constitucion', saveKey: 'salvacionConstitucion', label: 'CON' },
  { key: 'inteligencia', saveKey: 'salvacionInteligencia', label: 'INT' },
  { key: 'sabiduria', saveKey: 'salvacionSabiduria', label: 'SAB' },
  { key: 'carisma', saveKey: 'salvacionCarisma', label: 'CAR' },
]

export const traitTypeDisplayConfig = {
  Accion: { order: 10, label: 'Acciones' },
  'Accion Adicional': { order: 20, label: 'Acciones Adicionales' },
  'Accion Gratuita': { order: 30, label: 'Acciones Gratuitas' },
  'Accion de Movimiento': { order: 40, label: 'Acciones de Movimiento' },
  Reaccion: { order: 50, label: 'Reacciones' },
  'Acciones Legendarias': { order: 60, label: 'Acciones Legendarias' },
  'Acciones Combinadas': { order: 70, label: 'Acciones Combinadas' },
  Pasiva: { order: 80, label: 'Pasivas' },
  Aura: { order: 90, label: 'Auras' },
  Hechizos: { order: 100, label: 'Hechizos' },
  Transformacion: { order: 110, label: 'Transformaciones' },
  Resistencias: { order: 120, label: 'Resistencias' },
  Competencias: { order: 130, label: 'Competencias' },
  Habilidades: { order: 140, label: 'Habilidades' },
  Sentidos: { order: 150, label: 'Sentidos' },
  Dote: { order: 160, label: 'Dotes' },
  Objetos: { order: 170, label: 'Objetos' },
  Reliquias: { order: 180, label: 'Reliquias' },
}

export const tabs = [
  { id: 'estadisticas', label: 'Estadisticas' },
  { id: 'poderes-objetos', label: 'Poderes y Objetos' },
  { id: 'informacion', label: 'Informacion' },
  { id: 'musica', label: 'Musica' },
  { id: 'galeria', label: 'Galeria' },
]

export const editorDismissStorageKey =
  'wikicodex:skip-trait-delete-confirm-until'
export const defaultEditorTab = 'estadisticas'
export const defaultEditorAnchor = 'stats-header'
export const CHARACTER_NAME_MAX_LENGTH = 250
export const CHARACTER_TITLE_MAX_LENGTH = 400
export const CLASS_NAME_MAX_LENGTH = 100
export const SUBCLASS_NAME_MAX_LENGTH = 100
export const MAX_CLASS_LEVEL = 1000
export const MAX_SHEET_GENERAL_INTEGER = 9_999_999_999
export const MAX_SHEET_SPEED_INTEGER = 9_999_999_999_999
export const MAX_SHEET_COMPETENCE = 1000
export const MAX_ABILITY_SCORE = 10_000
export const MAX_SAVING_THROW = 100_000
export const MAX_DECIMAL_GENERAL = 9_999_999_999
