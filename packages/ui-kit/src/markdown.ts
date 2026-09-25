/**
 * Safe Markdown for assistant Chat bubbles.
 * See ADR 0022. User and system lines stay plain text.
 */
import MarkdownIt from 'markdown-it'

const ALLOWED_TAGS = new Set([
  'a',
  'br',
  'code',
  'em',
  'li',
  'ol',
  'p',
  'pre',
  'strong',
  'table',
  'tbody',
  'td',
  'th',
  'thead',
  'tr',
  'ul',
])

const md = new MarkdownIt({
  html: false,
  xhtmlOut: false,
  breaks: false,
  linkify: true,
  typographer: false,
})

md.disable([
  'heading',
  'lheading',
  'blockquote',
  'hr',
  'strikethrough',
])

md.validateLink = isSafeHttpUrl
md.linkify.set({ fuzzyLink: false, fuzzyEmail: false })
md.linkify.add('ftp:', null)
md.linkify.add('mailto:', null)

md.renderer.rules.link_open = (tokens, idx, options, _env, self) => {
  const token = tokens[idx]
  if (!token) {
    return ''
  }
  const href = token.attrGet('href') ?? ''
  token.attrs = [['href', href]]
  token.attrSet('target', '_blank')
  token.attrSet('rel', 'noopener noreferrer')
  return self.renderToken(tokens, idx, options)
}

md.renderer.rules.image = (tokens, idx) => {
  const token = tokens[idx]
  const src = token?.attrGet('src') ?? ''
  const alt = token?.content ?? ''
  return md.utils.escapeHtml(`![${alt}](${src})`)
}

/** Alignment markers stay valid GFM; the Kit does not emit align styles. */
md.renderer.rules.th_open = (tokens, idx, options, _env, self) => {
  const token = tokens[idx]
  if (token) {
    token.attrs = null
  }
  return self.renderToken(tokens, idx, options)
}
md.renderer.rules.td_open = md.renderer.rules.th_open

md.renderer.rules.fence = (tokens, idx) => renderCode(tokens[idx]?.content ?? '')
md.renderer.rules.code_block = (tokens, idx) => renderCode(tokens[idx]?.content ?? '')

function renderCode(content: string): string {
  return `<pre><code>${md.utils.escapeHtml(content)}</code></pre>\n`
}

/** Assistant bubbles use KitMarkdown. User and system stay plain text. */
export function assistantBubbleUsesMarkdown(role: string): boolean {
  return role === 'assistant'
}

/**
 * `http:` and `https:` only. Rejects `javascript:` and every other scheme,
 * including protocol-relative and relative URLs.
 */
export function isSafeHttpUrl(raw: string): boolean {
  const value = raw.trim()
  if (!/^https?:\/\//i.test(value)) {
    return false
  }
  if (value.includes('\\') || hasControlChar(value)) {
    return false
  }
  try {
    const url = new URL(value)
    return url.protocol === 'http:' || url.protocol === 'https:'
  } catch {
    return false
  }
}

function hasControlChar(value: string): boolean {
  for (let i = 0; i < value.length; i++) {
    const code = value.charCodeAt(i)
    if (code <= 0x1F || code === 0x7F) {
      return true
    }
  }
  return false
}

/** Allowlisted HTML from {@link renderChatMarkdown}. False rejects the string. */
export function chatHtmlIsSafe(html: string): boolean {
  let cursor = 0
  while (cursor < html.length) {
    const start = html.indexOf('<', cursor)
    if (start === -1) {
      return true
    }
    if (html.startsWith('<!--', start) || html.startsWith('<!', start) || html.startsWith('<?', start)) {
      return false
    }
    const end = findTagEnd(html, start)
    if (end === -1) {
      return false
    }
    if (!tagIsAllowed(html.slice(start + 1, end))) {
      return false
    }
    cursor = end + 1
  }
  return true
}

/**
 * Render an assistant Chat body. Raw HTML is escaped. Disallowed constructs
 * stay text. Unsafe output falls back to an escaped paragraph.
 */
