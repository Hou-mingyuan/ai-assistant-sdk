/**
 * Form Auto-Fill / Scanner
 * ------------------------
 * 扫描宿主页面里所有「值得填」的表单字段，并为每个字段收集尽可能多的候选标签
 * （label / placeholder / aria-label / data-ai-field / 父级 th/dt 等），交给
 * matcher 与解析出来的 ParsedPair 做评分匹配。
 *
 * 设计原则：
 *   - **零依赖**于 Vue 与业务框架；只读 DOM。Vue/React 等框架的 controlled
 *     input 也是真实 <input>，能扫到；写入由 filler 处理。
 *   - 默认排除 `.ai-assistant-wrapper` 内的所有字段，避免误把对话输入框、
 *     搜索框当成业务表单。
 *   - 默认排除 type=hidden / submit / button / reset / file / image 这些
 *     非数据字段。
 *   - radio / checkbox 按 `name` 归并为一组「选项集合」，filler 再决定勾哪个。
 *   - 一个字段可能有多个候选标签，matcher 会逐一打分挑最高分。
 */

export type FormFieldType =
  | 'text'
  | 'number'
  | 'date'
  | 'time'
  | 'datetime-local'
  | 'email'
  | 'tel'
  | 'url'
  | 'password'
  | 'textarea'
  | 'select'
  | 'radio'
  | 'checkbox';

export interface FormFieldOption {
  /** option / radio / checkbox 上的 value 属性 */
  value: string;
  /** 用户能看到的文本（如 <option> 的 text，或 radio 旁边的 label 文字） */
  label: string;
}

export interface FormField {
  /** 该字段对应的「主」DOM 元素：input/textarea/select；radio/checkbox 组则取第一个 */
  el: HTMLElement;
  /** radio/checkbox 组的所有元素；单值字段只含 1 个 */
  els: HTMLElement[];
  /** 字段类型 */
  type: FormFieldType;
  /** 候选标签列表（去重，原大小写保留；matcher 会再 toLowerCase） */
  labels: string[];
  /** 字段当前值（用于在预览里展示「旧值」与判断是否为空） */
  currentValue: string;
  /** 选项列表（仅 select / radio / checkbox 组有意义） */
  options: FormFieldOption[];
  /** 字段唯一 ID（用于去重 / matcher 1-1 分配） */
  id: string;
  /** 是否在视口内（matcher 可用此提升可见字段权重） */
  visible: boolean;
}

export interface ScanFormFieldsOptions {
  /**
   * 扫描根节点。默认 `document.body`，但若页面里存在
   * `[data-ai-fillable]` 元素，则**只**扫这些子树（不会回退）。
   */
  root?: HTMLElement;
  /** 额外排除的 CSS selector（匹配到的字段及其子树都不扫） */
  excludeSelectors?: string[];
  /**
   * 排除 SDK 自身的对话面板。默认 true；测试 / 特殊场景可关。
   */
  excludeAssistantWrapper?: boolean;
  /**
   * 是否跳过 `[data-ai-fillable-row]` 行容器内的字段。默认 `true`：
   * 单 pair 模式不应把表格行的字段也扔进候选池，避免 matcher 把 pair 错分配
   * 给某行（而那个行本来应该走表格模式）。
   * `scanFormRows` 内部递归调用时会把它设成 `false`。
   */
  excludeRowContainerFields?: boolean;
}

const ASSISTANT_WRAPPER_SELECTOR = '.ai-assistant-wrapper, [data-ai-assistant-auto-mount]';
const FILLABLE_SCOPE_SELECTOR = '[data-ai-fillable]';
const FILLABLE_ROW_SELECTOR = '[data-ai-fillable-row]';
const EXCLUDED_INPUT_TYPES = new Set([
  'hidden',
  'submit',
  'button',
  'reset',
  'file',
  'image',
  'color',
  'range',
]);
const FIELD_OPT_OUT_ATTR = 'data-ai-fill-ignore';
const FIELD_LABEL_ATTR = 'data-ai-field';

/**
 * 扫主入口：扫整个 root（或所有 `[data-ai-fillable]`）下的可填字段。
 */
