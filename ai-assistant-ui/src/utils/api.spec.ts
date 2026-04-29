import { describe, it, expect, vi, beforeEach } from 'vitest'

const mockFetch = vi.fn()
vi.stubGlobal('fetch', mockFetch)

import { postChat, fetchModels, fetchUrlPreview } from './api'

beforeEach(() => {
  mockFetch.mockReset()
})

describe('postChat', () => {
  it('returns success on 200', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({ success: true, result: 'hello' }),
    })
    const res = await postChat('/ai', { action: 'chat', text: 'hi' })
    expect(res.success).toBe(true)
    expect(res.result).toBe('hello')
    expect(mockFetch).toHaveBeenCalledOnce()
  })

  it('returns error on non-200', async () => {
    mockFetch.mockResolvedValueOnce({ ok: false, status: 500, statusText: 'Server Error' })
    const res = await postChat('/ai', { action: 'chat', text: 'hi' })
    expect(res.success).toBe(false)
    expect(res.error).toContain('500')
  })

  it('sends trimmed X-AI-Token header when provided', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({ success: true, result: 'ok' }),
    })
    await postChat('/ai', { action: 'chat', text: 'hi' }, '  my-token  ')
    const headers = mockFetch.mock.calls[0][1].headers
    expect(headers['X-AI-Token']).toBe('my-token')
  })

  it('does not send X-AI-Token header for blank token', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({ success: true, result: 'ok' }),
    })
    await postChat('/ai', { action: 'chat', text: 'hi' }, '   ')
    const headers = mockFetch.mock.calls[0][1].headers
    expect(headers['X-AI-Token']).toBeUndefined()
  })
})

describe('fetchModels', () => {
  it('returns models list', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({ success: true, models: ['gpt-4o', 'gpt-4o-mini'], defaultModel: 'gpt-4o-mini' }),
    })
    const res = await fetchModels('/ai')
    expect(res.success).toBe(true)
    expect(res.models).toHaveLength(2)
  })

  it('returns error on failure', async () => {
    mockFetch.mockResolvedValueOnce({ ok: false, status: 401, statusText: 'Unauthorized' })
    const res = await fetchModels('/ai')
    expect(res.success).toBe(false)
  })

  it('does not send X-AI-Token header for blank token', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({ success: true, models: ['gpt-5.4-mini'] }),
    })
    await fetchModels('/ai', '   ')
    const headers = mockFetch.mock.calls[0][1].headers
    expect(headers['X-AI-Token']).toBeUndefined()
  })
})

describe('fetchUrlPreview', () => {
  it('returns preview data', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({ success: true, title: 'Test', summary: 'A test page' }),
    })
    const res = await fetchUrlPreview('/ai', 'https://example.com')
    expect(res.success).toBe(true)
    expect(res.title).toBe('Test')
  })
})
