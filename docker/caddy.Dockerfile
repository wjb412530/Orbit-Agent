# Orbit-Agent（枢弈）前端 + 网关镜像
# 阶段1 构建 React 静态资源；阶段2 用 Caddy 托管静态 + 反代后端 + 自动 HTTPS

# --- 阶段1：构建前端 ---
FROM node:20-alpine AS frontend
WORKDIR /build
COPY frontend/package.json frontend/pnpm-lock.yaml ./
RUN corepack enable && corepack prepare pnpm@10.33.0 --activate && pnpm install --frozen-lockfile
COPY frontend/ ./
ARG VITE_API_BASE_URL
ENV VITE_API_BASE_URL=${VITE_API_BASE_URL}
RUN pnpm build

# --- 阶段2：Caddy 网关 ---
FROM caddy:2-alpine
COPY --from=frontend /build/dist /srv/dist