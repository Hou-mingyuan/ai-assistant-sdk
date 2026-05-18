/**
 * Chat message shape used by AiAssistant and its child components.
 *
 * Kept in a dedicated module so AiAssistant.vue and MessageList.vue (and any
 * future siblings) share the exact same TypeScript type without re-declaring it.
 */
export interface ToolCallEntry {
  name: string;
  arguments: string;
  result?: string;
  status: 'running' | 'done' | 'error';
}

export interface AgentStep {
  id: string;
  label: string;
  status: 'pending' | 'running' | 'done' | 'error';
  detail?: string;
}

/** Extract `<agent_step>` markers from the stream. */
export function extractAgentSteps(raw: string): { content: string; steps: AgentStep[] } {
  const steps: AgentStep[] = [];
  let idx = 0;
  const stepRegex =
    /<agent_step\s+status="(pending|running|done|error)"(?:\s+id="([^"]*)")?>([\s\S]*?)<\/agent_step>/gi;
  const cleaned = raw.replace(stepRegex, (_, status, id, body) => {
    steps.push({
      id: id || `step-${idx++}`,
      label: body.trim().split('\n')[0],
      status: status as AgentStep['status'],
      detail: body.trim(),
    });
    return '';
  });
  const openStep = /<agent_step\s+status="(running)"(?:\s+id="([^"]*)")?>([\s\S]*)$/i.exec(cleaned);
  if (openStep) {
    steps.push({
      id: openStep[2] || `step-${idx}`,
      label: openStep[3].trim().split('\n')[0] || '…',
      status: 'running',
      detail: openStep[3].trim(),
    });
    return { content: cleaned.slice(0, openStep.index).trim(), steps };
  }
  return { content: cleaned.trim(), steps };
}

export interface Message {
  role: 'user' | 'assistant';
  content: string;
  /** Thumbnail for the first image attached to a user message (legacy single-image view). */
  imageThumb?: string;
  /** Thumbnails for all images attached to a user message. */
  imageThumbs?: string[];
  /** 内存 cap 截断展示文案时保留的全文，导出/复制优先使用 */
  contentArchive?: string;
  /** AI 推理过程（从 <think> 标签中提取） */
  thinking?: string;
  /** Function calling / tool-use entries extracted from the stream */
  toolCalls?: ToolCallEntry[];
  /** Agent multi-step task progress */
  agentSteps?: AgentStep[];
  feedback?: 'up' | 'down';
  /**
   * K24: Reaction state for the MessageReactionBar widget. Stored as a count
   * map plus a single "selected" emoji per message so toggling works like
   * a radio (one reaction at a time per user). Both fields are optional;
   * absent => no reactions yet.
   */
  reactions?: { selected?: string; counts?: Record<string, number> };
  /** Lightweight runtime metadata for assistant responses. */
  meta?: {
    model?: string;
    requestedModel?: string;
    effectiveModel?: string;
    provider?: string;
    fallback?: boolean;
    visionInputCount?: number;
    visionRoute?: string;
    elapsedMs?: number;
    ttftMs?: number;
    retried?: boolean;
  };
  timestamp?: number;
}

/**
 * Extract `<tool_call>` / `<tool_result>` pairs from the stream.
 * Returns sanitised content (markers removed) and an array of tool entries.
 */
export function extractToolCalls(raw: string): { content: string; toolCalls: ToolCallEntry[] } {
  const calls: ToolCallEntry[] = [];

  const callRegex = /<tool_call>([\s\S]*?)<\/tool_call>/gi;
  let cleaned = raw.replace(callRegex, (_, body) => {
    try {
      const parsed = JSON.parse(body.trim());
      calls.push({
        name: parsed.name || parsed.function || 'unknown',
        arguments:
          typeof parsed.arguments === 'string'
            ? parsed.arguments
            : JSON.stringify(parsed.arguments ?? parsed.params ?? {}, null, 2),
        status: 'running',
      });
    } catch {
      calls.push({ name: 'tool', arguments: body.trim(), status: 'running' });
    }
    return '';
  });

  const resultRegex = /<tool_result(?:\s+name="([^"]*)")?>([\s\S]*?)<\/tool_result>/gi;
  cleaned = cleaned.replace(resultRegex, (_, name, body) => {
    const target = name
      ? calls.find((c) => c.name === name && c.status === 'running')
      : calls.find((c) => c.status === 'running');
    if (target) {
      target.result = body.trim();
      target.status = 'done';
    } else {
      calls.push({
        name: name || 'tool',
        arguments: '',
        result: body.trim(),
        status: 'done',
      });
    }
    return '';
  });

  const openCall = /<tool_call>([\s\S]*)$/i.exec(cleaned);
  if (openCall) {
    calls.push({ name: '…', arguments: openCall[1].trim(), status: 'running' });
    cleaned = cleaned.slice(0, openCall.index);
  }

  return { content: cleaned.trim(), toolCalls: calls };
}

/** 从流式内容中分离 <think> 块和正文 */
export function extractThinking(raw: string): { thinking: string; content: string } {
  const thinkRegex = /<think>([\s\S]*?)<\/think>/gi;
  const thinkParts: string[] = [];
  const content = raw.replace(thinkRegex, (_, inner) => {
    thinkParts.push(inner.trim());
    return '';
  });
  const openTag = /<think>([\s\S]*)$/i.exec(content);
  if (openTag) {
    thinkParts.push(openTag[1].trim());
    return { thinking: thinkParts.join('\n'), content: content.slice(0, openTag.index).trim() };
  }
  return { thinking: thinkParts.join('\n'), content: content.trim() };
}
