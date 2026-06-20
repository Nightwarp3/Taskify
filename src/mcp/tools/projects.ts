import type { SendToMain } from '../types'

export const projectTools = [
  {
    name: 'list_projects',
    description: 'List all active (non-archived) projects, sorted alphabetically by name.',
    inputSchema: { type: 'object', properties: {} }
  },
  {
    name: 'create_project',
    description: 'Create a new project with a name and display color.',
    inputSchema: {
      type: 'object',
      properties: {
        name: {
          type: 'string',
          description: 'Display name for the project'
        },
        color: {
          type: 'string',
          description: 'Hex color code for the project badge (e.g. "#4CAF50")'
        },
        description: {
          type: 'string',
          description: 'Optional longer description of the project'
        }
      },
      required: ['name', 'color']
    }
  },
  {
    name: 'update_project',
    description: 'Update the name, color, or description of an existing project.',
    inputSchema: {
      type: 'object',
      properties: {
        id: {
          type: 'number',
          description: 'Numeric ID of the project to update (obtain from list_projects)'
        },
        name: {
          type: 'string',
          description: 'New display name'
        },
        color: {
          type: 'string',
          description: 'New hex color code (e.g. "#FF5733")'
        },
        description: {
          type: 'string',
          description: 'New description text'
        }
      },
      required: ['id']
    }
  },
  {
    name: 'pull_task_to_today',
    description: "Move a backlog task onto today's calendar date so it appears in the Today view.",
    inputSchema: {
      type: 'object',
      properties: {
        taskId: {
          type: 'number',
          description: 'Numeric ID of the backlog task to pull to today'
        }
      },
      required: ['taskId']
    }
  }
]

export async function handleProjectTool(
  name: string,
  args: Record<string, unknown>,
  send: SendToMain
): Promise<{ content: Array<{ type: string; text: string }> }> {
  let data: unknown

  switch (name) {
    case 'list_projects':
      data = await send('projects:list', {})
      break
    case 'create_project':
      data = await send('projects:create', args)
      break
    case 'update_project':
      data = await send('projects:update', args)
      break
    case 'pull_task_to_today':
      data = await send('tasks:pullToToday', { taskId: args.taskId })
      break
    default:
      throw new Error(`Unknown project tool: ${name}`)
  }

  return { content: [{ type: 'text', text: JSON.stringify(data, null, 2) }] }
}
