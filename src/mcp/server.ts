import http from 'http'
import type { BridgeRequest, BridgeResponse, SendToMain } from './types'
import { taskTools, handleTaskTool } from './tools/tasks'
import { projectTools, handleProjectTool } from './tools/projects'
import { templateTools, handleTemplateTool } from './tools/templates'

// IPC bridge: pending promise map
const pendingRequests = new Map<string, (data: unknown) => void>()
let reqCounter = 0

const sendToMain: SendToMain = (type: string, payload: unknown): Promise<unknown> => {
  return new Promise((resolve) => {
    const id = String(++reqCounter)
    pendingRequests.set(id, resolve)
    process.send!({ id, type, payload } satisfies BridgeRequest)
  })
}

process.on('message', (msg: BridgeResponse) => {
  const resolver = pendingRequests.get(msg.id)
  if (resolver) {
    pendingRequests.delete(msg.id)
    resolver(msg.data)
  }
})

// ── MCP handler (manual SSE, no SDK dependency issues) ────────────────────
const allTools = [...taskTools, ...projectTools, ...templateTools]

async function handleMcpCall(method: string, params: Record<string, unknown>): Promise<unknown> {
  switch (method) {
    case 'initialize':
      return {
        protocolVersion: '2024-11-05',
        capabilities: { tools: {}, resources: {} },
        serverInfo: { name: 'taskify', version: '1.0.0' }
      }

    case 'tools/list':
      return { tools: allTools }

    case 'tools/call': {
      const name = params.name as string
      const args = (params.arguments ?? {}) as Record<string, unknown>

      if (taskTools.some((t) => t.name === name)) {
        return handleTaskTool(name, args, sendToMain)
      }
      if (projectTools.some((t) => t.name === name)) {
        return handleProjectTool(name, args, sendToMain)
      }
      if (templateTools.some((t) => t.name === name)) {
        return handleTemplateTool(name, args, sendToMain)
      }
      throw new Error(`Unknown tool: ${name}`)
    }

    case 'resources/list':
      return {
        resources: [
          { uri: 'taskify://today', name: "Today's tasks", mimeType: 'application/json' }
        ]
      }

    case 'resources/read': {
      const uri = params.uri as string
      if (uri === 'taskify://today') {
        const today = new Date().toISOString().slice(0, 10)
        const tasks = await sendToMain('tasks:listByDate', { date: today })
        return {
          contents: [
            { uri, mimeType: 'application/json', text: JSON.stringify(tasks, null, 2) }
          ]
        }
      }
      throw new Error(`Unknown resource: ${uri}`)
    }

    default:
      throw new Error(`Unknown method: ${method}`)
  }
}

// ── HTTP + SSE transport (manual implementation) ──────────────────────────
interface SseClient {
  res: http.ServerResponse
}

let sseClient: SseClient | null = null

const port = process.env.MCP_PORT ? parseInt(process.env.MCP_PORT, 10) : 57391

const server = http.createServer((req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')

  if (req.method === 'OPTIONS') {
    res.writeHead(204)
    res.end()
    return
  }

  if (req.url === '/sse' && req.method === 'GET') {
    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive'
    })
    sseClient = { res }

    // Send endpoint event so client knows where to POST
    res.write(`event: endpoint\ndata: http://127.0.0.1:${port}/message\n\n`)

    req.on('close', () => { sseClient = null })
    return
  }

  if (req.url === '/message' && req.method === 'POST') {
    let body = ''
    req.on('data', (chunk) => { body += chunk })
    req.on('end', async () => {
      try {
        const msg = JSON.parse(body) as {
          jsonrpc: string
          id: string | number
          method: string
          params?: Record<string, unknown>
        }

        let result: unknown
        let error: unknown = null

        try {
          result = await handleMcpCall(msg.method, msg.params ?? {})
        } catch (e) {
          error = { code: -32000, message: String(e) }
        }

        const response = error
          ? { jsonrpc: '2.0', id: msg.id, error }
          : { jsonrpc: '2.0', id: msg.id, result }

        if (sseClient) {
          const data = JSON.stringify(response)
          sseClient.res.write(`data: ${data}\n\n`)
        }

        res.writeHead(202)
        res.end()
      } catch (e) {
        res.writeHead(400)
        res.end(String(e))
      }
    })
    return
  }

  if (req.url === '/health') {
    res.writeHead(200, { 'Content-Type': 'application/json' })
    res.end(JSON.stringify({ ok: true }))
    return
  }

  res.writeHead(404)
  res.end()
})

server.listen(port, '127.0.0.1', () => {
  console.log(`Taskify MCP server listening on http://127.0.0.1:${port}/sse`)
})
