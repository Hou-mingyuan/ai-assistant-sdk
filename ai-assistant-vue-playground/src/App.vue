<template>
  <div class="page">
    <article class="demo-assistant-page-context">
      <h1>AI Assistant 悬浮球演示</h1>
      <p>
        请先启动 <code>ai-assistant-demo</code>（端口 8080），再在本目录执行
        <code>npm run dev</code>。页面右下角为悬浮球，请求经 Vite 代理到
        <code>/ai-assistant</code>。
      </p>
    </article>
    <AiAssistant />
  </div>
</template>

<script setup lang="ts">
</script>

<style scoped>
.page {
  padding: 2rem;
  max-width: 720px;
  margin: 0 auto;
  font-family: system-ui, sans-serif;
  line-height: 1.6;
  color: #333;
}
code {
  background: #f0f0f0;
  padding: 0.15em 0.4em;
  border-radius: 4px;
  font-size: 0.9em;
}
</style>
