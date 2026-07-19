import type { ServerWebSocket } from "bun";
import { CloseCode, CloseReason, type WebSocketData } from "@shared/types";
import type { RoomManager } from "./roomManager";
import type { RoomBroadcaster } from "./roomBroadcaster";
import type { ConnectionManager } from "./connectionManager";
import type { DisconnectManager } from "./disconnectManager";
import { joinRoomSuccessMessage } from "./roomSnapshots";
import { logger } from "./logger";

type Socket = ServerWebSocket<WebSocketData>;

export type RoomMembershipDeps = {
  roomManager: RoomManager;
  connectionManager: ConnectionManager;
  disconnectManager: DisconnectManager;
  broadcaster: RoomBroadcaster;
  /** Overridable so tests can assert expiry without a long fake advance. */
  gracePeriodMs?: number;
};

/**
 * How a member enters and leaves a room. Membership (a name on the room
 * roster) and presence (a live socket) are separate facts, and the grace
 * period is exactly the state where they disagree — keeping both here is
 * what lets the roster, the connection registry and the disconnect
 * registry stay consistent without callers sequencing them by hand.
 *
 * Charter: membership transitions only. Voting, decks and reactions are
 * the ClientMessageHandler's business.
 */
export function createRoomMembership(deps: RoomMembershipDeps) {
  const {
    roomManager,
    connectionManager,
    disconnectManager,
    broadcaster,
    gracePeriodMs = 30_000,
  } = deps;

  /**
   * Why a socket closed. Derived from the close frame *and* room state —
   * admin departure outranks whatever reason the client sent, which is
   * why this can't be a pure decode of (code, reason).
   */
  type DepartureReason = "usernameTaken" | "adminLeft" | "evicted" | "left" | "lost";

  function classify(roomId: string, username: string, code: number, reason: string): DepartureReason {
    if (code === CloseCode.UsernameTaken) return "usernameTaken";
    // Checked before the reason strings: an admin who leaves deliberately
    // still closes the room, so their "User left room" must not win here.
    if (roomManager.isAdmin(roomId, username)) return "adminLeft";
    if (reason === CloseReason.RemovedByAdmin) return "evicted";
    if (reason === CloseReason.UserLeft) return "left";
    return "lost";
  }

  /**
   * Drop from the roster and tell the room what happened to it. Losing
   * the admin ends the session, so that case announces `roomClosed`
   * instead of `userLeft` — including when the admin's grace period is
   * what expired, which is reachable because `transferAdmin` can hand the
   * role to a member who is currently absent.
   */
  function removeAndAnnounce(roomId: string, username: string): void {
    const { destroyed } = roomManager.leaveRoom(roomId, username);

    if (!destroyed) {
      broadcaster.toRoom(roomId, { type: "userLeft", data: { username } });
      return;
    }

    // Grace timers must never outlive the room they would fire against.
    disconnectManager.clearRoom(roomId);
    broadcaster.toRoom(roomId, {
      type: "roomClosed",
      data: { reason: "Admin left the room" },
    });
  }

  /**
   * A socket opened for a member: either a reconnect inside the grace
   * period, or a fresh join. The room-existence check matters because a
   * reconnect into a destroyed room would otherwise try to snapshot a
   * room that is gone; treating it as a fresh join recreates it.
   */
  function arrive(ws: Socket): void {
    const { roomId, username } = ws.data;

    if (disconnectManager.isDisconnected(roomId, username) && roomManager.roomExists(roomId)) {
      disconnectManager.cancelDisconnect(roomId, username);

      ws.subscribe(roomId);
      connectionManager.registerConnection(roomId, username, ws);

      logger.websocket(`User reconnected`, { roomId, username });

      broadcaster.reply(ws, joinRoomSuccessMessage(roomId, roomManager, username));
      broadcaster.toRoomExcept(ws, { type: "userReconnected", data: { username } });
      return;
    }

    // A stale grace entry for a room that no longer exists would keep the
    // member out of the fresh join below.
    disconnectManager.cancelDisconnect(roomId, username);

    try {
      roomManager.joinRoom(roomId, username, ws.data.deck, ws.data.role);
    } catch (error) {
      ws.close(CloseCode.UsernameTaken, (error as Error).message);
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
  }

  /** A socket closed. The reason decides whether the member is gone,
   *  merely absent, or already accounted for. */
  function depart(ws: Socket, code: number, reason: string): void {
    const { roomId, username } = ws.data;
    if (!roomId || !username) return;

    const departure = classify(roomId, username, code, reason);

    // The join was rejected before the connection was ever registered,
    // so there is nothing to unwind.
    if (departure === "usernameTaken") {
      logger.error(`Username taken`, { roomId, username, code, reason });
      return;
    }

    const log = code === 1000 ? logger.websocket : logger.error;
    log(`Connection closed`, { roomId, username, code, reason });

    connectionManager.removeConnection(roomId, username);

    switch (departure) {
      case "adminLeft":
      case "left":
        // One operation: leave the roster, tell the room. Whether that
        // ends the session is the roster's answer, not the reason's.
        removeAndAnnounce(roomId, username);
        return;

      case "evicted":
        // evict() already dropped them from the roster and told the room.
        return;

      case "lost":
        logger.websocket(`User disconnected unexpectedly, starting grace period`, {
          roomId,
          username,
        });
        broadcaster.toRoom(roomId, { type: "userDisconnected", data: { username } });

        disconnectManager.markDisconnected(
          roomId,
          username,
          () => {
            logger.websocket(`Grace period expired`, { roomId, username });
            removeAndAnnounce(roomId, username);
          },
          gracePeriodMs,
        );
        return;
    }
  }

  /**
   * The admin removes a member. Throws on an unauthorized or unknown
   * target — the ClientMessageHandler turns that into an error reply.
   *
   * Cancelling any pending grace entry is what keeps a removed member
   * from being announced twice: without it their timer still fires and
   * reports a userLeft for someone already gone.
   */
  function evict(roomId: string, actor: string, target: string): void {
    roomManager.removeParticipant(roomId, actor, target);
    disconnectManager.cancelDisconnect(roomId, target);

    // A member inside the grace period has no socket to notify or close,
    // but the room still hears about it now rather than 30s from now.
    if (connectionManager.isConnected(roomId, target)) {
      broadcaster.toUser(roomId, target, {
        type: "youWereRemoved",
        data: { removedBy: actor },
      });
      connectionManager.closeConnection(roomId, target, CloseReason.RemovedByAdmin);
    }

    broadcaster.toRoom(roomId, {
      type: "participantRemoved",
      data: { removedBy: actor, participant: target },
    });
  }

  return { arrive, depart, evict };
}

export type RoomMembership = ReturnType<typeof createRoomMembership>;
