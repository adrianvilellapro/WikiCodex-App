/* eslint-disable react-refresh/only-export-components */
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from 'react'

import { useAuth } from '../auth/auth-context'

const THEME_STORAGE_KEY = 'wikicodex-theme-settings'
export const SHEET_VISUAL_MODES = [
  'wikicodex',
  'legacy',
  'arcane-night',
  'ancient-parchment',
  'ink-paper',
  'grimoire',
  'high-contrast',
]
export const DEFAULT_THEME_SETTINGS = {
  mode: 'light',
  paletteColor: '#026b00',
  sheetVisualMode: 'wikicodex',
}

const ThemeContext = createContext(null)

function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max)
}

function hexToRgb(hexColor) {
  const normalized = hexColor.replace('#', '')
  const safeHex =
    normalized.length === 3
      ? normalized
          .split('')
          .map((character) => `${character}${character}`)
          .join('')
      : normalized

  const parsed = Number.parseInt(safeHex, 16)

  return {
    r: (parsed >> 16) & 255,
    g: (parsed >> 8) & 255,
    b: parsed & 255,
  }
}

function rgbToSpaceSeparated({ r, g, b }) {
  return `${r} ${g} ${b}`
}

function mixRgb(left, right, weight) {
  const safeWeight = clamp(weight, 0, 1)

  return {
    r: Math.round(left.r * (1 - safeWeight) + right.r * safeWeight),
    g: Math.round(left.g * (1 - safeWeight) + right.g * safeWeight),
    b: Math.round(left.b * (1 - safeWeight) + right.b * safeWeight),
  }
}

function getRelativeLuminance({ r, g, b }) {
  const convert = (value) => {
    const channel = value / 255
    return channel <= 0.03928
      ? channel / 12.92
      : ((channel + 0.055) / 1.055) ** 2.4
  }

  return 0.2126 * convert(r) + 0.7152 * convert(g) + 0.0722 * convert(b)
}

export function normalizeHexColor(value) {
  const normalized = String(value || '')
    .trim()
    .toLowerCase()
  const maybeHex = normalized.startsWith('#') ? normalized : `#${normalized}`

  return /^#([0-9a-f]{6}|[0-9a-f]{3})$/i.test(maybeHex)
    ? maybeHex.length === 4
      ? `#${maybeHex
          .slice(1)
          .split('')
          .map((character) => `${character}${character}`)
          .join('')}`
      : maybeHex
    : DEFAULT_THEME_SETTINGS.paletteColor
}

export function normalizeSheetVisualMode(value) {
  return SHEET_VISUAL_MODES.includes(value) ? value : 'wikicodex'
}

export function isDarkModeLockedByVisualMode(value) {
  return normalizeSheetVisualMode(value) === 'arcane-night'
}

function normalizeThemeSettings(settings) {
  const sheetVisualMode = normalizeSheetVisualMode(settings?.sheetVisualMode)

  return {
    mode: settings?.mode === 'dark' ? 'dark' : 'light',
    paletteColor: normalizeHexColor(settings?.paletteColor),
    sheetVisualMode,
  }
}

function getEffectiveMode(settings) {
  return isDarkModeLockedByVisualMode(settings.sheetVisualMode)
    ? 'dark'
    : settings.mode === 'dark'
      ? 'dark'
      : 'light'
}

const BASE_MODE_VARIABLES = {
  light: {
    '--color-canvas': '246 246 246',
    '--color-surface': '246 246 246',
    '--color-surface-strong': '240 241 241',
    '--color-stroke': '172 173 173',
    '--color-warning': '176 132 58',
    '--color-danger': '176 37 0',
    '--color-ink': '26 28 28',
    '--color-ink-soft': '54 57 57',
    '--color-ink-muted': '76 79 79',
    '--theme-card-surface': '19 22 24',
    '--theme-card-surface-strong': '28 32 35',
    '--theme-card-surface-soft': '35 40 43',
  },
  dark: {
    '--color-canvas': '12 15 15',
    '--color-surface': '12 15 15',
    '--color-surface-strong': '26 28 28',
    '--color-stroke': '92 96 96',
    '--color-warning': '225 186 96',
    '--color-danger': '249 86 48',
    '--color-ink': '246 246 246',
    '--color-ink-soft': '220 221 221',
    '--color-ink-muted': '156 157 157',
    '--theme-card-surface': '19 22 24',
    '--theme-card-surface-strong': '28 32 35',
    '--theme-card-surface-soft': '35 40 43',
  },
}

