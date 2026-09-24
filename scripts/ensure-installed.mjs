/**
 * Fail `pnpm check` when dependencies were not installed.
 * A cloud agent VM often has no `node_modules`. The hint is the install command.
 */
import { existsSync } from 'node:fs'
import { dirname, join } from 'node:path'
import process from 'node:process'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const eslintBin = join(root, 'node_modules', '.bin', 'eslint')

if (!existsSync(eslintBin)) {
  console.error('Dependencies are not installed (node_modules/.bin/eslint is missing).')
  console.error('From the repo root, run: pnpm install --frozen-lockfile')
  console.error('Then run: CI=1 pnpm check')
  process.exit(1)
}
