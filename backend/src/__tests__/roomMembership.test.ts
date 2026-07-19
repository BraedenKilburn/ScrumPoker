import { describe, expect, test } from "bun:test";
import { CloseCode, CloseReason } from "@shared/types";
import { ConnectionManager } from "../connectionManager";
import { DisconnectManager } from "../disconnectManager";
import { InMemoryRoomManager } from "../roomManager";
import { createRoomMembership } from "../roomMembership";
import { fakeScheduler, fakeSocket, recordingBroadcaster } from "./testDoubles";

const GRACE_MS = 30_000;

function setup() {
  const roomManager = new InMemoryRoomManager();
  const connectionManager = new ConnectionManager();
  const { scheduler, advance, pendingCount } = fakeScheduler();
  const disconnectManager = new DisconnectManager(scheduler);
  const { broadcaster, calls } = recordingBroadcaster();
  const membership = createRoomMembership({
    roomManager,
    connectionManager,
    disconnectManager,
    broadcaster,
    gracePeriodMs: GRACE_MS,
  });

  /** Open a socket for a member and route its close back through depart. */
  function connect(username: string, role?: "voter" | "spectator") {
    const ws = fakeSocket("room1", username);
    if (role) ws.data.role = role;
    ws.onClose = (code, reason) => membership.depart(ws, code, reason);
    membership.arrive(ws);
    return ws;
  }

  const types = () => calls.map((call) => call.msg.type);

  return {
    roomManager,
    connectionManager,
    disconnectManager,
    membership,
    calls,
    types,
    connect,
    advance,
    pendingCount,
    reset: () => calls.splice(0, calls.length),
  };
}

