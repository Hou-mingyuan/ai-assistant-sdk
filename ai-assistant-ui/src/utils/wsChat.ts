import type { ChatPayload } from './api'

/**
 * WebSocket-based streaming chat (alternative to SSE).
 * Connect to `ws(s)://<host>/<contextPath>/ws`, send ChatPayload as JSON,
 * receive delta text frames, then `[DONE]`.
 */
export async function* wsStreamChat(
  wsUrl: string,
  payload: ChatPayload,
  signal?: AbortSignal,
): AsyncGenerator<string> {
  const ws = new WebSocket(wsUrl)

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
    if (data.startsWith('{"error"')) {
      try {
        const parsed = JSON.parse(data)
        error = new Error(parsed.error || 'WebSocket error')
      } catch {
        error = new Error(data)
      }
      done = true
      wake()
      return
    }
    queue.push(data)
    wake()
  }

  ws.onerror = () => {
    error = error || new Error('WebSocket connection error')
    done = true
    wake()
  }

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
