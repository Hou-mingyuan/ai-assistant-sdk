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
  /** Deep Research v1: tool invoked for this step (e.g. web_search). */
  tool?: string;
  /** Deep Research v1: step wall-clock time in milliseconds. */
  elapsedMs?: number;
  /** Deep Research v1: number of sources gathered in this step. */
  sourceCount?: number;
}

const AGENT_STEP_STATUSES = new Set(['pending', 'running', 'done', 'error']);

interface AgentStepAttrs {
  status?: string;
  id?: string;
  tool?: string;
  elapsedMs?: number;
  sourceCount?: number;
}

function parseAgentStepAttrs(attrs: string): AgentStepAttrs {
  const read = (name: string) => attrs.match(new RegExp(`${name}="([^"]*)"`, 'i'))?.[1];
  const toNum = (raw?: string) => {
    if (raw == null || raw === '') return undefined;
    const n = Number(raw);
    return Number.isFinite(n) ? n : undefined;
  };
  return {
    status: read('status'),
    id: read('id'),
    tool: read('tool') || undefined,
    elapsedMs: toNum(read('elapsed')),
    sourceCount: toNum(read('sources')),
  };
}

/** Build an AgentStep, only attaching optional fields when present (keeps the
 * object shape backward compatible for steps that carry no extra metadata). */
function buildAgentStep(attrs: AgentStepAttrs, fallbackId: string, body: string): AgentStep {
  const step: AgentStep = {
    id: attrs.id || fallbackId,
    label: body.split('\n')[0] || '…',
    status: attrs.status as AgentStep['status'],
    detail: body,
  };
  if (attrs.tool) step.tool = attrs.tool;
  if (attrs.elapsedMs != null) step.elapsedMs = attrs.elapsedMs;
  if (attrs.sourceCount != null) step.sourceCount = attrs.sourceCount;
  return step;
}

/**
 * Extract `<agent_step>` markers from the stream. Attributes are order-independent:
 * `status` (required) plus optional `id`, `tool`, `elapsed` (ms), `sources` (count).
 * Backward compatible with the original status/id-only tags.
 */
export function extractAgentSteps(raw: string): { content: string; steps: AgentStep[] } {
  const steps: AgentStep[] = [];
  let idx = 0;
  const stepRegex = /<agent_step\s+([^>]*?)>([\s\S]*?)<\/agent_step>/gi;
  const cleaned = raw.replace(stepRegex, (full, attrs, body) => {
    const parsed = parseAgentStepAttrs(attrs);
    if (!parsed.status || !AGENT_STEP_STATUSES.has(parsed.status)) return full;
    steps.push(buildAgentStep(parsed, `step-${idx++}`, body.trim()));
    return '';
  });
  const openMatch = /<agent_step\s+([^>]*?)>([\s\S]*)$/i.exec(cleaned);
  if (openMatch) {
    const parsed = parseAgentStepAttrs(openMatch[1]);
    if (parsed.status === 'running') {
      steps.push(buildAgentStep(parsed, `step-${idx}`, openMatch[2].trim()));
      return { content: cleaned.slice(0, openMatch.index).trim(), steps };
    }
  }
  return { content: cleaned.trim(), steps };
}

/** Artifacts/Canvas：一件可在侧边 Canvas 独立展示的产物。 */
export type ArtifactType = 'code' | 'markdown' | 'html' | 'svg' | 'mermaid' | 'react' | 'vue';

export interface Artifact {
  /** 稳定标识：模型显式给出，或启发式按内容生成。用于版本归并与去重。 */
  id: string;
  type: ArtifactType;
  title: string;
  /** 代码语言（type=code 时有意义，如 python / ts）。 */
  lang?: string;
  content: string;
  /** streaming = 标签尚未闭合（生成中）；done = 已完整。 */
  status: 'streaming' | 'done';
}

const ARTIFACT_TYPES = new Set<ArtifactType>([
  'code',
  'markdown',
  'html',
  'svg',
  'mermaid',
  'react',
  'vue',
]);

interface ArtifactAttrs {
  id?: string;
  type?: string;
  title?: string;
  lang?: string;
}

