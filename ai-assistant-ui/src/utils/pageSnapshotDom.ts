/**
 * Build a user-visible Markdown snapshot of the host page.
 *
 * Unlike `pageContextDom`, this captures form control values as well as text
 * so users can ask "当前页面有什么内容" and get a concrete local answer.
 */

export interface PageSnapshotOptions {
  maxTextItems?: number;
  maxFormItems?: number;
  maxActionItems?: number;
  maxChars?: number;
}

const DEFAULT_MAX_TEXT_ITEMS = 24;
const DEFAULT_MAX_FORM_ITEMS = 80;
const DEFAULT_MAX_ACTION_ITEMS = 30;
const DEFAULT_MAX_CHARS = 12000;

const ASSISTANT_SELECTORS = [
  '.ai-assistant-wrapper',
  '[data-ai-assistant-auto-mount]',
  '.ai-assistant-fab',
  '.ai-page-sel-bar',
];

const SENSITIVE_RE =
  /password|passwd|pwd|token|secret|api[-_ ]?key|authorization|cookie|session|credential/i;

function collapseWhitespace(text: string): string {
  return text.replace(/\s+/g, ' ').trim();
}

function isInsideAssistant(el: Element): boolean {
  return ASSISTANT_SELECTORS.some((selector) => Boolean(el.closest(selector)));
}

function visibleText(el: Element | null | undefined): string {
  if (!el || isInsideAssistant(el)) return '';
  return collapseWhitespace(el.textContent ?? '');
}

function firstNonEmpty(...values: Array<string | null | undefined>): string {
  for (const value of values) {
    const text = collapseWhitespace(value ?? '');
    if (text) return text;
  }
  return '';
}

function labelForControl(
  control: HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement,
): string {
  const id = control.id;
  const escapedId = id && typeof CSS !== 'undefined' && CSS.escape ? CSS.escape(id) : id;
  const explicit = escapedId ? document.querySelector(`label[for="${escapedId}"]`) : null;
  const wrapping = control.closest('label');
  return firstNonEmpty(
    visibleText(explicit),
    visibleText(wrapping),
    control.getAttribute('aria-label'),
    control.getAttribute('placeholder'),
    control.getAttribute('name'),
    control.id,
  );
}

function isSensitiveControl(
  control: HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement,
): boolean {
  if (control instanceof HTMLInputElement && control.type === 'password') return true;
  const haystack = [
    control.type,
    control.name,
    control.id,
    control.getAttribute('autocomplete'),
    control.getAttribute('aria-label'),
    control.getAttribute('placeholder'),
    labelForControl(control),
  ]
    .filter(Boolean)
    .join(' ');
  return SENSITIVE_RE.test(haystack);
}

function controlValue(control: HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement): string {
  if (isSensitiveControl(control)) return '[已隐藏]';
  if (control instanceof HTMLInputElement) {
    if (control.type === 'checkbox') return control.checked ? '已勾选' : '未勾选';
    if (control.type === 'radio') return control.checked ? control.value || '已选中' : '';
    if (control.type === 'file')
      return control.files?.length ? `${control.files.length} 个文件` : '';
    return control.value;
  }
  if (control instanceof HTMLSelectElement) {
    return Array.from(control.selectedOptions)
      .map((option) => firstNonEmpty(option.textContent, option.value))
      .join(', ');
  }
  return control.value;
}

function truncate(text: string, maxChars: number): string {
  return text.length > maxChars ? `${text.slice(0, maxChars)}...(truncated)` : text;
}

function collectMainText(maxItems: number): string[] {
  const root = document.querySelector('main, article, [role="main"]') ?? document.body;
  const candidates = Array.from(
    root.querySelectorAll('h1,h2,h3,h4,p,li,th,td,[data-ai-page-summary]'),
  );
  const seen = new Set<string>();
  const items: string[] = [];
  for (const el of candidates) {
    if (!(el instanceof Element) || isInsideAssistant(el)) continue;
    const text = visibleText(el);
    if (!text || text.length < 2 || seen.has(text)) continue;
    seen.add(text);
    items.push(text);
    if (items.length >= maxItems) break;
  }
  if (items.length) return items;

  const bodyText = visibleText(document.body);
  return bodyText ? [bodyText] : [];
}

