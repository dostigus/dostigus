/** Public Catalog Store reads are for the marketing site (`dostigus/cloud`). */
export function allowPublicCatalogCors(event: Parameters<typeof setHeader>[0]): void {
  setHeader(event, 'access-control-allow-origin', '*')
  setHeader(event, 'access-control-allow-methods', 'GET, OPTIONS')
  setHeader(event, 'access-control-allow-headers', 'content-type')
}