export function scanFormFields(opts: ScanFormFieldsOptions = {}): FormField[] {
  if (typeof document === 'undefined') return [];

  const excludeAssistant = opts.excludeAssistantWrapper !== false;
  const excludeRowContainerFields = opts.excludeRowContainerFields !== false;
  const scopes = resolveScopes(opts.root);
  const excludeSelectorList = opts.excludeSelectors ?? [];
  const fields: FormField[] = [];
  const radioCheckboxGroups = new Map<string, HTMLInputElement[]>();
  const visited = new Set<HTMLElement>();
  let autoId = 0;

  for (const scope of scopes) {
    const nodes = scope.querySelectorAll<HTMLElement>('input, textarea, select');
    for (const el of Array.from(nodes)) {
      if (visited.has(el)) continue;
      if (shouldSkip(el, { excludeAssistant, excludeSelectorList, excludeRowContainerFields }))
        continue;

      if (el instanceof HTMLInputElement && (el.type === 'radio' || el.type === 'checkbox')) {
        const name = el.name || el.id || `__anon_${autoId++}`;
        const groupKey = `${el.type}::${name}`;
        const prev = radioCheckboxGroups.get(groupKey) ?? [];
        prev.push(el);
        radioCheckboxGroups.set(groupKey, prev);
        visited.add(el);
        continue;
      }

      visited.add(el);
      const field = buildSingleField(el, autoId++);
      if (field) fields.push(field);
    }
  }

  for (const [groupKey, els] of radioCheckboxGroups) {
    const type: FormFieldType = groupKey.startsWith('radio::') ? 'radio' : 'checkbox';
    const field = buildRadioCheckboxGroup(els, type, autoId++);
    if (field) fields.push(field);
  }

  return fields;
}

/**
 * Phase 2: 找到页面上所有「可填行」容器。宿主在每个表格行 / 卡片组上加
 * `data-ai-fillable-row` 或自定义 selector 即可被识别为一行；行内的所有
 * input/select/textarea/radio/checkbox 视为这一行的列。
 *
 * 返回结果按 DOM 出现顺序排序，row 之间不嵌套；如果某 row 容器又包了另一个
 * row 容器，只把最外层作为一行，内层 row 内的 field 不会被外层重复采集。
 */
export interface FormRow {
  el: HTMLElement;
  rowId: string;
  fields: FormField[];
}

export interface ScanFormRowsOptions {
  root?: HTMLElement;
  excludeSelectors?: string[];
  excludeAssistantWrapper?: boolean;
  /** 行容器 selector，默认 `[data-ai-fillable-row]` */
  rowSelector?: string;
}

export function scanFormRows(opts: ScanFormRowsOptions = {}): FormRow[] {
  if (typeof document === 'undefined') return [];
  const baseRoot = opts.root ?? document.body;
  if (!baseRoot) return [];
  const selector = opts.rowSelector ?? FILLABLE_ROW_SELECTOR;
  const containers = Array.from(baseRoot.querySelectorAll<HTMLElement>(selector));
  if (containers.length === 0) return [];

  // 去除嵌套：保留祖先，去掉子孙
  const outermost = containers.filter(
    (el) => !containers.some((other) => other !== el && other.contains(el)),
  );

  const out: FormRow[] = [];
  let autoIdx = 0;
  for (const container of outermost) {
    const fields = scanFormFields({
      root: container,
      excludeSelectors: opts.excludeSelectors,
      excludeAssistantWrapper: opts.excludeAssistantWrapper,
      // 关键：在 row 容器内部扫描时关闭 row 排除，否则会跳过容器自身的字段
      excludeRowContainerFields: false,
    });
    if (fields.length === 0) continue;
    const rowId = container.getAttribute('data-ai-fillable-row') || `__row_${autoIdx++}`;
    out.push({ el: container, rowId, fields });
  }
  return out;
}

function resolveScopes(root?: HTMLElement): HTMLElement[] {
  const baseRoot = root ?? document.body;
  if (!baseRoot) return [];
  const fillableScopes = Array.from(
    baseRoot.querySelectorAll<HTMLElement>(FILLABLE_SCOPE_SELECTOR),
  );
  if (fillableScopes.length > 0) return fillableScopes;
  return [baseRoot];
}

function shouldSkip(
  el: HTMLElement,
  ctx: {
    excludeAssistant: boolean;
    excludeSelectorList: string[];
    excludeRowContainerFields: boolean;
  },
): boolean {
  if (el.hasAttribute(FIELD_OPT_OUT_ATTR)) return true;
  if (ctx.excludeAssistant && el.closest(ASSISTANT_WRAPPER_SELECTOR)) return true;
  if (ctx.excludeRowContainerFields && el.closest(FILLABLE_ROW_SELECTOR)) return true;
  for (const sel of ctx.excludeSelectorList) {
    if (sel && safeMatches(el, sel)) return true;
    if (sel && el.closest(sel)) return true;
  }
  if (el instanceof HTMLInputElement) {
    const t = (el.type || 'text').toLowerCase();
    if (EXCLUDED_INPUT_TYPES.has(t)) return true;
  }
  if ((el as HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement).disabled) return true;
  // 只有 input/textarea 有 readOnly；select 不会进这条
  if (
    (el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement) &&
    el.readOnly === true
  ) {
    return true;
  }
  return false;
}

function safeMatches(el: HTMLElement, selector: string): boolean {
  try {
    return el.matches(selector);
  } catch {
    return false;
  }
}

