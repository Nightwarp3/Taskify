import type { SendToMain } from '../types'

export const templateTools = [
  {
    name: 'list_templates',
    description: 'List all recurring task templates',
    inputSchema: { type: 'object', properties: {} }
  },
  {
    name: 'create_template',
    description: 'Create a recurring task template',
    inputSchema: {
      type: 'object',
      properties: {
        title: { type: 'string' },
        schedule: {
          type: 'object',
          description: 'Schedule: { type: "daily" } | { type: "weekly", dayOfWeek: 0-6 } | { type: "every_n_days", n: number, anchorDate: "YYYY-MM-DD" } | { type: "monthly", dayOfMonth: 1-31 }'
        },
        estimatedMinutes: { type: 'number' },
        projectId: { type: 'number' },
        tags: { type: 'array', items: { type: 'string' } }
      },
      required: ['title', 'schedule']
    }
  },
  {
    name: 'set_template_active',
    description: 'Pause or resume a recurring template',
    inputSchema: {
      type: 'object',
      properties: {
        id: { type: 'number' },
        active: { type: 'boolean' }
      },
      required: ['id', 'active']
    }
  }
]

export async function handleTemplateTool(
  name: string,
  args: Record<string, unknown>,
  send: SendToMain
): Promise<{ content: Array<{ type: string; text: string }> }> {
  let data: unknown

  switch (name) {
    case 'list_templates':
      data = await send('templates:list', {})
      break
    case 'create_template':
      data = await send('templates:create', args)
      break
    case 'set_template_active':
      data = await send('templates:setActive', { id: args.id, active: args.active })
      break
    default:
      throw new Error(`Unknown template tool: ${name}`)
  }

  return { content: [{ type: 'text', text: JSON.stringify(data, null, 2) }] }
}
