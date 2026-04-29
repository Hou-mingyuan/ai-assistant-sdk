declare module '*.vue' {
  import type { DefineComponent } from 'vue';
  const component: DefineComponent<Record<string, never>, Record<string, never>, unknown>;
  export default component;
}

declare module 'html2canvas' {
  const html2canvas: (
    el: HTMLElement,
    opts?: Record<string, unknown>,
  ) => Promise<HTMLCanvasElement>;
  export default html2canvas;
}
