import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { ServerMessage } from "@shared/types";
import {
  createRoomConnection,
  type ConnectionStatus,
  type RoomConnection,
  type WebSocketLike,
} from "../roomConnection";

/**
 * A fake socket the tests drive by hand. It records what was sent/closed
 * and exposes helpers to simulate the events a real WebSocket would fire.
 */
class FakeSocket implements WebSocketLike {
  onopen: (() => void) | null = null;
  onmessage: ((event: { data: unknown }) => void) | null = null;
  onclose: ((event: { code: number; reason: string }) => void) | null = null;
  onerror: ((event: unknown) => void) | null = null;

  sent: string[] = [];
  closedWith: { code?: number; reason?: string } | null = null;

  constructor(readonly url: URL) {}

  send(data: string) {
    this.sent.push(data);
  }

  // The connection calls this on disconnect(); a real socket would then
  // fire onclose asynchronously — tests drive that explicitly via emitClose.
  close(code?: number, reason?: string) {
    this.closedWith = { code, reason };
  }

  emitOpen() {
    this.onopen?.();
  }

  emitMessage(msg: unknown) {
    this.onmessage?.({ data: JSON.stringify(msg) });
  }

  emitClose(code: number, reason = "") {
    this.onclose?.({ code, reason });
  }
}

function setup(url = new URL("ws://localhost:3000/?roomId=r&username=u")) {
  const sockets: FakeSocket[] = [];
  const messages: ServerMessage[] = [];
  const statuses: ConnectionStatus[] = [];

  const connection: RoomConnection = createRoomConnection({
    url,
    onMessage: (m) => messages.push(m),
    onStatus: (s) => statuses.push(s),
    socketFactory: (u) => {
      const socket = new FakeSocket(u);
      sockets.push(socket);
      return socket;
    },
  });

  return {
    connection,
    sockets,
    messages,
    statuses,
    latest: () => sockets[sockets.length - 1]!,
  };
}

beforeEach(() => {
  vi.useFakeTimers();
  vi.spyOn(console, "log").mockImplementation(() => {});
  vi.spyOn(console, "error").mockImplementation(() => {});
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.useRealTimers();
});