export function getThemeVariables(paletteColor) {
  const brand = hexToRgb(normalizeHexColor(paletteColor))
  const accent = mixRgb(brand, { r: 255, g: 255, b: 255 }, 0.22)
  const brandStrong = mixRgb(brand, { r: 0, g: 0, b: 0 }, 0.18)
  const brandSoft = mixRgb(brand, { r: 255, g: 255, b: 255 }, 0.88)
  const brandDeep = mixRgb(brand, { r: 0, g: 0, b: 0 }, 0.8)
  const brandContrast =
    getRelativeLuminance(brand) > 0.38
      ? { r: 8, g: 8, b: 8 }
      : { r: 255, g: 255, b: 255 }

  return {
    '--color-brand': rgbToSpaceSeparated(brand),
    '--color-brand-strong': rgbToSpaceSeparated(brandStrong),
    '--color-brand-contrast': rgbToSpaceSeparated(brandContrast),
    '--color-accent': rgbToSpaceSeparated(accent),
    '--color-success': rgbToSpaceSeparated(brand),
    '--theme-brand-soft': rgbToSpaceSeparated(brandSoft),
    '--theme-brand-deep': rgbToSpaceSeparated(brandDeep),
    '--theme-header-bg': rgbToSpaceSeparated(
      mixRgb(brand, { r: 0, g: 0, b: 0 }, 0.92)
    ),
    '--theme-header-surface': rgbToSpaceSeparated(
      mixRgb(brand, { r: 0, g: 0, b: 0 }, 0.88)
    ),
    '--theme-header-button-bg': rgbToSpaceSeparated(
      mixRgb(brand, { r: 0, g: 0, b: 0 }, 0.95)
    ),
    '--theme-header-button-hover': rgbToSpaceSeparated(
      mixRgb(brand, { r: 0, g: 0, b: 0 }, 0.89)
    ),
    '--theme-header-button-border': rgbToSpaceSeparated(
      mixRgb(brand, { r: 255, g: 255, b: 255 }, 0.2)
    ),
    '--theme-header-card': rgbToSpaceSeparated(
      mixRgb(brand, { r: 0, g: 0, b: 0 }, 0.93)
    ),
    '--theme-orbit-accent': rgbToSpaceSeparated(
      mixRgb(accent, { r: 255, g: 255, b: 255 }, 0.18)
    ),
    '--theme-card-surface': '19 22 24',
    '--theme-card-surface-strong': '28 32 35',
    '--theme-card-surface-soft': '35 40 43',
  }
}

