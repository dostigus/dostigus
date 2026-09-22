import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { expect, it } from 'vitest'

const appRoot = join(import.meta.dirname, '../../app')

function read(rel: string): string {
  return readFileSync(join(appRoot, rel), 'utf8')
}

const leftover = /Day-1|coming soon|MCP token|sealed cookie|Compose env|NUXT_|OPENAI_COMPATIBLE|LLM_API_KEY|stub reply|Host · Cluster/i

it('keeps Create Owner and Sign in free of leftover technical copy', () => {
  const onboarding = read('pages/onboarding.vue')
  const login = read('pages/login.vue')
  expect(onboarding).toContain('Create your Owner')
  expect(onboarding).toContain('This Host needs one Owner')
  expect(onboarding).not.toMatch(leftover)
  expect(login).toContain('Welcome back')
  expect(login).toContain('Sign in with your email or username')
  expect(login).not.toMatch(leftover)
  expect(login).not.toContain('Password reset')
})

it('defaults Settings to OpenRouter and keeps custom URL collapsed', () => {
  const settings = read('pages/settings.vue')
  expect(settings).toContain('OPENROUTER_DEFAULT_BASE_URL')
  expect(settings).toContain('baseUrlForLlmGatewayPreset')
  expect(settings).toContain('llmGatewayPresetFromBaseUrl')
  expect(settings).toContain('Paste your OpenRouter key')
  expect(settings).toContain('Custom OpenAI-compatible')
  expect(settings).toContain('Add an OpenRouter key so Bots can reply')
  expect(settings).not.toMatch(/Day-1|coming soon|Compose env|NUXT_|OPENAI_COMPATIBLE|LLM_API_KEY|stub reply/i)
  expect(settings).not.toContain('LLM gateway')
})

it('keeps Bot list and Chat copy product-facing when no key is set', () => {
  const bots = read('components/HostBotEmpty.vue')
  const home = read('pages/index.vue')
  const chat = read('pages/bots/[id].vue')
  const sidebar = read('components/HostSidebar.vue')
  expect(bots).toContain('No Bots yet')
  expect(bots).toContain('Create a Bot and start a Chat')
  expect(bots).toContain('Create a Bot')
  expect(bots).not.toMatch(leftover)
  expect(home).toContain('Open a Chat')
  expect(home).toContain('Choose a Bot from the list.')
  expect(home).not.toMatch(leftover)
  expect(chat).toContain('Replies stay quiet until you add an OpenRouter key')
  expect(chat).toContain('Replies stay quiet until the Owner adds an OpenRouter key')
  expect(chat).toContain('authorName')
  expect(chat).not.toContain('class="who"')
  expect(chat).toContain('aria-label="Send"')
  expect(chat).toContain('Attachments soon')
  expect(chat).toContain('v-if="draft.trim()"')
  expect(chat).toContain('Start the Chat')
  expect(chat).toContain('Replying…')
  expect(chat).not.toContain('Sending…')
  expect(chat).not.toMatch(/stub|Used Cluster tools|LLM gateway/i)
  expect(bots).toContain('v-if="isOwner"')
  expect(sidebar).toContain('v-if="isOwner"')
  expect(chat).toContain('v-if="isOwner"')
  expect(read('pages/index.vue')).not.toContain('Kinnu')
})

it('keeps Members copy product-facing', () => {
  const members = read('pages/members.vue')
  expect(members).toContain('No Members yet')
  expect(members).toContain('Add a Member')
  expect(members).toContain('Turn off sign-in')
  expect(members).toContain('Sign-in off')
  expect(members).not.toMatch(leftover)
  expect(members).not.toContain('Kinnu')
  expect(read('pages/login.vue')).not.toContain('Kinnu')
  expect(read('pages/index.vue')).not.toContain('Kinnu')
  expect(read('components/HostSidebar.vue')).not.toContain('Kinnu')
  expect(read('components/HostUserMenu.vue')).not.toContain('Kinnu')
  expect(read('components/BotSettingsSheet.vue')).not.toContain('Kinnu')
  expect(read('pages/bots/[id].vue')).not.toContain('Kinnu')
})
