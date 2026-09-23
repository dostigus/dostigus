/** Owner or Member. Same Store read as the Kitchen MCP tools. */
export default defineEventHandler(async (event) => {
  return withHostStore(event, (store) => readClusterKitchen(store))
})
