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

type ProjectQueriesType = typeof import('../../src/main/db').projectQueries
let projectQueries: ProjectQueriesType

beforeEach(async () => {
  vi.resetModules()
  const db = await import('../../src/main/db')
  projectQueries = db.projectQueries
})

describe('add()', () => {
  it('creates a project with correct fields', () => {
    const p = projectQueries.add('Work', '#4CAF50')
    expect(p.id).toBe(1)
    expect(p.name).toBe('Work')
    expect(p.color).toBe('#4CAF50')
    expect(p.archivedAt).toBeNull()
    expect(p.createdAt).toBeTruthy()
  })

  it('stores an optional description', () => {
    const p = projectQueries.add('Personal', '#2196F3', 'My personal tasks')
    expect(p.description).toBe('My personal tasks')
  })

  it('defaults description to null when not provided', () => {
    const p = projectQueries.add('Work', '#000')
    expect(p.description).toBeNull()
  })

  it('assigns incrementing ids', () => {
    const p1 = projectQueries.add('A', '#000')
    const p2 = projectQueries.add('B', '#fff')
    expect(p1.id).toBe(1)
    expect(p2.id).toBe(2)
  })
})

describe('list()', () => {
  it('returns projects sorted alphabetically by name', () => {
    projectQueries.add('Zebra', '#000')
    projectQueries.add('Alpha', '#fff')
    projectQueries.add('Middle', '#aaa')
    const list = projectQueries.list()
    expect(list.map((p) => p.name)).toEqual(['Alpha', 'Middle', 'Zebra'])
  })

  it('excludes archived projects', () => {
    const p1 = projectQueries.add('Active', '#000')
    const p2 = projectQueries.add('Archived', '#fff')
    projectQueries.archive(p2.id)
    const list = projectQueries.list()
    expect(list).toHaveLength(1)
    expect(list[0].id).toBe(p1.id)
  })

  it('returns an empty array when no projects exist', () => {
    expect(projectQueries.list()).toEqual([])
  })
})

describe('update()', () => {
  it('updates the project name', () => {
    const p = projectQueries.add('Old Name', '#000')
    const updated = projectQueries.update(p.id, { name: 'New Name' })
    expect(updated?.name).toBe('New Name')
  })

  it('updates the project color', () => {
    const p = projectQueries.add('Work', '#000')
    const updated = projectQueries.update(p.id, { color: '#FF5733' })
    expect(updated?.color).toBe('#FF5733')
  })

  it('updates the project description', () => {
    const p = projectQueries.add('Work', '#000')
    const updated = projectQueries.update(p.id, { description: 'New desc' })
    expect(updated?.description).toBe('New desc')
  })

  it('returns null for a nonexistent id', () => {
    expect(projectQueries.update(999, { name: 'x' })).toBeNull()
  })

  it('persists changes on subsequent reads', () => {
    const p = projectQueries.add('Work', '#000')
    projectQueries.update(p.id, { name: 'Updated' })
    expect(projectQueries.getById(p.id)?.name).toBe('Updated')
  })
})

describe('archive()', () => {
  it('sets archivedAt on the project', () => {
    const p = projectQueries.add('To Archive', '#000')
    projectQueries.archive(p.id)
    expect(projectQueries.getById(p.id)?.archivedAt).toBeTruthy()
  })

  it('returns { ok: true } on success', () => {
    const p = projectQueries.add('Work', '#000')
    expect(projectQueries.archive(p.id)).toEqual({ ok: true })
  })

  it('returns { ok: false } for a nonexistent id', () => {
    expect(projectQueries.archive(999)).toEqual({ ok: false })
  })

  it('removes the project from list() after archiving', () => {
    const p = projectQueries.add('Soon archived', '#000')
    projectQueries.archive(p.id)
    expect(projectQueries.list().find((x) => x.id === p.id)).toBeUndefined()
  })
})

describe('delete()', () => {
  it('removes the project entirely', () => {
    const p = projectQueries.add('Delete me', '#000')
    projectQueries.delete(p.id)
    expect(projectQueries.getById(p.id)).toBeNull()
  })

  it('returns { ok: true } on success', () => {
    const p = projectQueries.add('Work', '#000')
    expect(projectQueries.delete(p.id)).toEqual({ ok: true })
  })

  it('returns { ok: false } for a nonexistent id', () => {
    expect(projectQueries.delete(999)).toEqual({ ok: false })
  })
})

describe('getById()', () => {
  it('returns the project by id', () => {
    const p = projectQueries.add('Find me', '#000')
    expect(projectQueries.getById(p.id)).toMatchObject({ name: 'Find me' })
  })

  it('returns null for a nonexistent id', () => {
    expect(projectQueries.getById(999)).toBeNull()
  })
})
