import { describe, expect, it } from 'vitest'

type ValidationResult
  = | { ok: true, url: string }
    | { ok: false, key: string }

function isValidApplyPackUrl(value: string): ValidationResult {
  if (!value.trim()) {
    return { ok: false, key: 'pack.deepLinkUrlRequired' }
  }
  let parsed: URL
  try {
    parsed = new URL(value.trim())
  } catch {
    return { ok: false, key: 'pack.deepLinkInvalidUrl' }
  }
  if (parsed.protocol !== 'https:') {
    return { ok: false, key: 'pack.deepLinkHttpsOnly' }
  }
  const pathname = parsed.pathname.toLowerCase()
  if (!pathname.endsWith('.zip')) {
    return { ok: false, key: 'pack.deepLinkZipOnly' }
  }
  return { ok: true, url: parsed.href }
}

describe('pack deep-link Apply URL validation', () => {
  it('accepts a valid https .zip URL', () => {
    const result = isValidApplyPackUrl('https://dostigus.ru/pack-files/dostigus.kitchen-1.0.0.zip')
    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.url).toBe('https://dostigus.ru/pack-files/dostigus.kitchen-1.0.0.zip')
    }
  })

  it('accepts a URL with query parameters', () => {
    const result = isValidApplyPackUrl('https://dostigus.ru/pack-files/test.zip?v=1')
    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.url).toBe('https://dostigus.ru/pack-files/test.zip?v=1')
    }
  })

  it('accepts URL with percent encoding', () => {
    const encoded = encodeURIComponent('https://dostigus.ru/pack-files/dostigus.kitchen-1.0.0.zip')
    const decoded = decodeURIComponent(encoded)
    const result = isValidApplyPackUrl(decoded)
    expect(result.ok).toBe(true)
  })

  it('trims whitespace', () => {
    const result = isValidApplyPackUrl('  https://dostigus.ru/pack-files/test.zip  ')
    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.url).toBe('https://dostigus.ru/pack-files/test.zip')
    }
  })

  it('rejects empty URL', () => {
    expect(isValidApplyPackUrl('')).toEqual({ ok: false, key: 'pack.deepLinkUrlRequired' })
    expect(isValidApplyPackUrl('   ')).toEqual({ ok: false, key: 'pack.deepLinkUrlRequired' })
  })

  it('rejects invalid URL', () => {
    expect(isValidApplyPackUrl('not-a-url')).toEqual({ ok: false, key: 'pack.deepLinkInvalidUrl' })
    expect(isValidApplyPackUrl('//no-protocol.zip')).toEqual({ ok: false, key: 'pack.deepLinkInvalidUrl' })
  })

  it('rejects http (non-https) URL', () => {
    expect(isValidApplyPackUrl('http://dostigus.ru/pack-files/test.zip'))
      .toEqual({ ok: false, key: 'pack.deepLinkHttpsOnly' })
  })

  it('rejects ftp and other protocols', () => {
    expect(isValidApplyPackUrl('ftp://dostigus.ru/pack-files/test.zip'))
      .toEqual({ ok: false, key: 'pack.deepLinkHttpsOnly' })
    expect(isValidApplyPackUrl('file:///home/user/pack.zip'))
      .toEqual({ ok: false, key: 'pack.deepLinkHttpsOnly' })
  })

  it('rejects non-zip files', () => {
    expect(isValidApplyPackUrl('https://dostigus.ru/pack-files/test.tar.gz'))
      .toEqual({ ok: false, key: 'pack.deepLinkZipOnly' })
    expect(isValidApplyPackUrl('https://dostigus.ru/pack-files/pack.json'))
      .toEqual({ ok: false, key: 'pack.deepLinkZipOnly' })
    expect(isValidApplyPackUrl('https://dostigus.ru/'))
      .toEqual({ ok: false, key: 'pack.deepLinkZipOnly' })
  })

  it('is case-insensitive for .zip extension', () => {
    expect(isValidApplyPackUrl('https://dostigus.ru/pack-files/test.ZIP').ok).toBe(true)
    expect(isValidApplyPackUrl('https://dostigus.ru/pack-files/test.Zip').ok).toBe(true)
  })
})
