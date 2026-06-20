import { beforeEach, describe, expect, it, vi } from 'vitest'

// Self-contained mock so hoisting doesn't cause import-ordering issues.
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

type TaskQueriesType = typeof import('../../src/main/db').taskQueries
let taskQueries: TaskQueriesType

const TODAY = '2026-06-19'
const YESTERDAY = '2026-06-18'
const TOMORROW = '2026-06-20'

beforeEach(async () => {
  vi.resetModules()
  const db = await import('../../src/main/db')
  taskQueries = db.taskQueries
})

describe('add()', () => {
  it('creates a task with correct defaults', () => {
    const task = taskQueries.add('Write tests', TODAY)
    expect(task.id).toBe(1)
    expect(task.title).toBe('Write tests')
    expect(task.date).toBe(TODAY)
    expect(task.completed).toBe(false)
    expect(task.completedAt).toBeNull()
    expect(task.backlog).toBe(false)
    expect(task.sortOrder).toBe(0)
    expect(task.notes).toBeNull()
    expect(task.tags).toBeNull()
    expect(task.projectId).toBeNull()
  })

  it('assigns incrementing ids', () => {
    const t1 = taskQueries.add('First', TODAY)
    const t2 = taskQueries.add('Second', TODAY)
    expect(t1.id).toBe(1)
    expect(t2.id).toBe(2)
  })

  it('assigns incrementing sortOrder per date', () => {
    const t1 = taskQueries.add('A', TODAY)
    const t2 = taskQueries.add('B', TODAY)
    expect(t1.sortOrder).toBe(0)
    expect(t2.sortOrder).toBe(1)
  })

  it('stores tags as JSON string', () => {
    const task = taskQueries.add('Tagged', TODAY, { tags: ['work', 'urgent'] })
    expect(task.tags).toBe(JSON.stringify(['work', 'urgent']))
  })

  it('stores estimatedMinutes', () => {
    const task = taskQueries.add('Timed', TODAY, { estimatedMinutes: 30 })
    expect(task.estimatedMinutes).toBe(30)
  })

  it('defaults scheduledTime to null', () => {
    const task = taskQueries.add('No time', TODAY)
    expect(task.scheduledTime).toBeNull()
  })

  it('stores scheduledTime when provided', () => {
    const task = taskQueries.add('Morning standup', TODAY, { scheduledTime: '09:30' })
    expect(task.scheduledTime).toBe('09:30')
  })

  it('creates a backlog task with backlog=true, not in date order', () => {
    const task = taskQueries.add('Backlog item', TODAY, { backlog: true, projectId: 1 })
    expect(task.backlog).toBe(true)
    expect(taskQueries.listByDate(TODAY)).toHaveLength(0)
  })

  it('associates task with project', () => {
    const task = taskQueries.add('Proj task', TODAY, { projectId: 5 })
    expect(task.projectId).toBe(5)
  })
})

describe('listByDate()', () => {
  it('returns tasks in insertion order', () => {
    taskQueries.add('First', TODAY)
    taskQueries.add('Second', TODAY)
    const list = taskQueries.listByDate(TODAY)
    expect(list).toHaveLength(2)
    expect(list[0].title).toBe('First')
    expect(list[1].title).toBe('Second')
  })

  it('excludes backlog tasks', () => {
    taskQueries.add('Regular', TODAY)
    taskQueries.add('Backlog', TODAY, { backlog: true, projectId: 1 })
    expect(taskQueries.listByDate(TODAY)).toHaveLength(1)
    expect(taskQueries.listByDate(TODAY)[0].title).toBe('Regular')
  })

  it('does not cross-contaminate different dates', () => {
    taskQueries.add('Today task', TODAY)
    taskQueries.add('Tomorrow task', TOMORROW)
    expect(taskQueries.listByDate(TODAY)).toHaveLength(1)
    expect(taskQueries.listByDate(TOMORROW)).toHaveLength(1)
  })

  it('returns empty array for a date with no tasks', () => {
    expect(taskQueries.listByDate('2000-01-01')).toEqual([])
  })
})

describe('update()', () => {
  it('updates the title', () => {
    const t = taskQueries.add('Old', TODAY)
    const updated = taskQueries.update(t.id, { title: 'New' })
    expect(updated?.title).toBe('New')
  })

  it('marks task complete and sets completedAt', () => {
    const t = taskQueries.add('Do it', TODAY)
    const updated = taskQueries.update(t.id, { completed: true })
    expect(updated?.completed).toBe(true)
    expect(updated?.completedAt).toBeTruthy()
  })

  it('un-completes a task and clears completedAt', () => {
    const t = taskQueries.add('Done', TODAY)
    taskQueries.update(t.id, { completed: true })
    const updated = taskQueries.update(t.id, { completed: false })
    expect(updated?.completed).toBe(false)
    expect(updated?.completedAt).toBeNull()
  })

  it('updates notes', () => {
    const t = taskQueries.add('Task', TODAY)
    const updated = taskQueries.update(t.id, { notes: 'Some notes' })
    expect(updated?.notes).toBe('Some notes')
  })

  it('updates tags as a JSON string', () => {
    const t = taskQueries.add('Tagged', TODAY)
    const updated = taskQueries.update(t.id, { tags: JSON.stringify(['focus']) })
    expect(updated?.tags).toBe('["focus"]')
  })

  it('updates projectId', () => {
    const t = taskQueries.add('Task', TODAY)
    const updated = taskQueries.update(t.id, { projectId: 7 })
    expect(updated?.projectId).toBe(7)
  })

  it('updates scheduledTime', () => {
    const t = taskQueries.add('Task', TODAY)
    const updated = taskQueries.update(t.id, { scheduledTime: '14:00' })
    expect(updated?.scheduledTime).toBe('14:00')
  })

  it('clears scheduledTime when set to null', () => {
    const t = taskQueries.add('Task', TODAY, { scheduledTime: '10:00' })
    const updated = taskQueries.update(t.id, { scheduledTime: null })
    expect(updated?.scheduledTime).toBeNull()
  })

  it('returns null for a nonexistent id', () => {
    expect(taskQueries.update(999, { title: 'x' })).toBeNull()
  })

  it('persists changes on subsequent reads', () => {
    const t = taskQueries.add('Persist', TODAY)
    taskQueries.update(t.id, { title: 'Updated' })
    expect(taskQueries.getById(t.id)?.title).toBe('Updated')
  })
})