describe("createRoomConnection", () => {
  it("opens a socket immediately on the given URL", () => {
    const url = new URL("ws://localhost:3000/?roomId=r&username=u");
    const { sockets } = setup(url);

    expect(sockets).toHaveLength(1);
    expect(sockets[0]!.url).toBe(url);
  });

  it("reports connected and delivers parsed server messages", () => {
    const { latest, statuses, messages } = setup();

    latest().emitOpen();
    latest().emitMessage({ type: "votesCleared" });

    expect(statuses).toEqual(["connected"]);
    expect(messages).toEqual([{ type: "votesCleared" }]);
  });

  describe("senders", () => {
    it("each named sender emits the correct JSON to the socket", () => {
      const { connection, latest } = setup();

      connection.submitVote({ vote: "5" });
      connection.revealVotes();
      connection.hideVotes();
      connection.lockVotes();
      connection.unlockVotes();
      connection.clearVotes();
      connection.changeDeck("tshirt");
      connection.sendReaction("🎉");
      connection.transferAdmin("bob");
      connection.removeParticipant("carol");

      expect(latest().sent.map((raw) => JSON.parse(raw))).toEqual([
        { type: "submitVote", data: { vote: "5" } },
        { type: "revealVotes" },
        { type: "hideVotes" },
        { type: "lockVotes" },
        { type: "unlockVotes" },
        { type: "clearVotes" },
        { type: "changeDeck", data: { deck: "tshirt" } },
        { type: "sendReaction", data: { emoji: "🎉" } },
        { type: "transferAdmin", data: { newAdmin: "bob" } },
        { type: "removeParticipant", data: { participant: "carol" } },
      ]);
    });
  });

  describe("reconnection", () => {
    it("reconnects after an unexpected close and reports reconnecting", () => {
      const { sockets, statuses, latest } = setup();
      latest().emitOpen();

      latest().emitClose(1006); // abnormal closure

      expect(statuses).toEqual(["connected", "reconnecting", "reconnecting"]);
      expect(sockets).toHaveLength(1);

      vi.advanceTimersByTime(1000); // first backoff step
      expect(sockets).toHaveLength(2);
    });

    it("backs off exponentially: 1s, 2s, 4s, 8s, 16s", () => {
      const { sockets, latest } = setup();
      const delays = [1000, 2000, 4000, 8000, 16000];

      delays.forEach((delay, i) => {
        latest().emitClose(1006);
        // Not yet — the reconnect fires only after the full backoff delay.
        vi.advanceTimersByTime(delay - 1);
        expect(sockets).toHaveLength(i + 1);
        vi.advanceTimersByTime(1);
        expect(sockets).toHaveLength(i + 2);
      });
    });

    it("gives up after the attempt cap with a synthetic roomClosed", () => {
      const { latest, statuses, messages, sockets } = setup();

      // Exhaust all five reconnect attempts.
      for (let attempt = 0; attempt < 5; attempt++) {
        latest().emitClose(1006);
        vi.advanceTimersByTime(1000 * 2 ** attempt);
      }
      expect(sockets).toHaveLength(6);

      // The sixth failure trips the cap.
      latest().emitClose(1006);

      expect(statuses.at(-1)).toBe("failed");
      expect(messages).toContainEqual({
        type: "roomClosed",
        data: { reason: "Unable to reconnect to the room" },
      });
    });

    it("resets the backoff after a successful reconnect", () => {
      const { sockets, latest } = setup();

      latest().emitClose(1006);
      vi.advanceTimersByTime(1000);
      expect(sockets).toHaveLength(2);

      // A clean reopen must reset attempts, so the next drop waits 1s again.
      latest().emitOpen();
      latest().emitClose(1006);
      vi.advanceTimersByTime(999);
      expect(sockets).toHaveLength(2);
      vi.advanceTimersByTime(1);
      expect(sockets).toHaveLength(3);
    });
  });

  describe("terminal closes (no reconnect)", () => {
    it("disconnect() closes cleanly and suppresses reconnection", () => {
      const { connection, sockets, statuses } = setup();
      const socket = sockets[0]!;
      socket.emitOpen();

      connection.disconnect();
      expect(socket.closedWith).toEqual({ code: 1000, reason: "User left room" });

      // Even if the close event lands afterward, nothing reconnects.
      socket.emitClose(1000, "User left room");
      vi.advanceTimersByTime(60_000);
      expect(sockets).toHaveLength(1);
      expect(statuses).toEqual(["connected"]);
    });

    it("username-taken (4001) surfaces roomClosed and does not reconnect", () => {
      const { latest, messages, statuses, sockets } = setup();

      latest().emitClose(4001, "Username is already taken");
      vi.advanceTimersByTime(60_000);

      expect(messages).toEqual([
        { type: "roomClosed", data: { reason: "Username is already taken" } },
      ]);
      expect(statuses).toEqual([]);
      expect(sockets).toHaveLength(1);
    });

    it("removed-by-admin stays silent and does not reconnect", () => {
      const { latest, messages, statuses, sockets } = setup();

      latest().emitClose(1000, "Removed by admin");
      vi.advanceTimersByTime(60_000);

      expect(messages).toEqual([]);
      expect(statuses).toEqual([]);
      expect(sockets).toHaveLength(1);
    });
  });

  describe("updateUrl", () => {
    it("replays the updated URL on the next reconnect", () => {
      const { connection, latest } = setup();
      const nextUrl = new URL("ws://localhost:3000/?roomId=r&username=u&deck=tshirt");

      connection.updateUrl(nextUrl);
      latest().emitClose(1006);
      vi.advanceTimersByTime(1000);

      expect(latest().url).toBe(nextUrl);
    });
  });
});
