import { describe, expect, it, beforeEach } from 'vitest';

import {
  collectPageSnapshotMarkdown,
  isDirectPageSnapshotRequest,
  isPageSnapshotContextRequest,
} from './pageSnapshotDom';

describe('collectPageSnapshotMarkdown', () => {
  beforeEach(() => {
    document.title = '客户资料页';
    document.body.innerHTML = `
      <main>
        <h1>客户档案</h1>
        <p>用于维护客户合同和联系方式。</p>
        <label for="name">客户姓名</label>
        <input id="name" value="张三" />
        <label for="phone">电话</label>
        <input id="phone" value="13800000000" />
        <label for="token">API Token</label>
        <input id="token" name="apiToken" value="secret-token" />
        <label><input type="radio" name="gender" value="男" checked />男 / Male</label>
        <label><input type="checkbox" name="hobby" checked />系统</label>
        <select aria-label="城市"><option selected>广州</option></select>
        <button>保存</button>
        <a href="/formfill">表单填充 Demo</a>
      </main>
      <div class="ai-assistant-wrapper">
        <p>助手自己的内容不应该出现在快照里</p>
        <input aria-label="助手输入框" value="ignore me" />
      </div>
    `;
  });

  it('formats visible page text, form values, and actions', () => {
    const md = collectPageSnapshotMarkdown();

    expect(md).toContain('# 当前页面内容');
    expect(md).toContain('客户档案');
    expect(md).toContain('- 客户姓名: 张三');
    expect(md).toContain('- 电话: 13800000000');
    expect(md).toContain('- 城市: 广州');
    expect(md).toContain('- 男 / Male: 男');
    expect(md).toContain('- 系统: 已勾选');
    expect(md).toContain('- 保存');
    expect(md).toContain('表单填充 Demo');
  });

  it('hides sensitive field values and strips assistant DOM', () => {
    const md = collectPageSnapshotMarkdown();

    expect(md).toContain('- API Token: [已隐藏]');
    expect(md).not.toContain('secret-token');
    expect(md).not.toContain('助手自己的内容');
    expect(md).not.toContain('ignore me');
  });
});

describe('page snapshot intent detection', () => {
  it('detects direct page content requests', () => {
    expect(isDirectPageSnapshotRequest('当前页面有什么内容？')).toBe(true);
    expect(isDirectPageSnapshotRequest('/page')).toBe(true);
  });

  it('detects analysis requests that need page context', () => {
    expect(isPageSnapshotContextRequest('分析当前页面内容')).toBe(true);
  });
});
