# AGENTS.md

- No root package manager config exists; work inside `frontend/` or `backend/`.
- `frontend/` uses Bun + Vite + Vue 3; `backend/` uses Bun.
- `shared/` contains TypeScript types shared between frontend and backend (imported as `@shared/*`).

## Commands

- Dev stack: `docker compose -f docker-compose.dev.yml up --build`
- Prod stack: `docker compose -f docker-compose.prod.yml up --build`
- Frontend: `bun run dev`, `bun run build`, `bun run type-check`, `bun run lint` (oxlint), `bun run fmt` (oxfmt)
- Backend: `bun --watch src/index.ts` for local dev, `bun test` for coverage-enabled tests

## Frontend Patterns

- `frontend/src/composables/useRoomSession.ts` is the room orchestrator: it owns the WebSocket connection, the single message `switch`, and session-wide state. Do not add a second message handler.
- Feature-specific UI state goes in its own composable under `frontend/src/composables/`, instantiated by the session (template: `useReactions.ts`). Feature composables receive session state as refs (e.g. `username`, `connectionStatus`), may import senders from `@/modules/socket` directly, and expose plain methods for the session's message switch to call — never forward raw server messages into them; the switch stays the one place that maps messages to behavior.
- A feature composable that owns timers or other cleanup exposes a `dispose()` for `teardownRoomSession` to call. The session re-exports the feature's view-facing surface from its own return object so views keep a single `useRoomSession(...)` entry point.

## Repo Gotchas

- Frontend env files come from `frontend/.env.sample`; create `frontend/.env.development` and `frontend/.env.production` from it.
- Frontend reads `VITE_SOCKET_URL`.
- Frontend Vite alias `@` points to `frontend/src`.
- Frontend dev server runs on port `8080` and uses polling file watch.
- Backend entrypoint is `backend/src/index.ts`; the Docker release image copies `src/` to the image root and runs `bun index.ts`, so do not assume a repo-root `index.ts` exists.

## Formatting

- Frontend uses Oxc tooling: `oxlint` for linting and `oxfmt` for formatting.
- Backend test coverage is enabled in `backend/bunfig.toml`.

## Agent skills

### Issue tracker

Issues and PRDs are tracked as GitHub issues in `BraedenKilburn/ScrumPoker` (via the `gh` CLI). See `docs/agents/issue-tracker.md`.

### Triage labels

The five canonical triage labels, used as-is. See `docs/agents/triage-labels.md`.

### Domain docs

Single-context: `CONTEXT.md` + `docs/adr/` at the repo root. See `docs/agents/domain.md`.
