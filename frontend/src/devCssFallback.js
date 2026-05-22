const INDEX_CSS_PATH = '/src/index.css'
const FALLBACK_STYLE_ID = 'wikicodex-dev-css-fallback'

const getInjectedIndexStyle = () =>
  [...document.querySelectorAll('style[data-vite-dev-id]')].find((style) =>
    style.dataset.viteDevId?.replaceAll('\\', '/').endsWith(INDEX_CSS_PATH)
  )

const injectFallbackStyles = async () => {
  const viteStyle = getInjectedIndexStyle()

  if (!viteStyle || viteStyle.textContent.trim().length > 0) {
    return
  }

  const response = await fetch(`${INDEX_CSS_PATH}?direct&t=${Date.now()}`)

  if (!response.ok) {
    return
  }

  const css = await response.text()

  if (!css.trim()) {
    return
  }

  let fallbackStyle = document.getElementById(FALLBACK_STYLE_ID)

  if (!fallbackStyle) {
    fallbackStyle = document.createElement('style')
    fallbackStyle.id = FALLBACK_STYLE_ID
    fallbackStyle.dataset.source = 'vite-empty-css-fallback'
    document.head.appendChild(fallbackStyle)
  }

  fallbackStyle.textContent = css
}

if (import.meta.env.DEV) {
  requestAnimationFrame(() => {
    injectFallbackStyles().catch(() => {})
  })
}
