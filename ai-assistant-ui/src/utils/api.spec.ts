import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockFetch = vi.fn();
const mockCreateObjectURL = vi.fn(() => 'blob:test-url');
const mockRevokeObjectURL = vi.fn();
vi.stubGlobal('fetch', mockFetch);
Object.defineProperty(URL, 'createObjectURL', {
  configurable: true,
  value: mockCreateObjectURL,
});
Object.defineProperty(URL, 'revokeObjectURL', {
  configurable: true,
  value: mockRevokeObjectURL,
});

import {
  postChat,
  fetchModels,
  fetchUrlPreview,
  streamChat,
  uploadFile,
  postServerExport,
} from './api';

beforeEach(() => {
  mockFetch.mockReset();
  mockCreateObjectURL.mockClear();
  mockRevokeObjectURL.mockClear();
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe('postChat', () => {
  it('returns success on 200', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({ success: true, result: 'hello' }),
    });
    const res = await postChat('/ai', { action: 'chat', text: 'hi' });
    expect(res.success).toBe(true);
    expect(res.result).toBe('hello');
    expect(mockFetch).toHaveBeenCalledOnce();
  });

  it('normalizes trailing slash in baseUrl', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({ success: true, result: 'hello' }),
    });

    await postChat('/ai/', { action: 'chat', text: 'hi' });

    expect(mockFetch.mock.calls[0][0]).toBe('/ai/chat');
  });

  it('returns error on non-200', async () => {
    mockFetch.mockResolvedValueOnce({ ok: false, status: 500, statusText: 'Server Error' });
    const res = await postChat('/ai', { action: 'chat', text: 'hi' });
    expect(res.success).toBe(false);
    expect(res.error).toContain('500');
  });

  it('sends trimmed X-AI-Token header when provided', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({ success: true, result: 'ok' }),
    });
    await postChat('/ai', { action: 'chat', text: 'hi' }, '  my-token  ');
    const headers = mockFetch.mock.calls[0][1].headers;
    expect(headers['X-AI-Token']).toBe('my-token');
  });

  it('does not send X-AI-Token header for blank token', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({ success: true, result: 'ok' }),
    });
    await postChat('/ai', { action: 'chat', text: 'hi' }, '   ');
    const headers = mockFetch.mock.calls[0][1].headers;
    expect(headers['X-AI-Token']).toBeUndefined();
  });
});

describe('fetchModels', () => {
  it('returns models list', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () =>
        Promise.resolve({
          success: true,
          models: ['gpt-4o', 'gpt-4o-mini'],
          defaultModel: 'gpt-4o-mini',
        }),
    });
    const res = await fetchModels('/ai');
    expect(res.success).toBe(true);
    expect(res.models).toHaveLength(2);
  });

  it('returns error on failure', async () => {
    mockFetch.mockResolvedValueOnce({ ok: false, status: 401, statusText: 'Unauthorized' });
    const res = await fetchModels('/ai');
    expect(res.success).toBe(false);
  });

  it('does not send X-AI-Token header for blank token', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({ success: true, models: ['gpt-5.4-mini'] }),
    });
    await fetchModels('/ai', '   ');
    const headers = mockFetch.mock.calls[0][1].headers;
    expect(headers['X-AI-Token']).toBeUndefined();
  });
});

describe('fetchUrlPreview', () => {
  it('returns preview data', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({ success: true, title: 'Test', summary: 'A test page' }),
    });
    const res = await fetchUrlPreview('/ai', 'https://example.com');
    expect(res.success).toBe(true);
    expect(res.title).toBe('Test');
  });

  it('encodes URL query and sends trimmed token', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({ success: true }),
    });

    await fetchUrlPreview('/ai/', 'https://example.com/a b?x=1&y=2', '  preview-token  ');

    expect(mockFetch.mock.calls[0][0]).toBe(
      '/ai/url-preview?url=https%3A%2F%2Fexample.com%2Fa%20b%3Fx%3D1%26y%3D2',
    );
    expect(mockFetch.mock.calls[0][1].headers['X-AI-Token']).toBe('preview-token');
  });

  it('returns error on failure', async () => {
    mockFetch.mockResolvedValueOnce({ ok: false, status: 502, statusText: 'Bad Gateway' });

    const res = await fetchUrlPreview('/ai', 'https://example.com');

    expect(res.success).toBe(false);
    expect(res.error).toContain('502');
  });
});

