/**
 * Decide whether CI should build the Host image.
 *
 * A docs-only diff (`docs/**` and any `*.md`) skips the image.
 * A tag, a missing base, or a git failure still builds.
 *
 *   node scripts/ci-host-image.mjs
 *
 * Reads CI_EVENT_NAME, CI_REF, and CI_BASE_SHA. Prints `host_image=true|false`
 * for `$GITHUB_OUTPUT`.
 */
import { execFileSync } from 'node:child_process'
import process from 'node:process'
import { pathToFileURL } from 'node:url'

const ZERO_SHA = '0'.repeat(40)

/** `docs/**` or a Markdown file anywhere, including CONTEXT.md and AGENTS.md. */
export function isDocsOnlyPath(file) {
  const path = String(file).replaceAll('\\', '/').replace(/^\.\//, '')
  return path.startsWith('docs/') || path.endsWith('.md')
}

/** True when any changed path can affect the Host image. */
export function hostImageNeeded(files) {
  return files.some((file) => !isDocsOnlyPath(file))
}

/**
 * Tags and an unknown base always build. Pull requests and branch pushes
 * build only when the diff is not docs-only.
 */
export function decideHostImage(input) {
  if (input.eventName !== 'pull_request' && input.eventName !== 'push') {
    return true
  }
  if (typeof input.ref === 'string' && input.ref.startsWith('refs/tags/')) {
    return true
  }
  const base = input.baseSha ?? ''
  if (!base || base === ZERO_SHA) {
    return true
  }
  return hostImageNeeded(input.files)
}

function changedFiles(base) {
  const out = execFileSync('git', ['diff', '--name-only', `${base}...HEAD`], {
    encoding: 'utf8',
  })
  return out.split('\n').map((line) => line.trim()).filter(Boolean)
}

function main() {
  const eventName = process.env.CI_EVENT_NAME ?? ''
  const ref = process.env.CI_REF ?? ''
  const baseSha = process.env.CI_BASE_SHA ?? ''
  let files = []
  let needed = true
  const canDiff = (eventName === 'pull_request' || eventName === 'push')
    && baseSha
    && baseSha !== ZERO_SHA
    && !ref.startsWith('refs/tags/')
  if (canDiff) {
    try {
      files = changedFiles(baseSha)
      needed = decideHostImage({ eventName, ref, baseSha, files })
    } catch (error) {
      console.error('ci-host-image: git diff failed; building the Host image')
      console.error(error)
      needed = true
    }
  } else {
    needed = decideHostImage({ eventName, ref, baseSha, files })
  }
  const value = needed ? 'true' : 'false'
  console.error(`ci-host-image: host_image=${value} event=${eventName || '(none)'} files=${files.length}`)
  process.stdout.write(`host_image=${value}\n`)
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main()
}
