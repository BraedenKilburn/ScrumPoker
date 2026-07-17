import type { Server, ServerWebSocket } from "bun";
import { describe, expect, test } from "bun:test";
import type { WebSocketData } from "@shared/types";
import { ConnectionManager } from "../connectionManager";
import { BunRoomBroadcaster } from "../roomBroadcaster";

type Socket = ServerWebSocket<WebSocketData>;

function fakeSocket(roomId: string, username: string) {
  const socket = {
    data: { roomId, username },
    sent: [] as string[],
    published: [] as Array<{ topic: string; raw: string }>,
    send(raw: string) {
      socket.sent.push(raw);
    },
    publish(topic: string, raw: string) {
      socket.published.push({ topic, raw });
    },
  };
  return socket as unknown as Socket & typeof socket;
}

function setup() {
  const published: Array<{ topic: string; raw: string }> = [];
  const server = {
    publish: (topic: string, raw: string) => {
      published.push({ topic, raw });
      return raw.length;
    },
  } as unknown as Server<WebSocketData>;
  const connections = new ConnectionManager();
  const broadcaster = new BunRoomBroadcaster(server, connections);
  return { broadcaster, connections, published };
}

describe("BunRoomBroadcaster", () => {
  test("toRoom publishes the serialized message on the room topic", () => {
    const { broadcaster, published } = setup();

    broadcaster.toRoom("room1", { type: "voteLockStatus", data: { locked: true } });

    expect(published).toEqual([
      { topic: "room1", raw: JSON.stringify({ type: "voteLockStatus", data: { locked: true } }) },
    ]);
  });

  test("toRoomExcept publishes via the sender's socket on the sender's room", () => {
    const { broadcaster, published } = setup();
    const sender = fakeSocket("room1", "admin");

    broadcaster.toRoomExcept(sender, { type: "votesCleared" });

    // ws.publish excludes the sender's own subscription — that transport
    // behavior is what makes this the "room except actor" audience.
    expect(sender.published).toEqual([
      { topic: "room1", raw: JSON.stringify({ type: "votesCleared" }) },
    ]);
    expect(published).toEqual([]);
  });

  test("toUser sends to the registered connection only", () => {
    const { broadcaster, connections } = setup();
    const target = fakeSocket("room1", "voter");
    const bystander = fakeSocket("room1", "other");
    connections.registerConnection("room1", "voter", target);
    connections.registerConnection("room1", "other", bystander);

    broadcaster.toUser("room1", "voter", { type: "youWereRemoved", data: { removedBy: "admin" } });

    expect(target.sent).toEqual([
      JSON.stringify({ type: "youWereRemoved", data: { removedBy: "admin" } }),
    ]);
    expect(bystander.sent).toEqual([]);
  });

  test("toUser is a no-op for a user without a live connection", () => {
    const { broadcaster } = setup();

    expect(() =>
      broadcaster.toUser("room1", "ghost", { type: "votesCleared" }),
    ).not.toThrow();
  });

  test("reply sends on the given socket", () => {
    const { broadcaster } = setup();
    const ws = fakeSocket("room1", "voter");

    broadcaster.reply(ws, { type: "error", data: { message: "nope" } });

    expect(ws.sent).toEqual([JSON.stringify({ type: "error", data: { message: "nope" } })]);
  });
});
