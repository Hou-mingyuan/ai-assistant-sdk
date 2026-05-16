/**
 * Form Auto-Fill / Filler
 * -----------------------
 * 把匹配结果真正写到页面表单字段里。难点全在「让框架（Vue/React/...）能感知
 * 到这次写入」。直接 `el.value = x` 在 Vue 的 v-model 上会失效，因为 v-model
 * 是双向绑定到 reactive state 的；同样 React 会忽略不经它的状态变更。
 *
 * 解决：通过原型链上的 `value` setter （HTMLInputElement / HTMLTextAreaElement /
 * HTMLSelectElement 各自的原型 setter）直接调用 native setter，再手动派发
 * `input` 和 `change` 事件冒泡。Vue v-model 监听 `input`、React 通过
 * `valueTracker` hack 监听这个 setter，都能跟上。
 *
 * radio / checkbox 用 `.checked = bool` + dispatch `click` 事件，最贴近用户
 * 真实点击的行为模型，能让 Element-Plus / Ant Design Vue 等组件库的 wrapper
 * 同步内部 state。
 *
 * 所有 fill 都先快照 oldValue，方便整批 undo。
 */

import type { FormField, FormFieldOption } from './scanner';

/**
 * 内置 option alias 字典：把常见中文 → 拼音 / 英文 / 缩写双向打通，让
 * select / radio / checkbox 在用户粘贴拼音或英文时也能正确匹配到中文 option。
 * 覆盖范围（约 120 条）：4 直辖市、22 省、5 自治区、2 SAR、~50 主要城市、
 * 性别、是否、教育程度等高频选项。不包括所有 3000+ 县市；要更细可走
 * `optionAliases` host 配置。
 */
const BUILTIN_OPTION_ALIASES: Record<string, string[]> = {
  // 直辖市
  北京: ['beijing', 'bj', 'peking'],
  上海: ['shanghai', 'sh'],
  天津: ['tianjin', 'tj'],
  重庆: ['chongqing', 'cq'],
  // 省
  河北: ['hebei', 'he'],
  山西: ['shanxi', 'sx'],
  辽宁: ['liaoning', 'ln'],
  吉林: ['jilin', 'jl'],
  黑龙江: ['heilongjiang', 'hlj'],
  江苏: ['jiangsu', 'js'],
  浙江: ['zhejiang', 'zj'],
  安徽: ['anhui', 'ah'],
  福建: ['fujian', 'fj'],
  江西: ['jiangxi', 'jx'],
  山东: ['shandong', 'sd'],
  河南: ['henan', 'ha'],
  湖北: ['hubei', 'hb'],
  湖南: ['hunan', 'hn'],
  广东: ['guangdong', 'gd'],
  海南: ['hainan', 'hi'],
  四川: ['sichuan', 'sc'],
  贵州: ['guizhou', 'gz-sheng'],
  云南: ['yunnan', 'yn'],
  陕西: ['shaanxi', 'sn'],
  甘肃: ['gansu', 'gs'],
  青海: ['qinghai', 'qh'],
  台湾: ['taiwan', 'tw'],
  // 自治区
  内蒙古: ['neimenggu', 'nm', 'innermongolia'],
  广西: ['guangxi', 'gx'],
  西藏: ['xizang', 'xz', 'tibet'],
  宁夏: ['ningxia', 'nx'],
  新疆: ['xinjiang', 'xj'],
  // SAR
  香港: ['xianggang', 'hk', 'hongkong'],
  澳门: ['aomen', 'mo', 'macao', 'macau'],
  // 主要城市
  广州: ['guangzhou', 'gz', 'canton'],
  深圳: ['shenzhen', 'sz'],
  杭州: ['hangzhou', 'hz'],
  南京: ['nanjing', 'nj'],
  成都: ['chengdu', 'cd'],
  武汉: ['wuhan', 'wh'],
  西安: ['xian', 'xa'],
  苏州: ['suzhou', 'su'],
  青岛: ['qingdao', 'qd'],
  长沙: ['changsha', 'cs'],
  厦门: ['xiamen', 'xm', 'amoy'],
  宁波: ['ningbo', 'nb'],
  郑州: ['zhengzhou', 'zz'],
  济南: ['jinan', 'jn'],
  合肥: ['hefei', 'hf'],
  福州: ['fuzhou', 'fz'],
  昆明: ['kunming', 'km'],
  大连: ['dalian', 'dl'],
  沈阳: ['shenyang', 'sy'],
  哈尔滨: ['haerbin', 'harbin', 'hrb'],
  长春: ['changchun', 'cc'],
  无锡: ['wuxi', 'wx'],
  温州: ['wenzhou', 'wz'],
  佛山: ['foshan', 'fs'],
  东莞: ['dongguan', 'dg'],
  // 性别
  男: ['m', 'male', 'man', '男性'],
  女: ['f', 'female', 'woman', '女性'],
  其他: ['o', 'other', 'others'],
  // 是 / 否
  是: ['yes', 'y', 'true', '1', '有'],
  否: ['no', 'n', 'false', '0', '没有', '无'],
  启用: ['enable', 'enabled', 'on'],
  停用: ['disable', 'disabled', 'off'],
  // 教育程度
  本科: ['bachelor', 'undergraduate'],
  硕士: ['master', 'msc', 'ma'],
  博士: ['phd', 'doctor', 'doctorate'],
  专科: ['associate', 'aa'],
  高中: ['highschool'],
};

