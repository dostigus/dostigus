import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { expect, it } from 'vitest'
import { uiKitComponents } from '../../src/components'
import {
  assistantBubbleUsesMarkdown,
  chatHtmlIsSafe,
  renderChatMarkdown,
} from '../../src/markdown'

const root = join(import.meta.dirname, '../..')

it('renders bold, italic, and inline code', () => {
  const html = renderChatMarkdown('**bold** and *italic* and `code`')
  expect(html).toContain('<strong>bold</strong>')
  expect(html).toContain('<em>italic</em>')
  expect(html).toContain('<code>code</code>')
  expect(html).not.toContain('**bold**')
})

it('keeps literal newlines inside a fenced block and skips highlighting', () => {
  const html = renderChatMarkdown('```js\nconst x = 1\n**no**\n```')
  expect(html).toContain('<pre><code>')
  expect(html).toContain('const x = 1\n**no**')
  expect(html).not.toContain('<strong>')
  expect(html).not.toContain('language-')
  expect(html).not.toContain('class=')
})

it('renders bullet and numbered lists', () => {
  const bullets = renderChatMarkdown('- **bold** item\n- item with `code`')
  expect(bullets).toContain('<ul>')
  expect(bullets).toContain('<li><strong>bold</strong> item</li>')
  expect(bullets).toContain('<li>item with <code>code</code></li>')
  expect(bullets).not.toContain('<ol')

  const numbered = renderChatMarkdown('1. first\n2. second')
  expect(numbered).toContain('<ol>')
  expect(numbered).toContain('<li>first</li>')
  expect(numbered).toContain('<li>second</li>')
})

it('renders links and bare http(s) autolinks in a new tab', () => {
  const linked = renderChatMarkdown('See [docs](https://example.com/docs) and http://example.com/a.')
  expect(linked).toContain('href="https://example.com/docs"')
  expect(linked).toContain('href="http://example.com/a"')
  expect(linked).toContain('target="_blank"')
  expect(linked).toContain('rel="noopener noreferrer"')
  expect(linked).toContain('>docs</a>')
  expect(linked).toContain('>http://example.com/a</a>.')

  const bare = renderChatMarkdown('Visit https://example.com/path?q=1&x=2 now')
  expect(bare).toContain('href="https://example.com/path?q=1&amp;x=2"')
  expect(bare).toContain('target="_blank"')
})

it('soft-joins a single newline and splits paragraphs on a blank line', () => {
  const joined = renderChatMarkdown('hello\nworld')
  expect(joined).toBe('<p>hello\nworld</p>')
  expect(joined).not.toContain('<br')

  const paragraphs = renderChatMarkdown('hello\n\nworld')
  expect(paragraphs).toBe('<p>hello</p>\n<p>world</p>')
})

it('does not make non-http schemes clickable', () => {
  const cases = [
    '[bad](javascript:alert(1))',
    '[bad](JavaScript:alert(1))',
    '[bad](data:text/html,hi)',
    '[bad](ftp://example.com/file)',
    '[bad](mailto:a@b.com)',
    '[bad](/local)',
    '[bad](vbscript:msgbox)',
    '[bad](file:///etc/passwd)',
  ]
  for (const source of cases) {
    const html = renderChatMarkdown(source)
    expect(html, source).not.toContain('<a')
    expect(html, source).toContain(source)
  }

  const bare = renderChatMarkdown('ftp://example.com/file and mailto:a@b.com and www.example.com and user@example.com')
  expect(bare).not.toContain('<a')
  expect(bare).toContain('ftp://example.com/file')
  expect(bare).toContain('www.example.com')
  expect(bare).toContain('user@example.com')
})

it('keeps a safe link when another link uses a rejected scheme', () => {
  const html = renderChatMarkdown('[ok](https://example.com) and [bad](javascript:alert(1))')
  expect(html).toContain('href="https://example.com"')
  expect(html).toContain('[bad](javascript:alert(1))')
  expect(html).not.toContain('href="javascript:')
  expect(html.match(/<a /g)).toHaveLength(1)
})

it('renders a valid GFM table as a real table', () => {
  const html = renderChatMarkdown('| Tool | When | How |\n| --- | --- | --- |\n| Knife | Cutting | **sharp** |')
  expect(html).toContain('<table>')
  expect(html).toContain('<thead>')
  expect(html).toContain('<tbody>')
  expect(html).toContain('<tr>')
  expect(html).toContain('<th>Tool</th>')
  expect(html).toContain('<th>When</th>')
  expect(html).toContain('<th>How</th>')
  expect(html).toContain('<td>Knife</td>')
  expect(html).toContain('<td>Cutting</td>')
  expect(html).toContain('<td><strong>sharp</strong></td>')
  expect(html).not.toContain('| Tool |')
  expect(html).not.toContain('style=')
  expect(html).not.toContain('align=')

  const aligned = renderChatMarkdown('| a | b |\n| :--- | ---: |\n| 1 | 2 |')
  expect(aligned).toContain('<table>')
  expect(aligned).toContain('<th>a</th>')
  expect(aligned).toContain('<td>1</td>')
  expect(aligned).not.toContain('style=')
  expect(aligned).not.toContain('align=')

  const chef = renderChatMarkdown([
    '| Инструмент | Когда | Как |',
    '| --- | --- | --- |',
    '| Нож шеф | Нарезка | Вести лезвие, не пилить |',
    '| Сотейник | Соус | Средний огонь, мешать |',
  ].join('\n'))
  expect(chef).toContain('<table>')
  expect(chef).toContain('<th>Инструмент</th>')
  expect(chef).toContain('<td>Нож шеф</td>')
  expect(chef).toContain('<td>Вести лезвие, не пилить</td>')
  expect(chef).not.toContain('| Инструмент |')
})

