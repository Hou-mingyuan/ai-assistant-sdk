import type { ChatPayload } from './api'

/**
 * WebSocket-based streaming chat (alternative to SSE).
 * Connect to `ws(s)://<host>/<contextPath>/ws`, send ChatPayload as JSON,
 * receive delta text frames, then `[DONE]`.
 */
export async function* wsStreamChat(
  wsUrl: string,
  payload: ChatPayload,
  token?: string,
  signal?: AbortSignal,
): AsyncGenerator<string> {
  const finalUrl = token ? (wsUrl + (wsUrl.includes('?') ? '&' : '?') + 'token=' + encodeURIComponent(token)) : wsUrl
  const ws = new WebSocket(finalUrl)

  const queue: string[] = []
  let done = false
  let error: Error | null = null
  let resolver: (() => void) | null = null

  function wake() {
    if (resolver) { resolver(); resolver = null }
  }

  ws.onmessage = (e) => {
    const data = e.data as string
    if (data === '[DONE]') {
      done = true
      wake()
      return
    }
    if (data.charAt(0) === '{') {
      try {
        const parsed = JSON.parse(data)
        if (typeof parsed === 'object' && parsed !== null && 'error' in parsed && Object.keys(parsed).length === 1) {
          error = new Error(parsed.error || 'WebSocket error')
          done = true
          wake()
          return
        }
      } catch { /* not JSON, treat as content */ }
    }
    queue.push(data)
    wake()
  }

  function onRuntimeError() {
    error = error || new Error('WebSocket connection error')
    done = true
    wake()
  }

  ws.onerror = onRuntimeError

  ws.onclose = () => {
    done = true
    wake()
  }

  if (signal) {
    signal.addEventListener('abort', () => {
      ws.close()
      done = true
      wake()
    }, { once: true })
  }

  await new Promise<void>((resolve, reject) => {
    ws.onopen = () => {
      ws.onerror = onRuntimeError
      ws.send(JSON.stringify(payload))
      resolve()
    }
    ws.onerror = () => reject(new Error('WebSocket connection failed'))
  })

  try {
    while (true) {
      while (queue.length > 0) {
        yield queue.shift()!
      }
      if (done) break
      await new Promise<void>(r => { resolver = r })
    }
    if (error) throw error
  } finally {
    if (ws.readyState === WebSocket.OPEN) ws.close()
  }
}
