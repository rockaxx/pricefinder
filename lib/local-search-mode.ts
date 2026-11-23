export function localSearchMode() {
  const site = new URL(process.env.SITE_URL || 'http://localhost:3000')
  return (
    process.env.LOCAL_SIMPLE_SEARCH === '1' &&
    ['localhost', '127.0.0.1', '[::1]'].includes(site.hostname)
  )
}
