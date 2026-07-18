import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('electron-store', () => {
  function getPath(obj: unknown, path: string): unknown {
    const keys = path.split('.')
    let cur: unknown = obj
    for (const k of keys) {
      if (cur == null || typeof cur !== 'object') return undefined
      cur = (cur as Record<string, unknown>)[k]
    }
    return cur
  }

  function setPath(obj: Record<string, unknown>, path: string, value: unknown): void {
    const keys = path.split('.')
    let cur: Record<string, unknown> = obj
    for (let i = 0; i < keys.length - 1; i++) {
      const k = keys[i]
      if (typeof cur[k] !== 'object' || cur[k] === null) cur[k] = {}
      cur = cur[k] as Record<string, unknown>
    }
    cur[keys[keys.length - 1]] = value
  }

  class MockStore {
    private data: Record<string, unknown>
    constructor(opts?: { defaults?: Record<string, unknown> }) {
      this.data = opts?.defaults ? JSON.parse(JSON.stringify(opts.defaults)) : {}
    }
    get(key: string, def?: unknown): unknown {
      const v = getPath(this.data, key)
      return v !== undefined ? v : def
    }
    set(key: string, value: unknown): void {
      setPath(this.data, key, value)
    }
  }

  return { default: MockStore }
})

type Db = typeof import('../../src/main/db')
let db: Db

beforeEach(async () => {
  vi.resetModules()
  db = await import('../../src/main/db')
})

describe('settingsQueries', () => {
  it('includes the default close behavior', () => {
    expect(db.settingsQueries.get().closeBehavior).toBe('background')
  })

  it('persists changes to close behavior', () => {
    db.settingsQueries.set('closeBehavior', 'exit')
    expect(db.settingsQueries.get().closeBehavior).toBe('exit')
  })
})
