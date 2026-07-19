import type { ServerWebSocket } from "bun";
import { describe, expect, test } from "bun:test";
import type { ClientMessage, WebSocketData } from "@shared/types";
import { createClientMessageHandler } from "../clientMessageHandler";
import { ConnectionManager } from "../connectionManager";
import { DisconnectManager } from "../disconnectManager";
import { REACTION_REFILL_INTERVAL_MS, ReactionRateLimiter } from "../reactionRateLimiter";
import { InMemoryRoomManager } from "../roomManager";
import { createRoomMembership } from "../roomMembership";
import { fakeSocket, payloadFor, recordingBroadcaster } from "./testDoubles";

type Socket = ServerWebSocket<WebSocketData>;

function setup() {
  const roomManager = new InMemoryRoomManager();
  const connectionManager = new ConnectionManager();
  const disconnectManager = new DisconnectManager();
  let now = 0;
  const rateLimiter = new ReactionRateLimiter(() => now);
  const { broadcaster, calls } = recordingBroadcaster();
  const membership = createRoomMembership({
    roomManager,
    connectionManager,
    disconnectManager,
    broadcaster,
  });
  const handler = createClientMessageHandler({
    roomManager,
    broadcaster,
    rateLimiter,
    membership,
  });

  // Standard room: an admin voter, a second voter, and a spectator.
  const admin = fakeSocket("room1", "admin");
  const voter = fakeSocket("room1", "voter");
  const watcher = fakeSocket("room1", "watcher");
  roomManager.joinRoom("room1", "admin");
  roomManager.joinRoom("room1", "voter");
  roomManager.joinRoom("room1", "watcher", undefined, "spectator");

  const send = (ws: Socket, msg: ClientMessage | string) =>
    handler.handle(ws, typeof msg === "string" ? msg : JSON.stringify(msg));

  return {
    roomManager,
    connectionManager,
    calls,
    send,
    admin,
    voter,
    watcher,
    advance: (ms: number) => (now += ms),
  };
}

