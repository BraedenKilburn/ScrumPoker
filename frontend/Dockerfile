FROM oven/bun:1-slim AS development
WORKDIR /app
COPY frontend/package.json frontend/bun.lock ./
RUN bun install --frozen-lockfile
COPY frontend/ .
COPY shared/ ../shared/
CMD ["bun", "run", "dev", "--host"]

FROM oven/bun:1-slim AS build
WORKDIR /app
COPY frontend/package.json frontend/bun.lock ./
RUN bun install --frozen-lockfile
COPY frontend/ .
COPY shared/ ../shared/
RUN bun run build
CMD ["echo", "Finished"]
