import type { SendToMain } from '../types'

export const templateTools = [
  {
    name: 'list_templates',
    description: 'List all recurring task templates (both active and paused).',
    inputSchema: { type: 'object', properties: {} }
  },
  {
    name: 'create_template',
    description:
      'Create a recurring task template that auto-generates tasks on a schedule. Supported schedule types: daily (weekdays), weekly (specific day), every_n_days (interval from an anchor date), or monthly (specific day of month).',
    inputSchema: {
      type: 'object',
      properties: {
        title: {
          type: 'string',
          description: 'Title for the recurring task'
        },
        schedule: {
          type: 'object',
          description:
            'Recurrence schedule. One of: {"type":"daily"} | {"type":"weekly","dayOfWeek":0-6} | {"type":"every_n_days","n":number,"anchorDate":"YYYY-MM-DD"} | {"type":"monthly","dayOfMonth":1-31}. dayOfWeek: 0=Sun, 1=Mon, …, 6=Sat.'
        },
        estimatedMinutes: {
          type: 'number',
          description: 'Default time estimate in minutes for each generated task instance'
        },
        projectId: {
          type: 'number',
          description: 'Project to associate generated task instances with'
        },
        tags: {
          type: 'array',
          items: { type: 'string' },
          description: 'Tags to apply to each generated task instance'
        }
      },
      required: ['title', 'schedule']
    }
  },
  {
    name: 'set_template_active',
    description: 'Pause (active=false) or resume (active=true) a recurring template without deleting it.',
    inputSchema: {
      type: 'object',
      properties: {
        id: {
          type: 'number',
          description: 'Numeric ID of the template (obtain from list_templates)'
        },
        active: {
          type: 'boolean',
          description: 'true to resume, false to pause'
        }
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
