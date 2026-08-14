FROM oven/bun:1.3.14-slim AS workspace
WORKDIR /workspace
COPY package.json bun.lock bunfig.toml ./
COPY frontend/package.json frontend/package.json
COPY backend/package.json backend/package.json

FROM workspace AS dependencies
RUN bun install --frozen-lockfile

FROM workspace AS production-dependencies
RUN bun install --frozen-lockfile --production

FROM dependencies AS development
COPY backend/ backend/
COPY shared/ shared/
WORKDIR /workspace/backend
EXPOSE 3000/tcp
CMD ["bun", "--watch", "src/index.ts"]

FROM production-dependencies AS release
COPY backend/ backend/
COPY shared/ shared/
WORKDIR /workspace/backend
ENV NODE_ENV=production
USER bun
EXPOSE 3000/tcp
ENTRYPOINT ["bun", "src/index.ts"]