export interface FillOptions {
  /**
   * 用户自定义 option alias 字典：`{ 标准值: ['别名1', '别名2'] }`。
   * 与内置字典合并；当 host 想让 `<option value="gz">广州</option>` 也接受
   * `'guang-zhou'`、`'canton'`、本地土名等时使用。
   */
  optionAliases?: Record<string, string[]>;
}

export interface FillRecord {
  field: FormField;
  oldValue: string;
  newValue: string;
  /** false 时表示尝试过但未能写入（如 select 找不到匹配 option） */
  success: boolean;
  /** 命中的 option（select / radio / checkbox）用于 UI 提示 */
  matchedOption?: { value: string; label: string };
}

const nativeInputValueSetter = getNativeSetter('HTMLInputElement');
const nativeTextareaValueSetter = getNativeSetter('HTMLTextAreaElement');
const nativeSelectValueSetter = getNativeSetter('HTMLSelectElement');

function getNativeSetter(ctorName: string): ((this: HTMLElement, v: string) => void) | null {
  if (typeof window === 'undefined') return null;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const ctor = (window as any)[ctorName];
  if (!ctor) return null;
  const desc = Object.getOwnPropertyDescriptor(ctor.prototype, 'value');
  return (desc?.set as ((this: HTMLElement, v: string) => void) | undefined) ?? null;
}

/**
 * 真正写一个字段。返回的 FillRecord 既是 undo 记录，也是 UI 反馈来源。
 *
 * `newValue` 的语义：
 *   - text/textarea/number/date/...：字符串直接写
 *   - select：先按 option.value 精确匹配，再按 option.label 包含匹配，再走
 *     alias 字典（拼音 / 英文 / 缩写）
 *   - radio：同 select
 *   - checkbox：value 用 `,` `;` 分割成多值；命中则勾上，其余取消
 */
export function fillField(field: FormField, newValue: string, opts: FillOptions = {}): FillRecord {
  const oldValue = field.currentValue;
  if (field.type === 'select') return fillSelect(field, newValue, oldValue, opts);
  if (field.type === 'radio') return fillRadio(field, newValue, oldValue, opts);
  if (field.type === 'checkbox') return fillCheckbox(field, newValue, oldValue, opts);
  return fillTextLike(field, newValue, oldValue);
}

function fillTextLike(field: FormField, newValue: string, oldValue: string): FillRecord {
  const el = field.el as HTMLInputElement | HTMLTextAreaElement;
  const coerced = coerceForType(field.type, newValue);
  const setter =
    el instanceof HTMLTextAreaElement ? nativeTextareaValueSetter : nativeInputValueSetter;
  try {
    if (setter) setter.call(el, coerced);
    else el.value = coerced;
    dispatch(el, 'input');
    dispatch(el, 'change');
    field.currentValue = coerced;
    return { field, oldValue, newValue: coerced, success: true };
  } catch {
    return { field, oldValue, newValue: coerced, success: false };
  }
}

