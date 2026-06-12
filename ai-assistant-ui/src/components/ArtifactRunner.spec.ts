/**
 * ArtifactRunner P2 增强的组件级测试：
 *  - 工具条「↗ 新标签」按钮存在，点击用渲染后的自包含 HTML 调 window.open；
 *  - 沙箱回传 error 日志后，顶部出现「运行出错」友好横幅并显示首条错误；
 *  - 点击横幅「查看控制台」会展开控制台并隐藏横幅。
 *
 * 沙箱日志通过 postMessage 回传，channelId 是组件内部随机串；这里从 iframe 的
 * srcdoc 中取出真实 channelId，再派发 message 事件来精确模拟，避免依赖真实 iframe 执行。
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { mount, type VueWrapper } from '@vue/test-utils';
import { nextTick } from 'vue';
import ArtifactRunner from './ArtifactRunner.vue';
import type { Artifact } from '../types/message';

const reactArtifact: Artifact = {
  id: 'r1',
  type: 'react',
  title: 'Demo 组件',
  content: 'function App(){ return <div>hi</div>; }',
  status: 'done',
};

function channelIdOf(wrapper: VueWrapper): string {
  const srcdoc = wrapper.find('iframe').attributes('srcdoc') || '';
  return srcdoc.match(/airun-[a-z0-9]+/)?.[0] ?? '';
}

function emitLog(channelId: string, level: string, text: string) {
  window.dispatchEvent(new MessageEvent('message', { data: { __airun: channelId, level, text } }));
}

describe('ArtifactRunner P2 增强', () => {
  beforeEach(() => {
    // jsdom 未实现 createObjectURL / open，按需 stub
    (URL as unknown as { createObjectURL: unknown }).createObjectURL = vi.fn(() => 'blob:mock');
    (URL as unknown as { revokeObjectURL: unknown }).revokeObjectURL = vi.fn();
  });

  it('工具条包含「新标签」打开按钮', () => {
    const wrapper = mount(ArtifactRunner, { props: { artifact: reactArtifact } });
    expect(wrapper.findAll('button').some((b) => b.text().includes('新标签'))).toBe(true);
  });

  it('点击「新标签」用渲染后的 HTML 调 window.open', async () => {
    const openSpy = vi.fn();
    (window as unknown as { open: unknown }).open = openSpy;
    const wrapper = mount(ArtifactRunner, { props: { artifact: reactArtifact } });
    const btn = wrapper.findAll('button').find((b) => b.text().includes('新标签'));
    await btn?.trigger('click');
    expect(openSpy).toHaveBeenCalledTimes(1);
    expect(
      (URL as unknown as { createObjectURL: ReturnType<typeof vi.fn> }).createObjectURL,
    ).toHaveBeenCalled();
  });

  it('默认无错误横幅；收到 error 日志后显示「运行出错」横幅与首条错误', async () => {
    const wrapper = mount(ArtifactRunner, { props: { artifact: reactArtifact } });
    expect(wrapper.find('.ai-artifact-runner-error').exists()).toBe(false);

    const cid = channelIdOf(wrapper);
    expect(cid).toMatch(/^airun-/);
    emitLog(cid, 'error', 'ReferenceError: boom is not defined');
    await nextTick();

    expect(wrapper.find('.ai-artifact-runner-error').exists()).toBe(true);
    expect(wrapper.text()).toContain('运行出错');
    expect(wrapper.text()).toContain('boom is not defined');
  });

  it('点击「查看控制台」展开控制台并隐藏横幅', async () => {
    const wrapper = mount(ArtifactRunner, { props: { artifact: reactArtifact } });
    emitLog(channelIdOf(wrapper), 'error', 'boom');
    await nextTick();

    const link = wrapper.findAll('button').find((b) => b.text().includes('查看控制台'));
    await link?.trigger('click');
    await nextTick();

    expect(wrapper.find('.ai-artifact-runner-error').exists()).toBe(false);
    expect(wrapper.find('.ai-artifact-console-body').exists()).toBe(true);
  });
});