it('keeps lone and malformed pipes as literal text', () => {
  const lone = renderChatMarkdown('price | qty')
  expect(lone).not.toContain('<table')
  expect(lone).toContain('price | qty')

  const headerOnly = renderChatMarkdown('| a | b |')
  expect(headerOnly).not.toContain('<table')
  expect(headerOnly).toContain('| a | b |')

  const noSeparator = renderChatMarkdown('| a | b |\n| 1 | 2 |')
  expect(noSeparator).not.toContain('<table')
  expect(noSeparator).toContain('| a | b |')
  expect(noSeparator).toContain('| 1 | 2 |')

  const brokenSeparator = renderChatMarkdown('| a | b |\n| not-a-sep | --- |\n| 1 | 2 |')
  expect(brokenSeparator).not.toContain('<table')
  expect(brokenSeparator).toContain('| a | b |')
  expect(brokenSeparator).toContain('| not-a-sep |')
})

it('does not execute or elevate raw HTML, images, headings, or task checks', () => {
  const injected = renderChatMarkdown('**a** <script>alert(1)</script> <img src=x onerror=alert(1)> <b>no</b>')
  expect(injected).toContain('<strong>a</strong>')
  expect(injected).not.toContain('<script')
  expect(injected).not.toContain('<img')
  expect(injected).not.toContain('<b>')
  expect(injected).toContain('&lt;script&gt;')
  expect(injected).toContain('&lt;img')
  expect(injected).toContain('&lt;b&gt;')

  const image = renderChatMarkdown('![cat](https://example.com/c.png)')
  expect(image).not.toContain('<img')
  expect(image).not.toContain('<a')
  expect(image).toContain('![cat](https://example.com/c.png)')

  const heading = renderChatMarkdown('# Title')
  expect(heading).not.toContain('<h1')
  expect(heading).toContain('# Title')

  const task = renderChatMarkdown('- [ ] milk')
  expect(task).toContain('<ul>')
  expect(task).toContain('[ ] milk')
  expect(task).not.toContain('<input')

  const quote = renderChatMarkdown('> quoted')
  expect(quote).not.toContain('<blockquote')
  expect(quote).toContain('&gt; quoted')

  const strike = renderChatMarkdown('~~gone~~')
  expect(strike).not.toContain('<s>')
  expect(strike).toContain('~~gone~~')

  const fence = renderChatMarkdown('```\n<script>alert(1)</script>\n```')
  expect(fence).not.toContain('<script')
  expect(fence).toContain('&lt;script&gt;')
})

it('rejects unsafe markup the renderer did not emit', () => {
  expect(chatHtmlIsSafe('<p>ok</p>')).toBe(true)
  expect(chatHtmlIsSafe('<table><thead><tr><th>a</th></tr></thead><tbody><tr><td>1</td></tr></tbody></table>')).toBe(true)
  expect(chatHtmlIsSafe('<script>alert(1)</script>')).toBe(false)
  expect(chatHtmlIsSafe('<img src=x onerror=alert(1)>')).toBe(false)
  expect(chatHtmlIsSafe('<a href="javascript:alert(1)" target="_blank" rel="noopener noreferrer">x</a>')).toBe(false)
  expect(chatHtmlIsSafe('<a href="https://example.com" target="_blank" rel="noopener noreferrer" onclick="alert(1)">x</a>')).toBe(false)
  expect(chatHtmlIsSafe('<p onclick="alert(1)">x</p>')).toBe(false)
})

it('uses Markdown for the assistant role only', () => {
  expect(assistantBubbleUsesMarkdown('assistant')).toBe(true)
  expect(assistantBubbleUsesMarkdown('user')).toBe(false)
  expect(assistantBubbleUsesMarkdown('system')).toBe(false)
})

it('registers KitMarkdown on the Kit', () => {
  expect(uiKitComponents.markdown).toBe('KitMarkdown')
  const vue = readFileSync(join(root, 'src/components/KitMarkdown.vue'), 'utf8')
  expect(vue).toContain('renderChatMarkdown')
  expect(vue).toContain('class="kit-markdown"')
  expect(vue).toContain('v-html')
})
