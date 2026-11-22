# Scrum Poker

A real-time Scrum Poker application built with Vue 3 and Bun. This application allows teams to conduct planning poker sessions remotely using WebSocket connections for real-time updates.

## Tech Stack

### Frontend

- Vue 3 with TypeScript
- Vite
- PrimeVue Components
- Bun Package Manager
- Native CSS (with nesting) for styling

### Backend

- Bun Runtime
- TypeScript
- WebSocket Server

## Getting Started

### Prerequisites

- Docker & Docker Compose
- Bun
- Node 24 (pinned in `.node-version`; Vite and Vitest run under Node)

### Development Setup

1. Clone the repository

```bash
git clone https://github.com/braedenkilburn/scrum-bun.git
cd scrum-bun
```

2. Create environment files

Frontend environment:

```bash
cp frontend/.env.example frontend/.env.development
```

3. Start the development environment with Docker Compose

```bash
docker compose -f docker-compose.dev.yml up --build
```

The application will be available at:

- Frontend: http://localhost:8080
- Backend WebSocket: ws://localhost:3000

## Production Deployment

1. Create production environment files

Frontend environment:

```bash
cp frontend/.env.example frontend/.env.production
```

2. Build and run the production containers

```bash
docker compose -f docker-compose.prod.yml up --build
```

The production build will be available at:

- Frontend: http://localhost (port 80)
- Backend: ws://api.yourdomain.com (port 3000)

## Operations

### Health endpoint

`GET /health` (also reachable through the reverse proxy as `/ws/health`) is public and returns a minimal JSON body:

```json
{ "status": "ok", "uptimeSeconds": 8123, "version": "98adede" }
```

- `status` is always present and is exactly `"ok"` or `"degraded"`. Monitors depend on this contract.
- `version` is the git short SHA passed as the `GIT_SHA` Docker build arg (`scripts/deploy.sh` does this). It reads `"dev"` when the arg isn't set.
- When the backend process's resident memory (RSS) is above `HEALTH_MAX_RSS_MB`, the endpoint answers `503` with `"status": "degraded"`.
- Responses send `Cache-Control: no-store`.

`scripts/deploy.sh` waits for `/health` to answer `200` with the commit being deployed as its `version`, and rolls back otherwise. The prod compose file also defines a container `healthcheck` against it.

### Stats log line

Every `STATS_INTERVAL_MS` the backend logs one line:

```
[INFO] ... - stats {"rooms":0,"members":0,"connections":0,"absentMembers":0,"rssMb":30,"heapUsedMb":0}
```

`absentMembers` counts members inside their reconnect grace period. Above `HEALTH_MAX_RSS_MB` the line is logged as `[WARN]` instead. Read it with `docker compose -f docker-compose.prod.yml logs backend | grep stats`. Docker's `json-file` log rotation handles retention.

### Environment variables

| Variable            | Default  | Purpose                                                        |
| ------------------- | -------- | -------------------------------------------------------------- |
| `GIT_SHA`           | `dev`    | Build arg baked into the image; reported as `version`.         |
| `HEALTH_MAX_RSS_MB` | `400`    | RSS above this marks `/health` degraded and warns in the stats line. |
| `STATS_INTERVAL_MS` | `300000` | How often the stats line is logged (5 minutes).                |

### External alerting (manual setup)

**Uptime (Uptime Kuma).** Add an **HTTP(s) – Json Query** monitor:

- URL `https://<domain>/ws/health`, Json Query `status`, expected value `ok`.
- Accepted status codes `200-299`, so a `503` degraded response counts as down.
- Heartbeat interval 60s, with 2–3 retries before alerting, so a single dropped poll doesn't page.
- Turn on certificate-expiry notification, which also watches the automatic TLS renewal.
- Optionally add a plain **HTTP(s)** monitor on `https://<domain>/` to watch the static frontend separately.

Uptime Kuma polls the public URL from outside, so nothing needs to be opened on either side. If the machine running Uptime Kuma goes offline, nothing alerts.

## Project Structure

```bash
├── backend # Bun backend application
│   ├── Dockerfile
│   ├── package.json
│   ├── src
│   ├── tsconfig.json
│   └── types.d.ts
├── bun.lock
├── bunfig.toml
├── docker-compose.dev.yml
├── docker-compose.prod.yml
├── package.json
└── frontend # Vue 3 frontend application
    ├── Dockerfile
    ├── env.d.ts
    ├── index.html
    ├── package.json
    ├── src
    └── vite.config.ts
```

## Development

### Project Checks

Run checks for both the frontend and backend from the repository root:

```bash
bun run lint
bun run fmt
bun run type-check
bun run test
```

`bun run lint:fix` applies lint fixes, while `bun run fmt:check` checks formatting
without changing files. Install dependencies for the entire workspace from the
repository root with `bun install`.

### Frontend Development

- Uses Vite's hot module replacement
- PrimeVue components for UI
- TypeScript for type safety
- Native CSS (with nesting) for styling

### Backend Development

- Bun's built-in WebSocket server
- TypeScript for type safety
- Hot reloading in development

## Roadmap

Potential features, prioritized by value vs. effort. The guiding principle:
**preserve the zero-signup, no-tracking, no-database ethos.** Anything requiring
accounts, analytics, or persistent server-side storage is intentionally excluded —
privacy and speed are the differentiator, not feature parity.

Most of these are additive to the `ClientMessage`/`ServerMessage` unions in
`shared/types.ts` and the `Room` type in `backend/src/roomManager.ts`.

### Tier 1 — Strengthens the core loop

- **Story context + story queue** — Let the admin set the item being
  voted on (title, optional description, paste-in URL) shown above the board, and
  advance through a small queue. Turns the app from a voting widget into a standalone
  tool. Lives in the in-memory room; no persistence, no integrations.
- **Consensus + outlier signaling** — Reuse the avg/median/n already computed in
  `VoteDistribution`: celebrate when all numeric votes match; highlight the highest
  and lowest voters when they don't, to focus discussion.
- **Round timer + optional auto-reveal** — Admin-started countdown to keep sessions
  moving; optionally reveal automatically once everyone has voted.

### Tier 2 — Clear value, more surface area

- **End-of-session summary** — Client-side copy/CSV of each story and its agreed
  estimate (only meaningful alongside story context; keep it client-side, no storage).

### Tier 3 — Consider, but watch the "no fluff" line

- **Light-mode toggle** — The app currently forces dark mode (`modules/darkMode.ts`).

### Explicitly out of scope

Accounts, Jira/Linear import, persistent history servers, and analytics — each erodes
the zero-signup / no-tracking promise.

## Contributing

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add some amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request
