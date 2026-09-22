/**
 * HEAD /health. Same status and content type as GET, with no body.
 * Returning null makes h3 call sendNoContent, which turns a 200 into 204.
 * content-length matches the JSON GET would send (pretty in dev, compact in production).
 */
export default defineEventHandler((event) => {
  const body = JSON.stringify(healthBody(), undefined, import.meta.dev ? 2 : undefined)
  setResponseStatus(event, 200)
  setResponseHeader(event, 'content-type', 'application/json')
  setResponseHeader(event, 'content-length', new TextEncoder().encode(body).byteLength)
  event.node.res.end()
})
