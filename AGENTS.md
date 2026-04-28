# AGENTS.md

- No root package manager config exists; work inside `frontend/` or `backend/`.
- `frontend/` uses Bun + Vite + Vue 3; `backend/` uses Bun.
- `shared/` contains TypeScript types shared between frontend and backend (imported as `@shared/*`).
- Respect the scoped rules in `.cursor/rules/vue-cursor-rules.mdc` and `.cursor/rules/bun-cursor-rules.mdc`.

## Commands

- Dev stack: `docker compose -f docker-compose.dev.yml up --build`
- Prod stack: `docker compose -f docker-compose.prod.yml up --build`
- Frontend: `bun run dev`, `bun run build`, `bun run type-check`, `bun run lint` (oxlint), `bun run fmt` (oxfmt)
- Backend: `bun --watch src/index.ts` for local dev, `bun test` for coverage-enabled tests
- Single backend test file: `bun test src/__tests__/roomManager.test.ts`

## Repo Gotchas

- Frontend env files come from `frontend/.env.sample`; create `frontend/.env.development` and `frontend/.env.production` from it.
- Frontend reads `VITE_SOCKET_URL` and `VITE_GTAG_ID`.
- Frontend Vite alias `@` points to `frontend/src`.
- Frontend dev server runs on port `8080` and uses polling file watch.
- Backend entrypoint is `backend/src/index.ts`; the Docker release image copies `src/` to the image root and runs `bun index.ts`, so do not assume a repo-root `index.ts` exists.

## Formatting

- Frontend uses Oxc tooling: `oxlint` for linting and `oxfmt` for formatting.
- Backend test coverage is enabled in `backend/bunfig.toml`.
