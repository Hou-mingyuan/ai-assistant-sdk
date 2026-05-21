# AiAssistant.vue 重构计划

本文档记录 `AiAssistant.vue` 的拆分现状和下一步边界。它不是一次性大重构清单；每一步都应保持小范围、可测试、可回滚。

## 当前状态

已经完成并集成的拆分：

- `usePanelGeometry.ts`：面板尺寸、拖拽、缩放、视口夹紧、展开状态和生命周期清理。
- `useSendStream.ts`：发送编排、SSE/WS 流处理、URL preview side channel、错误归一化、TTFT/耗时记录。
- `useFormAutoFill.ts`：表单自动填充识别、选择、覆盖、确认填充和撤销。
- `MessageList.vue`、`AssistantHeader.vue`、`ChatInputArea.vue`、`SessionTabs.vue` 等组件已从主 SFC 中分离。

`AiAssistant.vue` 仍承担较多编排职责，短期风险不是“无法运行”，而是继续加功能时容易把状态、事件和副作用重新堆回主文件。

## 下一步建议

### 1. 抽取批量导出编排

候选文件：`src/composables/useBatchExport.ts`

边界：

- 管理选择模式、批量导出菜单、导出格式分发。
- 只接收消息、i18n、导出 API、toast 依赖。
- 不直接读写面板 DOM。

验证：

- 增加选择集合、导出 payload、错误提示的 Vitest 单测。

### 2. 抽取知识库 / Compare 编排

候选文件：

- `src/composables/useKnowledgeDrop.ts`（已完成）
- `src/composables/useCompareRegions.ts`（已完成）

边界：

- FAB drop 到 KB、KB picker、Compare regions 标记/取消/打开集合分离。
- UI 组件只负责展示，状态变更集中到 composable。

验证：

- 覆盖多 KB picker、空集合、重复标记、删除消息后索引同步。

当前进展：

- Compare regions 状态已抽到 `useCompareRegions.ts`，覆盖整条消息 mark/unmark、selection 多槽位、compare-with 打开 dialog、4 侧上限、swap/clear。
- KB drop / KB picker 编排已抽到 `useKnowledgeDrop.ts`，覆盖 Quick Ingest、picker 文件缓存、自动关闭 timer、键盘选择、新建 KB 和 toast。

### 3. 抽取连接诊断状态

候选文件：`src/composables/useConnectionDiagnosticsState.ts`（已完成）

边界：

- 模型列表加载、token/baseUrl 诊断、错误提示文案归一化。
- 继续复用 `utils/api.ts`，不新增网络层。

验证：

- 覆盖 401、429、5xx、网络失败、无 baseUrl。

当前进展：

- 连接诊断纯状态已抽到 `useConnectionDiagnosticsState.ts`，覆盖 error → status、endpoint/token 文案、状态文案、模型状态、来源提示和 remedy kind。
- 诊断复制文本构造、复制状态、剪贴板 fallback 和自动清空 timer 已抽到 `useDiagnosticsClipboard.ts`。
- 模型列表刷新、runtime config 读取/保存和 provider discovery 已抽到 `useDiagnosticsModelRequests.ts`。
- `useAssistantDiagnostics.ts` 现在主要负责组装各诊断 composable，并向组件返回统一状态。

## 执行规则

- 每次只拆一个编排主题，不把 UI 视觉调整混入重构提交。
- 先写单测或组件测试，再移动逻辑。
- 保持 `AiAssistant.vue` 模板结构稳定，除非目标任务本身是 UI 行为变更。
- 抽出的 composable 不应依赖全局单例；依赖通过参数注入，便于测试。
