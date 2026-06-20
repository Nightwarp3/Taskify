import type { SendToMain } from '../types'

export const projectTools = [
  {
    name: 'list_projects',
    description: 'List all active projects',
    inputSchema: { type: 'object', properties: {} }
  },
  {
    name: 'create_project',
    description: 'Create a new project',
    inputSchema: {
      type: 'object',
      properties: {
        name: { type: 'string' },
        color: { type: 'string', description: 'Hex color e.g. #4CAF50' },
        description: { type: 'string' }
      },
      required: ['name', 'color']
    }
  },
  {
    name: 'update_project',
    description: 'Update project metadata',
    inputSchema: {
      type: 'object',
      properties: {
        id: { type: 'number' },
        name: { type: 'string' },
        description: { type: 'string' }
      },
      required: ['id']
    }
  },
  {
    name: 'pull_task_to_today',
    description: 'Move a backlog task to today',
    inputSchema: {
      type: 'object',
      properties: { taskId: { type: 'number' } },
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
