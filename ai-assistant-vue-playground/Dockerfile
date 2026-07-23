# Build both the published Vue library surface and the Playground from a clean
# checkout. The compose build context is the repository root because the
# Playground consumes the sibling package through file:../ai-assistant-ui.
FROM node:22-alpine AS build

ENV NODE_TLS_REJECT_UNAUTHORIZED=1
WORKDIR /workspace

COPY ai-assistant-ui/package.json ai-assistant-ui/package-lock.json ./ai-assistant-ui/
RUN --mount=type=cache,target=/root/.npm \
  cd ai-assistant-ui && npm ci

COPY ai-assistant-ui/src ./ai-assistant-ui/src
COPY ai-assistant-ui/tsconfig.json ai-assistant-ui/vite.config.ts ./ai-assistant-ui/
RUN cd ai-assistant-ui && npm run build:lib

COPY ai-assistant-vue-playground/package.json ai-assistant-vue-playground/package-lock.json ./ai-assistant-vue-playground/
RUN --mount=type=cache,target=/root/.npm \
  cd ai-assistant-vue-playground && npm ci

COPY ai-assistant-vue-playground/index.html \
  ai-assistant-vue-playground/tsconfig.json \
  ai-assistant-vue-playground/tsconfig.node.json \
  ai-assistant-vue-playground/vite.config.ts \
  ai-assistant-vue-playground/vitest.config.ts \
  ./ai-assistant-vue-playground/
COPY ai-assistant-vue-playground/src ./ai-assistant-vue-playground/src
RUN cd ai-assistant-vue-playground && npm run build

FROM nginx:alpine

RUN rm -f /etc/nginx/conf.d/default.conf \
  && sed -i 's/^user  nginx;/# user nginx;/' /etc/nginx/nginx.conf \
  && touch /var/run/nginx.pid \
  && chown -R nginx:nginx /etc/nginx/conf.d /usr/share/nginx/html /var/cache/nginx /var/run/nginx.pid
COPY --chown=nginx:nginx ai-assistant-vue-playground/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build --chown=nginx:nginx /workspace/ai-assistant-vue-playground/dist /usr/share/nginx/html

USER nginx

EXPOSE 8080

# 用 curl + 127.0.0.1：容器内 busybox wget 会优先解析 localhost 为 IPv6(::1)，
# 而 nginx 仅监听 IPv4，会误报 unhealthy；curl 走 127.0.0.1 稳定。
HEALTHCHECK --interval=15s --timeout=5s --retries=5 --start-period=10s \
  CMD curl -fsS http://127.0.0.1:8080/ -o /dev/null || exit 1