function buildSingleField(el: HTMLElement, idCounter: number): FormField | null {
  const type = resolveFieldType(el);
  if (!type) return null;
  const labels = collectLabels(el);
  if (labels.length === 0) return null;

  const options =
    el instanceof HTMLSelectElement ? Array.from(el.options).map((o) => optionFromHtml(o)) : [];

  const id = el.id || `__ai_fill_${idCounter}`;
  return {
    el,
    els: [el],
    type,
    labels,
    currentValue: readValue(el),
    options,
    id,
    visible: isElementVisible(el),
  };
}

function buildRadioCheckboxGroup(
  els: HTMLInputElement[],
  type: 'radio' | 'checkbox',
  idCounter: number,
): FormField | null {
  if (els.length === 0) return null;
  const first = els[0]!;
  const groupName = first.name || first.id;

  const labels = new Set<string>();
  for (const e of els) {
    for (const l of collectLabels(e)) labels.add(l);
  }
  if (groupName) labels.add(groupName);
  if (labels.size === 0) return null;

  const options: FormFieldOption[] = els.map((e) => ({
    value: e.value || (e.checked ? 'on' : 'off'),
    label: bestVisibleLabelForRadio(e) || e.value || '',
  }));

  const currentValue =
    type === 'radio'
      ? (els.find((e) => e.checked)?.value ?? '')
      : els
          .filter((e) => e.checked)
          .map((e) => e.value || 'on')
          .join(',');

  return {
    el: first,
    els,
    type,
    labels: Array.from(labels),
    currentValue,
    options,
    id: `${type}::${groupName || '__anon'}::${idCounter}`,
    visible: els.some((e) => isElementVisible(e)),
  };
}

function resolveFieldType(el: HTMLElement): FormFieldType | null {
  if (el instanceof HTMLTextAreaElement) return 'textarea';
  if (el instanceof HTMLSelectElement) return 'select';
  if (el instanceof HTMLInputElement) {
    const t = (el.type || 'text').toLowerCase();
    switch (t) {
      case 'text':
      case 'search':
        return 'text';
      case 'number':
        return 'number';
      case 'date':
        return 'date';
      case 'time':
        return 'time';
      case 'datetime-local':
        return 'datetime-local';
      case 'email':
        return 'email';
      case 'tel':
        return 'tel';
      case 'url':
        return 'url';
      case 'password':
        return 'password';
      default:
        return EXCLUDED_INPUT_TYPES.has(t) ? null : 'text';
    }
  }
  return null;
}

function collectLabels(el: HTMLElement): string[] {
  const set = new Set<string>();
  const add = (s: string | null | undefined) => {
    if (!s) return;
    const trimmed = s.trim();
    if (!trimmed) return;
    set.add(trimmed);
    // 复合 label 也按常见分隔符拆出来：`客户姓名 / Customer Name` 既要保留整段
    // 又要把「客户姓名」「Customer Name」单独丢进候选集，让 matcher 的同义词
    // 字典能命中其中任意一段。分隔符覆盖 `/ | ｜ \ ( ) [ ] 【】 （） 《》 < >`
    // 等，以及空格夹着的 `-` 或 `—`（行内引导符）。
    for (const part of trimmed.split(/[/|｜·•\\(){}[\]（）【】<>《》]+|\s[-—]\s/)) {
      const sub = part.trim();
      if (sub && sub !== trimmed) set.add(sub);
    }
  };

  add(el.getAttribute(FIELD_LABEL_ATTR));
  add(el.getAttribute('aria-label'));
  add(el.getAttribute('placeholder'));
  add(el.getAttribute('name'));
  add(el.getAttribute('id'));
  add(el.getAttribute('title'));

  const labelledBy = el.getAttribute('aria-labelledby');
  if (labelledBy) {
    for (const refId of labelledBy.split(/\s+/)) {
      const ref = refId && document.getElementById(refId);
      if (ref) add(textForLabelExcludingControls(ref));
    }
  }

  if (el.id) {
    const forLabels = document.querySelectorAll<HTMLLabelElement>(
      `label[for="${cssEscape(el.id)}"]`,
    );
    forLabels.forEach((l) => add(textForLabelExcludingControls(l)));
  }
  const parentLabel = el.closest('label');
  if (parentLabel) add(textForLabelExcludingControls(parentLabel));

  // 表格 / 定义列表 / 描述列表场景：标签往往是同行/同组的 <th>/<dt>，与字段
  // 是兄弟而不是祖先关系。沿父链向上找最近的「prev sibling 是 th/dt」。
  const prevTh = findPrevSiblingTagText(el, 'th');
  if (prevTh) add(prevTh);
  const prevDt = findPrevSiblingTagText(el, 'dt');
  if (prevDt) add(prevDt);

  // 表格列头：如果字段在某 <td> 里，找它所在列在 thead / 首行的 <th> 文本，
  // 这样 `<th>客户姓名</th>` 能正确对应到 `<td><input name="customer_name" /></td>`。
  const colHeader = findTableColumnHeaderText(el);
  if (colHeader) add(colHeader);

  // 兜底：父级 5 层内查 .ant-form-item-label / .el-form-item__label / .form-label /
  // .ai-form-label，覆盖常见 UI 库的 label 包装层
  const labelClasses = [
    '.ant-form-item-label',
    '.el-form-item__label',
    '.form-label',
    '.ai-form-label',
    '.label',
  ];
  let p: HTMLElement | null = el.parentElement;
  let depth = 0;
  while (p && depth < 5) {
    for (const sel of labelClasses) {
      const found = p.querySelector(sel);
      if (found && found !== el) add(textContentTrim(found as HTMLElement));
    }
    p = p.parentElement;
    depth++;
  }

  return Array.from(set);
}

