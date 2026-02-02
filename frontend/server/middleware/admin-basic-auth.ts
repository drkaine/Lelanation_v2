import { defineEventHandler } from 'h3'

export default defineEventHandler(event => {
  const cfg = useRuntimeConfig(event)
  const pathPrefix = (cfg.admin?.pathPrefix as string | undefined) || '/admin'

  // Only run for /admin/* paths; do not require Basic auth so the login page
  // and dashboard can be served; the client enforces login and sends Basic auth
  // for API calls to /api/admin/*.
  if (event.path.startsWith(pathPrefix)) {
    // Intentionally no auth check here
  }
})