function collectForms(maxItems: number): string[] {
  const controls = Array.from(document.querySelectorAll('input,select,textarea')).filter(
    (el): el is HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement =>
      (el instanceof HTMLInputElement ||
        el instanceof HTMLSelectElement ||
        el instanceof HTMLTextAreaElement) &&
      !isInsideAssistant(el),
  );
  const lines: string[] = [];
  for (const control of controls) {
    if (control instanceof HTMLInputElement && control.type === 'hidden') continue;
    const value = controlValue(control);
    if (!value && control instanceof HTMLInputElement && control.type === 'radio') continue;
    const label = labelForControl(control) || '未命名字段';
    lines.push(`- ${label}: ${value || '(空)'}`);
    if (lines.length >= maxItems) break;
  }
  return lines;
}

function collectActions(maxItems: number): string[] {
  const actions = Array.from(document.querySelectorAll('button,a[href]')).filter(
    (el): el is HTMLButtonElement | HTMLAnchorElement =>
      (el instanceof HTMLButtonElement || el instanceof HTMLAnchorElement) &&
      !isInsideAssistant(el),
  );
  const lines: string[] = [];
  const seen = new Set<string>();
  for (const action of actions) {
    const label = firstNonEmpty(
      action.textContent,
      action.getAttribute('aria-label'),
      action.title,
    );
    if (!label) continue;
    const suffix = action instanceof HTMLAnchorElement ? ` -> ${action.href}` : '';
    const line = `- ${label}${suffix}`;
    if (seen.has(line)) continue;
    seen.add(line);
    lines.push(line);
    if (lines.length >= maxItems) break;
  }
  return lines;
}

export function collectPageSnapshotMarkdown(options: PageSnapshotOptions = {}): string {
  if (typeof document === 'undefined') return '';
  const maxChars = options.maxChars ?? DEFAULT_MAX_CHARS;
  const parts: string[] = ['# 当前页面内容'];

  if (document.title) parts.push(`- 页面标题: ${document.title}`);
  if (typeof location !== 'undefined' && location.href) parts.push(`- 页面URL: ${location.href}`);

  const textItems = collectMainText(options.maxTextItems ?? DEFAULT_MAX_TEXT_ITEMS);
  if (textItems.length) {
    parts.push('', '## 页面文本', ...textItems.map((item) => `- ${item}`));
  }

  const forms = collectForms(options.maxFormItems ?? DEFAULT_MAX_FORM_ITEMS);
  if (forms.length) {
    parts.push('', '## 表单字段', ...forms);
  }

  const actions = collectActions(options.maxActionItems ?? DEFAULT_MAX_ACTION_ITEMS);
  if (actions.length) {
    parts.push('', '## 可交互元素', ...actions);
  }

  return truncate(parts.join('\n'), maxChars);
}

export function isDirectPageSnapshotRequest(text: string): boolean {
  const normalized = collapseWhitespace(text).toLowerCase();
  if (/^\/(?:page|inspect)(?:\s|$)/i.test(normalized)) return true;
  return (
    /(当前|本|这个|此).{0,6}页面.{0,8}(有什么|内容|结构|字段|信息)/.test(normalized) ||
    /页面.{0,4}(有什么|内容|结构|字段|信息).{0,8}(当前|本|这个|此)?/.test(normalized) ||
    /what('| i)?s on (this|current) page/.test(normalized) ||
    /summari[sz]e (this|current) page content/.test(normalized)
  );
}

export function isPageSnapshotContextRequest(text: string): boolean {
  const normalized = collapseWhitespace(text).toLowerCase();
  return (
    isDirectPageSnapshotRequest(normalized) ||
    /(分析|总结|提取).{0,8}(当前|本|这个|此)?页面/.test(normalized)
  );
}
