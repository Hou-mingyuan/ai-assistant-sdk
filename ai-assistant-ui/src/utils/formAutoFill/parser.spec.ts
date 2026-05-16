import { describe, it, expect } from 'vitest';
import { parseFormData, parseFormDataAsTable, splitInlineSegments, unquote } from './parser';

describe('parseFormData', () => {
  it('parses single-line ASCII colon pairs', () => {
    const r = parseFormData('A: 234');
    expect(r).toEqual([{ key: 'A', value: '234', raw: 'A: 234' }]);
  });

  it('parses multi-line pairs with mixed separators', () => {
    const r = parseFormData('A: 234\nB = 1234\nC\t5678');
    expect(r.map((p) => `${p.key}=${p.value}`)).toEqual(['A=234', 'B=1234', 'C=5678']);
  });

  it('parses Chinese full-width colon', () => {
    const r = parseFormData('姓名：张三\n年龄：30');
    expect(r).toEqual([
      { key: '姓名', value: '张三', raw: '姓名：张三' },
      { key: '年龄', value: '30', raw: '年龄：30' },
    ]);
  });

  it('prefers colon over equals when both exist (value may contain equals)', () => {
    const r = parseFormData('Email: foo=bar@x.com');
    expect(r).toEqual([{ key: 'Email', value: 'foo=bar@x.com', raw: 'Email: foo=bar@x.com' }]);
  });

  it('parses ≥2 spaces as separator', () => {
    const r = parseFormData('Phone   13800000000\nName  Alice');
    expect(r.map((p) => `${p.key}=${p.value}`)).toEqual(['Phone=13800000000', 'Name=Alice']);
  });

  it('keeps single space inside key alone (no separator)', () => {
    const r = parseFormData('Customer Name: Alice');
    expect(r).toEqual([
      { key: 'Customer Name', value: 'Alice', raw: 'Customer Name: Alice' },
    ]);
  });

  it('parses inline multi-pair with comma/semicolon/pipe', () => {
    const r = parseFormData('A:1, B:2; C:3 | D:4');
    expect(r.map((p) => `${p.key}=${p.value}`)).toEqual(['A=1', 'B=2', 'C=3', 'D=4']);
  });

  it('parses Chinese full-width comma/semicolon as inline split', () => {
    const r = parseFormData('A：1，B：2；C：3');
    expect(r.map((p) => `${p.key}=${p.value}`)).toEqual(['A=1', 'B=2', 'C=3']);
  });

  it('preserves quoted commas inside value', () => {
    const r = parseFormData('A: 1, B: "hello, world", C: 3');
    expect(r.map((p) => `${p.key}=${p.value}`)).toEqual([
      'A=1',
      'B=hello, world',
      'C=3',
    ]);
  });

  it('strips wrapping single quotes', () => {
    const r = parseFormData("name: 'Alice'");
    expect(r[0]).toEqual({ key: 'name', value: 'Alice', raw: "name: 'Alice'" });
  });

  it('strips Chinese book quotes', () => {
    const r = parseFormData('备注: 「请联系」');
    expect(r[0]?.value).toBe('请联系');
  });

  it('ignores blank lines and lines without separator', () => {
    const r = parseFormData('\nA: 1\n\nthis is just narrative text\nB: 2');
    expect(r.map((p) => `${p.key}=${p.value}`)).toEqual(['A=1', 'B=2']);
  });

  it('ignores pair with empty key', () => {
    const r = parseFormData(': value');
    expect(r).toEqual([]);
  });

  it('ignores pair with empty value', () => {
    const r = parseFormData('A:');
    expect(r).toEqual([]);
  });

  it('truncates over-long values to maxValueLength', () => {
    const long = 'x'.repeat(5000);
    const r = parseFormData(`A: ${long}`, { maxValueLength: 100 });
    expect(r[0]!.value.length).toBeLessThanOrEqual(100);
  });

  it('returns [] for empty/non-string input', () => {
    expect(parseFormData('')).toEqual([]);
    // @ts-expect-error intentional bad input
    expect(parseFormData(null)).toEqual([]);
    // @ts-expect-error intentional bad input
    expect(parseFormData(undefined)).toEqual([]);
  });

  it('dedupes by last-wins by default', () => {
    const r = parseFormData('A: 1\nA: 2');
    expect(r).toEqual([{ key: 'A', value: '2', raw: 'A: 2' }]);
  });

  it('dedupes by first-wins when configured', () => {
    const r = parseFormData('A: 1\nA: 2', { duplicateKeyStrategy: 'first-wins' });
    expect(r).toEqual([{ key: 'A', value: '1', raw: 'A: 1' }]);
  });

  it('keeps all when configured', () => {
    const r = parseFormData('A: 1\nA: 2', { duplicateKeyStrategy: 'keep-all' });
    expect(r.map((p) => p.value)).toEqual(['1', '2']);
  });

  it('treats CRLF the same as LF', () => {
    const r = parseFormData('A: 1\r\nB: 2\r\n');
    expect(r.map((p) => `${p.key}=${p.value}`)).toEqual(['A=1', 'B=2']);
  });

  it('keeps Chinese comma inside value when only one pair on the line', () => {
    const r = parseFormData('备注: 高优客户，按 24h SLA 跟进');
    expect(r).toEqual([
      { key: '备注', value: '高优客户，按 24h SLA 跟进', raw: '备注: 高优客户，按 24h SLA 跟进' },
    ]);
  });

  it('keeps ASCII comma inside value when only one pair on the line', () => {
    const r = parseFormData('Address: 1 Main St, Apt 5, NY');
    expect(r).toEqual([
      { key: 'Address', value: '1 Main St, Apt 5, NY', raw: 'Address: 1 Main St, Apt 5, NY' },
    ]);
  });
});