const VISUAL_THEME_VARIABLES = {
  'arcane-night': {
    dark: {
      '--color-canvas': '8 9 18',
      '--color-surface': '10 12 22',
      '--color-surface-strong': '18 20 34',
      '--color-stroke': '107 92 170',
      '--color-brand': '183 148 255',
      '--color-brand-strong': '153 113 236',
      '--color-brand-contrast': '10 9 16',
      '--color-accent': '66 226 255',
      '--color-success': '119 255 201',
      '--color-warning': '246 198 95',
      '--color-danger': '255 102 102',
      '--color-ink': '249 246 255',
      '--color-ink-soft': '224 216 248',
      '--color-ink-muted': '172 161 210',
      '--theme-brand-soft': '35 28 67',
      '--theme-brand-deep': '8 7 18',
      '--theme-header-bg': '6 7 16',
      '--theme-header-surface': '16 13 35',
      '--theme-header-button-bg': '29 22 58',
      '--theme-header-button-hover': '43 31 84',
      '--theme-header-button-border': '112 95 190',
      '--theme-header-card': '14 12 29',
      '--theme-orbit-accent': '92 235 255',
      '--theme-card-surface': '14 16 29',
      '--theme-card-surface-strong': '22 24 42',
      '--theme-card-surface-soft': '31 28 55',
    },
  },
  'ancient-parchment': {
    light: {
      '--color-canvas': '239 221 181',
      '--color-surface': '246 229 194',
      '--color-surface-strong': '229 203 153',
      '--color-stroke': '126 88 42',
      '--color-brand': '115 68 24',
      '--color-brand-strong': '84 48 16',
      '--color-brand-contrast': '255 245 221',
      '--color-accent': '174 112 44',
      '--color-success': '72 111 52',
      '--color-warning': '174 112 44',
      '--color-danger': '154 50 31',
      '--color-ink': '36 24 13',
      '--color-ink-soft': '69 48 28',
      '--color-ink-muted': '105 77 46',
      '--theme-brand-soft': '224 192 130',
      '--theme-brand-deep': '42 25 12',
      '--theme-header-bg': '46 28 14',
      '--theme-header-surface': '69 43 20',
      '--theme-header-button-bg': '78 47 18',
      '--theme-header-button-hover': '101 62 24',
      '--theme-header-button-border': '166 120 57',
      '--theme-header-card': '63 38 17',
      '--theme-orbit-accent': '220 168 76',
      '--theme-card-surface': '250 235 200',
      '--theme-card-surface-strong': '236 210 163',
      '--theme-card-surface-soft': '226 194 137',
    },
    dark: {
      '--color-canvas': '33 25 17',
      '--color-surface': '42 31 21',
      '--color-surface-strong': '59 43 26',
      '--color-stroke': '154 109 56',
      '--color-brand': '231 178 92',
      '--color-brand-strong': '246 198 110',
      '--color-brand-contrast': '32 21 10',
      '--color-accent': '245 210 126',
      '--color-success': '158 205 128',
      '--color-warning': '245 210 126',
      '--color-danger': '249 118 92',
      '--color-ink': '252 240 210',
      '--color-ink-soft': '232 211 171',
      '--color-ink-muted': '188 153 103',
      '--theme-brand-soft': '87 58 29',
      '--theme-brand-deep': '22 14 8',
      '--theme-header-bg': '25 16 9',
      '--theme-header-surface': '49 31 16',
      '--theme-header-button-bg': '62 38 18',
      '--theme-header-button-hover': '85 54 25',
      '--theme-header-button-border': '164 112 53',
      '--theme-header-card': '39 25 14',
      '--theme-orbit-accent': '246 198 110',
      '--theme-card-surface': '45 33 22',
      '--theme-card-surface-strong': '61 45 29',
      '--theme-card-surface-soft': '74 53 32',
    },
  },
  'ink-paper': {
    light: {
      '--color-canvas': '247 247 243',
      '--color-surface': '255 255 250',
      '--color-surface-strong': '235 235 228',
      '--color-stroke': '37 37 33',
      '--color-brand': '18 18 17',
      '--color-brand-strong': '0 0 0',
      '--color-brand-contrast': '255 255 250',
      '--color-accent': '92 92 82',
      '--color-success': '26 94 59',
      '--color-warning': '130 92 30',
      '--color-danger': '156 36 31',
      '--color-ink': '14 14 13',
      '--color-ink-soft': '50 50 46',
      '--color-ink-muted': '88 88 80',
      '--theme-brand-soft': '226 226 218',
      '--theme-brand-deep': '10 10 9',
      '--theme-header-bg': '16 16 15',
      '--theme-header-surface': '28 28 26',
      '--theme-header-button-bg': '20 20 19',
      '--theme-header-button-hover': '45 45 41',
      '--theme-header-button-border': '112 112 100',
      '--theme-header-card': '24 24 22',
      '--theme-orbit-accent': '180 180 168',
      '--theme-card-surface': '255 255 250',
      '--theme-card-surface-strong': '239 239 232',
      '--theme-card-surface-soft': '231 231 222',
    },
    dark: {
      '--color-canvas': '10 10 10',
      '--color-surface': '14 14 14',
      '--color-surface-strong': '28 28 27',
      '--color-stroke': '210 210 198',
      '--color-brand': '245 245 232',
      '--color-brand-strong': '255 255 245',
      '--color-brand-contrast': '10 10 10',
      '--color-accent': '184 184 169',
      '--color-success': '134 230 172',
      '--color-warning': '234 179 8',
      '--color-danger': '248 113 113',
      '--color-ink': '248 248 238',
      '--color-ink-soft': '218 218 205',
      '--color-ink-muted': '169 169 154',
      '--theme-brand-soft': '42 42 39',
      '--theme-brand-deep': '3 3 3',
      '--theme-header-bg': '4 4 4',
      '--theme-header-surface': '17 17 16',
      '--theme-header-button-bg': '17 17 16',
      '--theme-header-button-hover': '38 38 35',
      '--theme-header-button-border': '245 245 232',
      '--theme-header-card': '13 13 12',
      '--theme-orbit-accent': '245 245 232',
      '--theme-card-surface': '17 17 16',
      '--theme-card-surface-strong': '27 27 25',
      '--theme-card-surface-soft': '38 38 35',
    },
  },
  grimoire: {
    light: {
      '--color-canvas': '236 231 247',
      '--color-surface': '247 243 255',
      '--color-surface-strong': '226 217 242',
      '--color-stroke': '164 122 50',
      '--color-brand': '188 145 63',
      '--color-brand-strong': '145 102 35',
      '--color-brand-contrast': '27 18 42',
      '--color-accent': '91 49 143',
      '--color-success': '67 121 89',
      '--color-warning': '188 145 63',
      '--color-danger': '160 55 80',
      '--color-ink': '31 22 45',
      '--color-ink-soft': '67 49 91',
      '--color-ink-muted': '102 82 127',
      '--theme-brand-soft': '219 204 240',
      '--theme-brand-deep': '25 16 43',
      '--theme-header-bg': '24 15 40',
      '--theme-header-surface': '43 26 70',
      '--theme-header-button-bg': '188 145 63',
      '--theme-header-button-hover': '210 167 78',
      '--theme-header-button-border': '232 194 111',
      '--theme-header-card': '36 22 60',
      '--theme-orbit-accent': '225 184 91',
      '--theme-card-surface': '250 246 255',
      '--theme-card-surface-strong': '238 225 191',
      '--theme-card-surface-soft': '228 210 160',
    },
    dark: {
      '--color-canvas': '16 11 27',
      '--color-surface': '21 15 35',
      '--color-surface-strong': '32 23 52',
      '--color-stroke': '196 153 74',
      '--color-brand': '229 188 89',
      '--color-brand-strong': '247 214 126',
      '--color-brand-contrast': '18 12 29',
      '--color-accent': '198 168 255',
      '--color-success': '134 239 172',
      '--color-warning': '229 188 89',
      '--color-danger': '251 113 133',
      '--color-ink': '250 244 255',
      '--color-ink-soft': '226 214 247',
      '--color-ink-muted': '178 157 205',
      '--theme-brand-soft': '47 34 76',
      '--theme-brand-deep': '10 7 19',
      '--theme-header-bg': '9 6 16',
      '--theme-header-surface': '28 18 48',
      '--theme-header-button-bg': '229 188 89',
      '--theme-header-button-hover': '247 214 126',
      '--theme-header-button-border': '247 214 126',
      '--theme-header-card': '22 15 37',
      '--theme-orbit-accent': '229 188 89',
      '--theme-card-surface': '25 18 41',
      '--theme-card-surface-strong': '54 40 64',
      '--theme-card-surface-soft': '82 61 78',
    },
  },
  'high-contrast': {
    light: {
      '--color-canvas': '255 255 255',
      '--color-surface': '255 255 255',
      '--color-surface-strong': '238 238 238',
      '--color-stroke': '0 0 0',
      '--color-brand': '0 0 0',
      '--color-brand-strong': '0 0 0',
      '--color-brand-contrast': '255 255 255',
      '--color-accent': '0 80 255',
      '--color-success': '0 108 45',
      '--color-warning': '132 82 0',
      '--color-danger': '190 0 0',
      '--color-ink': '0 0 0',
      '--color-ink-soft': '0 0 0',
      '--color-ink-muted': '35 35 35',
      '--theme-brand-soft': '230 230 230',
      '--theme-brand-deep': '0 0 0',
      '--theme-header-bg': '0 0 0',
      '--theme-header-surface': '0 0 0',
      '--theme-header-button-bg': '0 0 0',
      '--theme-header-button-hover': '35 35 35',
      '--theme-header-button-border': '255 255 255',
      '--theme-header-card': '0 0 0',
      '--theme-orbit-accent': '0 80 255',
      '--theme-card-surface': '255 255 255',
      '--theme-card-surface-strong': '245 245 245',
      '--theme-card-surface-soft': '235 235 235',
    },
    dark: {
      '--color-canvas': '0 0 0',
      '--color-surface': '0 0 0',
      '--color-surface-strong': '18 18 18',
      '--color-stroke': '255 255 255',
      '--color-brand': '255 255 0',
      '--color-brand-strong': '255 255 120',
      '--color-brand-contrast': '0 0 0',
      '--color-accent': '0 255 255',
      '--color-success': '0 255 128',
      '--color-warning': '255 255 0',
      '--color-danger': '255 92 92',
      '--color-ink': '255 255 255',
      '--color-ink-soft': '255 255 255',
      '--color-ink-muted': '230 230 230',
      '--theme-brand-soft': '32 32 0',
      '--theme-brand-deep': '0 0 0',
      '--theme-header-bg': '0 0 0',
      '--theme-header-surface': '0 0 0',
      '--theme-header-button-bg': '0 0 0',
      '--theme-header-button-hover': '18 18 18',
      '--theme-header-button-border': '255 255 255',
      '--theme-header-card': '0 0 0',
      '--theme-orbit-accent': '0 255 255',
      '--theme-card-surface': '0 0 0',
      '--theme-card-surface-strong': '18 18 18',
      '--theme-card-surface-soft': '32 32 32',
    },
  },
}

