import type { Server, ServerWebSocket } from "bun";
import type { ServerMessage, WebSocketData } from "@shared/types";
import type { ConnectionManager } from "./connectionManager";

type Socket = ServerWebSocket<WebSocketData>;

/**
 * The one place that decides who hears a server message. Every
 * server→client send is addressed to exactly one of four audiences;
 * serialization lives behind this seam so callers only ever hand over
 * typed ServerMessage objects.
 */
export interface RoomBroadcaster {
  /** Everyone in the room, including the actor. */
  toRoom(roomId: string, msg: ServerMessage): void;
  /** Everyone in the room except the actor (the sender's own socket). */
  toRoomExcept(sender: Socket, msg: ServerMessage): void;
  /** One named member, looked up in the connection registry. */
  toUser(roomId: string, username: string, msg: ServerMessage): void;
  /**
   * A separate message per member, built for that recipient. Used where
   * the payload differs by who receives it — a vote snapshot carries the
   * recipient's own vote unmasked, so it cannot be one shared broadcast.
   */
  toEachMember(roomId: string, build: (username: string) => ServerMessage): void;
  /** The sender's own socket only — errors, rate-limit notices, snapshots. */
  reply(ws: Socket, msg: ServerMessage): void;
}

/**
 * Production adapter over Bun's pub/sub: `server.publish` includes the
 * sender's subscription, `ws.publish` excludes it — that transport quirk
 * is exactly the audience distinction the interface names.
 */
export class BunRoomBroadcaster implements RoomBroadcaster {
  constructor(
    private readonly server: Server<WebSocketData>,
    private readonly connections: ConnectionManager,
  ) {}

  toRoom(roomId: string, msg: ServerMessage): void {
    this.server.publish(roomId, JSON.stringify(msg));
  }

  toRoomExcept(sender: Socket, msg: ServerMessage): void {
    sender.publish(sender.data.roomId, JSON.stringify(msg));
  }

  toUser(roomId: string, username: string, msg: ServerMessage): void {
    this.connections.getConnection(roomId, username)?.send(JSON.stringify(msg));
  }

  toEachMember(roomId: string, build: (username: string) => ServerMessage): void {
    for (const [username, ws] of this.connections.forRoom(roomId)) {
      ws.send(JSON.stringify(build(username)));
    }
  }

  reply(ws: Socket, msg: ServerMessage): void {
    ws.send(JSON.stringify(msg));
  }
}
