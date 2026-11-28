import { describe, expect, it } from 'vitest';
import {
  isEventInsideAssistantUi,
  shouldClosePanelOnOutsideMousedown,
} from './usePanelOutsideClose';

describe('usePanelOutsideClose', () => {
  it('closes open panel on primary mousedown outside assistant elements', () => {
    const wrapper = document.createElement('div');
    wrapper.className = 'ai-assistant-wrapper';
    const panel = document.createElement('div');
    panel.className = 'ai-panel';
    wrapper.appendChild(panel);

    const hostButton = document.createElement('button');
    document.body.append(wrapper, hostButton);

    const ev = new MouseEvent('mousedown', { button: 0, bubbles: true });
    Object.defineProperty(ev, 'target', { value: hostButton });

    expect(
      shouldClosePanelOnOutsideMousedown(ev, {
        isOpen: true,
        panelEl: panel,
        wrapperEl: wrapper,
      }),
    ).toBe(true);

    wrapper.remove();
    hostButton.remove();
  });

  it('does not close when clicking inside panel, teleported modals, or toasts', () => {
    const wrapper = document.createElement('div');
    wrapper.className = 'ai-assistant-wrapper';
    const panel = document.createElement('div');
    panel.className = 'ai-panel';
    const textarea = document.createElement('textarea');
    panel.appendChild(textarea);
    wrapper.appendChild(panel);

    const dialog = document.createElement('div');
    dialog.className = 'ai-personalize-overlay';
    const dialogInner = document.createElement('button');
    dialog.appendChild(dialogInner);

    const selBar = document.createElement('div');
    selBar.className = 'ai-page-sel-bar';
    const selBtn = document.createElement('button');
    selBar.appendChild(selBtn);

    document.body.append(wrapper, dialog, selBar);

    for (const target of [textarea, dialogInner, selBtn]) {
      const ev = new MouseEvent('mousedown', { button: 0, bubbles: true });
      Object.defineProperty(ev, 'target', { value: target });
      expect(isEventInsideAssistantUi(ev, panel, wrapper)).toBe(true);
      expect(
        shouldClosePanelOnOutsideMousedown(ev, {
          isOpen: true,
          panelEl: panel,
          wrapperEl: wrapper,
        }),
      ).toBe(false);
    }

    wrapper.remove();
    dialog.remove();
    selBar.remove();
  });

  it('does not close when right-clicking, closed, modal open, or transient popup dismissed', () => {
    const hostEl = document.createElement('div');
    document.body.appendChild(hostEl);

    const rightClick = new MouseEvent('mousedown', { button: 2, bubbles: true });
    Object.defineProperty(rightClick, 'target', { value: hostEl });
    expect(shouldClosePanelOnOutsideMousedown(rightClick, { isOpen: true })).toBe(false);

    const leftClick = new MouseEvent('mousedown', { button: 0, bubbles: true });
    Object.defineProperty(leftClick, 'target', { value: hostEl });
    expect(shouldClosePanelOnOutsideMousedown(leftClick, { isOpen: false })).toBe(false);
    expect(
      shouldClosePanelOnOutsideMousedown(leftClick, { isOpen: true, hasOpenModal: true }),
    ).toBe(false);
    expect(
      shouldClosePanelOnOutsideMousedown(leftClick, { isOpen: true, hadTransientPopup: true }),
    ).toBe(false);

    hostEl.remove();
  });
});
