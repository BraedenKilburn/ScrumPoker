import { describe, expect, test } from "bun:test";
import { InMemoryRoomManager } from "../roomManager";
import { joinRoomSuccessMessage } from "../roomSnapshots";

describe("joinRoomSuccessMessage", () => {
  test("captures the full room state with votes masked while hidden", () => {
    const roomManager = new InMemoryRoomManager();
    roomManager.joinRoom("room1", "admin", "tshirt");
    roomManager.joinRoom("room1", "voter");
    roomManager.joinRoom("room1", "watcher", undefined, "spectator");
    roomManager.submitVote("room1", "voter", "M");
    roomManager.setVoteLock("room1", "admin", true);

    expect(joinRoomSuccessMessage("room1", roomManager)).toEqual({
      type: "joinRoomSuccess",
      data: {
        participants: { admin: null, voter: "?" },
        spectators: ["watcher"],
        admin: "admin",
        locked: true,
        revealed: false,
        deck: "tshirt",
      },
    });
  });

  test("carries real votes once the room is revealed", () => {
    const roomManager = new InMemoryRoomManager();
    roomManager.joinRoom("room1", "admin");
    roomManager.submitVote("room1", "admin", "5");
    roomManager.setVoteVisibility("room1", "admin", true);

    expect(joinRoomSuccessMessage("room1", roomManager).data).toMatchObject({
      participants: { admin: "5" },
      revealed: true,
    });
  });
});
