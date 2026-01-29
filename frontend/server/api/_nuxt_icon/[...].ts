// Nitro handler to serve @nuxt/icon endpoints
// This ensures the route is handled by Nuxt and not proxied to the backend
export default defineEventHandler(event => {
  // This handler ensures the route exists and is not proxied
  // The actual icon serving is handled by @nuxt/icon module
  // We just need to prevent this route from being proxied
  setHeader(event, 'Cache-Control', 'public, max-age=86400')
  return new Response(null, { status: 404 })
})
