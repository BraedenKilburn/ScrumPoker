import { isDeckId, isParticipantRole, normalizeRoomId, type WebSocketData } from "@shared/types";
import { InMemoryRoomManager } from "./roomManager";
import { ConnectionManager } from "./connectionManager";
import { DisconnectManager } from "./disconnectManager";
import { logger } from "./logger";
import { ReactionRateLimiter } from "./reactionRateLimiter";
import { BunRoomBroadcaster } from "./roomBroadcaster";
import { createClientMessageHandler } from "./clientMessageHandler";
import { createRoomMembership } from "./roomMembership";

const connectionManager = new ConnectionManager();
const roomManager = new InMemoryRoomManager();
const disconnectManager = new DisconnectManager();
const reactionRateLimiter = new ReactionRateLimiter();

// Exported so an integration test can bind an ephemeral port (PORT=0)
// and stop the server afterwards. Production still runs `bun index.ts`.
export const server = Bun.serve<WebSocketData>({
  fetch(req, server) {
    const url = new URL(req.url);

    // Room-existence probe for the home page. Matched by pathname suffix
    // because in prod only `location /ws` is proxied to the backend, so
    // the request arrives as `/ws/rooms/:id`.
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

    logger.error(`Upgrade failed`, { roomId, username });
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

console.log(`Listening on ${server.hostname}:${server.port}`);
