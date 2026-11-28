import { computed, ref } from 'vue';

export type EdgeDockStyle =
  'handle-bar' | 'ear-clip' | 'ghost-hotzone' | 'eye-strip' | 'nap-lean' | 'halo-ring';

export interface EdgeDockStyleOption {
  id: EdgeDockStyle;
  titleZh: string;
  titleEn: string;
  descZh: string;
  descEn: string;
  tagZh: string;
  tagEn: string;
}

export const EDGE_DOCK_STYLE_KEY = 'ai-assistant-edge-dock-style-v1';

export const EDGE_DOCK_STYLES: ReadonlyArray<EdgeDockStyleOption> = [
  {
    id: 'handle-bar',
    titleZh: '方案 1 · 极简竖条耳',
    titleEn: '1 · Sleek Handle Bar',
    descZh: '收拢为 10px 微光细条，悬停瞬间展成正圆球',
    descEn: '10px glowing edge bar; expands to full orb on hover',
    tagZh: '零遮挡',
    tagEn: 'Zero-block',
  },
  {
    id: 'ear-clip',
    titleZh: '方案 2 · 半圆耳扣',
    titleEn: '2 · Ear Clip Tab',
    descZh: '贴边露半圆机器人徽章，点击丝滑弹成正圆球',
    descEn: '26px half-orb badge; pops into full sphere on click',
    tagZh: '高识别度',
    tagEn: 'Iconic',
  },
  {
    id: 'ghost-hotzone',
    titleZh: '方案 3 · 幽灵热区',
    titleEn: '3 · Ghost Hotzone',
    descZh: '静置半透低调隐身，光标靠近热区自动浮现',
    descEn: 'Subtle translucent hide; wakes on edge proximity',
    tagZh: '极简隐身',
    tagEn: 'Stealth',
  },
  {
    id: 'eye-strip',
    titleZh: '方案 4 · 细条双瞳',
    titleEn: '4 · Eye Strip Pod',
    descZh: '16px 窄条露眨眼双瞳，悬停现全身点击滚出',
    descEn: '16px strip with blinking eyes; rolls out on click',
    tagZh: '趣味萌动',
    tagEn: 'Playful',
  },
  {
    id: 'nap-lean',
    titleZh: '方案 5 · 打盹探头',
    titleEn: '5 · Nap Lean + Dot',
    descZh: '斜靠边缘带状态光点，悬停抬头眨眼醒来',
    descEn: 'Tilted edge lean with halo dot; perks up on hover',
    tagZh: '有状态灯',
    tagEn: 'Status dot',
  },
  {
    id: 'halo-ring',
    titleZh: '方案 6 · 极简光环',
    titleEn: '6 · Halo Arc Ring',
    descZh: '静置透亮钴蓝细弧环，悬停注满液态蓝光',
    descEn: 'Hollow translucent ring; fills with cobalt glow',
    tagZh: '轻量通透',
    tagEn: 'Airy',
  },
];

const VALID_STYLES = new Set<string>(EDGE_DOCK_STYLES.map((s) => s.id));

export function isValidEdgeDockStyle(value: unknown): value is EdgeDockStyle {
  return typeof value === 'string' && VALID_STYLES.has(value);
}

function readStoredEdgeDockStyle(storageKey: string): EdgeDockStyle | null {
  if (typeof window === 'undefined' || typeof localStorage === 'undefined') return null;
  try {
    const raw = localStorage.getItem(storageKey);
    return isValidEdgeDockStyle(raw) ? raw : null;
  } catch {
    return null;
  }
}

export function useEdgeDockStyle(initialStyle?: EdgeDockStyle, storageKey = EDGE_DOCK_STYLE_KEY) {
  const stored = readStoredEdgeDockStyle(storageKey);
  const fallback: EdgeDockStyle = isValidEdgeDockStyle(initialStyle) ? initialStyle : 'handle-bar';
  const edgeDockStyle = ref<EdgeDockStyle>(stored ?? fallback);

  function setEdgeDockStyle(next: EdgeDockStyle) {
    if (!isValidEdgeDockStyle(next)) return;
    edgeDockStyle.value = next;
    if (typeof window === 'undefined' || typeof localStorage === 'undefined') return;
    try {
      localStorage.setItem(storageKey, next);
    } catch {
      /* Ignore storage quota or sandbox failures. */
    }
  }

  const edgeDockStyleClass = computed(() => `dock-style-${edgeDockStyle.value}`);

  return {
    edgeDockStyle,
    setEdgeDockStyle,
    edgeDockStyleClass,
  };
}