describe('uploadFile', () => {
  it('uploads file for summarization by default', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({ success: true, result: 'summary' }),
    });

    const file = new File(['hello'], 'note.txt', { type: 'text/plain' });
    const res = await uploadFile('/ai/', file, undefined, undefined, '  file-token  ');
    const request = mockFetch.mock.calls[0][1];
    const body = request.body as FormData;

    expect(mockFetch.mock.calls[0][0]).toBe('/ai/file/summarize');
    expect(request.method).toBe('POST');
    expect(request.headers['X-AI-Token']).toBe('file-token');
    expect(body.get('file')).toBe(file);
    expect(body.get('targetLang')).toBeNull();
    expect(res.result).toBe('summary');
  });

  it('uploads file for translation with target language', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({ success: true, result: 'translated' }),
    });

    const file = new File(['hello'], 'note.txt', { type: 'text/plain' });
    await uploadFile('/ai', file, 'translate', 'en');
    const body = mockFetch.mock.calls[0][1].body as FormData;

    expect(mockFetch.mock.calls[0][0]).toBe('/ai/file/translate');
    expect(body.get('targetLang')).toBe('en');
  });

  it('returns error when upload fails', async () => {
    mockFetch.mockResolvedValueOnce({ ok: false, status: 413, statusText: 'Payload Too Large' });

    const file = new File(['hello'], 'note.txt', { type: 'text/plain' });
    const res = await uploadFile('/ai', file);

    expect(res.success).toBe(false);
    expect(res.error).toContain('413');
  });
});

describe('postServerExport', () => {
  it('downloads exported file with quoted content-disposition filename', async () => {
    vi.useFakeTimers();
    const clickSpy = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});
    const progress = vi.fn();
    const blob = new Blob(['xlsx'], {
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    });
    mockFetch.mockResolvedValueOnce(exportResponse(blob, 'attachment; filename="chat.xlsx"'));

    const res = await postServerExport(
      '/ai/',
      'xlsx',
      'Chat Export',
      [{ role: 'assistant', content: 'hello' }],
      '  export-token  ',
      progress,
    );
    const request = mockFetch.mock.calls[0][1];
    const body = JSON.parse(request.body);

    expect(res.ok).toBe(true);
    expect(mockFetch.mock.calls[0][0]).toBe('/ai/export');
    expect(request.method).toBe('POST');
    expect(request.headers['X-AI-Token']).toBe('export-token');
    expect(body).toEqual({
      format: 'xlsx',
      title: 'Chat Export',
      messages: [{ role: 'assistant', content: 'hello' }],
    });
    expect(progress.mock.calls.map(([phase]) => phase)).toEqual(['response', 'download']);
    expect(mockCreateObjectURL).toHaveBeenCalledWith(blob);
    expect(clickSpy).toHaveBeenCalledOnce();

    vi.advanceTimersByTime(60_000);
    expect(mockRevokeObjectURL).toHaveBeenCalledWith('blob:test-url');
  });

  it('decodes filename star header and sends theme when provided', async () => {
    const clickSpy = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});
    mockFetch.mockResolvedValueOnce(
      exportResponse(new Blob(['docx']), "attachment; filename*=UTF-8''%E5%AF%B9%E8%AF%9D.docx"),
    );

    const res = await postServerExport(
      '/ai',
      'docx',
      '对话',
      [{ role: 'user', content: '你好' }],
      undefined,
      undefined,
      'dark',
    );
    const request = mockFetch.mock.calls[0][1];
    const body = JSON.parse(request.body);
    const anchor = clickSpy.mock.instances[0] as HTMLAnchorElement;

    expect(res.ok).toBe(true);
    expect(request.headers['X-AI-Token']).toBeUndefined();
    expect(body.theme).toBe('dark');
    expect(anchor.download).toBe('对话.docx');
  });

  it('converts pdf blob to octet-stream before download', async () => {
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});
    mockFetch.mockResolvedValueOnce(
      exportResponse(new Blob(['pdf'], { type: 'application/pdf' }), null),
    );

    const res = await postServerExport('/ai', 'pdf', 'PDF', []);
    const downloadedBlob = mockCreateObjectURL.mock.calls[0][0] as Blob;

    expect(res.ok).toBe(true);
    expect(downloadedBlob.type).toBe('application/octet-stream');
  });

  it('returns server error text when export fails', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 500,
      statusText: 'Server Error',
      text: () => Promise.resolve('export failed'),
    });

    const res = await postServerExport('/ai', 'xlsx', 'Export', []);

    expect(res).toEqual({ ok: false, error: 'export failed' });
    expect(mockCreateObjectURL).not.toHaveBeenCalled();
  });
});

