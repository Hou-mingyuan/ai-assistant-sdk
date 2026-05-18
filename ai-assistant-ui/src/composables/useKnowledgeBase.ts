/**
 * RAG / 知识库管理：上传文档、列表管理、选择激活的知识库。
 * 实际的向量化和检索由后端完成，前端负责 UI 和 payload 传递。
 */
import { ref, computed } from 'vue';

export interface KnowledgeDoc {
  id: string;
  name: string;
  size: number;
  uploadedAt: number;
  status: 'uploading' | 'indexing' | 'ready' | 'error';
}

export interface KnowledgeBase {
  id: string;
  name: string;
  docs: KnowledgeDoc[];
  createdAt: number;
  enabled: boolean;
}

const STORAGE_KEY = 'ai-assistant-knowledge-bases';
const MAX_BASES = 10;

function genId(): string {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
}

export function useKnowledgeBase(storageKey = STORAGE_KEY) {
  const bases = ref<KnowledgeBase[]>([]);
  let loaded = false;

  function load() {
    if (loaded) return;
    loaded = true;
    if (typeof window === 'undefined') return;
    try {
      const raw = localStorage.getItem(storageKey);
      if (!raw) return;
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        bases.value = parsed.slice(0, MAX_BASES);
      }
    } catch {
      /* ignore */
    }
  }

  function save() {
    load();
    try {
      localStorage.setItem(storageKey, JSON.stringify(bases.value.slice(0, MAX_BASES)));
    } catch {
      /* ignore */
    }
  }

  function createBase(name: string): KnowledgeBase {
    load();
    const kb: KnowledgeBase = {
      id: genId(),
      name: name.trim() || `知识库 ${bases.value.length + 1}`,
      docs: [],
      createdAt: Date.now(),
      enabled: true,
    };
    bases.value.unshift(kb);
    save();
    return kb;
  }

  function deleteBase(id: string) {
    load();
    bases.value = bases.value.filter((b) => b.id !== id);
    save();
  }

  function toggleBase(id: string) {
    load();
    const b = bases.value.find((kb) => kb.id === id);
    if (b) {
      b.enabled = !b.enabled;
      save();
    }
  }

  function addDoc(baseId: string, file: File): KnowledgeDoc {
    load();
    const doc: KnowledgeDoc = {
      id: genId(),
      name: file.name,
      size: file.size,
      uploadedAt: Date.now(),
      status: 'uploading',
    };
    const b = bases.value.find((kb) => kb.id === baseId);
    if (b) {
      b.docs.push(doc);
      save();
      simulateIndexing(baseId, doc.id);
    }
    return doc;
  }

  function removeDoc(baseId: string, docId: string) {
    load();
    const b = bases.value.find((kb) => kb.id === baseId);
    if (b) {
      b.docs = b.docs.filter((d) => d.id !== docId);
      save();
    }
  }

  function simulateIndexing(baseId: string, docId: string) {
    setTimeout(() => {
      load();
      const b = bases.value.find((kb) => kb.id === baseId);
      const d = b?.docs.find((doc) => doc.id === docId);
      if (d && d.status === 'uploading') {
        d.status = 'indexing';
        save();
        setTimeout(() => {
          if (d.status === 'indexing') {
            d.status = 'ready';
            save();
          }
        }, 2000);
      }
    }, 1000);
  }

  const enabledBaseNames = computed(() => {
    load();
    return bases.value
      .filter((b) => b.enabled && b.docs.some((d) => d.status === 'ready'))
      .map((b) => b.name);
  });

  const ragPromptFragment = computed(() => {
    const enabled = enabledBaseNames.value;
    if (enabled.length === 0) return '';
    return `[Knowledge Bases Active]\nThe following knowledge bases are enabled for RAG retrieval: ${enabled.join(', ')}\nPlease reference relevant documents when answering.\n`;
  });

  return {
    bases,
    createBase,
    deleteBase,
    toggleBase,
    addDoc,
    removeDoc,
    enabledBaseNames,
    ragPromptFragment,
  };
}
