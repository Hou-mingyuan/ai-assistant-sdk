// @vitest-environment jsdom
import { describe, it, expect, beforeEach } from 'vitest';
import { scanFormFields, scanFormRows } from './scanner';

function mount(html: string): HTMLDivElement {
  const host = document.createElement('div');
  host.innerHTML = html;
  document.body.appendChild(host);
  return host;
}

describe('scanFormFields', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
  });

  it('collects basic text inputs with labels via <label for>', () => {
    mount(`
      <form>
        <label for="username">Username</label>
        <input id="username" type="text" />
        <label for="age">Age</label>
        <input id="age" type="number" />
      </form>
    `);
    const fields = scanFormFields();
    expect(fields).toHaveLength(2);
    expect(fields[0]!.labels).toContain('Username');
    expect(fields[1]!.labels).toContain('Age');
    expect(fields[0]!.type).toBe('text');
    expect(fields[1]!.type).toBe('number');
  });

  it('falls back to placeholder/name/id when no <label>', () => {
    mount(`
      <input id="email" name="email_field" placeholder="邮箱地址" />
    `);
    const fields = scanFormFields();
    expect(fields).toHaveLength(1);
    const labels = fields[0]!.labels;
    expect(labels).toContain('email');
    expect(labels).toContain('email_field');
    expect(labels).toContain('邮箱地址');
  });

  it('reads aria-label and aria-labelledby', () => {
    mount(`
      <span id="lbl1">Customer Name</span>
      <input aria-labelledby="lbl1" />
      <input aria-label="Phone Number" />
    `);
    const fields = scanFormFields();
    expect(fields[0]!.labels).toContain('Customer Name');
    expect(fields[1]!.labels).toContain('Phone Number');
  });

  it('respects data-ai-field as highest-priority label', () => {
    mount(`<input data-ai-field="客户姓名" name="cname" />`);
    const fields = scanFormFields();
    expect(fields[0]!.labels).toContain('客户姓名');
  });

  it('skips hidden / submit / button / reset / file', () => {
    mount(`
      <input type="hidden" name="csrf" />
      <input type="submit" name="go" />
      <input type="button" name="x" />
      <input type="reset" name="r" />
      <input type="file" name="f" />
      <input type="text" name="real" />
    `);
    const fields = scanFormFields();
    expect(fields).toHaveLength(1);
    expect(fields[0]!.labels).toContain('real');
  });

  it('skips disabled and readOnly fields', () => {
    mount(`
      <input type="text" name="a" disabled />
      <input type="text" name="b" readonly />
      <input type="text" name="c" />
    `);
    const fields = scanFormFields();
    expect(fields).toHaveLength(1);
    expect(fields[0]!.labels).toContain('c');
  });

  it('skips fields with data-ai-fill-ignore', () => {
    mount(`
      <input type="text" name="a" data-ai-fill-ignore />
      <input type="text" name="b" />
    `);
    const fields = scanFormFields();
    expect(fields).toHaveLength(1);
    expect(fields[0]!.labels).toContain('b');
  });

  it('skips assistant wrapper by default', () => {
    mount(`
      <div class="ai-assistant-wrapper">
        <textarea name="ai-input"></textarea>
      </div>
      <input name="real-input" />
    `);
    const fields = scanFormFields();
    expect(fields).toHaveLength(1);
    expect(fields[0]!.labels).toContain('real-input');
  });

  it('limits scope to [data-ai-fillable] subtrees when present', () => {
    mount(`
      <input name="outside" />
      <form data-ai-fillable>
        <input name="inside-a" />
        <input name="inside-b" />
      </form>
    `);
    const fields = scanFormFields();
    expect(fields.map((f) => f.labels[0])).toEqual(['inside-a', 'inside-b']);
  });

  it('honors excludeSelectors', () => {
    mount(`
      <input name="search-box" class="global-search" />
      <input name="real" />
    `);
    const fields = scanFormFields({ excludeSelectors: ['.global-search'] });
    expect(fields).toHaveLength(1);
    expect(fields[0]!.labels).toContain('real');
  });

  it('groups radio inputs by name', () => {
    mount(`
      <fieldset>
        <legend>Gender</legend>
        <label><input type="radio" name="gender" value="m" />Male</label>
        <label><input type="radio" name="gender" value="f" />Female</label>
      </fieldset>
    `);
    const fields = scanFormFields();
    const radio = fields.find((f) => f.type === 'radio');
    expect(radio).toBeDefined();
    expect(radio!.options.map((o) => o.value)).toEqual(['m', 'f']);
    expect(radio!.options.map((o) => o.label)).toEqual(['Male', 'Female']);
    expect(radio!.els).toHaveLength(2);
  });

  it('groups checkboxes by name and joins current values', () => {
    mount(`
      <label><input type="checkbox" name="hobby" value="a" checked />A</label>
      <label><input type="checkbox" name="hobby" value="b" checked />B</label>
      <label><input type="checkbox" name="hobby" value="c" />C</label>
    `);
    const fields = scanFormFields();
    const cb = fields.find((f) => f.type === 'checkbox');
    expect(cb).toBeDefined();
    expect(cb!.options).toHaveLength(3);
    expect(cb!.currentValue).toBe('a,b');
  });

  it('reads <select> options and current value', () => {
    mount(`
      <label for="city">City</label>
      <select id="city">
        <option value="bj">Beijing</option>
        <option value="sh" selected>Shanghai</option>
      </select>
    `);
    const fields = scanFormFields();
    const sel = fields[0]!;
    expect(sel.type).toBe('select');
    expect(sel.options.map((o) => o.value)).toEqual(['bj', 'sh']);
    expect(sel.currentValue).toBe('sh');
  });

  it('reads textarea type and value', () => {
    const host = mount(`<textarea name="remark">hi</textarea>`);
    const fields = scanFormFields();
    expect(fields[0]!.type).toBe('textarea');
    expect(fields[0]!.currentValue).toBe('hi');
    host.remove();
  });

  it('falls back to th / dt label when no other label found', () => {
    mount(`
      <table>
        <tr>
          <th>合同编号</th>
          <td><input name="contract_no" /></td>
        </tr>
      </table>
      <dl>
        <dt>项目名</dt>
        <dd><input name="proj" /></dd>
      </dl>
    `);
    const fields = scanFormFields();
    const contract = fields.find((f) => (f.el as HTMLInputElement).name === 'contract_no');
    expect(contract!.labels).toContain('合同编号');
    const proj = fields.find((f) => (f.el as HTMLInputElement).name === 'proj');
    expect(proj!.labels).toContain('项目名');
  });

  it('reads UI-library label wrappers (.el-form-item__label etc.)', () => {
    mount(`
      <div class="el-form-item">
        <label class="el-form-item__label">订单号</label>
        <div class="el-form-item__content">
          <input name="order_no" />
        </div>
      </div>
    `);
    const fields = scanFormFields();
    expect(fields[0]!.labels).toContain('订单号');
  });

  it('returns empty array when no scannable fields', () => {
    document.body.innerHTML = '';
    expect(scanFormFields()).toEqual([]);
  });
});

