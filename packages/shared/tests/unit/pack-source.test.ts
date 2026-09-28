import { expect, it } from 'vitest'
import {
  detectPackRemoteSource,
  PACK_REMOTE_GIT_AUTH,
  PACK_REMOTE_GIT_HTTPS,
  PACK_REMOTE_HINT,
  PACK_REMOTE_PATH,
  PACK_REMOTE_ZIP_ONLY,
  PackInputError,
  parsePackSource,
  sanitizePackGitPath,
} from '../../src/index'

it('classifies a .zip URL and a zip Content-Type', () => {
  expect(detectPackRemoteSource({
    url: 'https://cdn.example/ada.notes-1.0.0.zip',
  })).toEqual({
    kind: 'url',
    url: 'https://cdn.example/ada.notes-1.0.0.zip',
  })
  expect(detectPackRemoteSource({
    url: 'http://mirror.example/download?name=1',
    contentType: 'application/zip; charset=binary',
  })).toEqual({
    kind: 'url',
    url: 'http://mirror.example/download?name=1',
  })
})

it('normalizes a bare GitHub repo and a tree URL into git + ref + path', () => {
  expect(detectPackRemoteSource({
    url: 'https://github.com/ada/notes',
  })).toEqual({
    kind: 'git',
    url: 'https://github.com/ada/notes.git',
  })
  expect(detectPackRemoteSource({
    url: 'https://www.github.com/ada/notes.git',
  })).toEqual({
    kind: 'git',
    url: 'https://github.com/ada/notes.git',
  })
  expect(detectPackRemoteSource({
    url: 'https://github.com/ada/notes/tree/main/packs/foo',
  })).toEqual({
    kind: 'git',
    url: 'https://github.com/ada/notes.git',
    ref: 'main',
    path: 'packs/foo',
  })
  expect(detectPackRemoteSource({
    url: 'https://gitlab.com/ada/notes',
  })).toEqual({
    kind: 'git',
    url: 'https://gitlab.com/ada/notes.git',
  })
  expect(detectPackRemoteSource({
    url: 'https://git.example/ada/notes.git',
    ref: 'v1.0.0',
    path: 'share',
  })).toEqual({
    kind: 'git',
    url: 'https://git.example/ada/notes.git',
    ref: 'v1.0.0',
    path: 'share',
  })
})

it('lets optional path and ref override a parsed GitHub tree', () => {
  expect(detectPackRemoteSource({
    url: 'https://github.com/ada/notes/tree/main/old',
    ref: 'v2',
    path: 'new/dir',
  })).toEqual({
    kind: 'git',
    url: 'https://github.com/ada/notes.git',
    ref: 'v2',
    path: 'new/dir',
  })
})

it('rejects raw pack.json, GitHub blob HTML, SSH, and private auth', () => {
  expect(() => detectPackRemoteSource({
    url: 'https://example.com/pack.json',
  })).toThrow(PACK_REMOTE_HINT)
  expect(() => detectPackRemoteSource({
    url: 'https://github.com/ada/notes/blob/main/pack.json',
  })).toThrow(PACK_REMOTE_ZIP_ONLY)
  expect(() => detectPackRemoteSource({
    url: 'git@github.com:ada/notes.git',
  })).toThrow(PACK_REMOTE_GIT_AUTH)
  expect(() => detectPackRemoteSource({
    url: 'ssh://git@github.com/ada/notes.git',
  })).toThrow(PACK_REMOTE_GIT_AUTH)
  expect(() => detectPackRemoteSource({
    url: 'https://ada:ghp_secret@github.com/ada/notes.git',
  })).toThrow(PACK_REMOTE_GIT_AUTH)
  expect(() => detectPackRemoteSource({
    url: 'http://github.com/ada/notes',
  })).toThrow(PACK_REMOTE_GIT_HTTPS)
  expect(() => detectPackRemoteSource({
    url: 'https://example.com/not-a-pack',
  })).toThrow(PACK_REMOTE_HINT)
})

it('rejects a git path that escapes the checkout', () => {
  expect(() => sanitizePackGitPath('../secret')).toThrow(PACK_REMOTE_PATH)
  expect(() => detectPackRemoteSource({
    url: 'https://github.com/ada/notes.git',
    path: '..',
  })).toThrow(PackInputError)
})

it('parses stored Pack source on a snapshot', () => {
  expect(parsePackSource({ kind: 'file' })).toEqual({ kind: 'file' })
  expect(parsePackSource({
    kind: 'url',
    url: 'https://cdn.example/a.zip',
  })).toEqual({ kind: 'url', url: 'https://cdn.example/a.zip' })
  expect(parsePackSource({
    kind: 'git',
    url: 'https://github.com/ada/notes.git',
    ref: 'main',
    path: 'share',
  })).toEqual({
    kind: 'git',
    url: 'https://github.com/ada/notes.git',
    ref: 'main',
    path: 'share',
  })
  expect(parsePackSource(undefined)).toBeUndefined()
})