describe('delete()', () => {
  it('removes the task from storage', () => {
    const t = taskQueries.add('Remove me', TODAY)
    taskQueries.delete(t.id)
    expect(taskQueries.getById(t.id)).toBeNull()
  })

  it('removes the task from the date order', () => {
    const t = taskQueries.add('Remove me', TODAY)
    taskQueries.delete(t.id)
    expect(taskQueries.listByDate(TODAY)).toHaveLength(0)
  })

  it('does not affect other tasks on the same date', () => {
    const t1 = taskQueries.add('Keep', TODAY)
    const t2 = taskQueries.add('Delete', TODAY)
    taskQueries.delete(t2.id)
    const remaining = taskQueries.listByDate(TODAY)
    expect(remaining).toHaveLength(1)
    expect(remaining[0].id).toBe(t1.id)
  })
})

describe('getById()', () => {
  it('returns the task by id', () => {
    const t = taskQueries.add('Find me', TODAY)
    expect(taskQueries.getById(t.id)).toMatchObject({ title: 'Find me', id: t.id })
  })

  it('returns null for a nonexistent id', () => {
    expect(taskQueries.getById(999)).toBeNull()
  })
})

describe('listByProject()', () => {
  it('returns only tasks belonging to the project', () => {
    taskQueries.add('Proj A task', TODAY, { projectId: 1 })
    taskQueries.add('Other task', TODAY, { projectId: 2 })
    const list = taskQueries.listByProject(1)
    expect(list).toHaveLength(1)
    expect(list[0].title).toBe('Proj A task')
  })

  it('returns both backlog and scheduled tasks for a project', () => {
    taskQueries.add('Scheduled', TODAY, { projectId: 3 })
    taskQueries.add('Backlog', TODAY, { projectId: 3, backlog: true })
    expect(taskQueries.listByProject(3)).toHaveLength(2)
  })

  it('returns empty array when project has no tasks', () => {
    expect(taskQueries.listByProject(99)).toEqual([])
  })
})

describe('rescheduleDate()', () => {
  it('moves a task to a new date', () => {
    const t = taskQueries.add('Move me', TODAY)
    taskQueries.rescheduleDate(t.id, TOMORROW)
    expect(taskQueries.listByDate(TODAY)).toHaveLength(0)
    expect(taskQueries.listByDate(TOMORROW)).toHaveLength(1)
    expect(taskQueries.getById(t.id)?.date).toBe(TOMORROW)
  })

  it('is a no-op when the date is the same', () => {
    const t = taskQueries.add('Same date', TODAY)
    taskQueries.rescheduleDate(t.id, TODAY)
    expect(taskQueries.listByDate(TODAY)).toHaveLength(1)
  })

  it('returns null for a nonexistent task', () => {
    expect(taskQueries.rescheduleDate(999, TOMORROW)).toBeNull()
  })
})

describe('listOverdue()', () => {
  it('returns incomplete tasks from dates before today', () => {
    taskQueries.add('Old incomplete', YESTERDAY)
    const groups = taskQueries.listOverdue(TODAY)
    expect(groups).toHaveLength(1)
    expect(groups[0].date).toBe(YESTERDAY)
    expect(groups[0].tasks[0].title).toBe('Old incomplete')
  })

  it('excludes completed overdue tasks', () => {
    const t = taskQueries.add('Old done', YESTERDAY)
    taskQueries.update(t.id, { completed: true })
    expect(taskQueries.listOverdue(TODAY)).toHaveLength(0)
  })

  it("excludes today's tasks and future tasks", () => {
    taskQueries.add('Today', TODAY)
    taskQueries.add('Future', TOMORROW)
    expect(taskQueries.listOverdue(TODAY)).toHaveLength(0)
  })

  it('groups multiple overdue dates separately', () => {
    taskQueries.add('Day -1', YESTERDAY)
    taskQueries.add('Day -2', '2026-06-17')
    const groups = taskQueries.listOverdue(TODAY)
    expect(groups).toHaveLength(2)
    // Groups are sorted newest-first
    expect(groups[0].date).toBe(YESTERDAY)
    expect(groups[1].date).toBe('2026-06-17')
  })
})

describe('getAll()', () => {
  it('returns all tasks regardless of date or backlog status', () => {
    taskQueries.add('Scheduled', TODAY)
    taskQueries.add('Old', YESTERDAY)
    taskQueries.add('Backlog', TODAY, { backlog: true, projectId: 1 })
    expect(taskQueries.getAll()).toHaveLength(3)
  })

  it('returns empty array when there are no tasks', () => {
    expect(taskQueries.getAll()).toEqual([])
  })
})

describe('reorder()', () => {
  it('reorders tasks by swapping their sortOrder', () => {
    const t1 = taskQueries.add('A', TODAY)
    const t2 = taskQueries.add('B', TODAY)
    taskQueries.reorder(TODAY, [t2.id, t1.id])
    const list = taskQueries.listByDate(TODAY)
    expect(list[0].id).toBe(t2.id)
    expect(list[1].id).toBe(t1.id)
  })
})
