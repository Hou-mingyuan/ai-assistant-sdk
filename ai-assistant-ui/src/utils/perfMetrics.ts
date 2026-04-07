/**
 * Lightweight performance metrics for streaming chat.
 * Tracks time-to-first-byte (TTFB), stream duration, and render frame rate.
 */

export interface StreamMetrics {
  ttfbMs: number
  totalMs: number
  chunks: number
  avgFrameMs: number
}

export function createStreamTracker() {
  let startTime = 0
  let firstChunkTime = 0
  let chunkCount = 0
  let lastFrameTime = 0
  let frameDeltas: number[] = []

  function start() {
    startTime = performance.now()
    firstChunkTime = 0
    chunkCount = 0
    lastFrameTime = 0
    frameDeltas = []
  }

  function onChunk() {
    const now = performance.now()
    chunkCount++
    if (chunkCount === 1) {
      firstChunkTime = now
    }
    if (lastFrameTime > 0) {
      frameDeltas.push(now - lastFrameTime)
    }
    lastFrameTime = now
  }

  function finish(): StreamMetrics {
    const end = performance.now()
    const avgFrame = frameDeltas.length > 0
      ? frameDeltas.reduce((a, b) => a + b, 0) / frameDeltas.length
      : 0
    return {
      ttfbMs: Math.round(firstChunkTime - startTime),
      totalMs: Math.round(end - startTime),
      chunks: chunkCount,
      avgFrameMs: Math.round(avgFrame),
    }
  }

  return { start, onChunk, finish }
}
