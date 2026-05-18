/**
 * Temporary OpenAPI type snapshot for the current chat wire contract.
 * Replace by running `scripts/generate-frontend-types.mjs` against `/v3/api-docs`.
 */

export interface paths {
  '/chat': {
    post: {
      requestBody: {
        content: {
          'application/json': components['schemas']['ChatRequest'];
        };
      };
      responses: {
        200: {
          content: {
            'application/json': components['schemas']['ChatResponse'];
          };
        };
      };
    };
  };
  '/stream': {
    post: {
      requestBody: {
        content: {
          'application/json': components['schemas']['ChatRequest'];
        };
      };
    };
  };
  '/sse': {
    post: {
      requestBody: {
        content: {
          'application/json': components['schemas']['ChatRequest'];
        };
      };
    };
  };
}

export interface components {
  schemas: {
    ChatRequest: {
      action?: 'translate' | 'summarize' | 'chat';
      text: string;
      targetLang?: string;
      history?: components['schemas']['MessageItem'][];
      systemPrompt?: string;
      model?: string;
      imageData?: string;
      imageDataList?: string[];
      pageContext?: string;
      sessionId?: string;
    };
    MessageItem: {
      role: 'user' | 'assistant' | 'system';
      content: string;
    };
    ChatResponse: {
      success: boolean;
      result?: string;
      error?: string;
      errorCode?: string;
      meta?: components['schemas']['RuntimeMeta'];
    };
    RuntimeMeta: {
      requestedModel?: string;
      effectiveModel?: string;
      provider?: string;
      fallback?: boolean;
      visionInputCount?: number;
      visionRoute?: string;
    };
  };
}
