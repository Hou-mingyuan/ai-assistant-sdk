export function findCodeElementForCodeActionTarget(target: HTMLElement): HTMLElement | null {
  const wrap = target.closest('.ai-code-wrap');
  const pre = wrap?.querySelector('pre') ?? target.closest('pre');
  return (pre?.querySelector('code') as HTMLElement | null) ?? null;
}

export function getCodeLanguage(codeEl: Element | null | undefined): string | undefined {
  const cls = codeEl?.className || '';
  return cls.match(/language-([\w+-]+)/)?.[1];
}

export function updateCodeFoldToggleState(
  button: HTMLElement,
  isFolded: boolean,
  foldLabel: string,
  unfoldLabel: string,
) {
  const label = isFolded ? unfoldLabel : foldLabel;
  button.setAttribute('aria-expanded', isFolded ? 'false' : 'true');
  button.setAttribute('aria-label', label);
  button.textContent = label;
}

export function updateCodeActionButtonLabel(button: HTMLElement, label: string) {
  button.setAttribute('aria-label', label);
  button.textContent = label;
}
