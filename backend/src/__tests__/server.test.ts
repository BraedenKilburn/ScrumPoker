import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import type { ServerMessage } from "@shared/types";

/**
 * The one suite that drives the real entrypoint: Bun's fetch handler, the
 * upgrade, and a live socket. Everything below the transport has its own
 * unit tests — what only shows up here is the wiring, and whether the
 * HTTP probe and the socket agree on what a room is called.
 */

// Must be set before importing index.ts: Bun.serve reads it at call time.
process.env.PORT = "0";

let baseUrl: string;
let stop: () => void;

beforeAll(async () => {
  const { server } = await import("../index");
  baseUrl = `http://${server.hostname}:${server.port}`;
  stop = () => server.stop(true);
});

afterAll(() => stop());

function wsUrl(params: Record<string, string>): string {
  const url = new URL(baseUrl.replace("http:", "ws:"));
  for (const [key, value] of Object.entries(params)) url.searchParams.set(key, value);
  return url.toString();
}

/** Open a socket and resolve once the join snapshot lands. */
function join(params: Record<string, string>) {
  return new Promise<{ socket: WebSocket; messages: ServerMessage[] }>((resolve, reject) => {
    const socket = new WebSocket(wsUrl(params));
    const messages: ServerMessage[] = [];
    const timer = setTimeout(() => reject(new Error("timed out waiting for joinRoomSuccess")), 2000);

    socket.onmessage = (event) => {
      const msg = JSON.parse(event.data as string) as ServerMessage;
      messages.push(msg);
      if (msg.type === "joinRoomSuccess") {
        clearTimeout(timer);
        resolve({ socket, messages });
      }
    };
    socket.onerror = () => {
      clearTimeout(timer);
      reject(new Error("socket error"));
    };
  });
}

const probe = (id: string) => fetch(`${baseUrl}/rooms/${id}`);

describe("server", () => {
  describe("room existence probe", () => {
    test("reports a room that has never existed", async () => {
      const response = await probe("no-such-room");

      expect(response.status).toBe(200);
      expect(await response.json()).toEqual({ exists: false, deck: null });
    });

    test("sends CORS headers so the SPA can read the answer cross-origin", async () => {
      const response = await probe("no-such-room");

      expect(response.headers.get("Access-Control-Allow-Origin")).toBe("*");
    });

    test("reports a live room and the deck it was created with", async () => {
      const { socket } = await join({ roomId: "probe-live", username: "admin", deck: "tshirt" });

      const response = await probe("probe-live");
      expect(await response.json()).toEqual({ exists: true, deck: "tshirt" });

      socket.close();
    });

    test("malformed percent-encoding answers the probe instead of failing", async () => {
      const response = await probe("%E0%A4%A");

      expect(response.status).toBe(200);
      expect(await response.json()).toEqual({ exists: false, deck: null });
    });
  });

  describe("room id normalization", () => {
    test("a room created in one casing is found by the probe in another", async () => {
      const { socket } = await join({ roomId: "Sprint42", username: "admin" });

      // The seed-script scenario: created uppercase, probed lowercase.
      expect(await (await probe("sprint42")).json()).toMatchObject({ exists: true });
      expect(await (await probe("SPRINT42")).json()).toMatchObject({ exists: true });

      socket.close();
    });

    test("two clients spelling the room differently land in the same room", async () => {
      const first = await join({ roomId: "Casing-Test", username: "alice" });
      const second = await join({ roomId: "  casing-test  ", username: "bob" });

      // bob's snapshot lists alice, so they are in one room and not two.
      const snapshot = second.messages.find((msg) => msg.type === "joinRoomSuccess");
      expect(snapshot).toBeDefined();
      if (snapshot?.type === "joinRoomSuccess") {
        expect(Object.keys(snapshot.data.participants).sort()).toEqual(["alice", "bob"]);
        expect(snapshot.data.admin).toBe("alice");
      }

      first.socket.close();
      second.socket.close();
    });
  });

  describe("upgrade", () => {
    test("rejects a connection with no username", async () => {
      const response = await fetch(`${baseUrl}/?roomId=room1`);

      expect(response.status).toBe(400);
      expect(await response.text()).toBe("Username is required");
    });

    test("rejects a connection with no room id", async () => {
      const response = await fetch(`${baseUrl}/?username=alice`);

      expect(response.status).toBe(400);
      expect(await response.text()).toBe("Room ID is required");
    });

    test("rejects a room id that normalizes to nothing", async () => {
      const response = await fetch(`${baseUrl}/?username=alice&roomId=${encodeURIComponent("   ")}`);

      expect(response.status).toBe(400);
      expect(await response.text()).toBe("Room ID is required");
    });
  });
});
