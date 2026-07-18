import { isDeckId, isParticipantRole, type WebSocketData } from "@shared/types";
import { InMemoryRoomManager } from "./roomManager";
import { ConnectionManager } from "./connectionManager";
import { DisconnectManager } from "./disconnectManager";
import { logger } from "./logger";
import { ReactionRateLimiter } from "./reactionRateLimiter";
import { BunRoomBroadcaster } from "./roomBroadcaster";
import { createClientMessageHandler } from "./clientMessageHandler";
import { joinRoomSuccessMessage } from "./roomSnapshots";

const connectionManager = new ConnectionManager();
const roomManager = new InMemoryRoomManager();
const disconnectManager = new DisconnectManager();
const reactionRateLimiter = new ReactionRateLimiter();

const ErrorCodes = {
  Unknown: 4000,
  UsernameTaken: 4001,
} as const;

const server = Bun.serve<WebSocketData>({
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
        id = decodeURIComponent(roomsMatch[1]).toLowerCase();
      } catch {}
      const exists = id !== "" && roomManager.roomExists(id);
      return Response.json(
        { exists, deck: exists ? roomManager.getRoomDeck(id) : null },
        { headers: { "Access-Control-Allow-Origin": "*" } },
      );
    }

    const roomId = url.searchParams.get("roomId");
    const username = url.searchParams.get("username");
    const deckParam = url.searchParams.get("deck");
    const deck = deckParam && isDeckId(deckParam) ? deckParam : undefined;
    const roleParam = url.searchParams.get("role");
    const role = roleParam && isParticipantRole(roleParam) ? roleParam : undefined;

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
      const { roomId, username } = ws.data;

      // Check if this is a reconnection
      if (disconnectManager.isDisconnected(roomId, username)) {
        disconnectManager.cancelDisconnect(roomId, username);

        ws.subscribe(roomId);
        connectionManager.registerConnection(roomId, username, ws);

        logger.websocket(`User reconnected`, { roomId, username });

        // Send current room state to reconnected user
        broadcaster.reply(ws, joinRoomSuccessMessage(roomId, roomManager, username));

        // Notify others that user reconnected
        broadcaster.toRoomExcept(ws, { type: "userReconnected", data: { username } });
        return;
      }

      // Normal join flow
      try {
        roomManager.joinRoom(roomId, username, ws.data.deck, ws.data.role);
      } catch (error: any) {
        ws.close(ErrorCodes.UsernameTaken, error.message);
        return;
      }

      ws.subscribe(roomId);
      connectionManager.registerConnection(roomId, username, ws);

      logger.websocket(`Connection opened`, { roomId, username });

      // Role comes from room state, not the query param, so the broadcast
      // matches what joinRoom actually recorded.
      broadcaster.toRoomExcept(ws, {
        type: "userJoined",
        data: { username, role: roomManager.isSpectator(roomId, username) ? "spectator" : "voter" },
      });

      broadcaster.reply(ws, joinRoomSuccessMessage(roomId, roomManager, username));
    },
    message(ws, message) {
      clientMessages.handle(ws, message as string);
    },
    close(ws, code, reason) {
      const { roomId, username } = ws.data;
      if (!roomId || !username) return;

      const log = code === 1000 ? logger.websocket : logger.error;
      switch (code) {
        case ErrorCodes.UsernameTaken:
          logger.error(`Username taken`, { roomId, username, code, reason });
          return;
        default:
          log(`Connection closed`, { roomId, username, code, reason });
      }

      // Remove the connection
      connectionManager.removeConnection(roomId, username);

      // Admin disconnect → destroy room immediately
      if (roomManager.isAdmin(roomId, username)) {
        disconnectManager.clearRoom(roomId);
        const { shouldDestroyRoom } = roomManager.leaveRoom(roomId, username);
        if (shouldDestroyRoom) {
          broadcaster.toRoom(roomId, {
            type: "roomClosed",
            data: { reason: "Admin left the room" },
          });
        }
        return;
      }

      // User was removed by admin — already handled
      if (reason === "Removed by admin") return;

      // User intentionally left — no grace period
      if (reason === "User left room") {
        const { shouldDestroyRoom } = roomManager.leaveRoom(roomId, username);
        if (!shouldDestroyRoom) {
          broadcaster.toRoom(roomId, { type: "userLeft", data: { username } });
        }
        return;
      }

      // Unexpected disconnect — start grace period
      logger.websocket(`User disconnected unexpectedly, starting grace period`, {
        roomId,
        username,
      });
      broadcaster.toRoom(roomId, { type: "userDisconnected", data: { username } });

      disconnectManager.markDisconnected(roomId, username, () => {
        // Grace period expired — remove the user
        logger.websocket(`Grace period expired`, { roomId, username });
        const { shouldDestroyRoom } = roomManager.leaveRoom(roomId, username);
        if (!shouldDestroyRoom) {
          broadcaster.toRoom(roomId, { type: "userLeft", data: { username } });
        }
      });
    },
  },
});

// Constructed after Bun.serve because the broadcaster wraps the returned
// server handle. Safe: the websocket callbacks above can't fire until this
// synchronous startup block finishes.
const broadcaster = new BunRoomBroadcaster(server, connectionManager);
const clientMessages = createClientMessageHandler({
  roomManager,
  connectionManager,
  broadcaster,
  rateLimiter: reactionRateLimiter,
});

console.log(`Listening on ${server.hostname}:${server.port}`);