function fillSelect(
  field: FormField,
  newValue: string,
  oldValue: string,
  opts: FillOptions,
): FillRecord {
  const el = field.el as HTMLSelectElement;
  const target = matchOption(field.options, newValue, opts.optionAliases);
  if (!target) {
    return { field, oldValue, newValue, success: false };
  }
  try {
    if (nativeSelectValueSetter) nativeSelectValueSetter.call(el, target.value);
    else el.value = target.value;
    dispatch(el, 'input');
    dispatch(el, 'change');
    field.currentValue = target.value;
    return { field, oldValue, newValue: target.value, success: true, matchedOption: target };
  } catch {
    return { field, oldValue, newValue, success: false };
  }
}

function fillRadio(
  field: FormField,
  newValue: string,
  oldValue: string,
  opts: FillOptions,
): FillRecord {
  const target = matchOption(field.options, newValue, opts.optionAliases);
  if (!target) return { field, oldValue, newValue, success: false };
  let success = false;
  for (const node of field.els) {
    const input = node as HTMLInputElement;
    const shouldCheck = input.value === target.value;
    if (input.checked !== shouldCheck) {
      input.checked = shouldCheck;
      dispatch(input, 'input');
      dispatch(input, 'change');
      if (shouldCheck) {
        try {
          input.click?.();
        } catch {
          // some frameworks throw on programmatic click; safe to ignore
        }
      }
    }
    if (shouldCheck) success = true;
  }
  if (success) field.currentValue = target.value;
  return { field, oldValue, newValue: target.value, success, matchedOption: target };
}

function fillCheckbox(
  field: FormField,
  newValue: string,
  oldValue: string,
  opts: FillOptions,
): FillRecord {
  const tokens = newValue
    .split(/[,;，；|]/)
    .map((s) => s.trim())
    .filter(Boolean);
  if (tokens.length === 0) return { field, oldValue, newValue, success: false };

  const targets = new Set<string>();
  for (const t of tokens) {
    const m = matchOption(field.options, t, opts.optionAliases);
    if (m) targets.add(m.value);
  }
  if (targets.size === 0) return { field, oldValue, newValue, success: false };

  // Vue 的 checkbox v-model（数组形式）每个 input 会缓存它「上次 patch 时
  // 看到的 modelValue 数组」（_modelValue）。在同一 microtask 内连续多次
  // dispatch change，第二次的 change handler 读到的还是首次 dispatch 前
  // 的旧数组，结果是第二次 push 覆盖掉第一次的 push（数组只剩最后一个）。
  // 解决：把每次 click 放到独立的 microtask，让 Vue 在期间能 flush 出新的
  // _modelValue。fillField 本身仍然同步返回成功记录，UI 在几个 microtask
  // 内收敛。
  const toToggle: HTMLInputElement[] = [];
  for (const node of field.els) {
    const input = node as HTMLInputElement;
    const shouldCheck = targets.has(input.value || (input.checked ? 'on' : 'off'));
    if (input.checked !== shouldCheck) toToggle.push(input);
  }
  scheduleCheckboxClicks(toToggle);
  const joined = Array.from(targets).join(',');
  field.currentValue = joined;
  return { field, oldValue, newValue: joined, success: true };
}

function scheduleCheckboxClicks(inputs: HTMLInputElement[]): void {
  if (inputs.length === 0) return;
  let i = 0;
  const tick = () => {
    if (i >= inputs.length) return;
    const input = inputs[i++]!;
    try {
      input.click();
    } catch {
      const desired = !input.checked;
      input.checked = desired;
      dispatch(input, 'input');
      dispatch(input, 'change');
    }
    if (i < inputs.length) {
      // queueMicrotask is enough for Vue's reactive system to flush between
      // clicks (in tests we used to verify with setTimeout(0); microtask works
      // and avoids visible flicker). Fall back to Promise.resolve in
      // environments without queueMicrotask.
      if (typeof queueMicrotask === 'function') queueMicrotask(tick);
      else Promise.resolve().then(tick);
    }
  };
  tick();
}

