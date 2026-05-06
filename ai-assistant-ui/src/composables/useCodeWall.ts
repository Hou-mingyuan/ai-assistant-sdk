import { ref, type Ref } from 'vue';

interface CodeWallCell {
  char: string;
  color: string;
  targetColor: string;
  progress: number;
}

const TOKENS = [
  ...'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789{}[]()<>/+=-_*#$',
  'AI',
  'CODE',
];
const COLORS = [
  'rgba(75, 210, 128, 0.56)',
  'rgba(30, 165, 94, 0.48)',
  'rgba(126, 222, 156, 0.36)',
  'rgba(0, 220, 120, 0.42)',
  'rgba(178, 238, 194, 0.28)',
];
const CELL_W = 15;
const CELL_H = 18;
const TICK_MS = 50;
const MUTATION_RATIO = 0.08;

export function useCodeWall(
  canvasRef: Ref<HTMLCanvasElement | undefined>,
  panelRef: Ref<HTMLElement | undefined>,
  reducedMotion: Ref<boolean>,
  pageVisible: Ref<boolean>,
) {
  const disabled = ref(false);

  let cells: CodeWallCell[] = [];
  let grid = { columns: 0, rows: 0 };
  let raf = 0;
  let lastTick = 0;
  let observer: ResizeObserver | null = null;

  function shouldAnimate() {
    return !disabled.value && !reducedMotion.value && pageVisible.value;
  }

  function pickToken() {
    return TOKENS[Math.floor(Math.random() * TOKENS.length)] || 'AI';
  }

  function pickColor() {
    return COLORS[Math.floor(Math.random() * COLORS.length)] || 'rgba(75, 210, 128, 0.42)';
  }

  function createCell(): CodeWallCell {
    const c = pickColor();
    return { char: pickToken(), color: c, targetColor: c, progress: Math.random() };
  }

  function rebuildCells(cols: number, rows: number) {
    const n = cols * rows;
    if (n <= 0) { cells = []; return; }
    if (cells.length === n) return;
    cells = Array.from({ length: n }, () => createCell());
  }

  function resize() {
    const canvas = canvasRef.value;
    const panel = panelRef.value;
    if (!canvas || !panel) return;
    const w = Math.max(1, Math.ceil(panel.clientWidth || panel.offsetWidth));
    const h = Math.max(1, Math.ceil(panel.clientHeight || panel.offsetHeight));
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const cw = Math.ceil(w * dpr);
    const ch = Math.ceil(h * dpr);
    if (canvas.width !== cw || canvas.height !== ch) {
      canvas.width = cw;
      canvas.height = ch;
      canvas.style.width = `${w}px`;
      canvas.style.height = `${h}px`;
    }
    const cols = Math.ceil(w / CELL_W);
    const rows = Math.ceil(h / CELL_H);
    if (cols !== grid.columns || rows !== grid.rows) {
      grid = { columns: cols, rows };
      rebuildCells(cols, rows);
    }
    const ctx = canvas.getContext('2d');
    ctx?.setTransform(dpr, 0, 0, dpr, 0, 0);
    paint();
  }

  function mutate() {
    if (!cells.length) return;
    const n = Math.max(1, Math.floor(cells.length * MUTATION_RATIO));
    for (let i = 0; i < n; i++) {
      const cell = cells[Math.floor(Math.random() * cells.length)];
      if (!cell) continue;
      cell.char = pickToken();
      cell.targetColor = pickColor();
      cell.progress = 0;
    }
  }

  function paint() {
    const canvas = canvasRef.value;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx || !grid.columns || !grid.rows) return;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const w = canvas.width / dpr;
    const h = canvas.height / dpr;
    ctx.clearRect(0, 0, w, h);
    ctx.font = '700 11px ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", monospace';
    ctx.textBaseline = 'middle';
    for (let r = 0; r < grid.rows; r++) {
      for (let c = 0; c < grid.columns; c++) {
        const cell = cells[r * grid.columns + c];
        if (!cell) continue;
        if (cell.progress < 1) {
          cell.progress = Math.min(1, cell.progress + 0.22);
          if (cell.progress === 1) cell.color = cell.targetColor;
        }
        ctx.fillStyle = cell.progress < 1 ? cell.targetColor : cell.color;
        ctx.shadowColor = cell.targetColor;
        ctx.shadowBlur = cell.progress < 1 ? 8 : 3;
        ctx.globalAlpha = cell.progress < 1 ? 0.44 + cell.progress * 0.24 : 0.44;
        ctx.fillText(cell.char, c * CELL_W + 3, r * CELL_H + 9);
      }
    }
    ctx.globalAlpha = 1;
    ctx.shadowBlur = 0;
  }

  function tick(ts: number) {
    if (!shouldAnimate()) { raf = 0; return; }
    raf = requestAnimationFrame(tick);
    if (ts - lastTick < TICK_MS) return;
    lastTick = ts;
    mutate();
    paint();
  }

  function stop() {
    if (raf) { cancelAnimationFrame(raf); raf = 0; }
    lastTick = 0;
    observer?.disconnect();
    observer = null;
  }

  function start() {
    const panel = panelRef.value;
    const canvas = canvasRef.value;
    if (!panel || !canvas) return;
    if (disabled.value) { canvas.style.display = 'none'; return; }
    canvas.style.display = '';
    stop();
    resize();
    if (typeof ResizeObserver !== 'undefined') {
      observer = new ResizeObserver(() => resize());
      observer.observe(panel);
    }
    if (!shouldAnimate()) return;
    raf = requestAnimationFrame(tick);
  }

  return { disabled, start, stop };
}