function getHighContrastPaletteVariables(paletteColor, effectiveMode) {
  const selectedBrand = hexToRgb(normalizeHexColor(paletteColor))
  const luminance = getRelativeLuminance(selectedBrand)
  const brand =
    effectiveMode === 'dark' && luminance < 0.35
      ? mixRgb(selectedBrand, { r: 255, g: 255, b: 255 }, 0.48)
      : effectiveMode === 'light' && luminance > 0.72
        ? mixRgb(selectedBrand, { r: 0, g: 0, b: 0 }, 0.42)
        : selectedBrand
  const brandStrong =
    effectiveMode === 'dark'
      ? mixRgb(brand, { r: 255, g: 255, b: 255 }, 0.22)
      : mixRgb(brand, { r: 0, g: 0, b: 0 }, 0.2)
  const brandContrast =
    getRelativeLuminance(brand) > 0.38
      ? { r: 0, g: 0, b: 0 }
      : { r: 255, g: 255, b: 255 }

  return {
    '--color-brand': rgbToSpaceSeparated(brand),
    '--color-brand-strong': rgbToSpaceSeparated(brandStrong),
    '--color-brand-contrast': rgbToSpaceSeparated(brandContrast),
    '--color-accent': rgbToSpaceSeparated(brand),
    '--color-success': rgbToSpaceSeparated(brand),
    '--theme-header-button-bg': rgbToSpaceSeparated(brand),
    '--theme-header-button-hover': rgbToSpaceSeparated(brandStrong),
    '--theme-header-button-border': rgbToSpaceSeparated(brand),
    '--theme-orbit-accent': rgbToSpaceSeparated(brand),
  }
}