/**
 * 把 `needle` 对应到 `options` 中的一项。从最强到最弱依次尝试：
 *   1. exact value / label（区分大小写）
 *   2. case-insensitive value / label
 *   3. label 互相 contains
 *   4. value 互相 contains
 *   5. **alias 字典反查**：用内置 + host 提供的别名字典，把 `'guangzhou'`
 *      与 option `{ value:'gz', label:'广州' }` 接通。
 */
function matchOption(
  options: FormFieldOption[],
  needle: string,
  extraAliases?: Record<string, string[]>,
): FormFieldOption | null {
  if (!needle || options.length === 0) return null;
  const v = needle.trim();
  if (!v) return null;

  const exactValue = options.find((o) => o.value === v);
  if (exactValue) return exactValue;

  const exactLabel = options.find((o) => o.label === v);
  if (exactLabel) return exactLabel;

  const lc = v.toLowerCase();
  const ciValue = options.find((o) => o.value.toLowerCase() === lc);
  if (ciValue) return ciValue;
  const ciLabel = options.find((o) => o.label.toLowerCase() === lc);
  if (ciLabel) return ciLabel;

  const containsLabel = options.find((o) => {
    const lbl = o.label.toLowerCase();
    if (!lbl) return false;
    return lbl.includes(lc) || lc.includes(lbl);
  });
  if (containsLabel) return containsLabel;

  const containsValue = options.find((o) => {
    const val = o.value.toLowerCase();
    // 跳过 value 为空的 option（典型场景：`<option value="">请选择</option>`），
    // 否则 `lc.includes('')` 永远 true，会把 placeholder 当作命中返回。
    if (!val) return false;
    return val.includes(lc) || lc.includes(val);
  });
  if (containsValue) return containsValue;

  return matchOptionByAlias(v, options, extraAliases ?? {});
}

/**
 * Alias lookup with two directions:
 *   - forward:  needle 是中文，看它的 alias 列表（`'广州' → ['guangzhou']`）
 *               是否能命中某 option 的 value 或 label
 *   - reverse:  needle 是英文/拼音/缩写，找到所有以 needle 为 alias 的中文
 *               canonical，再用 canonical 去匹配 option
 */
function matchOptionByAlias(
  needle: string,
  options: FormFieldOption[],
  extra: Record<string, string[]>,
): FormFieldOption | null {
  const lc = needle.toLowerCase();

  const forwardAliases = aliasesFor(needle, extra).map((a) => a.toLowerCase());
  for (const opt of options) {
    if (forwardAliases.includes(opt.value.toLowerCase())) return opt;
    if (forwardAliases.includes(opt.label.toLowerCase())) return opt;
  }

  const canonicals = canonicalsFor(needle, extra);
  for (const c of canonicals) {
    for (const opt of options) {
      if (opt.value === c) return opt;
      if (opt.label === c) return opt;
      if (opt.label.toLowerCase() === c.toLowerCase()) return opt;
    }
  }

  // 也允许「option label / value 的 alias 包含 needle」：例如 option label
  // 是 '广州' alias ['guangzhou','gz']，needle 是 'guangzhou'，命中。
  for (const opt of options) {
    const labelAliases = aliasesFor(opt.label, extra).map((a) => a.toLowerCase());
    if (labelAliases.includes(lc)) return opt;
    const valueAliases = aliasesFor(opt.value, extra).map((a) => a.toLowerCase());
    if (valueAliases.includes(lc)) return opt;
  }

  return null;
}

/** 返回 canonical 自己 + 内置字典 + host 字典里它的所有别名。 */
function aliasesFor(canonical: string, extra: Record<string, string[]>): string[] {
  const set = new Set<string>([canonical]);
  const b = BUILTIN_OPTION_ALIASES[canonical];
  if (b) b.forEach((a) => set.add(a));
  const ex = extra[canonical];
  if (Array.isArray(ex)) ex.forEach((a) => set.add(a));
  return Array.from(set);
}

