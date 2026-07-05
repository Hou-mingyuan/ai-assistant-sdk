# 视觉资产 (assets)

README 首屏的演示动图和截图放这里。**高质量的演示图是开源项目涨 Star 的关键**——很多访客只看第一屏就决定要不要点 Star。

## 需要准备的图（按优先级）

| 文件名 | 用途 | 优先级 |
| --- | --- | --- |
| `demo.gif` | 首屏主演示动图（悬浮球 → 提问 → 流式回答 → RAG 引用） | 必做 |
| `screenshot-chat.png` | 对话界面截图 | 高 |
| `screenshot-rag.png` | RAG 引用溯源截图 | 高 |
| `screenshot-admin.png` | 管理后台截图 | 中 |
| `architecture.png` | 架构图 | 中 |
| `social-preview.png` | 1280×640 社交预览图（GitHub Settings → Social preview） | 中 |
| `banner.png` | 项目横幅（可选，放标题上方） | 可选 |

## 怎么录制 demo.gif

1. 启动演示：`ai-assistant-vue-playground` 或 `ai-assistant-demo`（配好 LLM key）。
2. 录制工具：
   - Windows：[ScreenToGif](https://www.screentogif.com/)（免费好用）
   - macOS：[Kap](https://getkap.co/) 或 LICEcap
3. 录制脚本（15–25 秒最佳）：点开悬浮球 → 输入问题 → 展示流式打字回答 → 切到 RAG 提问 → 展示带来源引用的回答。
4. 导出：宽度 720–800px，体积控制在 **10MB 以内**（GitHub 大图加载慢），必要时降帧/压缩。
5. 放到本目录命名 `demo.gif`，然后在 `README.md` / `README_EN.md` 取消演示图那行的注释。

## 规格建议

- 截图统一主题、干净背景，宽度 1280 或 720。
- PNG 用 [TinyPNG](https://tinypng.com/) 压缩。
- 深色 / 浅色各来一张，体现主题切换能力。
