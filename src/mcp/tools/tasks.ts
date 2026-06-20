import type { SendToMain } from '../types'

export const taskTools = [
  {
    name: 'list_tasks_by_date',
    description: 'List all tasks for a given date',
    inputSchema: {
      type: 'object',
      properties: { date: { type: 'string', description: 'Date in YYYY-MM-DD format' } },
      required: ['date']
    }
  },
  {
    name: 'list_tasks_today',
    description: "List all tasks for today",
    inputSchema: { type: 'object', properties: {} }
  },
  {
    name: 'list_overdue_tasks',
    description: 'List all incomplete tasks from dates before today',
    inputSchema: { type: 'object', properties: {} }
  },
  {
    name: 'list_tasks_by_project',
    description: 'List all tasks in a project',
    inputSchema: {
      type: 'object',
      properties: { projectId: { type: 'number' } },
      required: ['projectId']
    }
  },
  {
    name: 'list_tasks_by_tag',
    description: 'List all tasks with a specific tag',
    inputSchema: {
      type: 'object',
      properties: { tag: { type: 'string' } },
      required: ['tag']
    }
  },
  {
    name: 'create_task',
    description: 'Create a new task',
    inputSchema: {
      type: 'object',
      properties: {
        title: { type: 'string' },
        date: { type: 'string', description: 'YYYY-MM-DD, defaults to today' },
        estimatedMinutes: { type: 'number' },
        projectId: { type: 'number' },
        tags: { type: 'array', items: { type: 'string' } }
      },
      required: ['title']
    }
  },
  {
    name: 'update_task',
    description: 'Update fields on a task',
    inputSchema: {
      type: 'object',
      properties: {
        id: { type: 'number' },
        title: { type: 'string' },
        completed: { type: 'boolean' },
        notes: { type: 'string' },
        estimatedMinutes: { type: 'number' }
      },
      required: ['id']
    }
  },
  {
    name: 'delete_task',
    description: 'Delete a task',
    inputSchema: {
      type: 'object',
      properties: { id: { type: 'number' } },
      required: ['id']
    }
  }
]

export async function handleTaskTool(
  name: string,
  args: Record<string, unknown>,
  send: SendToMain
): Promise<{ content: Array<{ type: string; text: string }> }> {
  let data: unknown

  switch (name) {
    case 'list_tasks_by_date':
      data = await send('tasks:listByDate', { date: args.date })
      break
    case 'list_tasks_today':
      data = await send('tasks:listToday', {})
      break
    case 'list_overdue_tasks':
      data = await send('tasks:listOverdue', {})
      break
    case 'list_tasks_by_project':
      data = await send('tasks:listByProject', { projectId: args.projectId })
      break
    case 'list_tasks_by_tag': {
      const allByDate = (await send('tasks:listToday', {})) as Array<{ tags: string | null }>
      data = allByDate.filter((t) => {
        if (!t.tags) return false
        try { return (JSON.parse(t.tags) as string[]).includes(args.tag as string) }
        catch { return false }
      })
      break
    }
    case 'create_task':
      data = await send('tasks:create', args)
      break
    case 'update_task':
      data = await send('tasks:update', args)
      break
    case 'delete_task':
      data = await send('tasks:delete', { id: args.id })
      break
    default:
      throw new Error(`Unknown task tool: ${name}`)
  }

  return { content: [{ type: 'text', text: JSON.stringify(data, null, 2) }] }
}
