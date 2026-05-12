import type { WebSocketData } from "@shared/types";
import { InMemoryRoomManager } from "./roomManager";
import { MessageHandler } from "./messageHandler";
import { ConnectionManager } from "./connectionManager";
import { DisconnectManager } from "./disconnectManager";
import { logger } from "./logger";

const connectionManager = new ConnectionManager();
const roomManager = new InMemoryRoomManager();
const disconnectManager = new DisconnectManager();

const ErrorCodes = {
  Unknown: 4000,
  UsernameTaken: 4001,
} as const;

function createJoinRoomSuccessMessage(roomId: string) {
  const participants = Object.fromEntries(roomManager.getRoomVotes(roomId));
  const admin = roomManager.getAdmin(roomId)!;
  const locked = roomManager.getRoomLockState(roomId);
  const revealed = roomManager.getRoomVisibility(roomId);

  return MessageHandler.createMessage({
    type: "joinRoomSuccess",
    data: { participants, admin, locked, revealed },
  });
}

const server = Bun.serve<WebSocketData, undefined>({
  fetch(req, server) {
    const roomId = new URL(req.url).searchParams.get("roomId");
    const username = new URL(req.url).searchParams.get("username");

    if (!username) return new Response("Username is required", { status: 400 });
    if (!roomId) return new Response("Room ID is required", { status: 400 });
    if (server.upgrade(req, { data: { username, roomId } })) return;

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
        ws.send(createJoinRoomSuccessMessage(roomId));

        // Notify others that user reconnected
        ws.publish(
          roomId,
          MessageHandler.createMessage({
            type: "userReconnected",
            data: { username },
          }),
        );
        return;
      }

      // Normal join flow
      try {
        roomManager.joinRoom(roomId, username);
      } catch (error: any) {
        ws.close(ErrorCodes.UsernameTaken, error.message);
        return;
      }

      ws.subscribe(roomId);
      connectionManager.registerConnection(roomId, username, ws);

      logger.websocket(`Connection opened`, { roomId, username });

      const joinMessage = MessageHandler.createMessage({ type: "userJoined", data: { username } });
      ws.publish(roomId, joinMessage);

      ws.send(createJoinRoomSuccessMessage(roomId));
    },
    message(ws, message) {
      const { roomId, username } = ws.data;
      try {
        const msg = MessageHandler.parseMessage(message as string);
        switch (msg.type) {
          case "submitVote":
            roomManager.submitVote(roomId, username, msg.data.vote ?? null);
            ws.publish(
              roomId,
              MessageHandler.createUserVotedMessage(roomId, username, roomManager),
            );
            break;

          case "revealVotes":
            roomManager.setVoteVisibility(roomId, username, true);
            server.publish(roomId, MessageHandler.createVoteStatusMessage(roomId, roomManager));
            break;

          case "hideVotes":
            roomManager.setVoteVisibility(roomId, username, false);
            server.publish(roomId, MessageHandler.createVoteStatusMessage(roomId, roomManager));
            break;

          case "clearVotes":
            roomManager.clearVotes(roomId, username);
            roomManager.setVoteVisibility(roomId, username, false);
            ws.publish(roomId, MessageHandler.createMessage({ type: "votesCleared" }));
            break;

          case "transferAdmin":
            roomManager.transferAdmin(roomId, username, msg.data.newAdmin);
            server.publish(
              roomId,
              MessageHandler.createMessage({
                type: "adminTransferred",
                data: { newAdmin: msg.data.newAdmin },
              }),
            );
            break;

          case "lockVotes":
            roomManager.setVoteLock(roomId, username, true);
            server.publish(
              roomId,
              MessageHandler.createMessage({
                type: "voteLockStatus",
                data: { locked: true },
              }),
            );
            break;

          case "unlockVotes":
            roomManager.setVoteLock(roomId, username, false);
            server.publish(
              roomId,
              MessageHandler.createMessage({
                type: "voteLockStatus",
                data: { locked: false },
              }),
            );
            break;

          case "removeParticipant": {
            const participantToRemove = msg.data.participant;
            if (!participantToRemove) break;

            roomManager.removeParticipant(roomId, username, participantToRemove);
            connectionManager.removeParticipant(roomId, participantToRemove, username);
            break;
          }

          default:
            ws.send(
              MessageHandler.createMessage({
                type: "error",
                data: { message: "Unknown message type" },
              }),
            );
        }
      } catch (error) {
        logger.warn(`Error parsing message`, {
          roomId,
          username,
          message,
          error: (error as Error).message,
        });
        ws.send(
          MessageHandler.createMessage({
            type: "error",
            data: { message: (error as Error).message },
          }),
        );
      }
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
          server.publish(
            roomId,
            MessageHandler.createMessage({
              type: "roomClosed",
              data: { reason: "Admin left the room" },
            }),
          );
        }
        return;
      }

      // User was removed by admin — already handled
      if (reason === "Removed by admin") return;

      // User intentionally left — no grace period
      if (reason === "User left room") {
        const { shouldDestroyRoom } = roomManager.leaveRoom(roomId, username);
        if (!shouldDestroyRoom) {
          server.publish(
            roomId,
            MessageHandler.createMessage({
              type: "userLeft",
              data: { username },
            }),
          );
        }
        return;
      }

      // Unexpected disconnect — start grace period
      logger.websocket(`User disconnected unexpectedly, starting grace period`, {
        roomId,
        username,
      });
      server.publish(
        roomId,
        MessageHandler.createMessage({
          type: "userDisconnected",
          data: { username },
        }),
      );

      disconnectManager.markDisconnected(roomId, username, () => {
        // Grace period expired — remove the user
        logger.websocket(`Grace period expired`, { roomId, username });
        const { shouldDestroyRoom } = roomManager.leaveRoom(roomId, username);
        if (!shouldDestroyRoom) {
          server.publish(
            roomId,
            MessageHandler.createMessage({
              type: "userLeft",
              data: { username },
            }),
          );
        }
      });
    },
  },
});

console.log(`Listening on ${server.hostname}:${server.port}`);
