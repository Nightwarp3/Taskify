import { beforeEach, describe, expect, it, vi } from 'vitest'

// In-memory AsyncStorage mock.
vi.mock('@react-native-async-storage/async-storage', () => {
  const store = new Map<string, string>()
  return {
    default: {
      getItem: vi.fn(async (k: string) => (store.has(k) ? store.get(k)! : null)),
      setItem: vi.fn(async (k: string, v: string) => { store.set(k, v) }),
      removeItem: vi.fn(async (k: string) => { store.delete(k) }),
      clear: vi.fn(async () => { store.clear() }),
      __store: store
    }
  }
})

type Storage = typeof import('../src/lib/storage')
let storage: Storage

beforeEach(async () => {
  vi.resetModules()
  const AsyncStorage = (await import('@react-native-async-storage/async-storage')).default as unknown as {
    __store: Map<string, string>
  }
  AsyncStorage.__store.clear()
  storage = await import('../src/lib/storage')
  await storage.initStorage()
})

describe('projectQueries', () => {
  it('creates a project with correct fields and incrementing ids', async () => {
    const p1 = await storage.projectQueries.add('Work', '#4CAF50')
    const p2 = await storage.projectQueries.add('Personal', '#2196F3', 'desc')
    expect(p1.id).toBe(1)
    expect(p1.archivedAt).toBeNull()
    expect(p2.id).toBe(2)
    expect(p2.description).toBe('desc')
  })

  it('lists alphabetically and excludes archived', async () => {
    await storage.projectQueries.add('Zebra', '#000')
    await storage.projectQueries.add('Alpha', '#fff')
    const archived = await storage.projectQueries.add('Mid', '#aaa')
    await storage.projectQueries.archive(archived.id)
    const list = await storage.projectQueries.list()
    expect(list.map((p) => p.name)).toEqual(['Alpha', 'Zebra'])
  })

  it('persists across a reload (flush + initStorage)', async () => {
    const p = await storage.projectQueries.add('Persisted', '#000')
    vi.resetModules()
    storage = await import('../src/lib/storage')
    await storage.initStorage()
    expect((await storage.projectQueries.getById(p.id))?.name).toBe('Persisted')
  })
})

describe('isScheduledOn', () => {
  it('daily fires Mon–Fri only', () => {
    expect(storage.isScheduledOn({ type: 'daily' }, '2026-06-22')).toBe(true)  // Monday
    expect(storage.isScheduledOn({ type: 'daily' }, '2026-06-21')).toBe(false) // Sunday
  })

  it('every_n_days respects the anchor', () => {
    const s = { type: 'every_n_days', n: 3, anchorDate: '2026-06-01' } as const
    expect(storage.isScheduledOn(s, '2026-06-04')).toBe(true)
    expect(storage.isScheduledOn(s, '2026-06-05')).toBe(false)
  })

  it('monthly fires on the configured day', () => {
    expect(storage.isScheduledOn({ type: 'monthly', dayOfMonth: 15 }, '2026-06-15')).toBe(true)
    expect(storage.isScheduledOn({ type: 'monthly', dayOfMonth: 15 }, '2026-06-16')).toBe(false)
  })
})

describe('generateDueTasks', () => {
  it('creates one task per active, due template without an open instance', async () => {
    await storage.templateQueries.add({ title: 'Standup', schedule: { type: 'daily' } })
    const created = await storage.templateQueries.generateDueTasks('2026-06-22') // Monday
    expect(created).toHaveLength(1)
    expect(created[0].title).toBe('Standup')
    // Running again the same day should not duplicate (open instance exists).
    const again = await storage.templateQueries.generateDueTasks('2026-06-22')
    expect(again).toHaveLength(0)
  })
})

describe('taskQueries history and carry-over', () => {
  it('lists earlier current-week tasks including completed tasks', async () => {
    await storage.taskQueries.add('Monday', '2026-06-15')
    const done = await storage.taskQueries.add('Thursday done', '2026-06-18')
    await storage.taskQueries.update(done.id, { completed: true })

    const groups = await storage.taskQueries.listWeekHistory('2026-06-19')

    expect(groups.map((g) => g.date)).toEqual(['2026-06-18', '2026-06-15'])
    expect(groups[0].tasks[0].title).toBe('Thursday done')
    expect(groups[0].tasks[0].completed).toBe(true)
  })

  it('excludes today, future, previous-week, and backlog tasks from week history', async () => {
    await storage.taskQueries.add('Previous week', '2026-06-12')
    await storage.taskQueries.add('Today', '2026-06-19')
    await storage.taskQueries.add('Future', '2026-06-20')
    await storage.taskQueries.add('Backlog', '2026-06-18', { backlog: true, projectId: 1 })

    expect(await storage.taskQueries.listWeekHistory('2026-06-19')).toEqual([])
  })

  it('moves a dated task to today and removes it from the old date order', async () => {
    const task = await storage.taskQueries.add('Carry over', '2026-06-18')

    await storage.taskQueries.pullToToday(task.id, '2026-06-19')

    expect(await storage.taskQueries.listByDate('2026-06-18')).toHaveLength(0)
    expect((await storage.taskQueries.listByDate('2026-06-19')).map((t) => t.id)).toEqual([task.id])
    expect((await storage.taskQueries.getById(task.id))?.date).toBe('2026-06-19')
  })
})
