/**
 * Collect visible text from configured DOM selectors to provide the LLM
 * with page-level context ("what is the user looking at right now?").
 *
 * Stripping logic:
 * 1. Clone the matched subtree so we never touch the live DOM.
 * 2. Remove `.ai-assistant-wrapper` and any `[data-ai-assistant-auto-mount]`
 *    nodes from the clone—these are the assistant's own UI.
 * 3. Collapse whitespace, trim, and enforce a per-block / total char budget.
 */

export interface PageContextBlock {
  /** CSS selector that identifies a page region. */
  selector: string;
  /** Human-readable label prepended as a heading in the context text. */
  label: string;
}

export interface PageContextOptions {
  /** One or more DOM regions to extract text from. */
  blocks: PageContextBlock[];
  /**
   * Max characters per block (after whitespace collapse).
   * Default: 3000. Longer content is truncated with an ellipsis marker.
   */
  maxCharsPerBlock?: number;
  /**
   * Max total characters across all blocks. Default: 6000.
   */
  maxTotalChars?: number;
}

const ASSISTANT_STRIP_SELECTORS = [
  '.ai-assistant-wrapper',
  '[data-ai-assistant-auto-mount]',
  '.ai-assistant-fab',
];

const DEFAULT_MAX_PER_BLOCK = 3000;
const DEFAULT_MAX_TOTAL = 6000;

function stripAssistantNodes(clone: Node): void {
  if (clone instanceof Element) {
    for (const sel of ASSISTANT_STRIP_SELECTORS) {
      clone.querySelectorAll(sel).forEach((el) => el.remove());
    }
  }
}

function collapseWhitespace(text: string): string {
  return text
    .replace(/[ \t]+/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

/**
 * Collect page-context text from the configured DOM selectors.
 *
 * Returns an empty string when the document isn't available (SSR) or when
 * no selectors match anything visible.
 */
export function collectPageContextText(options: PageContextOptions): string {
  if (typeof document === 'undefined') return '';
  const maxPer = options.maxCharsPerBlock ?? DEFAULT_MAX_PER_BLOCK;
  const maxTotal = options.maxTotalChars ?? DEFAULT_MAX_TOTAL;
  const sections: string[] = [];
  let totalLen = 0;

  for (const block of options.blocks) {
    if (totalLen >= maxTotal) break;
    const el = document.querySelector(block.selector);
    if (!el) continue;
    const clone = el.cloneNode(true);
    stripAssistantNodes(clone);
    let text = collapseWhitespace((clone as Element).textContent ?? '');
    if (!text) continue;
    if (text.length > maxPer) {
      text = text.slice(0, maxPer) + '…(truncated)';
    }
    const remaining = maxTotal - totalLen;
    if (text.length > remaining) {
      text = text.slice(0, remaining) + '…(truncated)';
    }
    sections.push(`【${block.label}】\n${text}`);
    totalLen += text.length;
  }

  if (!sections.length) return '';

  return `[当前页面上下文]\n${sections.join('\n\n')}`;
}

/**
 * Smart context: also grabs `document.title` and `location` metadata
 * in addition to block content.
 */
export function collectSmartPageContext(options: PageContextOptions): string {
  if (typeof document === 'undefined') return '';

  const parts: string[] = [];
  const url = location.href;
  const title = document.title;
  if (url) parts.push(`页面URL: ${url}`);
  if (title) parts.push(`页面标题: ${title}`);

  const blockText = collectPageContextText(options);
  if (blockText) parts.push(blockText);

  if (!parts.length) return '';
  return parts.join('\n');
}
