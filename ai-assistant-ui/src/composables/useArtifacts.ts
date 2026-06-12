/**
 * Artifacts/Canvas 控制器（P1）。
 *
 * - current：当前在侧边 Canvas 打开的 artifact
 * - registry：按 id 归并的版本历史（同 id 内容变化即新增一版），供版本切换 + diff
 * - resend：把"编辑后重发"的提示词回灌给宿主的发送管线（由 AiAssistant 注入 handler）
 *
 * 由 AiAssistant.vue 创建并 provide；ArtifactCard inject 后 openArtifact，ArtifactCanvas 读取渲染。
 */
import { ref, computed, type InjectionKey, type Ref, type ComputedRef } from 'vue';
import type { Artifact } from '../types/message';

export interface ArtifactsController {
  current: Ref<Artifact | null>;
  currentVersions: ComputedRef<Artifact[]>;
  isOpen: ComputedRef<boolean>;
  openArtifact: (artifact: Artifact) => void;
  closeArtifact: () => void;
  registerArtifacts: (list: Artifact[] | undefined) => void;
  resend: (text: string) => void;
  setResendHandler: (fn: (text: string) => void) => void;
}

export const ARTIFACTS_KEY: InjectionKey<ArtifactsController> = Symbol('aiAssistantArtifacts');

export function useArtifacts(): ArtifactsController {
  const current = ref<Artifact | null>(null);
  /** id -> 版本数组（按出现顺序，末尾为最新）。 */
  const registry = ref<Record<string, Artifact[]>>({});
  let resendHandler: ((text: string) => void) | null = null;

  const isOpen = computed(() => current.value !== null);

  const currentVersions = computed<Artifact[]>(() => {
    const id = current.value?.id;
    if (!id) return current.value ? [current.value] : [];
    return registry.value[id] ?? (current.value ? [current.value] : []);
  });

  /** 归并版本：同 id 且内容和上一版不同 => 追加新版本。仅登记已完成的 artifact。 */
  function registerArtifacts(list: Artifact[] | undefined) {
    if (!list || list.length === 0) return;
    let changed = false;
    const next = { ...registry.value };
    for (const a of list) {
      if (a.status !== 'done') continue;
      const arr = next[a.id] ? [...next[a.id]!] : [];
      const last = arr[arr.length - 1];
      if (!last || last.content !== a.content) {
        arr.push(a);
        next[a.id] = arr;
        changed = true;
      }
    }
    if (changed) registry.value = next;
  }

  function openArtifact(artifact: Artifact) {
    registerArtifacts([artifact]);
    current.value = artifact;
  }

  function closeArtifact() {
    current.value = null;
  }

  function resend(text: string) {
    resendHandler?.(text);
  }

  function setResendHandler(fn: (text: string) => void) {
    resendHandler = fn;
  }

  return {
    current,
    currentVersions,
    isOpen,
    openArtifact,
    closeArtifact,
    registerArtifacts,
    resend,
    setResendHandler,
  };
}