function parseArtifactAttrs(attrs: string): ArtifactAttrs {
  const read = (name: string) => attrs.match(new RegExp(`${name}="([^"]*)"`, 'i'))?.[1];
  // 兼容 Claude 风格属性：identifier→id、language→lang（deepseek 等模型常用）。
  return {
    id: read('id') || read('identifier'),
    type: read('type'),
    title: read('title'),
    lang: read('lang') || read('language'),
  };
}

/**
 * 模型常把代码用 ```fence``` 再包进 <artifact> 里（甚至给裸 <artifact> 不带任何属性）。
 * 若正文整体就是单个围栏块（闭合或被截断未闭合），解包出语言与代码，便于推断 type 并清掉围栏标记。
 */
function unwrapSingleFence(content: string): { lang: string; code: string } | null {
  const trimmed = content.trim();
  const m =
    /^```([\w+-]*)[ \t]*\n([\s\S]*?)\n```$/.exec(trimmed) ||
    /^```([\w+-]*)[ \t]*\n([\s\S]*)$/.exec(trimmed);
  if (!m) return null;
  return { lang: (m[1] || '').trim().toLowerCase(), code: m[2] };
}

/** 简易稳定哈希：给没带 id 的 artifact 生成一个稳定标识（同内容同 id）。 */
function stableArtifactId(seed: string): string {
  let h = 5381;
  for (let i = 0; i < seed.length; i++) h = ((h << 5) + h + seed.charCodeAt(i)) >>> 0;
  return `artifact-${h.toString(36)}`;
}

function buildArtifact(
  attrs: ArtifactAttrs,
  fallbackSeed: string,
  body: string,
  status: Artifact['status'],
): Artifact {
  let content = body.replace(/^\n+/, '').replace(/\s+$/, '');
  let lang = attrs.lang?.trim() || undefined;
  let typeRaw = (attrs.type || '').toLowerCase();

  // 解包 <artifact> 内被 ```fence``` 包裹的代码，并用围栏语言补全缺失的 type/lang。
  const fenced = unwrapSingleFence(content);
  if (fenced) {
    content = fenced.code.replace(/^\n+/, '').replace(/\s+$/, '');
    if (!lang && fenced.lang) lang = fenced.lang;
    if (!ARTIFACT_TYPES.has(typeRaw as ArtifactType) && fenced.lang) {
      typeRaw = specialTypeForFenceLang(fenced.lang) ?? typeRaw;
    }
  }

  // type 缺失或不认识时，用 lang 推断特殊类型（vue/jsx/tsx/html/svg/mermaid），否则按 code。
  const normalizedType: ArtifactType = ARTIFACT_TYPES.has(typeRaw as ArtifactType)
    ? (typeRaw as ArtifactType)
    : lang
      ? (specialTypeForFenceLang(lang) ?? 'code')
      : 'code';

  const artifact: Artifact = {
    id: attrs.id?.trim() || stableArtifactId(fallbackSeed + content),
    type: normalizedType,
    title: attrs.title?.trim() || defaultArtifactTitle(normalizedType),
    content,
    status,
  };
  if (lang) artifact.lang = lang;
  return artifact;
}

function defaultArtifactTitle(type: ArtifactType): string {
  switch (type) {
    case 'markdown':
      return 'Document';
    case 'html':
      return 'HTML Preview';
    case 'svg':
      return 'SVG';
    case 'mermaid':
      return 'Diagram';
    case 'react':
      return 'React Component';
    case 'vue':
      return 'Vue Component';
    default:
      return 'Code';
  }
}

/**
 * 抽取 `<artifact id=.. type=.. title=.. lang=..>...</artifact>` 标记，
 * 与 `<agent_step>` 同套路：闭合标签 => done；流末未闭合标签 => streaming（生成中）。
 * 返回去除标记后的正文 + artifact 列表。
 */
export function extractArtifacts(raw: string): { content: string; artifacts: Artifact[] } {
  const artifacts: Artifact[] = [];
  let idx = 0;
  // 属性可选：兼容裸 <artifact>（无任何属性，deepseek 等模型常见）。
  const re = /<artifact(\s[^>]*?)?>([\s\S]*?)<\/artifact>/gi;
  const cleaned = raw.replace(re, (_full, attrs, body) => {
    artifacts.push(buildArtifact(parseArtifactAttrs(attrs || ''), `c${idx++}`, body, 'done'));
    return '';
  });
  const open = /<artifact(\s[^>]*?)?>([\s\S]*)$/i.exec(cleaned);
  if (open) {
    artifacts.push(
      buildArtifact(parseArtifactAttrs(open[1] || ''), `c${idx}`, open[2], 'streaming'),
    );
    return { content: cleaned.slice(0, open.index).trim(), artifacts };
  }
  return { content: cleaned.trim(), artifacts };
}

/** 围栏语言 → 适合画布预览的特殊 artifact 类型（其余按普通 code 处理）。 */
function specialTypeForFenceLang(language: string): ArtifactType | null {
  switch (language) {
    case 'mermaid':
      return 'mermaid';
    case 'html':
      return 'html';
    case 'svg':
      return 'svg';
    case 'vue':
      return 'vue';
    case 'jsx':
    case 'tsx':
      return 'react';
    default:
      return null;
  }
}

/** 被提升的围栏块默认标题。 */
function promotedFenceTitle(special: ArtifactType | null, language: string): string | undefined {
  switch (special) {
    case 'mermaid':
      return '图表';
    case 'html':
      return 'HTML 预览';
    case 'svg':
      return 'SVG';
    case 'vue':
      return 'Vue 组件';
    case 'react':
      return 'React 组件';
    default:
      return language ? `${language} 代码` : undefined;
  }
}

/**
 * 启发式保底：当模型未按协议吐 `<artifact>` 标签时，把正文里的围栏块提升为 artifact 卡片，
 * 正文处留占位。仅在收尾阶段调用，避免流式途中反复重排。
 *
 * 规则：
 * - ```mermaid / ```html / ```svg / ```vue / ```jsx|tsx 围栏**不论长短**都提升为对应类型；
 * - 其它语言的普通代码块需达到 `minLines` 行才提升（短片段留在正文里更自然）；
 * - 末尾**未闭合**的围栏（模型被 max_tokens 截断时常见）也会被提升，避免整段代码以原文残留、无法进画布。
 */
export function promoteLargeCodeBlocks(
  raw: string,
  minLines = 12,
): { content: string; artifacts: Artifact[] } {
  const artifacts: Artifact[] = [];
  let idx = 0;

  /** 满足提升条件则建 artifact 并返回 true；否则不动并返回 false。 */
  const tryPromote = (language: string, code: string): boolean => {
    const special = specialTypeForFenceLang(language);
    if (!special && code.split('\n').length < minLines) return false;
    const type: ArtifactType = special ?? 'code';
    artifacts.push(
      buildArtifact(
        {
          type,
          lang: type === 'code' ? language : undefined,
          title: promotedFenceTitle(special, language),
        },
        `auto${idx++}`,
        code,
        'done',
      ),
    );
    return true;
  };

  const fence = /(^|\n)```([\w+-]*)[ \t]*\n([\s\S]*?)\n```/g;
  let content = raw.replace(fence, (full, lead, lang, code) =>
    tryPromote((lang || '').trim().toLowerCase(), code) ? `${lead}` : full,
  );

  // 收尾兜底：闭合围栏均已处理，若仍残留一个开头围栏（末尾未闭合，常见于截断），
  // 把它后面到结尾的内容当作完整代码块提升，避免大段代码以原文残留。
  const open = /(^|\n)```([\w+-]*)[ \t]*\n([\s\S]*)$/.exec(content);
  if (open) {
    const code = open[3].replace(/\s+$/, '');
    if (code.trim().length > 0 && tryPromote((open[2] || '').trim().toLowerCase(), code)) {
      content = content.slice(0, open.index) + open[1];
    }
  }

  return { content: content.replace(/\n{3,}/g, '\n\n').trim(), artifacts };
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
  /** Artifacts/Canvas: 从流中抽取的可独立展示作品（代码/文档/HTML/图） */
  artifacts?: Artifact[];
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
    webSearchEnabled?: boolean;
    webSearchProvider?: string;
    webSearchFallback?: boolean;
    webSearchResultCount?: number;
    webSearchSourceUrls?: string[];
    webSearchSourcePreviews?: {
      title?: string;
      url?: string;
      snippet?: string;
      qualityScore?: number;
      qualityLabel?: string;
    }[];
    webSearchFailureReason?: string;
    webSearchDurationMs?: number;
    webSearchStableDurationMs?: number;
    webSearchFallbackDurationMs?: number;
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
