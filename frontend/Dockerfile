FROM oven/bun:1.3.14-slim AS dependencies
WORKDIR /workspace
COPY package.json bun.lock bunfig.toml ./
COPY frontend/package.json frontend/package.json
COPY backend/package.json backend/package.json
RUN bun install --frozen-lockfile

FROM dependencies AS development
COPY frontend/ frontend/
COPY shared/ shared/
WORKDIR /workspace/frontend
CMD ["bun", "run", "dev", "--host"]

FROM dependencies AS build
COPY frontend/ frontend/
COPY shared/ shared/
WORKDIR /workspace/frontend
RUN bun run build