function getVisualThemeVariables(sheetVisualMode, effectiveMode, paletteColor) {
  const normalizedMode = normalizeSheetVisualMode(sheetVisualMode)
  const modeVariables = VISUAL_THEME_VARIABLES[normalizedMode]

  if (!modeVariables) {
    return {}
  }

  const variables = modeVariables[effectiveMode] || modeVariables.light || {}

  if (normalizedMode === 'high-contrast') {
    return {
      ...variables,
      ...getHighContrastPaletteVariables(paletteColor, effectiveMode),
    }
  }

  return variables
}

function loadStoredThemeSettings() {
  if (typeof window === 'undefined') {
    return DEFAULT_THEME_SETTINGS
  }

  try {
    const rawValue = window.localStorage.getItem(THEME_STORAGE_KEY)

    if (!rawValue) {
      return DEFAULT_THEME_SETTINGS
    }

    const parsed = JSON.parse(rawValue)

    return normalizeThemeSettings(parsed)
  } catch {
    return DEFAULT_THEME_SETTINGS
  }
}

function applyThemeSettings(settings) {
  if (typeof document === 'undefined') {
    return
  }

  const root = document.documentElement
  const paletteColor = normalizeHexColor(settings.paletteColor)
  const sheetVisualMode = normalizeSheetVisualMode(settings.sheetVisualMode)
  const effectiveMode = getEffectiveMode({ ...settings, sheetVisualMode })
  const variables = {
    ...BASE_MODE_VARIABLES[effectiveMode],
    ...getThemeVariables(paletteColor),
    ...getVisualThemeVariables(sheetVisualMode, effectiveMode, paletteColor),
  }

  root.dataset.mode = effectiveMode
  root.dataset.palette = 'custom'
  root.dataset.sheetVisual = sheetVisualMode

  Object.entries(variables).forEach(([name, value]) => {
    root.style.setProperty(name, value)
  })
}