describe('scanFormRows', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
  });

  it('returns rows matching [data-ai-fillable-row]', () => {
    const host = document.createElement('div');
    host.innerHTML = `
      <table>
        <tr data-ai-fillable-row="row-1">
          <td><input name="name" /></td>
          <td><input name="phone" /></td>
        </tr>
        <tr data-ai-fillable-row="row-2">
          <td><input name="name" /></td>
          <td><input name="phone" /></td>
        </tr>
      </table>
    `;
    document.body.appendChild(host);
    const rows = scanFormRows();
    expect(rows).toHaveLength(2);
    expect(rows[0]!.rowId).toBe('row-1');
    expect(rows[0]!.fields).toHaveLength(2);
    expect(rows[1]!.rowId).toBe('row-2');
  });

  it('falls back to auto-generated rowId when attribute value is empty', () => {
    const host = document.createElement('div');
    host.innerHTML = `
      <div data-ai-fillable-row>
        <input name="x" />
      </div>
      <div data-ai-fillable-row>
        <input name="y" />
      </div>
    `;
    document.body.appendChild(host);
    const rows = scanFormRows();
    expect(rows).toHaveLength(2);
    expect(rows[0]!.rowId).toMatch(/^__row_/);
    expect(rows[1]!.rowId).toMatch(/^__row_/);
    expect(rows[0]!.rowId).not.toBe(rows[1]!.rowId);
  });

  it('returns empty array when no row containers found', () => {
    const host = document.createElement('div');
    host.innerHTML = `<input name="standalone" />`;
    document.body.appendChild(host);
    expect(scanFormRows()).toEqual([]);
  });

  it('skips rows with no fields', () => {
    const host = document.createElement('div');
    host.innerHTML = `
      <div data-ai-fillable-row><span>just text</span></div>
      <div data-ai-fillable-row><input name="x" /></div>
    `;
    document.body.appendChild(host);
    const rows = scanFormRows();
    expect(rows).toHaveLength(1);
  });

  it('does not double-count nested row containers', () => {
    const host = document.createElement('div');
    host.innerHTML = `
      <div data-ai-fillable-row="outer">
        <input name="a" />
        <div data-ai-fillable-row="inner">
          <input name="b" />
        </div>
      </div>
    `;
    document.body.appendChild(host);
    const rows = scanFormRows();
    expect(rows).toHaveLength(1);
    expect(rows[0]!.rowId).toBe('outer');
    // outer 容器扫描时会包含 inner 里的 'b'，这是符合预期的（最外层收编全部字段）
    expect(rows[0]!.fields.map((f) => (f.el as HTMLInputElement).name).sort()).toEqual(['a', 'b']);
  });

  it('honors custom rowSelector', () => {
    const host = document.createElement('div');
    host.innerHTML = `
      <li class="kb-row"><input name="a" /></li>
      <li class="kb-row"><input name="b" /></li>
      <li><input name="ignored" /></li>
    `;
    document.body.appendChild(host);
    const rows = scanFormRows({ rowSelector: '.kb-row' });
    expect(rows).toHaveLength(2);
    expect(rows[0]!.fields.map((f) => (f.el as HTMLInputElement).name)).toEqual(['a']);
  });
});