/** 反查：哪些 canonical 字典项把 `needle` 列为别名。 */
function canonicalsFor(needle: string, extra: Record<string, string[]>): string[] {
  const lc = needle.toLowerCase();
  const out: string[] = [];
  for (const [canonical, aliases] of Object.entries(BUILTIN_OPTION_ALIASES)) {
    if (canonical.toLowerCase() === lc) out.push(canonical);
    else if (aliases.some((a) => a.toLowerCase() === lc)) out.push(canonical);
  }
  for (const [canonical, aliases] of Object.entries(extra)) {
    if (!Array.isArray(aliases)) continue;
    if (canonical.toLowerCase() === lc) out.push(canonical);
    else if (aliases.some((a) => a.toLowerCase() === lc)) out.push(canonical);
  }
  return out;
}

function coerceForType(type: FormField['type'], v: string): string {
  if (v == null) return '';
  const s = String(v);
  switch (type) {
    case 'number':
      return s.replace(/[^\d.+\-eE]/g, '');
    case 'date': {
      const d = parseDate(s);
      return d ? toISODate(d) : s;
    }
    case 'datetime-local': {
      const d = parseDate(s);
      return d ? toISODateTime(d) : s;
    }
    case 'time':
      return s.match(/^\d{1,2}:\d{2}(:\d{2})?$/) ? s : s;
    case 'tel':
      return s.replace(/[^\d+\-()\s]/g, '');
    case 'email':
    case 'url':
    case 'password':
    case 'text':
    case 'textarea':
    default:
      return s;
  }
}

function parseDate(s: string): Date | null {
  const trimmed = s.trim();
  if (!trimmed) return null;
  // 优先 ISO (YYYY-MM-DD)
  const iso = /^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})/.exec(trimmed);
  if (iso) {
    const [, y, m, d] = iso;
    const dt = new Date(Number(y), Number(m) - 1, Number(d));
    if (!Number.isNaN(dt.getTime())) return dt;
  }
  const cn = /^(\d{4})年(\d{1,2})月(\d{1,2})日/.exec(trimmed);
  if (cn) {
    const [, y, m, d] = cn;
    const dt = new Date(Number(y), Number(m) - 1, Number(d));
    if (!Number.isNaN(dt.getTime())) return dt;
  }
  const dt = new Date(trimmed);
  return Number.isNaN(dt.getTime()) ? null : dt;
}

function toISODate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function toISODateTime(d: Date): string {
  const base = toISODate(d);
  const h = String(d.getHours()).padStart(2, '0');
  const min = String(d.getMinutes()).padStart(2, '0');
  return `${base}T${h}:${min}`;
}

function dispatch(el: HTMLElement, type: string): void {
  try {
    el.dispatchEvent(new Event(type, { bubbles: true }));
  } catch {
    // older runtimes may not support Event() ctor
    const e = document.createEvent('Event');
    e.initEvent(type, true, false);
    el.dispatchEvent(e);
  }
}

/**
 * 批量撤销：按 records 顺序写回 oldValue。
 * 注意 `field.currentValue` 也会同步还原，方便重新 fill。
 */
export function undoFills(records: FillRecord[]): void {
  for (const r of records) {
    if (!r.success) continue;
    if (r.field.type === 'radio' || r.field.type === 'checkbox') {
      restoreRadioCheckbox(r);
      continue;
    }
    const el = r.field.el as HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement;
    const setter =
      el instanceof HTMLTextAreaElement
        ? nativeTextareaValueSetter
        : el instanceof HTMLSelectElement
          ? nativeSelectValueSetter
          : nativeInputValueSetter;
    try {
      if (setter) setter.call(el, r.oldValue);
      else (el as HTMLInputElement).value = r.oldValue;
      dispatch(el, 'input');
      dispatch(el, 'change');
      r.field.currentValue = r.oldValue;
    } catch {
      // best-effort; if restoration fails we still keep the dialog open for retry
    }
  }
}

function restoreRadioCheckbox(r: FillRecord): void {
  if (r.field.type === 'checkbox') {
    restoreCheckbox(r);
  } else {
    restoreRadio(r);
  }
  r.field.currentValue = r.oldValue;
}

