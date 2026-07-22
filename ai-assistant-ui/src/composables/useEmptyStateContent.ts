import { computed, type ComputedRef, type Ref } from 'vue';
import type { Locale } from '../utils/i18n';
import type { AssistantIconName } from '../utils/assistantIcons';

/**
 * Refactor (T1)：原本在 AiAssistant.vue 里直接堆放的 4 语言空状态文案
 *（skill chips / starter cards / capability hints）抽到这里。
 *
 * 这些数据是纯函数化的查表 + i18n，没有副作用，独立 composable 后：
 * - 主组件减少 ~330 行；
 * - skill/starter 文案改动可以独立修订，不影响其它编排；
 * - 单测可以直接 import 这个 composable 验证 4 语言 fallback。
 */

export interface EmptySkillChip {
  icon: AssistantIconName;
  label: string;
  prompt: string;
  tone: 'violet' | 'cyan' | 'amber' | 'emerald' | 'rose' | 'sky';
}

export interface EmptyStarterCard {
  icon: AssistantIconName;
  title: string;
  desc: string;
  prompt: string;
  tone: 'violet' | 'cyan' | 'amber' | 'emerald' | 'rose' | 'sky';
}

export interface EmptyCapabilityHint {
  icon: AssistantIconName;
  label: string;
}

interface UseEmptyStateContentOptions {
  locale: ComputedRef<Locale | undefined> | Ref<Locale | undefined>;
  mode: Ref<'translate' | 'summarize' | 'chat'>;
}

