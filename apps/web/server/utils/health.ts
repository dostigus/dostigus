/** GET body for `/health`. HEAD sends the same status and content type, with no body. */
export function healthBody(): { ok: true } {
  return { ok: true }
}
