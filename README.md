# Scrum Poker

A real-time Scrum Poker application built with Vue 3 and Bun. This application allows teams to conduct planning poker sessions remotely using WebSocket connections for real-time updates.

## Tech Stack

### Frontend
- Vue 3 with TypeScript
- Vite
- PrimeVue Components
- PNPM Package Manager
- SCSS for styling

### Backend
- Bun Runtime
- TypeScript
- WebSocket Server

## Getting Started

### Prerequisites
- Docker & Docker Compose
- PNPM (for frontend package management)
- Bun (for backend development)

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

## Contributing

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add some amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request
