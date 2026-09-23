import { openStore } from '@dostigus/db'
import { KITCHEN_COOK_XP } from '@dostigus/shared'
import { afterEach, expect, it } from 'vitest'
import { invokeChatMcpTool, platformToolSpec } from '../../server/utils/mcp-platform-tools'
import { KITCHEN_MCP_TOOLS } from '../../server/utils/mcp-surface'

const opened: Array<ReturnType<typeof openStore>> = []

function memoryStore() {
  const store = openStore('file::memory:')
  opened.push(store)
  return store
}

afterEach(() => {
  while (opened.length > 0) {
    opened.pop()?.close()
  }
})

it('runs Kitchen MCP tools on the same Store helpers the Sheet uses', () => {
  const store = memoryStore()
  const added = platformToolSpec('dostigus_kitchen_pantry_add').run({
    name: 'Eggs',
    qty: 6,
  }, store)
  expect(added).toMatchObject({
    item: { name: 'Eggs', qty: '6' },
    kitchen: { xp: 0 },
  })

  const listed = platformToolSpec('dostigus_kitchen_pantry_list').run({}, store) as {
    pantry: Array<{ name: string }>
  }
  expect(listed.pantry.map((item) => item.name)).toEqual(['Eggs'])

  const saved = platformToolSpec('dostigus_kitchen_recipe_save').run({
    name: 'Omelette',
    ingredients: 'eggs',
  }, store)
  expect(saved).toMatchObject({
    recipe: { name: 'Omelette', ingredients: 'eggs' },
  })

  const cooked = platformToolSpec('dostigus_kitchen_cooked_mark').run({
    label: 'Omelette',
    personId: 'person-1',
  }, store) as { entry: { xp: number, personId: string }, kitchen: { xp: number } }
  expect(cooked.entry.xp).toBe(KITCHEN_COOK_XP)
  expect(cooked.entry.personId).toBe('person-1')
  expect(cooked.kitchen.xp).toBe(KITCHEN_COOK_XP)

  const recipe = platformToolSpec('dostigus_kitchen_recipe_get').run({}, store)
  expect(recipe).toMatchObject({
    recipe: { name: 'Omelette' },
    xp: KITCHEN_COOK_XP,
  })
})

it('rejects a blank pantry name from the Kitchen tool', () => {
  const store = memoryStore()
  expect(() => platformToolSpec('dostigus_kitchen_pantry_add').run({ name: '  ' }, store))
    .toThrow(/Pantry name is required/)
})

it('keeps Kitchen tools off the Chat reply loop', () => {
  const store = memoryStore()
  for (const name of KITCHEN_MCP_TOOLS) {
    const owner = invokeChatMcpTool({ name, args: { name: 'Eggs' }, store, role: 'owner' })
    const member = invokeChatMcpTool({ name, args: {}, store, role: 'member' })
    expect(owner.ok).toBe(false)
    expect(member.ok).toBe(false)
  }
})
