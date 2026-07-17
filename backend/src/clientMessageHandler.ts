import type { ServerWebSocket } from "bun";
import {
  isDeckId,
  isReactionEmoji,
  type ClientMessage,
  type WebSocketData,
} from "@shared/types";
import type { RoomManager } from "./roomManager";
import type { RoomBroadcaster } from "./roomBroadcaster";
import type { ConnectionManager } from "./connectionManager";
import type { ReactionRateLimiter } from "./reactionRateLimiter";
import { userVotedMessage, voteStatusMessage } from "./roomSnapshots";
import { logger } from "./logger";

type Socket = ServerWebSocket<WebSocketData>;

export type ClientMessageHandlerDeps = {
  roomManager: RoomManager;
  connectionManager: ConnectionManager;
  broadcaster: RoomBroadcaster;
  rateLimiter: ReactionRateLimiter;
};

/**
 * The room's inbound seam: `handle(ws, raw)` owns parsing, dispatch, and
 * the error path — it never throws. Every outcome is a state change on
 * the RoomManager paired with a broadcast, so tests drive raw messages
 * in and assert recorded broadcasts out.
 */
export function createClientMessageHandler(deps: ClientMessageHandlerDeps) {
  const { roomManager, connectionManager, broadcaster, rateLimiter } = deps;

  function parseMessage(raw: string): ClientMessage {
    try {
      return JSON.parse(raw);
    } catch {
      throw new Error("Invalid message format. Please send valid JSON.");
    }
  }

  function dispatch(ws: Socket, msg: ClientMessage): void {
    const { roomId, username } = ws.data;

    switch (msg.type) {
      case "submitVote":
        roomManager.submitVote(roomId, username, msg.data.vote ?? null);
        broadcaster.toRoomExcept(ws, userVotedMessage(roomId, username, roomManager));
        break;

      case "sendReaction": {
        const emoji = msg.data?.emoji;
        if (!isReactionEmoji(emoji)) throw new Error("Invalid reaction");

        const rateLimit = rateLimiter.consume(ws);
        if (!rateLimit.allowed) {
          broadcaster.reply(ws, {
            type: "reactionRateLimited",
            data: { retryAfterMs: rateLimit.retryAfterMs },
          });
          break;
        }

        // Reactions are live-only: broadcast without touching room state.
        // The room audience includes the sender so every client follows
        // the same receive path; `username` comes from the authenticated
        // socket, never from the client payload.
        broadcaster.toRoom(roomId, { type: "reaction", data: { username, emoji } });
        break;
      }

      case "revealVotes":
        roomManager.setVoteVisibility(roomId, username, true);
        broadcaster.toRoom(roomId, voteStatusMessage(roomId, roomManager));
        break;

      case "hideVotes":
        roomManager.setVoteVisibility(roomId, username, false);
        broadcaster.toRoom(roomId, voteStatusMessage(roomId, roomManager));
        break;

      case "clearVotes":
        roomManager.clearVotes(roomId, username);
        roomManager.setVoteVisibility(roomId, username, false);
        // Deliberately excludes the actor: the admin's client clears
        // locally and stays silent (no new-round cue for one's own clear).
        broadcaster.toRoomExcept(ws, { type: "votesCleared" });
        break;

      case "transferAdmin":
        roomManager.transferAdmin(roomId, username, msg.data.newAdmin);
        broadcaster.toRoom(roomId, {
          type: "adminTransferred",
          data: { newAdmin: msg.data.newAdmin },
        });
        break;

      case "lockVotes":
        roomManager.setVoteLock(roomId, username, true);
        broadcaster.toRoom(roomId, { type: "voteLockStatus", data: { locked: true } });
        break;

      case "unlockVotes":
        roomManager.setVoteLock(roomId, username, false);
        broadcaster.toRoom(roomId, { type: "voteLockStatus", data: { locked: false } });
        break;

      case "changeDeck": {
        if (!isDeckId(msg.data.deck)) throw new Error("Invalid deck");

        // The room audience includes the admin who changed it — one
        // receive path for everyone. A same-deck call is a no-op so an
        // accidental confirm can't wipe votes.
        const changed = roomManager.setDeck(roomId, username, msg.data.deck);
        if (changed) {
          broadcaster.toRoom(roomId, { type: "deckChanged", data: { deck: msg.data.deck } });
        }
        break;
      }

      case "removeParticipant": {
        const participantToRemove = msg.data.participant;
        if (!participantToRemove) break;

        roomManager.removeParticipant(roomId, username, participantToRemove);

        // A member in the disconnect grace period has no live connection;
        // in that case nothing is broadcast and the room learns of the
        // removal when the grace period expires (userLeft).
        if (!connectionManager.isConnected(roomId, participantToRemove)) break;

        broadcaster.toUser(roomId, participantToRemove, {
          type: "youWereRemoved",
          data: { removedBy: username },
        });
        connectionManager.closeConnection(roomId, participantToRemove, "Removed by admin");
        broadcaster.toRoom(roomId, {
          type: "participantRemoved",
          data: { removedBy: username, participant: participantToRemove },
        });
        break;
      }

      default:
        broadcaster.reply(ws, { type: "error", data: { message: "Unknown message type" } });
    }
  }

  function handle(ws: Socket, raw: string): void {
    const { roomId, username } = ws.data;
    try {
      dispatch(ws, parseMessage(raw));
    } catch (error) {
      logger.warn(`Error parsing message`, {
        roomId,
        username,
        message: raw,
        error: (error as Error).message,
      });
      broadcaster.reply(ws, { type: "error", data: { message: (error as Error).message } });
    }
  }

  return { handle };
}