function restoreCheckbox(r: FillRecord): void {
  const desired = new Set(
    r.oldValue
      .split(/[,;，；|]/)
      .map((s) => s.trim())
      .filter(Boolean),
  );
  const toToggle: HTMLInputElement[] = [];
  for (const node of r.field.els) {
    const input = node as HTMLInputElement;
    const shouldCheck = desired.has(input.value || 'on');
    if (input.checked !== shouldCheck) toToggle.push(input);
  }
  scheduleCheckboxClicks(toToggle);
}

function restoreRadio(r: FillRecord): void {
  // 单选组的撤销：因为浏览器无法在 click() 上把 radio 切回「未选」（radio
  // 不可 toggle off），且直接 set .checked=false 后再 dispatch change，Vue 的
  // vModelRadio 会把 modelValue 重新 set 回元素自己的 value。我们在两种
  // 场景下尽力还原：
  //   - 原值非空：在对应 radio 上 click()，让其重新成为选中项；
  //   - 原值为空：把组内被填上的 radio 的 checked 改为 false 并 dispatch，
  //     Vue v-model 在某些写法下可能依然指向该 value，宿主若发现状态不同步
  //     可在自己的撤销链里再重置 v-model 引用（已记录在 Phase 1 known issues）。
  if (r.oldValue) {
    for (const node of r.field.els) {
      const input = node as HTMLInputElement;
      if (input.value === r.oldValue && !input.checked) {
        try {
          input.click();
        } catch {
          input.checked = true;
          dispatch(input, 'input');
          dispatch(input, 'change');
        }
        return;
      }
    }
  }
  for (const node of r.field.els) {
    const input = node as HTMLInputElement;
    if (input.checked) {
      input.checked = false;
      dispatch(input, 'input');
      dispatch(input, 'change');
    }
  }
}

/**
 * 给已经填好的字段加临时高亮，方便用户视觉确认到底改到了哪。复用 domHighlight
 * 的样式但不依赖那边的 selector 解析（这里直接拿到 HTMLElement）。
 */
const FILL_HIGHLIGHT_CLASS = 'ai-form-fill-highlight';
const FILL_HIGHLIGHT_DURATION = 2500;
let activeFillHighlights: Array<{ el: HTMLElement; timer: ReturnType<typeof setTimeout> }> = [];

export function highlightFilledField(field: FormField, duration = FILL_HIGHLIGHT_DURATION): void {
  injectFillHighlightStyles();
  const els = field.els.length > 0 ? field.els : [field.el];
  for (const el of els) {
    el.classList.add(FILL_HIGHLIGHT_CLASS);
    const timer = setTimeout(() => {
      el.classList.remove(FILL_HIGHLIGHT_CLASS);
      activeFillHighlights = activeFillHighlights.filter((h) => h.el !== el);
    }, duration);
    activeFillHighlights.push({ el, timer });
  }
  const first = els[0];
  if (first && typeof first.scrollIntoView === 'function') {
    first.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }
}

export function clearFillHighlights(): void {
  for (const h of activeFillHighlights) {
    h.el.classList.remove(FILL_HIGHLIGHT_CLASS);
    clearTimeout(h.timer);
  }
  activeFillHighlights = [];
}

function injectFillHighlightStyles(): void {
  if (typeof document === 'undefined') return;
  if (document.querySelector('[data-ai-form-fill-styles]')) return;
  const style = document.createElement('style');
  style.setAttribute('data-ai-form-fill-styles', '');
  style.textContent = `
    .${FILL_HIGHLIGHT_CLASS} {
      outline: 2px solid #22c55e !important;
      outline-offset: 2px !important;
      box-shadow: 0 0 0 4px rgba(34, 197, 94, 0.18) !important;
      transition: outline-color 0.3s ease, box-shadow 0.3s ease !important;
      animation: ai-form-fill-pulse 1.2s ease-in-out 1 !important;
    }
    @keyframes ai-form-fill-pulse {
      0% { box-shadow: 0 0 0 0 rgba(34, 197, 94, 0.45); }
      100% { box-shadow: 0 0 0 12px rgba(34, 197, 94, 0); }
    }
  `;
  document.head.appendChild(style);
}
