import type { SendToMain } from '../types'

export const taskTools = [
  {
    name: 'list_tasks_by_date',
    description:
      'List all tasks scheduled for a specific calendar date. Returns tasks in display order, excluding backlog items.',
    inputSchema: {
      type: 'object',
      properties: {
        date: {
          type: 'string',
          description: 'Calendar date in YYYY-MM-DD format (e.g. "2026-06-19")'
        }
      },
      required: ['date']
    }
  },
  {
    name: 'list_tasks_today',
    description: "List all tasks scheduled for today's date. Excludes backlog tasks.",
    inputSchema: { type: 'object', properties: {} }
  },
  {
    name: 'list_overdue_tasks',
    description:
      'List all incomplete, non-backlog tasks from dates strictly before today, grouped by date (newest first).',
    inputSchema: { type: 'object', properties: {} }
  },
  {
    name: 'list_tasks_by_project',
    description: 'List all tasks (including backlog) belonging to a specific project, sorted by sort order.',
    inputSchema: {
      type: 'object',
      properties: {
        projectId: {
          type: 'number',
          description: 'Numeric ID of the project (obtain from list_projects)'
        }
      },
      required: ['projectId']
    }
  },
  {
    name: 'list_tasks_by_tag',
    description: 'List all tasks (across all dates) that have a specific tag assigned.',
    inputSchema: {
      type: 'object',
      properties: {
        tag: {
          type: 'string',
          description: 'Exact tag string to filter by (case-sensitive)'
        }
      },
      required: ['tag']
    }
  },
  {
    name: 'get_task',
    description: 'Retrieve a single task by its numeric ID.',
    inputSchema: {
      type: 'object',
      properties: {
        id: {
          type: 'number',
          description: 'Numeric ID of the task'
        }
      },
      required: ['id']
    }
  },
  {
    name: 'create_task',
    description:
      'Create a new task. If no date is given, it is scheduled for today. Set backlog=true to add to a project backlog instead of a calendar date.',
    inputSchema: {
      type: 'object',
      properties: {
        title: {
          type: 'string',
          description: 'Task title / description'
        },
        date: {
          type: 'string',
          description: 'Calendar date in YYYY-MM-DD format. Defaults to today if omitted.'
        },
        estimatedMinutes: {
          type: 'number',
          description: 'Estimated duration in minutes (e.g. 30)'
        },
        projectId: {
          type: 'number',
          description: 'Numeric project ID to associate this task with'
        },
        tags: {
          type: 'array',
          items: { type: 'string' },
          description: 'List of tag strings (e.g. ["work", "urgent"])'
        },
        backlog: {
          type: 'boolean',
          description: 'If true, adds to the project backlog rather than a calendar date'
        }
      },
      required: ['title']
    }
  },
  {
    name: 'update_task',
    description:
      'Update one or more fields on an existing task. Only supply the fields you want to change; omitted fields are left untouched.',
    inputSchema: {
      type: 'object',
      properties: {
        id: {
          type: 'number',
          description: 'Numeric ID of the task to update'
        },
        title: {
          type: 'string',
          description: 'New title / description for the task'
        },
        completed: {
          type: 'boolean',
          description: 'Mark the task complete (true) or incomplete (false)'
        },
        notes: {
          type: 'string',
          description: 'Freeform notes / details to attach to the task'
        },
        estimatedMinutes: {
          type: 'number',
          description: 'Updated time estimate in minutes'
        },
        tags: {
          type: 'array',
          items: { type: 'string' },
          description: 'Replace the task\'s tags with this list (e.g. ["focus", "deep-work"])'
        },
        projectId: {
          type: 'number',
          description: 'Move this task to a different project (use null to remove project association)'
        },
        date: {
          type: 'string',
          description: 'Reschedule the task to this calendar date (YYYY-MM-DD)'
        }
      },
      required: ['id']
    }
  },
  {
    name: 'delete_task',
    description: 'Permanently delete a task. This action cannot be undone.',
    inputSchema: {
      type: 'object',
      properties: {
        id: {
          type: 'number',
          description: 'Numeric ID of the task to delete'
        }
      },
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
    case 'list_tasks_by_tag':
      data = await send('tasks:listByTag', { tag: args.tag })
      break
    case 'get_task':
      data = await send('tasks:getById', { id: args.id })
      break
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
