# 视觉资产

README 首屏使用 `demo.png`。该图来自真实运行的 Playground `1440x900` 浏览器验收，展示显式 Demo Provider、零密钥 smoke 结果和经后端 SSE 返回的 Demo 对话，不是静态设计稿或模型效果宣传。

更新该图时必须：

1. 启动真实 Playground 与后端，不使用脱离应用的静态 HTML。
2. 完成健康、同步聊天和 SSE smoke，确保页面显示 `Demo Provider UP`。
3. 在 `1440x900` 视口截图，确认无横向滚动、遮挡和浏览器控制台错误。
4. 删除截图中的密钥、Token、本地绝对路径和个人信息，再替换 `demo.png`。

Demo 输出是确定性本地数据，不代表真实模型质量。真实 Provider 的截图只有在使用者自备 Key、且明确标注供应商与外部条件时才能加入文档。