describe("clientMessageHandler", () => {
  describe("submitVote", () => {
    test("records the vote and broadcasts it masked while votes are hidden", () => {
      const { roomManager, calls, send, voter } = setup();

      send(voter, { type: "submitVote", data: { vote: "5" } });

      expect(roomManager.voteSnapshot("room1").get("voter")).toBe("?");
      expect(calls).toEqual([
        {
          to: "roomExcept",
          sender: voter,
          msg: { type: "userVoted", data: { username: "voter", vote: "?" } },
        },
      ]);
    });

    test("broadcasts the real vote once votes are revealed", () => {
      const { calls, send, admin, voter } = setup();

      send(admin, { type: "revealVotes" });
      send(voter, { type: "submitVote", data: { vote: "8" } });

      expect(calls.at(-1)).toEqual({
        to: "roomExcept",
        sender: voter,
        msg: { type: "userVoted", data: { username: "voter", vote: "8" } },
      });
    });

    test("rejects a vote that is not in the room's deck", () => {
      const { calls, send, voter } = setup();

      send(voter, { type: "submitVote", data: { vote: "not-a-card" } });

      expect(calls).toEqual([
        {
          to: "reply",
          ws: voter,
          msg: { type: "error", data: { message: "Invalid vote value" } },
        },
      ]);
    });

    test("rejects votes from spectators", () => {
      const { calls, send, watcher } = setup();

      send(watcher, { type: "submitVote", data: { vote: "5" } });

      expect(calls).toEqual([
        {
          to: "reply",
          ws: watcher,
          msg: { type: "error", data: { message: "Spectators cannot vote" } },
        },
      ]);
    });

    test("rejects votes while the room is locked", () => {
      const { calls, send, admin, voter } = setup();

      send(admin, { type: "lockVotes" });
      send(voter, { type: "submitVote", data: { vote: "5" } });

      expect(calls.at(-1)).toEqual({
        to: "reply",
        ws: voter,
        msg: { type: "error", data: { message: "Votes are locked" } },
      });
    });
  });

  describe("reveal / hide", () => {
    test("admin reveal sends every member an unmasked vote status", () => {
      const { calls, send, admin, voter } = setup();

      send(voter, { type: "submitVote", data: { vote: "5" } });
      send(admin, { type: "revealVotes" });

      const call = calls.at(-1);
      expect(call).toMatchObject({ to: "eachMember", roomId: "room1" });
      // Revealed: everyone sees everything, so payloads are identical.
      expect(payloadFor(call, "admin")).toEqual({
        type: "voteStatus",
        data: { revealed: true, votes: { admin: null, voter: "5" } },
      });
      expect(payloadFor(call, "voter")).toEqual({
        type: "voteStatus",
        data: { revealed: true, votes: { admin: null, voter: "5" } },
      });
    });

    test("admin hide masks other members' votes but never the recipient's own", () => {
      const { calls, send, admin, voter } = setup();

      send(voter, { type: "submitVote", data: { vote: "5" } });
      send(admin, { type: "submitVote", data: { vote: "8" } });
      send(admin, { type: "revealVotes" });
      send(admin, { type: "hideVotes" });

      const call = calls.at(-1);
      expect(call).toMatchObject({ to: "eachMember", roomId: "room1" });

      // Each member sees their own real vote and "?" for everyone else.
      expect(payloadFor(call, "voter")).toEqual({
        type: "voteStatus",
        data: { revealed: false, votes: { admin: "?", voter: "5" } },
      });
      expect(payloadFor(call, "admin")).toEqual({
        type: "voteStatus",
        data: { revealed: false, votes: { admin: "8", voter: "?" } },
      });
    });

    test("a hidden payload never carries another member's estimate", () => {
      const { calls, send, admin, voter, watcher } = setup();

      send(voter, { type: "submitVote", data: { vote: "5" } });
      send(admin, { type: "submitVote", data: { vote: "8" } });
      send(admin, { type: "hideVotes" });

      const call = calls.at(-1);

      // The leak assertion: nobody's payload contains a vote value that
      // isn't their own. A spectator has no vote, so sees only "?".
      const cases: Array<[string, string[]]> = [
        ["voter", ["8"]],
        ["admin", ["5"]],
        ["watcher", ["5", "8"]],
      ];
      for (const [member, forbidden] of cases) {
        const serialized = JSON.stringify(payloadFor(call, member));
        for (const estimate of forbidden) {
          expect(serialized).not.toContain(`"${estimate}"`);
        }
      }
      expect(payloadFor(call, "watcher")).toEqual({
        type: "voteStatus",
        data: { revealed: false, votes: { admin: "?", voter: "?" } },
      });
    });

    test("non-admin reveal is refused with no broadcast", () => {
      const { roomManager, calls, send, voter } = setup();

      send(voter, { type: "revealVotes" });

      expect(roomManager.getRoomVisibility("room1")).toBe(false);
      expect(calls).toEqual([
        {
          to: "reply",
          ws: voter,
          msg: { type: "error", data: { message: "Only the admin can reveal/hide votes" } },
        },
      ]);
    });
  });

  describe("clearVotes", () => {
    test("clears state and notifies everyone except the acting admin", () => {
      const { roomManager, calls, send, admin, voter } = setup();

      send(voter, { type: "submitVote", data: { vote: "5" } });
      send(admin, { type: "revealVotes" });
      send(admin, { type: "clearVotes" });

      expect(roomManager.voteSnapshot("room1").get("voter")).toBeNull();
      expect(roomManager.getRoomVisibility("room1")).toBe(false);
      // The actor is deliberately excluded: their client clears locally.
      expect(calls.at(-1)).toEqual({
        to: "roomExcept",
        sender: admin,
        msg: { type: "votesCleared" },
      });
    });

    test("non-admin clear is refused", () => {
      const { calls, send, voter } = setup();

      send(voter, { type: "clearVotes" });

      expect(calls).toEqual([
        {
          to: "reply",
          ws: voter,
          msg: { type: "error", data: { message: "Only the admin can clear votes" } },
        },
      ]);
    });
  });

  describe("lock / unlock", () => {
    test("admin lock and unlock broadcast the lock status to the whole room", () => {
      const { calls, send, admin } = setup();

      send(admin, { type: "lockVotes" });
      send(admin, { type: "unlockVotes" });

      expect(calls).toEqual([
        { to: "room", roomId: "room1", msg: { type: "voteLockStatus", data: { locked: true } } },
        { to: "room", roomId: "room1", msg: { type: "voteLockStatus", data: { locked: false } } },
      ]);
    });
  });

  describe("transferAdmin", () => {
    test("admin transfer broadcasts to the whole room", () => {
      const { roomManager, calls, send, admin } = setup();

      send(admin, { type: "transferAdmin", data: { newAdmin: "voter" } });

      expect(roomManager.getAdmin("room1")).toBe("voter");
      expect(calls).toEqual([
        {
          to: "room",
          roomId: "room1",
          msg: { type: "adminTransferred", data: { newAdmin: "voter" } },
        },
      ]);
    });

    test("transfer to someone outside the room is refused", () => {
      const { roomManager, calls, send, admin } = setup();

      send(admin, { type: "transferAdmin", data: { newAdmin: "stranger" } });

      expect(roomManager.getAdmin("room1")).toBe("admin");
      expect(calls).toEqual([
        {
          to: "reply",
          ws: admin,
          msg: { type: "error", data: { message: "New admin must be in the room" } },
        },
      ]);
    });
  });

  describe("changeDeck", () => {
    test("a real deck change resets votes and broadcasts to the whole room", () => {
      const { roomManager, calls, send, admin, voter } = setup();

      send(voter, { type: "submitVote", data: { vote: "5" } });
      send(admin, { type: "changeDeck", data: { deck: "tshirt" } });

      expect(roomManager.getRoomDeck("room1")).toBe("tshirt");
      expect(roomManager.voteSnapshot("room1").get("voter")).toBeNull();
      expect(calls.at(-1)).toEqual({
        to: "room",
        roomId: "room1",
        msg: { type: "deckChanged", data: { deck: "tshirt" } },
      });
    });

    test("a same-deck confirm is a silent no-op that keeps votes", () => {
      const { roomManager, calls, send, admin, voter } = setup();

      send(voter, { type: "submitVote", data: { vote: "5" } });
      const callsBefore = calls.length;
      send(admin, { type: "changeDeck", data: { deck: "fibonacci" } });

      expect(calls.length).toBe(callsBefore);
      expect(roomManager.voteSnapshot("room1").get("voter")).toBe("?");
    });

    test("an unknown deck id never reaches the room", () => {
      // The rejection itself is clientMessageParser's; what matters here
      // is that a refused message changes nothing and answers the sender.
      const { roomManager, calls, send, admin } = setup();

      send(admin, JSON.stringify({ type: "changeDeck", data: { deck: "tarot" } }));

      expect(roomManager.getRoomDeck("room1")).toBe("fibonacci");
      expect(calls).toEqual([
        {
          to: "reply",
          ws: admin,
          msg: { type: "error", data: { message: "changeDeck requires a known deck" } },
        },
      ]);
    });
  });

  describe("sendReaction", () => {
    test("a valid reaction is broadcast to the whole room with the socket's username", () => {
      const { calls, send, voter } = setup();

      send(voter, { type: "sendReaction", data: { emoji: "🎉" } });

      expect(calls).toEqual([
        {
          to: "room",
          roomId: "room1",
          msg: { type: "reaction", data: { username: "voter", emoji: "🎉" } },
        },
      ]);
    });

    test("a burst beyond the bucket gets a rate-limit reply, not a broadcast", () => {
      const { calls, send, voter } = setup();

      for (let i = 0; i < 4; i++) send(voter, { type: "sendReaction", data: { emoji: "👍" } });

      const broadcasts = calls.filter((call) => call.to === "room");
      expect(broadcasts.length).toBe(3);
      expect(calls.at(-1)).toEqual({
        to: "reply",
        ws: voter,
        msg: {
          type: "reactionRateLimited",
          data: { retryAfterMs: REACTION_REFILL_INTERVAL_MS },
        },
      });
    });
  });

  // The eviction sequence itself is a membership transition and is
  // covered in roomMembership.test.ts. What belongs here is the wiring:
  // the message reaches evict(), and a refusal becomes an error reply.
  describe("removeParticipant", () => {
    test("delegates to the membership seam", () => {
      const { roomManager, connectionManager, calls, send, admin, voter } = setup();
      connectionManager.registerConnection("room1", "voter", voter);

      send(admin, { type: "removeParticipant", data: { participant: "voter" } });

      expect(roomManager.isUserInRoom("room1", "voter")).toBe(false);
      expect(calls.map((call) => call.msg.type)).toEqual([
        "youWereRemoved",
        "participantRemoved",
      ]);
    });

    test("an empty participant is answered, not silently dropped", () => {
      const { calls, send, admin } = setup();

      send(admin, JSON.stringify({ type: "removeParticipant", data: { participant: "" } }));

      expect(calls).toEqual([
        {
          to: "reply",
          ws: admin,
          msg: { type: "error", data: { message: "removeParticipant requires a participant" } },
        },
      ]);
    });

    test("non-admin removal is refused", () => {
      const { roomManager, calls, send, voter } = setup();

      send(voter, { type: "removeParticipant", data: { participant: "admin" } });

      expect(roomManager.isUserInRoom("room1", "admin")).toBe(true);
      expect(calls).toEqual([
        {
          to: "reply",
          ws: voter,
          msg: { type: "error", data: { message: "Only the admin can remove participants" } },
        },
      ]);
    });
  });

  describe("error path", () => {
    test("malformed JSON gets an error reply", () => {
      const { calls, send, voter } = setup();

      send(voter, "not json {");

      expect(calls).toEqual([
        {
          to: "reply",
          ws: voter,
          msg: {
            type: "error",
            data: { message: "Invalid message format. Please send valid JSON." },
          },
        },
      ]);
    });

    test("an unknown message type gets an error reply", () => {
      const { calls, send, voter } = setup();

      send(voter, JSON.stringify({ type: "teleport" }));

      expect(calls).toEqual([
        {
          to: "reply",
          ws: voter,
          msg: { type: "error", data: { message: "Unknown message type" } },
        },
      ]);
    });
  });
});
