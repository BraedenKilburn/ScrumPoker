# Scrum Poker

A real-time Scrum Poker application built with Vue 3 and Bun. This application allows teams to conduct planning poker sessions remotely using WebSocket connections for real-time updates.

## Tech Stack

### Frontend

- Vue 3 with TypeScript
- Vite
- PrimeVue Components
- Bun Package Manager
- SCSS for styling

### Backend

- Bun Runtime
- TypeScript
- WebSocket Server

## Getting Started

### Prerequisites

- Docker & Docker Compose
- Bun

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

## Project Structure

```bash
├── backend # Bun backend application
│   ├── Dockerfile
│   ├── bun.lock
│   ├── package.json
│   ├── src
│   ├── tsconfig.json
│   └── types.d.ts
├── docker-compose.dev.yml
├── docker-compose.prod.yml
└── frontend # Vue 3 frontend application
    ├── Dockerfile
    ├── env.d.ts
    ├── index.html
    ├── package.json
    ├── src
    └── vite.config.ts
```

## Development

### Frontend Development

- Uses Vite's hot module replacement
- PrimeVue components for UI
- TypeScript for type safety
- SCSS for styling

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
