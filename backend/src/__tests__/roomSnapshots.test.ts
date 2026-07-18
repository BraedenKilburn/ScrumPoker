import { describe, expect, test } from "bun:test";
import { InMemoryRoomManager } from "../roomManager";
import { joinRoomSuccessMessage, voteStatusMessage } from "../roomSnapshots";

function room() {
  const roomManager = new InMemoryRoomManager();
  roomManager.joinRoom("room1", "admin", "tshirt");
  roomManager.joinRoom("room1", "voter");
  roomManager.joinRoom("room1", "watcher", undefined, "spectator");
  return roomManager;
}

describe("joinRoomSuccessMessage", () => {
  test("captures the full room state, masking everyone but the recipient", () => {
    const roomManager = room();
    roomManager.submitVote("room1", "voter", "M");
    roomManager.submitVote("room1", "admin", "L");
    roomManager.setVoteLock("room1", "admin", true);

    expect(joinRoomSuccessMessage("room1", roomManager, "voter")).toEqual({
      type: "joinRoomSuccess",
      data: {
        participants: { admin: "?", voter: "M" },
        spectators: ["watcher"],
        admin: "admin",
        locked: true,
        revealed: false,
        deck: "tshirt",
      },
    });
  });

  test("a joining spectator sees no one's estimate", () => {
    const roomManager = room();
    roomManager.submitVote("room1", "voter", "M");

    expect(joinRoomSuccessMessage("room1", roomManager, "watcher").data.participants).toEqual({
      admin: null,
      voter: "?",
    });
  });

  test("carries real votes once the room is revealed", () => {
    const roomManager = room();
    roomManager.submitVote("room1", "admin", "L");
    roomManager.setVoteVisibility("room1", "admin", true);

    expect(joinRoomSuccessMessage("room1", roomManager, "voter").data).toMatchObject({
      participants: { admin: "L", voter: null },
      revealed: true,
    });
  });
});

describe("voteStatusMessage", () => {
  test("is built per recipient: own vote real, others masked", () => {
    const roomManager = room();
    roomManager.submitVote("room1", "voter", "M");
    roomManager.submitVote("room1", "admin", "L");

    expect(voteStatusMessage("room1", roomManager, "admin")).toEqual({
      type: "voteStatus",
      data: { revealed: false, votes: { admin: "L", voter: "?" } },
    });
    expect(voteStatusMessage("room1", roomManager, "voter")).toEqual({
      type: "voteStatus",
      data: { revealed: false, votes: { admin: "?", voter: "M" } },
    });
  });

  test("reveals every vote to every recipient once revealed", () => {
    const roomManager = room();
    roomManager.submitVote("room1", "voter", "M");
    roomManager.submitVote("room1", "admin", "L");
    roomManager.setVoteVisibility("room1", "admin", true);

    expect(voteStatusMessage("room1", roomManager, "watcher")).toEqual({
      type: "voteStatus",
      data: { revealed: true, votes: { admin: "L", voter: "M" } },
    });
  });
});