describe("roomMembership", () => {
  describe("arrive", () => {
    test("a first join creates the room, registers the socket, and snapshots back", () => {
      const { roomManager, connectionManager, calls, connect } = setup();

      const admin = connect("admin");

      expect(roomManager.isUserInRoom("room1", "admin")).toBe(true);
      expect(roomManager.getAdmin("room1")).toBe("admin");
      expect(connectionManager.isConnected("room1", "admin")).toBe(true);
      expect(admin.subscribed).toEqual(["room1"]);
      expect(calls).toEqual([
        {
          to: "roomExcept",
          sender: admin,
          msg: { type: "userJoined", data: { username: "admin", role: "voter" } },
        },
        { to: "reply", ws: admin, msg: expect.objectContaining({ type: "joinRoomSuccess" }) },
      ]);
    });

    test("the announced role comes from room state, not the query param", () => {
      const { calls, connect } = setup();
      connect("admin");

      connect("watcher", "spectator");

      expect(calls.at(-2)).toMatchObject({
        msg: { type: "userJoined", data: { username: "watcher", role: "spectator" } },
      });
    });

    test("a duplicate username is closed with UsernameTaken and never registered", () => {
      const { connectionManager, membership, calls, connect, reset } = setup();
      const original = connect("admin");
      reset();

      const dupe = fakeSocket("room1", "admin");
      membership.arrive(dupe);

      expect(dupe.closed?.code).toBe(CloseCode.UsernameTaken);
      expect(dupe.subscribed).toEqual([]);
      // The original holder keeps the name and the connection.
      expect(connectionManager.getConnection("room1", "admin")).toBe(original);
      expect(calls).toEqual([]);
    });

    test("a reconnect into a destroyed room is treated as a fresh join", () => {
      const { roomManager, disconnectManager, membership, connect, reset } = setup();
      const admin = connect("admin");
      const voter = connect("voter");

      // voter drops into the grace period, then the admin closes the room.
      voter.close(1006, "");
      admin.close(1000, CloseReason.UserLeft);
      expect(roomManager.roomExists("room1")).toBe(false);

      // Force the state the ordering constraint normally rules out: a
      // stale grace entry for a room that is gone.
      disconnectManager.markDisconnected("room1", "voter", () => {});
      reset();

      const returning = fakeSocket("room1", "voter");
      membership.arrive(returning);

      expect(roomManager.roomExists("room1")).toBe(true);
      expect(roomManager.getAdmin("room1")).toBe("voter");
      expect(disconnectManager.isDisconnected("room1", "voter")).toBe(false);
    });
  });

  describe("depart", () => {
    test("a deliberate leave drops the member and tells the room", () => {
      const { roomManager, connectionManager, calls, connect, reset } = setup();
      connect("admin");
      const voter = connect("voter");
      reset();

      voter.close(1000, CloseReason.UserLeft);

      expect(roomManager.isUserInRoom("room1", "voter")).toBe(false);
      expect(connectionManager.isConnected("room1", "voter")).toBe(false);
      expect(calls).toEqual([
        { to: "room", roomId: "room1", msg: { type: "userLeft", data: { username: "voter" } } },
      ]);
    });

    test("an unexpected drop announces a disconnect and starts the grace period", () => {
      const { roomManager, calls, connect, reset, pendingCount } = setup();
      connect("admin");
      const voter = connect("voter");
      reset();

      voter.close(1006, "");

      // Still on the roster — absent, not gone.
      expect(roomManager.isUserInRoom("room1", "voter")).toBe(true);
      expect(pendingCount()).toBe(1);
      expect(calls).toEqual([
        {
          to: "room",
          roomId: "room1",
          msg: { type: "userDisconnected", data: { username: "voter" } },
        },
      ]);
    });

    test("the grace period expiring removes the member and announces userLeft", () => {
      const { roomManager, calls, connect, reset, advance } = setup();
      connect("admin");
      const voter = connect("voter");
      reset();

      voter.close(1006, "");
      reset();

      advance(GRACE_MS - 1);
      expect(calls).toEqual([]);
      expect(roomManager.isUserInRoom("room1", "voter")).toBe(true);

      advance(1);
      expect(roomManager.isUserInRoom("room1", "voter")).toBe(false);
      expect(calls).toEqual([
        { to: "room", roomId: "room1", msg: { type: "userLeft", data: { username: "voter" } } },
      ]);
    });

    test("reconnecting before expiry cancels the timer and replays the snapshot", () => {
      const { roomManager, connectionManager, membership, calls, connect, reset, advance } =
        setup();
      connect("admin");
      const voter = connect("voter");
      reset();

      voter.close(1006, "");
      reset();

      const returning = fakeSocket("room1", "voter");
      membership.arrive(returning);

      expect(connectionManager.isConnected("room1", "voter")).toBe(true);
      expect(calls).toEqual([
        { to: "reply", ws: returning, msg: expect.objectContaining({ type: "joinRoomSuccess" }) },
        {
          to: "roomExcept",
          sender: returning,
          msg: { type: "userReconnected", data: { username: "voter" } },
        },
      ]);

      // The cancelled timer must not fire later.
      reset();
      advance(GRACE_MS * 2);
      expect(calls).toEqual([]);
      expect(roomManager.isUserInRoom("room1", "voter")).toBe(true);
    });

    test("the admin leaving closes the room, whatever reason the client sent", () => {
      const { roomManager, calls, connect, reset } = setup();
      const admin = connect("admin");
      connect("voter");
      reset();

      // Deliberate leave: the admin branch must still win over "left".
      admin.close(1000, CloseReason.UserLeft);

      expect(roomManager.roomExists("room1")).toBe(false);
      expect(calls).toEqual([
        {
          to: "room",
          roomId: "room1",
          msg: { type: "roomClosed", data: { reason: "Admin left the room" } },
        },
      ]);
    });

    test("the admin leaving clears pending grace timers before the room goes", () => {
      const { calls, connect, reset, advance, pendingCount } = setup();
      const admin = connect("admin");
      const voter = connect("voter");
      reset();

      voter.close(1006, "");
      expect(pendingCount()).toBe(1);

      admin.close(1006, "");
      expect(pendingCount()).toBe(0);
      reset();

      // Nothing fires against the destroyed room.
      advance(GRACE_MS * 2);
      expect(calls).toEqual([]);
    });

    test("a UsernameTaken close unwinds nothing", () => {
      const { connectionManager, membership, calls, connect, reset } = setup();
      connect("admin");
      reset();

      const dupe = fakeSocket("room1", "admin");
      membership.arrive(dupe);
      reset();

      membership.depart(dupe, CloseCode.UsernameTaken, "Username is already taken");

      // The original holder keeps their connection and their membership.
      expect(connectionManager.isConnected("room1", "admin")).toBe(true);
      expect(calls).toEqual([]);
    });

    test("an evicted member's close is silent — evict already told the room", () => {
      const { membership, calls, connect, reset } = setup();
      connect("admin");
      const voter = connect("voter");
      reset();

      membership.evict("room1", "admin", "voter");
      const afterEvict = calls.length;

      // The socket close fires depart; it must not announce a second time.
      voter.close(1000, CloseReason.RemovedByAdmin);

      expect(calls.length).toBe(afterEvict);
    });
  });

  describe("evict", () => {
    test("removes a connected member: notify them, close them, tell the room", () => {
      const { roomManager, connectionManager, membership, calls, connect, reset } = setup();
      connect("admin");
      const voter = connect("voter");
      reset();

      membership.evict("room1", "admin", "voter");

      expect(roomManager.isUserInRoom("room1", "voter")).toBe(false);
      expect(voter.closed).toEqual({ code: 1000, reason: CloseReason.RemovedByAdmin });
      expect(connectionManager.isConnected("room1", "voter")).toBe(false);
      expect(calls).toEqual([
        {
          to: "user",
          roomId: "room1",
          username: "voter",
          msg: { type: "youWereRemoved", data: { removedBy: "admin" } },
        },
        {
          to: "room",
          roomId: "room1",
          msg: {
            type: "participantRemoved",
            data: { removedBy: "admin", participant: "voter" },
          },
        },
      ]);
    });

    test("evicting a member inside the grace period cancels their timer", () => {
      const { roomManager, membership, calls, connect, reset, advance, pendingCount } = setup();
      connect("admin");
      const voter = connect("voter");
      reset();

      voter.close(1006, "");
      expect(pendingCount()).toBe(1);
      reset();

      membership.evict("room1", "admin", "voter");

      expect(roomManager.isUserInRoom("room1", "voter")).toBe(false);
      expect(pendingCount()).toBe(0);
      // The room hears about it now, not 30s from now.
      expect(calls).toEqual([
        {
          to: "room",
          roomId: "room1",
          msg: {
            type: "participantRemoved",
            data: { removedBy: "admin", participant: "voter" },
          },
        },
      ]);

      // And the cancelled timer never reports a stale userLeft.
      reset();
      advance(GRACE_MS * 2);
      expect(calls).toEqual([]);
    });

    test("throws when the actor is not the admin, leaving the roster untouched", () => {
      const { roomManager, membership, calls, connect, reset } = setup();
      connect("admin");
      connect("voter");
      reset();

      expect(() => membership.evict("room1", "voter", "admin")).toThrow(
        "Only the admin can remove participants",
      );
      expect(roomManager.isUserInRoom("room1", "admin")).toBe(true);
      expect(calls).toEqual([]);
    });

    test("throws when the target is not in the room", () => {
      const { membership, connect, reset } = setup();
      connect("admin");
      reset();

      expect(() => membership.evict("room1", "admin", "ghost")).toThrow(
        "Participant not found in room",
      );
    });
  });
});
