# Orbit-Agent（枢弈）后端镜像
# 使用 uv 官方镜像（自带 uv + Python 3.12），按 uv.lock 精确安装依赖

FROM ghcr.io/astral-sh/uv:python3.12-bookworm-slim

WORKDIR /app

# 先拷依赖清单，利用 Docker 层缓存；后续源码变更不影响依赖层
COPY pyproject.toml uv.lock ./
RUN uv sync --frozen --no-dev

# 再拷源码
COPY . .

# 运行期目录：checkpoint 相对路径、output、updated
RUN mkdir -p app/data app/output app/updated

ENV PATH="/app/.venv/bin:$PATH"

EXPOSE 8000

# 必须单 worker：active_tasks 与 WebSocket 连接保存在进程内存，多 worker 会串台
CMD ["uvicorn", "app.api.server:app", "--host", "0.0.0.0", "--port", "8000"]