/**
 * 表格列头查找：把字段元素往上找到它所在的 `<td>` / `<th>`，再用列序号到
 * `<thead>` 或第一行 `<tr>` 拿同列的 `<th>` 文本。
 *
 * 例：`<th>客户姓名</th>` 与 `<td><input name="customer_name" /></td>` 同列，
 * 这里返回 `'客户姓名'`，让 matcher 能用同义词字典命中。
 */
function findTableColumnHeaderText(el: HTMLElement): string | null {
  const td = el.closest('td, th');
  if (!td) return null;
  const tr = td.closest('tr');
  if (!tr) return null;
  const colIndex = Array.from(tr.children).indexOf(td);
  if (colIndex < 0) return null;
  const table = tr.closest('table');
  if (!table) return null;
  const headerRow = table.querySelector('thead tr') || (table.tBodies[0]?.rows[0] ?? table.rows[0]);
  if (!headerRow || headerRow === tr) return null;
  const headerCell = headerRow.children[colIndex];
  if (!headerCell) return null;
  return textContentTrim(headerCell as HTMLElement);
}

/**
 * `<label>` 包 `<select>` / `<input>` 时，`textContent` 会把表单控件自己的
 * 显示文本也吞进来（select 里所有 option 的 text、textarea 的 value 等）。
 * 这里通过克隆 + 删除控件后再读 textContent，得到「纯标签文本」。
 */
function textForLabelExcludingControls(label: HTMLElement): string {
  if (!label) return '';
  const clone = label.cloneNode(true) as HTMLElement;
  clone
    .querySelectorAll('input, select, textarea, button')
    .forEach((c) => c.parentNode?.removeChild(c));
  return textContentTrim(clone);
}

function bestVisibleLabelForRadio(el: HTMLInputElement): string {
  const wrappingLabel = el.closest('label');
  if (wrappingLabel) return textContentTrim(wrappingLabel);
  if (el.id) {
    const lbl = document.querySelector<HTMLLabelElement>(`label[for="${cssEscape(el.id)}"]`);
    if (lbl) return textContentTrim(lbl);
  }
  const sib = el.nextElementSibling as HTMLElement | null;
  if (sib) return textContentTrim(sib);
  return el.value || '';
}

function readValue(el: HTMLElement): string {
  if (el instanceof HTMLSelectElement) {
    return el.multiple
      ? Array.from(el.selectedOptions)
          .map((o) => o.value)
          .join(',')
      : el.value;
  }
  if (el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement) return el.value;
  return '';
}

function optionFromHtml(o: HTMLOptionElement): FormFieldOption {
  return {
    value: o.value,
    label: (o.textContent || o.label || o.value).trim(),
  };
}

function textContentTrim(el: HTMLElement): string {
  return (el.textContent || '').replace(/\s+/g, ' ').trim();
}

function findPrevSiblingTagText(el: HTMLElement, tag: string): string | null {
  let cur: HTMLElement | null = el.parentElement;
  // 通常 <dt><label>... / <dd><input> 这种结构
  while (cur) {
    let prev: Element | null = cur.previousElementSibling;
    while (prev) {
      if (prev.tagName === tag.toUpperCase()) return textContentTrim(prev as HTMLElement);
      prev = prev.previousElementSibling;
    }
    cur = cur.parentElement;
    if (cur && cur.tagName === 'DL') break;
  }
  return null;
}

function isElementVisible(el: HTMLElement): boolean {
  if (!el.isConnected) return false;
  const style = typeof getComputedStyle === 'function' ? getComputedStyle(el) : null;
  if (style && (style.display === 'none' || style.visibility === 'hidden')) return false;
  const rect = el.getBoundingClientRect();
  if (rect.width <= 0 && rect.height <= 0) return false;
  return true;
}

function cssEscape(id: string): string {
  if (typeof CSS !== 'undefined' && typeof CSS.escape === 'function') return CSS.escape(id);
  return id.replace(/(["\\\]])/g, '\\$1');
}
