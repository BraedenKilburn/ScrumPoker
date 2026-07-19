import type { ServerWebSocket } from "bun";
import type { ServerMessage, WebSocketData } from "@shared/types";
import type { RoomBroadcaster } from "../roomBroadcaster";
import type { Scheduler } from "../disconnectManager";

type Socket = ServerWebSocket<WebSocketData>;

export type FakeSocket = Socket & {
  sent: string[];
  closed?: { code?: number; reason?: string };
  subscribed: string[];
  /** Fires when close() is called, standing in for Bun's close callback. */
  onClose?: (code: number, reason: string) => void;
};

export function fakeSocket(roomId: string, username: string): FakeSocket {
  const socket = {
    data: { roomId, username },
    sent: [] as string[],
    subscribed: [] as string[],
    closed: undefined as { code?: number; reason?: string } | undefined,
    onClose: undefined as ((code: number, reason: string) => void) | undefined,
    send(raw: string) {
      socket.sent.push(raw);
    },
    subscribe(topic: string) {
      socket.subscribed.push(topic);
    },
    close(code?: number, reason?: string) {
      socket.closed = { code, reason };
      socket.onClose?.(code ?? 1000, reason ?? "");
    },
  };
  return socket as unknown as FakeSocket;
}

export type EachMemberCall = {
  to: "eachMember";
  roomId: string;
  build: (username: string) => ServerMessage;
};

export type BroadcastCall =
  | { to: "room"; roomId: string; msg: ServerMessage }
  | { to: "roomExcept"; sender: Socket; msg: ServerMessage }
  | { to: "user"; roomId: string; username: string; msg: ServerMessage }
  | EachMemberCall
  | { to: "reply"; ws: Socket; msg: ServerMessage };

/** The seam's second adapter: records every broadcast instead of sending. */
export function recordingBroadcaster() {
  const calls: BroadcastCall[] = [];
  const broadcaster: RoomBroadcaster = {
    toRoom: (roomId, msg) => calls.push({ to: "room", roomId, msg }),
    toRoomExcept: (sender, msg) => calls.push({ to: "roomExcept", sender, msg }),
    toUser: (roomId, username, msg) => calls.push({ to: "user", roomId, username, msg }),
    toEachMember: (roomId, build) => calls.push({ to: "eachMember", roomId, build }),
    reply: (ws, msg) => calls.push({ to: "reply", ws, msg }),
  };
  return { broadcaster, calls };
}

/** The personalized payload a given member would have received. */
export function payloadFor(call: BroadcastCall | undefined, username: string): ServerMessage {
  if (!call || call.to !== "eachMember") {
    throw new Error(`Expected an eachMember call, got ${call?.to}`);
  }
  return call.build(username);
}

/**
 * The DisconnectManager's scheduling seam, driven by hand. Grace-period
 * expiry is asserted by advancing time, not by sleeping.
 */
export function fakeScheduler() {
  let nextId = 1;
  const pending = new Map<number, { runAt: number; callback: () => void }>();
  let now = 0;

  const scheduler: Scheduler = {
    schedule(callback, delayMs) {
      const id = nextId++;
      pending.set(id, { runAt: now + delayMs, callback });
      return id;
    },
    cancel(timer) {
      pending.delete(timer as number);
    },
  };

  /** Advance the clock, firing anything that comes due. */
  function advance(ms: number): void {
    now += ms;
    for (const [id, entry] of [...pending]) {
      if (entry.runAt <= now) {
        pending.delete(id);
        entry.callback();
      }
    }
  }

  return { scheduler, advance, pendingCount: () => pending.size };
}