export function renderChatMarkdown(source: string): string {
  const html = md.render(source).trim()
  if (html.length === 0) {
    return ''
  }
  if (!chatHtmlIsSafe(html)) {
    return `<p>${md.utils.escapeHtml(source)}</p>`
  }
  return html
}

function findTagEnd(html: string, start: number): number {
  let quote: '"' | '\'' | null = null
  for (let i = start + 1; i < html.length; i++) {
    const ch = html[i]
    if (quote) {
      if (ch === quote) {
        quote = null
      }
      continue
    }
    if (ch === '"' || ch === '\'') {
      quote = ch
      continue
    }
    if (ch === '>') {
      return i
    }
  }
  return -1
}

function tagIsAllowed(body: string): boolean {
  let rest = body.trim()
  if (rest.endsWith('/')) {
    rest = rest.slice(0, -1).trim()
  }
  const closing = rest.startsWith('/')
  if (closing) {
    rest = rest.slice(1).trim()
  }
  const nameMatch = /^[a-z0-9]+/.exec(rest)
  if (!nameMatch) {
    return false
  }
  const name = nameMatch[0]
  if (!ALLOWED_TAGS.has(name)) {
    return false
  }
  const attrSource = rest.slice(name.length)
  if (closing) {
    return attrSource.trim() === ''
  }
  const attrs = parseAttrs(attrSource)
  if (!attrs) {
    return false
  }
  return attrsAllowed(name, attrs)
}

type Attr = { name: string, value: string }

function parseAttrs(source: string): Attr[] | null {
  const attrs: Attr[] = []
  let i = 0
  while (i < source.length) {
    while (i < source.length && /\s/.test(source[i] ?? '')) {
      i++
    }
    if (i >= source.length) {
      break
    }
    const nameMatch = /^[a-z_:][\w:.-]*/i.exec(source.slice(i))
    if (!nameMatch) {
      return null
    }
    const name = nameMatch[0].toLowerCase()
    i += name.length
    while (i < source.length && /\s/.test(source[i] ?? '')) {
      i++
    }
    if (source[i] !== '=') {
      return null
    }
    i++
    while (i < source.length && /\s/.test(source[i] ?? '')) {
      i++
    }
    const quote = source[i]
    if (quote !== '"' && quote !== '\'') {
      return null
    }
    i++
    const end = source.indexOf(quote, i)
    if (end === -1) {
      return null
    }
    attrs.push({ name, value: source.slice(i, end) })
    i = end + 1
  }
  const names = attrs.map((attr) => attr.name)
  if (new Set(names).size !== names.length) {
    return null
  }
  return attrs
}

function attrsAllowed(name: string, attrs: Attr[]): boolean {
  if (name === 'a') {
    if (attrs.length !== 3) {
      return false
    }
    const href = attrs.find((attr) => attr.name === 'href')
    const target = attrs.find((attr) => attr.name === 'target')
    const rel = attrs.find((attr) => attr.name === 'rel')
    if (!href || !target || !rel) {
      return false
    }
    if (target.value !== '_blank' || rel.value !== 'noopener noreferrer') {
      return false
    }
    return isSafeHttpUrl(decodeHtmlAttr(href.value))
  }
  if (name === 'ol') {
    if (attrs.length === 0) {
      return true
    }
    if (attrs.length !== 1 || attrs[0]?.name !== 'start') {
      return false
    }
    return /^\d{1,6}$/.test(attrs[0].value)
  }
  return attrs.length === 0
}

function decodeHtmlAttr(value: string): string {
  return value
    .replace(/&#x([0-9a-f]+);/gi, (_, hex: string) => fromCode(Number.parseInt(hex, 16)))
    .replace(/&#(\d+);/g, (_, dec: string) => fromCode(Number.parseInt(dec, 10)))
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, '\'')
    .replace(/&#39;/g, '\'')
    .replace(/&amp;/g, '&')
}

function fromCode(n: number): string {
  if (!Number.isFinite(n) || n < 0 || n > 0x10FFFF) {
    return '\uFFFD'
  }
  return String.fromCodePoint(n)
}