describe('streamChat', () => {
  it('parses standard SSE events across chunks', async () => {
    mockFetch.mockResolvedValueOnce(streamResponse(['data: hel', 'lo\n\n', 'data: [DONE]\n\n']));

    const chunks = [];
    for await (const chunk of streamChat('/ai', { action: 'chat', text: 'hi' })) {
      chunks.push(chunk);
    }

    expect(chunks).toEqual(['hello']);
  });

  it('parses multiline SSE data events', async () => {
    mockFetch.mockResolvedValueOnce(streamResponse(['data: hello\r\ndata: world\r\n\r\n']));

    const chunks = [];
    for await (const chunk of streamChat('/ai', { action: 'chat', text: 'hi' })) {
      chunks.push(chunk);
    }

    expect(chunks).toEqual(['hello\nworld']);
  });

  it('yields trailing SSE data when stream ends without separator', async () => {
    mockFetch.mockResolvedValueOnce(streamResponse(['data: trailing']));

    const chunks = [];
    for await (const chunk of streamChat('/ai', { action: 'chat', text: 'hi' })) {
      chunks.push(chunk);
    }

    expect(chunks).toEqual(['trailing']);
  });

  it('sends trimmed token header for streaming requests', async () => {
    mockFetch.mockResolvedValueOnce(streamResponse(['data: ok\n\n']));

    for await (const _chunk of streamChat(
      '/ai',
      { action: 'chat', text: 'hi' },
      '  stream-token  ',
    )) {
      // consume stream
    }

    expect(mockFetch.mock.calls[0][1].headers['X-AI-Token']).toBe('stream-token');
  });

  it('throws on failed streaming response', async () => {
    mockFetch.mockResolvedValueOnce({ ok: false, status: 503, statusText: 'Unavailable' });

    await expect(async () => {
      for await (const _chunk of streamChat('/ai', { action: 'chat', text: 'hi' })) {
        // consume stream
      }
    }).rejects.toThrow('HTTP 503');
  });

  it('throws when response body is missing', async () => {
    mockFetch.mockResolvedValueOnce({ ok: true });

    await expect(async () => {
      for await (const _chunk of streamChat('/ai', { action: 'chat', text: 'hi' })) {
        // consume stream
      }
    }).rejects.toThrow('Stream not available');
  });
});

function streamResponse(chunks: string[]) {
  const encoder = new TextEncoder();
  let index = 0;
  const reader = {
    read: vi.fn(() => {
      if (index >= chunks.length) {
        return Promise.resolve({ done: true, value: undefined });
      }
      return Promise.resolve({ done: false, value: encoder.encode(chunks[index++]) });
    }),
    cancel: vi.fn(() => Promise.resolve()),
  };
  return {
    ok: true,
    body: {
      getReader: () => reader,
    },
  };
}

function exportResponse(blob: Blob, contentDisposition: string | null) {
  return {
    ok: true,
    blob: () => Promise.resolve(blob),
    headers: {
      get: (name: string) =>
        name.toLowerCase() === 'content-disposition' ? contentDisposition : null,
    },
  };
}