// The locale tables are intentionally colocated so labels, prompts, and tones stay in sync.
// eslint-disable-next-line max-lines-per-function
export function useEmptyStateContent(opts: UseEmptyStateContentOptions) {
  const { locale, mode } = opts;

  const defaultSkills = computed<EmptySkillChip[]>(() => {
    const loc = (locale.value ?? 'en') as Locale;
    const lib: Record<Locale, EmptySkillChip[]> = {
      zh: [
        { icon: 'pen-line', label: '写作', tone: 'violet', prompt: '帮我写一段关于 ' },
        { icon: 'languages', label: '翻译', tone: 'cyan', prompt: '把这段翻译成中文：' },
        {
          icon: 'chart-no-axes-combined',
          label: '分析',
          tone: 'sky',
          prompt: '帮我分析这份数据：',
        },
        { icon: 'lightbulb', label: '灵感', tone: 'amber', prompt: '给我一些关于 ' },
        { icon: 'code-xml', label: '编程', tone: 'emerald', prompt: '帮我写一段实现 ' },
        { icon: 'file-text', label: '总结', tone: 'rose', prompt: '帮我总结一下：' },
      ],
      en: [
        {
          icon: 'pen-line',
          label: 'Write',
          tone: 'violet',
          prompt: 'Help me write a draft about ',
        },
        {
          icon: 'languages',
          label: 'Translate',
          tone: 'cyan',
          prompt: 'Translate this into English: ',
        },
        {
          icon: 'chart-no-axes-combined',
          label: 'Analyze',
          tone: 'sky',
          prompt: 'Help me analyze this data: ',
        },
        { icon: 'lightbulb', label: 'Ideas', tone: 'amber', prompt: 'Give me some ideas about ' },
        { icon: 'code-xml', label: 'Code', tone: 'emerald', prompt: 'Write code to ' },
        { icon: 'file-text', label: 'Summary', tone: 'rose', prompt: 'Summarize this for me: ' },
      ],
      ja: [
        { icon: 'pen-line', label: '文章', tone: 'violet', prompt: '〜について書いてください：' },
        { icon: 'languages', label: '翻訳', tone: 'cyan', prompt: 'この文を翻訳してください：' },
        {
          icon: 'chart-no-axes-combined',
          label: '分析',
          tone: 'sky',
          prompt: 'このデータを分析してください：',
        },
        { icon: 'lightbulb', label: 'アイデア', tone: 'amber', prompt: '〜に関するアイデアを：' },
        { icon: 'code-xml', label: 'コード', tone: 'emerald', prompt: '〜を実装するコードを：' },
        { icon: 'file-text', label: '要約', tone: 'rose', prompt: '要約してください：' },
      ],
      ko: [
        { icon: 'pen-line', label: '글쓰기', tone: 'violet', prompt: '〜에 대해 써 주세요: ' },
        { icon: 'languages', label: '번역', tone: 'cyan', prompt: '이 문장을 번역해 주세요: ' },
        {
          icon: 'chart-no-axes-combined',
          label: '분석',
          tone: 'sky',
          prompt: '이 데이터를 분석해 주세요: ',
        },
        { icon: 'lightbulb', label: '아이디어', tone: 'amber', prompt: '〜에 대한 아이디어: ' },
        { icon: 'code-xml', label: '코드', tone: 'emerald', prompt: '〜를 구현하는 코드: ' },
        { icon: 'file-text', label: '요약', tone: 'rose', prompt: '요약해 주세요: ' },
      ],
    };
    return lib[loc] ?? lib.en;
  });

  const defaultStartersRich = computed<EmptyStarterCard[]>(() => {
    const loc = (locale.value ?? 'en') as Locale;
    const lib: Record<Locale, EmptyStarterCard[]> = {
      zh: [
        {
          icon: 'briefcase-business',
          title: '写一封商务邮件',
          desc: '正式得体、要点清晰',
          prompt: '帮我写一封商务邮件，主题是：',
          tone: 'violet',
        },
        {
          icon: 'brain',
          title: '解释一个概念',
          desc: '通俗易懂、举例说明',
          prompt: '用通俗的话解释一下什么是 ',
          tone: 'cyan',
        },
        {
          icon: 'languages',
          title: '翻译成英文',
          desc: '保留语气，自然地道',
          prompt: '把这段中文翻译成自然的英文：',
          tone: 'amber',
        },
        {
          icon: 'book-open',
          title: '推荐 3 本科幻小说',
          desc: '附简短理由和难度',
          prompt: '给我推荐 3 本好看的科幻小说，并简要说明每本的看点。',
          tone: 'emerald',
        },
      ],
      en: [
        {
          icon: 'briefcase-business',
          title: 'Write a business email',
          desc: 'Polished tone, clear points',
          prompt: 'Help me draft a business email about ',
          tone: 'violet',
        },
        {
          icon: 'brain',
          title: 'Explain a concept',
          desc: 'Plain language, with examples',
          prompt: 'Explain in plain words what ',
          tone: 'cyan',
        },
        {
          icon: 'languages',
          title: 'Translate to Chinese',
          desc: 'Natural, tone-preserving',
          prompt: 'Translate the following into natural Chinese: ',
          tone: 'amber',
        },
        {
          icon: 'book-open',
          title: 'Recommend 3 sci-fi novels',
          desc: 'With short reasons',
          prompt: 'Recommend 3 great sci-fi novels with a one-line reason for each.',
          tone: 'emerald',
        },
      ],
      ja: [
        {
          icon: 'briefcase-business',
          title: 'ビジネスメール作成',
          desc: '丁寧で要点が明確',
          prompt: '以下の件についてビジネスメールを書いてください：',
          tone: 'violet',
        },
        {
          icon: 'brain',
          title: '概念を説明',
          desc: 'わかりやすく、例つき',
          prompt: '次の概念をわかりやすく説明してください：',
          tone: 'cyan',
        },
        {
          icon: 'languages',
          title: '英語に翻訳',
          desc: '自然でニュアンスを保持',
          prompt: 'この文章を自然な英語に翻訳してください：',
          tone: 'amber',
        },
        {
          icon: 'book-open',
          title: 'SF小説を3冊',
          desc: '短い理由つき',
          prompt: 'おすすめのSF小説を3冊、短い理由とともに教えてください。',
          tone: 'emerald',
        },
      ],
      ko: [
        {
          icon: 'briefcase-business',
          title: '비즈니스 이메일',
          desc: '정중하고 요점이 명확',
          prompt: '다음 주제로 비즈니스 이메일을 작성해 주세요: ',
          tone: 'violet',
        },
        {
          icon: 'brain',
          title: '개념 설명',
          desc: '쉽게, 예시와 함께',
          prompt: '다음 개념을 쉽게 설명해 주세요: ',
          tone: 'cyan',
        },
        {
          icon: 'languages',
          title: '영어로 번역',
          desc: '자연스럽고 어조 유지',
          prompt: '다음 문장을 자연스러운 영어로 번역해 주세요: ',
          tone: 'amber',
        },
        {
          icon: 'book-open',
          title: 'SF 소설 3권',
          desc: '간단한 이유와 함께',
          prompt: '좋은 SF 소설 3권을 간단한 이유와 함께 추천해 주세요.',
          tone: 'emerald',
        },
      ],
    };
    return lib[loc] ?? lib.en;
  });

  /**
   * mode === 'translate'/'summarize' 时返回模式特定的 starter；
   * 'chat' 时回退到 defaultStartersRich。
   */
  const modeStarterCards = computed<EmptyStarterCard[]>(() => {
    const loc = (locale.value ?? 'en') as Locale;
    if (mode.value === 'translate') {
      return loc === 'zh'
        ? [
            {
              icon: 'languages',
              title: '翻译成中文',
              desc: '保留语气和格式',
              prompt: '把下面内容翻译成中文：',
              tone: 'cyan',
            },
            {
              icon: 'languages',
              title: '翻译成英文',
              desc: '自然地道表达',
              prompt: '把下面内容翻译成自然英文：',
              tone: 'violet',
            },
            {
              icon: 'book-open',
              title: '术语对齐',
              desc: '适合技术/业务文本',
              prompt: '翻译下面内容，并保持专业术语一致：',
              tone: 'emerald',
            },
          ]
        : [
            {
              icon: 'languages',
              title: 'Translate to English',
              desc: 'Natural and concise',
              prompt: 'Translate this into natural English: ',
              tone: 'violet',
            },
            {
              icon: 'languages',
              title: 'Translate to Chinese',
              desc: 'Keep tone and formatting',
              prompt: 'Translate this into Chinese: ',
              tone: 'cyan',
            },
            {
              icon: 'book-open',
              title: 'Keep terminology',
              desc: 'For technical content',
              prompt: 'Translate this and keep terminology consistent: ',
              tone: 'emerald',
            },
          ];
    }
    if (mode.value === 'summarize') {
      return loc === 'zh'
        ? [
            {
              icon: 'file-text',
              title: '总结长文',
              desc: '提炼核心结论',
              prompt: '请总结下面内容的核心要点：',
              tone: 'rose',
            },
            {
              icon: 'list',
              title: '提炼要点',
              desc: '输出清晰条目',
              prompt: '请把下面内容提炼成 5 条要点：',
              tone: 'sky',
            },
            {
              icon: 'list-checks',
              title: '整理待办',
              desc: '会议/记录转行动项',
              prompt: '请从下面内容中整理待办事项和负责人：',
              tone: 'amber',
            },
          ]
        : [
            {
              icon: 'file-text',
              title: 'Summarize long text',
              desc: 'Extract the core points',
              prompt: 'Summarize the key points of this content: ',
              tone: 'rose',
            },
            {
              icon: 'list',
              title: 'Five bullets',
              desc: 'Make it skimmable',
              prompt: 'Extract this into 5 concise bullet points: ',
              tone: 'sky',
            },
            {
              icon: 'list-checks',
              title: 'Action items',
              desc: 'Meeting notes to tasks',
              prompt: 'Extract action items, owners, and deadlines from this: ',
              tone: 'amber',
            },
          ];
    }
    return defaultStartersRich.value;
  });

  const emptyStarterCards = computed(() => modeStarterCards.value);

  const emptyCapabilityHints = computed<EmptyCapabilityHint[]>(() => {
    const loc = (locale.value ?? 'en') as Locale;
    const lib: Record<Locale, EmptyCapabilityHint[]> = {
      zh: [
        { icon: 'command', label: '页面上下文' },
        { icon: 'paperclip', label: '文件摘要' },
        { icon: 'mic', label: '语音输入' },
      ],
      en: [
        { icon: 'command', label: 'Page context' },
        { icon: 'paperclip', label: 'File summaries' },
        { icon: 'mic', label: 'Voice input' },
      ],
      ja: [
        { icon: 'command', label: 'ページ文脈' },
        { icon: 'paperclip', label: 'ファイル要約' },
        { icon: 'mic', label: '音声入力' },
      ],
      ko: [
        { icon: 'command', label: '페이지 컨텍스트' },
        { icon: 'paperclip', label: '파일 요약' },
        { icon: 'mic', label: '음성 입력' },
      ],
    };
    return lib[loc] ?? lib.en;
  });

  return {
    defaultSkills,
    defaultStartersRich,
    modeStarterCards,
    emptyStarterCards,
    emptyCapabilityHints,
  };
}
