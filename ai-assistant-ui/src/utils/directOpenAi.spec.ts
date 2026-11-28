import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  buildOpenAiMessages,
  fetchOpenAiModels,
  fetchProviderModels,
  readTextFileForDirectQa,
  resolveOpenAiEndpoint,
  resolveProviderEndpoint,
  streamDirectOpenAiChat,
  streamDirectProviderChat,
} from './directOpenAi';

describe('directOpenAi helpers', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('normalizes OpenAI-compatible base URLs for chat completions and models', () => {
    expect(resolveOpenAiEndpoint('https://api.deepseek.com', '/chat/completions')).toBe(
      'https://api.deepseek.com/v1/chat/completions',
    );
    expect(resolveOpenAiEndpoint('https://api.deepseek.com/v1/', '/chat/completions')).toBe(
      'https://api.deepseek.com/v1/chat/completions',
    );
    expect(
      resolveOpenAiEndpoint('https://dashscope.aliyuncs.com/compatible-mode/v1', '/models'),
    ).toBe('https://dashscope.aliyuncs.com/compatible-mode/v1/models');
    expect(resolveOpenAiEndpoint('http://localhost:11434/v1/chat/completions', '/models')).toBe(
      'http://localhost:11434/v1/models',
    );
    expect(() => resolveOpenAiEndpoint('javascript:alert(1)', '/models')).toThrow();
  });

  it('builds chat messages including system prompt, history, and multimodal images', () => {
    const msgs = buildOpenAiMessages({
      action: 'chat',
      text: 'Inspect screenshot',
      systemPrompt: 'Be concise.',
      history: [{ role: 'user', content: 'hi' }],
      imageDataList: ['data:image/png;base64,abc'],
    });
    expect(msgs).toHaveLength(3);
    expect(msgs[0]).toEqual({ role: 'system', content: 'Be concise.' });
    expect(msgs[2].role).toBe('user');
    expect(Array.isArray(msgs[2].content)).toBe(true);
  });

  it('fetches OpenAI /models and streams SSE chat deltas cleanly', async () => {
    const encoder = new TextEncoder();
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.endsWith('/models')) {
        return new Response(
          JSON.stringify({ data: [{ id: 'deepseek-chat' }, { id: 'deepseek-reasoner' }] }),
          { status: 200, headers: { 'Content-Type': 'application/json' } },
        );
      }
      const stream = new ReadableStream({
        start(controller) {
          controller.enqueue(
            encoder.encode('data: {"choices":[{"delta":{"content":"你好"}}]}\n\n'),
          );
          controller.enqueue(
            encoder.encode(
              'data: {"choices":[{"delta":{"content":"，世界"}}]}\n\ndata: [DONE]\n\n',
            ),
          );
          controller.close();
        },
      });
      return new Response(stream, {
        status: 200,
        headers: { 'Content-Type': 'text/event-stream' },
      });
    });
    vi.stubGlobal('fetch', fetchMock);

    const modelsRes = await fetchOpenAiModels('https://api.deepseek.com/v1', 'sk-test');
    expect(modelsRes).toEqual({
      success: true,
      models: ['deepseek-chat', 'deepseek-reasoner'],
    });

    const metas: string[] = [];
    let output = '';
    for await (const chunk of streamDirectOpenAiChat(
      'https://api.deepseek.com/v1',
      { action: 'chat', text: 'hello', model: 'deepseek-chat' },
      'sk-test',
      undefined,
      (m) => {
        if (m.effectiveModel) metas.push(m.effectiveModel);
      },
    )) {
      output += chunk;
    }

    expect(metas).toEqual(['deepseek-chat']);
    expect(output).toBe('你好，世界');
  });

  it('reads plain text files for direct Q&A and rejects binary Office/PDF files clearly', async () => {
    const txt = new File(['Termination notice is 30 days.'], 'contract.txt', {
      type: 'text/plain',
    });
    const okRes = await readTextFileForDirectQa(txt, 'How many days?');
    expect(okRes.ok).toBe(true);
    if (okRes.ok) {
      expect(okRes.promptText).toContain('How many days?');
      expect(okRes.promptText).toContain('Termination notice is 30 days.');
    }

    const pdf = new File(['%PDF-1.7'], 'doc.pdf', { type: 'application/pdf' });
    const errRes = await readTextFileForDirectQa(pdf);
    expect(errRes.ok).toBe(false);
  });

  it('supports Anthropic Messages and Google Gemini protocols for endpoints, models, and streaming', async () => {
    expect(resolveProviderEndpoint('https://api.anthropic.com', 'anthropic', 'chat')).toBe(
      'https://api.anthropic.com/v1/messages',
    );
    expect(resolveProviderEndpoint('https://api.anthropic.com/v1/', 'anthropic', 'models')).toBe(
      'https://api.anthropic.com/v1/models',
    );
    expect(
      resolveProviderEndpoint(
        'https://generativelanguage.googleapis.com',
        'gemini',
        'chat',
        'gemini-2.5-flash',
      ),
    ).toBe(
      'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:streamGenerateContent?alt=sse',
    );

    const encoder = new TextEncoder();
    const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      const headers = (init?.headers || {}) as Record<string, string>;
      if (url === 'https://api.anthropic.com/v1/models') {
        expect(headers['x-api-key']).toBe('sk-ant-1');
        expect(headers['anthropic-version']).toBe('2023-06-01');
        return new Response(JSON.stringify({ data: [{ id: 'claude-sonnet-4-20250514' }] }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        });
      }
      if (url === 'https://api.anthropic.com/v1/messages') {
        expect(headers['x-api-key']).toBe('sk-ant-1');
        const stream = new ReadableStream({
          start(controller) {
            controller.enqueue(
              encoder.encode(
                'event: content_block_delta\ndata: {"type":"content_block_delta","delta":{"type":"text_delta","text":"Claude OK"}}\n\n',
              ),
            );
            controller.close();
          },
        });
        return new Response(stream, {
          status: 200,
          headers: { 'Content-Type': 'text/event-stream' },
        });
      }
      if (url === 'https://generativelanguage.googleapis.com/v1beta/models') {
        expect(headers['x-goog-api-key']).toBe('AIza-1');
        return new Response(
          JSON.stringify({
            models: [
              { name: 'models/gemini-2.5-flash', supportedGenerationMethods: ['generateContent'] },
              { name: 'models/text-embedding-004', supportedGenerationMethods: ['embedContent'] },
            ],
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } },
        );
      }
      const stream = new ReadableStream({
        start(controller) {
          controller.enqueue(
            encoder.encode(
              'data: {"candidates":[{"content":{"parts":[{"text":"Gemini OK"}]}}]}\n\n',
            ),
          );
          controller.close();
        },
      });
      return new Response(stream, {
        status: 200,
        headers: { 'Content-Type': 'text/event-stream' },
      });
    });
    vi.stubGlobal('fetch', fetchMock);

    const antModels = await fetchProviderModels(
      'anthropic',
      'https://api.anthropic.com',
      'sk-ant-1',
    );
    expect(antModels).toEqual({ success: true, models: ['claude-sonnet-4-20250514'] });

    let antText = '';
    for await (const c of streamDirectProviderChat(
      'anthropic',
      'https://api.anthropic.com',
      { action: 'chat', text: 'hi', model: 'claude-sonnet-4-20250514' },
      'sk-ant-1',
    )) {
      antText += c;
    }
    expect(antText).toBe('Claude OK');

    const gemModels = await fetchProviderModels(
      'gemini',
      'https://generativelanguage.googleapis.com',
      'AIza-1',
    );
    expect(gemModels).toEqual({ success: true, models: ['gemini-2.5-flash'] });

    let gemText = '';
    for await (const c of streamDirectProviderChat(
      'gemini',
      'https://generativelanguage.googleapis.com',
      { action: 'chat', text: 'hi', model: 'gemini-2.5-flash' },
      'AIza-1',
    )) {
      gemText += c;
    }
    expect(gemText).toBe('Gemini OK');
  });

  it('normalizes Anthropic message history to drop leading assistant turns and merge adjacent same-role turns', async () => {
    let sentBody: { messages?: Array<{ role: string; content: unknown }> } | undefined;
    const fetchMock = vi.fn(async (_input: RequestInfo | URL, init?: RequestInit) => {
      sentBody = JSON.parse(String(init?.body || '{}')) as typeof sentBody;
      return new Response(JSON.stringify({ content: [{ type: 'text', text: 'Normalized OK' }] }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    });
    vi.stubGlobal('fetch', fetchMock);

    let out = '';
    for await (const c of streamDirectProviderChat(
      'anthropic',
      'https://api.anthropic.com',
      {
        action: 'chat',
        text: 'follow-up',
        model: 'claude-sonnet-4-20250514',
        history: [
          { role: 'assistant', content: 'orphan greeting' },
          { role: 'user', content: 'first user' },
          { role: 'user', content: 'second user' },
          { role: 'assistant', content: 'reply' },
          { role: 'user', content: 'unanswered previous user' },
        ],
      },
      'sk-ant-1',
    )) {
      out += c;
    }

    expect(out).toBe('Normalized OK');
    expect(sentBody?.messages).toHaveLength(3);
    expect(sentBody?.messages?.map((m) => m.role)).toEqual(['user', 'assistant', 'user']);
    expect(Array.isArray(sentBody?.messages?.[0].content)).toBe(true);
    expect(Array.isArray(sentBody?.messages?.[2].content)).toBe(true);
  });
});
