/**
 * Chat message shape used by AiAssistant and its child components.
 *
 * Kept in a dedicated module so AiAssistant.vue and MessageList.vue (and any
 * future siblings) share the exact same TypeScript type without re-declaring it.
 */
export interface Message {
  role: 'user' | 'assistant';
  content: string;
  /** 内存 cap 截断展示文案时保留的全文，导出/复制优先使用 */
  contentArchive?: string;
  feedback?: 'up' | 'down';
  timestamp?: number;
}