describe('splitInlineSegments', () => {
  it('splits by comma/semicolon/pipe', () => {
    expect(splitInlineSegments('a; b, c | d')).toEqual(['a', ' b', ' c ', ' d']);
  });

  it('preserves quoted commas', () => {
    expect(splitInlineSegments('a, "b, c", d')).toEqual(['a', ' "b, c"', ' d']);
  });

  it('returns single segment when no separators', () => {
    expect(splitInlineSegments('just one line')).toEqual(['just one line']);
  });

  it('drops empty segments produced by trailing separators', () => {
    expect(splitInlineSegments('a;;b,')).toEqual(['a', 'b']);
  });
});

describe('parseFormDataAsTable', () => {
  it('parses TSV (header + 2 rows)', () => {
    const r = parseFormDataAsTable('姓名\t电话\t邮箱\n张三\t138\ta@x.com\n李四\t139\tb@x.com');
    expect(r).not.toBeNull();
    expect(r!.headers).toEqual(['姓名', '电话', '邮箱']);
    expect(r!.rows).toEqual([
      ['张三', '138', 'a@x.com'],
      ['李四', '139', 'b@x.com'],
    ]);
  });

  it('parses multi-space aligned table', () => {
    const r = parseFormDataAsTable(
      '姓名   电话         邮箱\n张三   13800000000  a@x.com\n李四   13900000000  b@x.com',
    );
    expect(r).not.toBeNull();
    expect(r!.headers).toEqual(['姓名', '电话', '邮箱']);
    expect(r!.rows[0]).toEqual(['张三', '13800000000', 'a@x.com']);
  });

  it('parses Markdown table (with separator row)', () => {
    const r = parseFormDataAsTable(
      '| name | phone |\n|---|---|\n| Alice | 138 |\n| Bob | 139 |',
    );
    expect(r).not.toBeNull();
    expect(r!.headers).toEqual(['name', 'phone']);
    expect(r!.rows).toEqual([
      ['Alice', '138'],
      ['Bob', '139'],
    ]);
  });

  it('parses CSV with quoted comma inside cell', () => {
    const r = parseFormDataAsTable(
      'name,address\nAlice,"123 Main St, Apt 5"\nBob,"42 Oak Ave"',
    );
    expect(r).not.toBeNull();
    expect(r!.headers).toEqual(['name', 'address']);
    expect(r!.rows[0]).toEqual(['Alice', '123 Main St, Apt 5']);
    expect(r!.rows[1]).toEqual(['Bob', '42 Oak Ave']);
  });

  it('returns null for fewer than 2 data rows', () => {
    expect(parseFormDataAsTable('a\tb\n1\t2')).toBeNull();
  });

  it('returns null for fewer than 2 columns', () => {
    expect(parseFormDataAsTable('a\n1\n2\n3')).toBeNull();
  });

  it('returns null for plain prose', () => {
    expect(parseFormDataAsTable('this is just one sentence\nand another\nand a third')).toBeNull();
  });

  it('returns null for empty / non-string input', () => {
    expect(parseFormDataAsTable('')).toBeNull();
    // @ts-expect-error intentional bad input
    expect(parseFormDataAsTable(null)).toBeNull();
  });

  it('rejects rows whose cell count diverges from header (strict)', () => {
    // Phase 2 strictness: every data row must have EXACTLY the same cell count
    // as the header. Otherwise multi-pair pastes (e.g. `city = guangzhou`)
    // would be mis-classified as a 1-cell table row.
    expect(parseFormDataAsTable('a\tb\tc\n1\t2\n3\t4\t5')).toBeNull();
    expect(parseFormDataAsTable('a\tb\n1\t2\t3\n4\t5')).toBeNull();
    expect(parseFormDataAsTable('a\tb\n1\t2\t3\n4\t5\t6')).toBeNull();
    // Both rows strictly match → still a table
    expect(parseFormDataAsTable('a\tb\n1\t2\n3\t4')).not.toBeNull();
  });

  it('honors minDataRows option', () => {
    expect(
      parseFormDataAsTable('a\tb\n1\t2\n3\t4', { minDataRows: 3 }),
    ).toBeNull();
  });
});

describe('unquote', () => {
  it('strips matching ASCII double quotes', () => {
    expect(unquote('"hi"')).toBe('hi');
  });
  it('strips matching ASCII single quotes', () => {
    expect(unquote("'hi'")).toBe('hi');
  });
  it('strips Chinese book quotes', () => {
    expect(unquote('「测试」')).toBe('测试');
  });
  it('leaves un-paired quotes intact', () => {
    expect(unquote('"hi')).toBe('"hi');
    expect(unquote('hi"')).toBe('hi"');
  });
  it('leaves nested quotes intact', () => {
    expect(unquote('"a"b"')).toBe('a"b');
  });
});
