export const isDemoMode =
  import.meta.env.MODE === 'demo' || import.meta.env.VITE_DEMO_MODE === 'true'

export const demoToken = 'wikicodex-demo-token'
