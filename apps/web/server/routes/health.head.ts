/**
 * HEAD /health. Same status and content type as GET, with no body.
 * A missing HEAD handler falls through to the Vue app and redirects.
 */
export default defineEventHandler((event) => {
  setResponseStatus(event, 200)
  setResponseHeader(event, 'content-type', 'application/json')
  return null
})