export function ThemeProvider({ children }) {
  const { user } = useAuth()
  const [settings, setSettings] = useState(loadStoredThemeSettings)

  const replaceSettings = useCallback((nextSettings) => {
    setSettings((current) => {
      const normalizedSettings = normalizeThemeSettings(nextSettings)

      return current.mode === normalizedSettings.mode &&
        current.paletteColor === normalizedSettings.paletteColor &&
        current.sheetVisualMode === normalizedSettings.sheetVisualMode
        ? current
        : normalizedSettings
    })
  }, [])

  useEffect(() => {
    if (!user) {
      return
    }

    const syncId = window.setTimeout(() => {
      replaceSettings({
        mode: user.temaModo,
        paletteColor: user.temaColorHex,
        sheetVisualMode: user.modoVisualFichas,
      })
    }, 0)

    return () => {
      window.clearTimeout(syncId)
    }
  }, [replaceSettings, user])

  useEffect(() => {
    applyThemeSettings(settings)

    if (typeof window !== 'undefined') {
      window.localStorage.setItem(THEME_STORAGE_KEY, JSON.stringify(settings))
    }
  }, [settings])

  const setMode = useCallback((mode) => {
    setSettings((current) =>
      isDarkModeLockedByVisualMode(current.sheetVisualMode)
        ? current
        : {
            ...current,
            mode: mode === 'dark' ? 'dark' : 'light',
          }
    )
  }, [])

  const setPaletteColor = useCallback((paletteColor) => {
    setSettings((current) => ({
      ...current,
      paletteColor: normalizeHexColor(paletteColor),
    }))
  }, [])

  const setSheetVisualMode = useCallback((sheetVisualMode) => {
    setSettings((current) => ({
      ...current,
      sheetVisualMode: normalizeSheetVisualMode(sheetVisualMode),
    }))
  }, [])

  const resetTheme = useCallback(() => {
    setSettings(DEFAULT_THEME_SETTINGS)
  }, [])

  const effectiveMode = getEffectiveMode(settings)
  const isDarkModeLocked = isDarkModeLockedByVisualMode(
    settings.sheetVisualMode
  )

  return (
    <ThemeContext.Provider
      value={{
        mode: settings.mode,
        effectiveMode,
        paletteColor: normalizeHexColor(settings.paletteColor),
        sheetVisualMode: settings.sheetVisualMode,
        isDarkMode: effectiveMode === 'dark',
        isDarkModeLocked,
        setMode,
        setPaletteColor,
        setSheetVisualMode,
        resetTheme,
      }}
    >
      {children}
    </ThemeContext.Provider>
  )
}

export function useTheme() {
  const context = useContext(ThemeContext)

  if (!context) {
    throw new Error('useTheme debe usarse dentro de ThemeProvider.')
  }

  return context
}
