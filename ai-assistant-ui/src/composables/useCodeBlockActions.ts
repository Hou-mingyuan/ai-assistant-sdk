import type { ComputedRef, Ref } from 'vue';

import {
  findCodeElementForCodeActionTarget,
  getCodeLanguage,
  updateCodeActionButtonLabel,
  updateCodeCopyFailureState,
  updateCodeFoldToggleState,
} from '../utils/codeBlockDom';

interface CodeBlockActionLabels {
  msgCtxCompareSetFull?: string;
  codeFold?: string;
  codeUnfold?: string;
  codeCopied?: string;
  copyCode?: string;
  diagnosticsCopyFailed?: string;
}

interface UseCodeBlockActionsDeps<TMessage> {
  messages: Ref<TMessage[]>;
  compareSet: Ref<readonly unknown[]>;
  maxCompareSides: number;
  markCompare: (msgIndex: number, codeText: string) => void;
  openCodeInIde?: (payload: { code: string; language?: string }) => void;
  t: ComputedRef<CodeBlockActionLabels>;
  setToast: (text: string, ms: number) => void;
  pendingTimers?: number[];
  setTimeoutFn?: (cb: () => void, ms: number) => number;
  clipboardWrite?: (text: string) => Promise<void>;
}

function defaultSetTimeout(cb: () => void, ms: number) {
  return window.setTimeout(cb, ms);
}

function defaultClipboardWrite(text: string) {
  return navigator.clipboard.writeText(text);
}

function closestHtmlAction(target: Element, selector: string): HTMLElement | null {
  return target.closest(selector) as HTMLElement | null;
}

export function useCodeBlockActions<TMessage>(deps: UseCodeBlockActionsDeps<TMessage>) {
  const setTimeoutFn = deps.setTimeoutFn ?? defaultSetTimeout;
  const clipboardWrite = deps.clipboardWrite ?? defaultClipboardWrite;

  function scheduleCopyLabelReset(target: HTMLElement) {
    const timerId = setTimeoutFn(() => {
      updateCodeActionButtonLabel(target, deps.t.value.copyCode || 'Copy');
    }, 1500);
    deps.pendingTimers?.push(timerId);
  }

  function handleCompareClick(event: MouseEvent, cmpBtn: HTMLElement) {
    event.preventDefault();
    event.stopPropagation();
    const msgIdxRaw = cmpBtn.getAttribute('data-ai-cmp-msg');
    const msgIdx = msgIdxRaw != null ? parseInt(msgIdxRaw, 10) : -1;
    const codeText = findCodeElementForCodeActionTarget(cmpBtn)?.textContent ?? '';
    const message = msgIdx >= 0 ? deps.messages.value[msgIdx] : undefined;
    if (!message || !codeText.trim()) return true;

    if (deps.compareSet.value.length >= deps.maxCompareSides) {
      deps.setToast(deps.t.value.msgCtxCompareSetFull || 'Compare set is full (max 4)', 2400);
      return true;
    }

    deps.markCompare(msgIdx, codeText);
    cmpBtn.classList.add('ai-code-cmp-btn-added');
    setTimeoutFn(() => cmpBtn.classList.remove('ai-code-cmp-btn-added'), 1000);
    return true;
  }

  function handleBodyClick(event: MouseEvent): boolean {
    const eventTarget = event.target;
    if (!(eventTarget instanceof Element)) return false;

    const cmpBtn = closestHtmlAction(eventTarget, '.ai-code-cmp-btn');
    if (cmpBtn) return handleCompareClick(event, cmpBtn);

    const ideTarget = closestHtmlAction(eventTarget, '[data-ide="true"]');
    if (ideTarget) {
      const codeEl = findCodeElementForCodeActionTarget(ideTarget);
      const code = codeEl?.textContent || '';
      deps.openCodeInIde?.({ code, language: getCodeLanguage(codeEl) });
      return true;
    }

    const foldTarget = closestHtmlAction(eventTarget, '[data-fold-toggle="true"]');
    if (foldTarget) {
      const wrap = foldTarget.closest('.ai-code-wrap');
      if (wrap) {
        const isFolded = wrap.classList.toggle('ai-code-folded');
        updateCodeFoldToggleState(
          foldTarget,
          isFolded,
          deps.t.value.codeFold || 'Fold',
          deps.t.value.codeUnfold || 'Unfold',
        );
      }
      return true;
    }

    const copyTarget = closestHtmlAction(eventTarget, '[data-copy="true"]');
    if (copyTarget) {
      const code = findCodeElementForCodeActionTarget(copyTarget)?.textContent || '';
      clipboardWrite(code)
        .then(() => {
          updateCodeActionButtonLabel(copyTarget, deps.t.value.codeCopied || 'Copied');
          scheduleCopyLabelReset(copyTarget);
        })
        .catch(() => {
          updateCodeCopyFailureState(
            copyTarget,
            deps.t.value.diagnosticsCopyFailed || 'Copy failed',
          );
          scheduleCopyLabelReset(copyTarget);
        });
      return true;
    }

    return false;
  }

  return {
    handleBodyClick,
  };
}
