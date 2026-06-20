export interface BridgeRequest {
  id: string
  type: string
  payload: unknown
}

export interface BridgeResponse {
  id: string
  ok: boolean
  data?: unknown
  error?: string
}

export type SendToMain = (type: string, payload: unknown) => Promise<unknown>
