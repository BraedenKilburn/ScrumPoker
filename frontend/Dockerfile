# Build stage
FROM node:20-slim AS development

WORKDIR /app

# Install pnpm
RUN npm install -g pnpm

# Copy package files
COPY package.json pnpm-lock.yaml ./

# Install dependencies
RUN pnpm install

# Copy source code
COPY . .

# Start development server
CMD ["pnpm", "run", "dev", "--host"]

# Production build stage
FROM node:20-slim AS build

WORKDIR /app

# Install pnpm
RUN npm install -g pnpm

COPY package.json pnpm-lock.yaml ./
RUN pnpm install

COPY . .
RUN pnpm run build

# Production stage
FROM alpine/git AS deploy

WORKDIR /app

COPY --from=build /app/dist .

CMD ["echo", "Finished"]
