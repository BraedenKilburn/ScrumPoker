import { isDeckId, isParticipantRole, normalizeRoomId, type WebSocketData } from "@shared/types";
import { InMemoryRoomManager } from "./roomManager";
import { ConnectionManager } from "./connectionManager";
import { DisconnectManager } from "./disconnectManager";
import { logger } from "./logger";
import { ReactionRateLimiter } from "./reactionRateLimiter";
import { BunRoomBroadcaster } from "./roomBroadcaster";
import { createClientMessageHandler } from "./clientMessageHandler";
import { createRoomMembership } from "./roomMembership";
import { healthCheck, opsConfigFromEnv } from "./health";
import { startStatsReporter } from "./statsReporter";

const connectionManager = new ConnectionManager();
const roomManager = new InMemoryRoomManager();
const disconnectManager = new DisconnectManager();
const reactionRateLimiter = new ReactionRateLimiter();
const ops = opsConfigFromEnv(process.env);
const readMemory = () => process.memoryUsage();

// Exported so an integration test can bind an ephemeral port (PORT=0)
// and stop the server afterwards. Production still runs `bun index.ts`.
export const server = Bun.serve<WebSocketData>({
  // Read here rather than left to Bun's default, which snapshots PORT at
  // process start and ignores the test's runtime `process.env.PORT = "0"`.
  port: process.env.PORT ?? 3000,
  fetch(req, server) {
    const url = new URL(req.url);

    // Room-existence probe for the home page. Matched by pathname suffix
    // because in prod only the `/ws` prefix is proxied here (and the prefix is
    // forwarded intact), so the request arrives as `/ws/rooms/:id` — while
    // a direct request on :3000 is plain `/rooms/:id`.
    const roomsMatch = url.pathname.match(/\/rooms\/([^/]+)$/);
    if (req.method === "GET" && roomsMatch) {
      // decodeURIComponent throws on malformed %-encoding — such an id
      // can't name a room, so answer the probe instead of 500ing.
      let id = "";
      try {
        id = normalizeRoomId(decodeURIComponent(roomsMatch[1]));
      } catch {}
      const exists = id !== "" && roomManager.roomExists(id);
      return Response.json(
        { exists, deck: exists ? roomManager.getRoomDeck(id) : null },
        { headers: { "Access-Control-Allow-Origin": "*" } },
      );
    }

    // Liveness for deploy.sh, the container healthcheck and Uptime Kuma.
    // Same suffix rule as the probe above, so it answers both directly on
    // :3000 and as `/ws/health` through Caddy. Checked after the room
    // probe so `/rooms/health` still asks about a room called "health".
    if (req.method === "GET" && url.pathname.endsWith("/health")) {
      return healthCheck({
        version: ops.version,
        maxRssMb: ops.maxRssMb,
        uptimeSeconds: process.uptime,
        readMemory,
      });
    }

    const rawRoomId = url.searchParams.get("roomId");
    const username = url.searchParams.get("username");
    const deckParam = url.searchParams.get("deck");
    const deck = deckParam && isDeckId(deckParam) ? deckParam : undefined;
    const roleParam = url.searchParams.get("role");
    const role = roleParam && isParticipantRole(roleParam) ? roleParam : undefined;

    // Normalized here so the socket and the probe above agree, whatever
    // the client sent. Everything downstream reads ws.data.roomId.
    const roomId = rawRoomId ? normalizeRoomId(rawRoomId) : "";

    if (!username) return new Response("Username is required", { status: 400 });
    if (!roomId) return new Response("Room ID is required", { status: 400 });
    if (server.upgrade(req, { data: { username, roomId, deck, role } })) return;

    logger.error(`Upgrade failed`, { roomId });
    return new Response("Upgrade failed", { status: 500 });
  },
  websocket: {
    idleTimeout: 960,
    sendPings: true,
    open(ws) {
      membership.arrive(ws);
    },
    message(ws, message) {
      clientMessages.handle(ws, message as string);
    },
    close(ws, code, reason) {
      membership.depart(ws, code, reason);
    },
  },
});

// Constructed after Bun.serve because the broadcaster wraps the returned
// server handle. Safe: the websocket callbacks above can't fire until this
// synchronous startup block finishes.
const broadcaster = new BunRoomBroadcaster(server, connectionManager);
const membership = createRoomMembership({
  roomManager,
  connectionManager,
  disconnectManager,
  broadcaster,
});
const clientMessages = createClientMessageHandler({
  roomManager,
  broadcaster,
  rateLimiter: reactionRateLimiter,
  membership,
});

startStatsReporter({
  // Unref'd: the stats timer alone must never keep the process alive
  // (the server does that), so a stopped server in tests can exit.
  scheduler: {
    schedule: (callback, delayMs) => setTimeout(callback, delayMs).unref(),
    cancel: (timer) => clearTimeout(timer as ReturnType<typeof setTimeout>),
  },
  intervalMs: ops.statsIntervalMs,
  maxRssMb: ops.maxRssMb,
  readMemory,
  readCounts: () => ({
    rooms: roomManager.roomCount(),
    members: roomManager.memberCount(),
    connections: connectionManager.connectionCount(),
    absentMembers: disconnectManager.absentCount(),
  }),
  log: logger,
});

console.log(`Listening on ${server.hostname}:${server.port}`);
