import forms from '@tailwindcss/forms'

/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Inter', 'ui-sans-serif', 'system-ui', 'sans-serif'],
        body: ['Inter', 'ui-sans-serif', 'system-ui', 'sans-serif'],
        label: ['Manrope', 'ui-sans-serif', 'system-ui', 'sans-serif'],
        display: [
          '"Space Grotesk"',
          'ui-sans-serif',
          'system-ui',
          'sans-serif',
        ],
      },
      colors: {
        canvas: 'rgb(var(--color-canvas) / <alpha-value>)',
        surface: 'rgb(var(--color-surface) / <alpha-value>)',
        'surface-strong': 'rgb(var(--color-surface-strong) / <alpha-value>)',
        stroke: 'rgb(var(--color-stroke) / <alpha-value>)',
        brand: 'rgb(var(--color-brand) / <alpha-value>)',
        'brand-strong': 'rgb(var(--color-brand-strong) / <alpha-value>)',
        'brand-contrast': 'rgb(var(--color-brand-contrast) / <alpha-value>)',
        accent: 'rgb(var(--color-accent) / <alpha-value>)',
        success: 'rgb(var(--color-success) / <alpha-value>)',
        warning: 'rgb(var(--color-warning) / <alpha-value>)',
        danger: 'rgb(var(--color-danger) / <alpha-value>)',
        ink: 'rgb(var(--color-ink) / <alpha-value>)',
        'ink-soft': 'rgb(var(--color-ink-soft) / <alpha-value>)',
        'ink-muted': 'rgb(var(--color-ink-muted) / <alpha-value>)',
      },
      boxShadow: {
        glow: '0 24px 80px rgba(45, 47, 47, 0.08)',
        card: '0 16px 40px rgba(45, 47, 47, 0.06)',
      },
      backgroundImage: {
        'mesh-codex':
          'radial-gradient(circle at top left, rgb(var(--color-accent) / 0.08), transparent 22%), radial-gradient(circle at top right, rgb(var(--color-brand) / 0.08), transparent 26%), linear-gradient(180deg, rgb(255 255 255 / 0.98), rgb(var(--color-surface) / 0.96))',
      },
    },
  },
  plugins: [forms],
}
