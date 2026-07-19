import { expect, test, describe, beforeEach } from "bun:test";
import { InMemoryRoomManager } from "../roomManager";

describe("InMemoryRoomManager", () => {
  let roomManager: InMemoryRoomManager;

  beforeEach(() => {
    roomManager = new InMemoryRoomManager();
  });

  describe("joinRoom", () => {
    test("should create and join new room", () => {
      roomManager.joinRoom("room1", "user1");
      expect(roomManager.getRoomUsers("room1")).toEqual(["user1"]);
      expect(roomManager.getAdmin("room1")).toBe("user1");
    });

    test("should throw error for duplicate username", () => {
      roomManager.joinRoom("room1", "user1");
      expect(() => roomManager.joinRoom("room1", "user1")).toThrow("Username is already taken");
    });
  });

  describe("voting operations", () => {
    beforeEach(() => {
      roomManager.joinRoom("room1", "admin");
      roomManager.joinRoom("room1", "user1");
    });

    test("should submit vote successfully", () => {
      roomManager.submitVote("room1", "user1", "5");
      expect(roomManager.getUsersVote("room1", "user1")).toBe("?"); // Hidden by default
      roomManager.setVoteVisibility("room1", "admin", true);
      expect(roomManager.getUsersVote("room1", "user1")).toBe("5");
    });

    test("should clear votes", () => {
      roomManager.submitVote("room1", "user1", "5");
      roomManager.clearVotes("room1", "admin");
      expect(roomManager.getUsersVote("room1", "user1")).toBeNull();
    });

    test("should not allow non-admin to clear votes", () => {
      expect(() => roomManager.clearVotes("room1", "user1")).toThrow(
        "Only the admin can clear votes",
      );
    });
  });

  describe("admin operations", () => {
    const roomId = "room1";
    const admin = "admin";
    const user = "user1";

    beforeEach(() => {
      roomManager.joinRoom(roomId, admin);
      roomManager.joinRoom(roomId, user);
    });

    test("should transfer admin rights", () => {
      roomManager.transferAdmin(roomId, admin, user);
      expect(roomManager.getAdmin(roomId)).toBe(user);
    });

    test("should throw error if room does not exist", () => {
      expect(() => roomManager.transferAdmin("room2", admin, user)).toThrow("Room does not exist");
    });

    test("should not allow non-admin to transfer admin rights", () => {
      expect(() => roomManager.transferAdmin(roomId, user, admin)).toThrow(
        "Only the admin can transfer admin rights",
      );
    });

    test("should throw error if user is not in room", () => {
      expect(() => roomManager.transferAdmin(roomId, admin, "user2")).toThrow(
        "New admin must be in the room",
      );
    });
  });

  describe("room state", () => {
    beforeEach(() => {
      roomManager.joinRoom("room1", "admin");
      roomManager.joinRoom("room1", "user1");
    });

    test("room creator is admin", () => {
      expect(roomManager.getAdmin("room1")).toBe("admin");
      expect(roomManager.isAdmin("room1", "admin")).toBe(true);
      expect(roomManager.isAdmin("room1", "user1")).toBe(false);
    });

    test("should handle room lock state", () => {
      expect(roomManager.getRoomLockState("room1")).toBe(false);
      roomManager.setVoteLock("room1", "admin", true);
      expect(roomManager.getRoomLockState("room1")).toBe(true);
    });

    test("should handle vote visibility", () => {
      roomManager.submitVote("room1", "admin", "5");
      expect(roomManager.getRoomVisibility("room1")).toBe(false);
      expect(roomManager.getUsersVote("room1", "admin")).toBe("?");

      roomManager.setVoteVisibility("room1", "admin", true);
      expect(roomManager.getRoomVisibility("room1")).toBe(true);
      expect(roomManager.getUsersVote("room1", "admin")).toBe("5");
    });

    test("should get all votes in room", () => {
      roomManager.submitVote("room1", "admin", "5");
      roomManager.submitVote("room1", "user1", "3");
      expect(roomManager.voteSnapshot("room1")).toEqual(
        new Map([
          ["admin", "?"],
          ["user1", "?"],
        ]),
      );

      roomManager.setVoteVisibility("room1", "admin", true);
      expect(roomManager.voteSnapshot("room1")).toEqual(
        new Map([
          ["admin", "5"],
          ["user1", "3"],
        ]),
      );
    });
  });

  describe("vote masking", () => {
    beforeEach(() => {
      roomManager.joinRoom("room1", "admin");
      roomManager.joinRoom("room1", "user1");
    });

    test("a member's own vote is never masked from them", () => {
      roomManager.submitVote("room1", "admin", "5");
      roomManager.submitVote("room1", "user1", "3");

      expect(roomManager.voteSnapshot("room1", "admin")).toEqual(
        new Map([
          ["admin", "5"],
          ["user1", "?"],
        ]),
      );
      expect(roomManager.voteSnapshot("room1", "user1")).toEqual(
        new Map([
          ["admin", "?"],
          ["user1", "3"],
        ]),
      );
    });

    test("an uncast vote reads as null for everyone, own or not", () => {
      roomManager.submitVote("room1", "user1", "3");

      expect(roomManager.voteSnapshot("room1", "admin")).toEqual(
        new Map([
          ["admin", null],
          ["user1", "?"],
        ]),
      );
    });

    test("revealing unmasks every vote regardless of the viewer", () => {
      roomManager.submitVote("room1", "admin", "5");
      roomManager.submitVote("room1", "user1", "3");
      roomManager.setVoteVisibility("room1", "admin", true);

      const revealed = new Map([
        ["admin", "5"],
        ["user1", "3"],
      ]);
      expect(roomManager.voteSnapshot("room1", "user1")).toEqual(revealed);
      expect(roomManager.voteSnapshot("room1")).toEqual(revealed);
    });

    test("an unknown viewer gets a fully masked snapshot", () => {
      roomManager.submitVote("room1", "admin", "5");

      expect(roomManager.voteSnapshot("room1", "stranger")).toEqual(
        new Map([
          ["admin", "?"],
          ["user1", null],
        ]),
      );
    });

    test("getUsersVote always masks — it feeds the broadcast to everyone else", () => {
      roomManager.submitVote("room1", "admin", "5");
      expect(roomManager.getUsersVote("room1", "admin")).toBe("?");
    });

    test("the returned snapshot cannot mutate internal room state", () => {
      roomManager.submitVote("room1", "admin", "5");

      roomManager.voteSnapshot("room1").set("admin", "999");

      roomManager.setVoteVisibility("room1", "admin", true);
      expect(roomManager.voteSnapshot("room1").get("admin")).toBe("5");
    });
  });

  describe("leaving room", () => {
    test("should destroy room when admin leaves", () => {
      roomManager.joinRoom("room1", "admin");
      roomManager.joinRoom("room1", "user1");
      const result = roomManager.leaveRoom("room1", "admin");
      expect(result.destroyed).toBe(true);
      expect(roomManager.getRoomUsers("room1")).toEqual([]);
      expect(() => roomManager.submitVote("room1", "user1", "5")).toThrow("Room does not exist");
    });

    test("should not destroy room when non-admin leaves", () => {
      roomManager.joinRoom("room1", "admin");
      roomManager.joinRoom("room1", "user1");
      const result = roomManager.leaveRoom("room1", "user1");
      expect(result.destroyed).toBe(false);
      expect(roomManager.getRoomUsers("room1")).toEqual(["admin"]);
    });

    test("the last non-admin leaving keeps the room open for the admin", () => {
      roomManager.joinRoom("room1", "admin");
      roomManager.joinRoom("room1", "user1");

      expect(roomManager.leaveRoom("room1", "user1").destroyed).toBe(false);
      expect(roomManager.roomExists("room1")).toBe(true);
      expect(roomManager.getRoomUsers("room1")).toEqual(["admin"]);
    });

    test("destruction follows the admin role, not the original creator", () => {
      roomManager.joinRoom("room1", "admin");
      roomManager.joinRoom("room1", "user1");
      roomManager.transferAdmin("room1", "admin", "user1");

      // The creator is now an ordinary member.
      expect(roomManager.leaveRoom("room1", "admin").destroyed).toBe(false);
      expect(roomManager.roomExists("room1")).toBe(true);

      expect(roomManager.leaveRoom("room1", "user1").destroyed).toBe(true);
      expect(roomManager.roomExists("room1")).toBe(false);
    });
  });

  describe("removeParticipant", () => {
    const roomId = "room1";
    const admin = "admin";

    beforeEach(() => {
      roomManager.joinRoom(roomId, admin);
      roomManager.joinRoom(roomId, "user1");
      roomManager.joinRoom(roomId, "user2");
    });

    test("admin should be able to remove a participant", () => {
      roomManager.removeParticipant(roomId, admin, "user1");

      // Verify user was removed
      const users = roomManager.getRoomUsers(roomId);
      expect(users).toEqual([admin, "user2"]);
      expect(users).not.toContain("user1");

      // Verify their vote was removed
      const votes = roomManager.voteSnapshot(roomId);
      expect(votes.has("user1")).toBe(false);
    });

    test("should throw error if room does not exist", () => {
      expect(() => roomManager.removeParticipant("nonexistent", admin, "user1")).toThrow(
        "Room does not exist",
      );
    });

    test("should throw error if non-admin tries to remove a participant", () => {
      expect(() => roomManager.removeParticipant(roomId, "user1", "user2")).toThrow(
        "Only the admin can remove participants",
      );
    });

    test("should throw error if participant does not exist in room", () => {
      expect(() => roomManager.removeParticipant(roomId, admin, "nonexistent")).toThrow(
        "Participant not found in room",
      );
    });

    test("should throw error if admin tries to remove themselves", () => {
      expect(() => roomManager.removeParticipant(roomId, admin, admin)).toThrow(
        "Admin cannot remove themselves",
      );
    });

    test("should remove participant's vote when they are removed", () => {
      // Submit a vote for the user
      roomManager.submitVote(roomId, "user1", "5");

      // Verify the vote exists
      roomManager.setVoteVisibility(roomId, admin, true);
      expect(roomManager.voteSnapshot(roomId).get("user1")).toBe("5");

      // Remove the participant
      roomManager.removeParticipant(roomId, admin, "user1");

      // Verify the vote was removed
      const votes = roomManager.voteSnapshot(roomId);
      expect(votes.has("user1")).toBe(false);
    });

    test("should work correctly when removing multiple participants", () => {
      roomManager.removeParticipant(roomId, admin, "user1");
      roomManager.removeParticipant(roomId, admin, "user2");

      // Verify only admin remains
      const users = roomManager.getRoomUsers(roomId);
      expect(users).toEqual([admin]);
      expect(users).not.toContain("user1");
      expect(users).not.toContain("user2");
    });
  });

  describe("decks", () => {
    test("new room defaults to fibonacci", () => {
      roomManager.joinRoom("room1", "admin");
      expect(roomManager.getRoomDeck("room1")).toBe("fibonacci");
    });

    test("creator's deck argument is honored", () => {
      roomManager.joinRoom("room1", "admin", "tshirt");
      expect(roomManager.getRoomDeck("room1")).toBe("tshirt");
    });

    test("joiner's deck argument is ignored on an existing room", () => {
      roomManager.joinRoom("room1", "admin", "tshirt");
      roomManager.joinRoom("room1", "user1", "linear");
      expect(roomManager.getRoomDeck("room1")).toBe("tshirt");
    });

    test("roomExists reflects room lifecycle", () => {
      expect(roomManager.roomExists("room1")).toBe(false);
      roomManager.joinRoom("room1", "admin");
      expect(roomManager.roomExists("room1")).toBe(true);
      roomManager.leaveRoom("room1", "admin");
      expect(roomManager.roomExists("room1")).toBe(false);
    });

    test("getRoomDeck throws for non-existent room", () => {
      expect(() => roomManager.getRoomDeck("nonexistent")).toThrow("Room does not exist");
    });

    test("submitVote validates against the room's deck", () => {
      roomManager.joinRoom("tshirt-room", "admin", "tshirt");
      roomManager.joinRoom("fib-room", "admin");

      roomManager.submitVote("tshirt-room", "admin", "XS");
      expect(() => roomManager.submitVote("fib-room", "admin", "XS")).toThrow("Invalid vote value");
      expect(() => roomManager.submitVote("tshirt-room", "admin", "5")).toThrow(
        "Invalid vote value",
      );
    });

    test("'?' is accepted in every deck", () => {
      roomManager.joinRoom("tshirt-room", "admin", "tshirt");
      roomManager.joinRoom("fib-room", "admin");

      roomManager.submitVote("tshirt-room", "admin", "?");
      roomManager.submitVote("fib-room", "admin", "?");
    });

    describe("setDeck", () => {
      beforeEach(() => {
        roomManager.joinRoom("room1", "admin");
        roomManager.joinRoom("room1", "user1");
      });

      test("non-admin cannot change the deck", () => {
        expect(() => roomManager.setDeck("room1", "user1", "tshirt")).toThrow(
          "Only the admin can change the deck",
        );
      });

      test("throws for non-existent room", () => {
        expect(() => roomManager.setDeck("nonexistent", "admin", "tshirt")).toThrow(
          "Room does not exist",
        );
      });

      test("changing deck nulls all votes and resets revealed/locked", () => {
        roomManager.submitVote("room1", "user1", "5");
        roomManager.setVoteVisibility("room1", "admin", true);
        roomManager.setVoteLock("room1", "admin", true);

        const changed = roomManager.setDeck("room1", "admin", "tshirt");

        expect(changed).toBe(true);
        expect(roomManager.getRoomDeck("room1")).toBe("tshirt");
        expect(roomManager.getUsersVote("room1", "user1")).toBeNull();
        expect(roomManager.getRoomVisibility("room1")).toBe(false);
        expect(roomManager.getRoomLockState("room1")).toBe(false);
      });

      test("same-deck call is a no-op and leaves votes untouched", () => {
        roomManager.submitVote("room1", "user1", "5");
        roomManager.setVoteVisibility("room1", "admin", true);

        const changed = roomManager.setDeck("room1", "admin", "fibonacci");

        expect(changed).toBe(false);
        expect(roomManager.getUsersVote("room1", "user1")).toBe("5");
        expect(roomManager.getRoomVisibility("room1")).toBe(true);
      });
    });
  });

  describe("spectators", () => {
    beforeEach(() => {
      roomManager.joinRoom("room1", "admin");
      roomManager.joinRoom("room1", "voter1");
      roomManager.joinRoom("room1", "watcher", undefined, "spectator");
    });

    test("spectator is in the room but has no vote entry", () => {
      expect(roomManager.isUserInRoom("room1", "watcher")).toBe(true);
      expect(roomManager.getRoomSpectators("room1")).toEqual(["watcher"]);
      expect(roomManager.isSpectator("room1", "watcher")).toBe(true);
      expect(roomManager.isSpectator("room1", "voter1")).toBe(false);
      expect(roomManager.voteSnapshot("room1").has("watcher")).toBe(false);
    });

    test("spectator cannot vote", () => {
      expect(() => roomManager.submitVote("room1", "watcher", "5")).toThrow(
        "Spectators cannot vote",
      );
      expect(roomManager.voteSnapshot("room1").has("watcher")).toBe(false);
    });

    test("spectator username is still reserved", () => {
      expect(() => roomManager.joinRoom("room1", "watcher")).toThrow("Username is already taken");
    });

    test("leaving removes the spectator entry", () => {
      roomManager.leaveRoom("room1", "watcher");
      expect(roomManager.getRoomSpectators("room1")).toEqual([]);
      expect(roomManager.isUserInRoom("room1", "watcher")).toBe(false);
    });

    test("admin can remove a spectator", () => {
      roomManager.removeParticipant("room1", "admin", "watcher");
      expect(roomManager.getRoomSpectators("room1")).toEqual([]);
      expect(roomManager.isUserInRoom("room1", "watcher")).toBe(false);
    });

    test("spectator can be made admin and run the round", () => {
      roomManager.transferAdmin("room1", "admin", "watcher");
      roomManager.submitVote("room1", "voter1", "5");
      roomManager.setVoteVisibility("room1", "watcher", true);
      expect(roomManager.voteSnapshot("room1").get("voter1")).toBe("5");
      roomManager.clearVotes("room1", "watcher");
      expect(roomManager.voteSnapshot("room1").get("voter1")).toBeNull();
    });

    test("clearVotes and setDeck leave spectators untouched", () => {
      roomManager.submitVote("room1", "voter1", "5");
      roomManager.clearVotes("room1", "admin");
      expect(roomManager.getRoomSpectators("room1")).toEqual(["watcher"]);
      roomManager.setDeck("room1", "admin", "tshirt");
      expect(roomManager.getRoomSpectators("room1")).toEqual(["watcher"]);
      expect(roomManager.voteSnapshot("room1").has("watcher")).toBe(false);
    });

    test("getRoomSpectators returns empty for non-existent room", () => {
      expect(roomManager.getRoomSpectators("nonexistent")).toEqual([]);
      expect(roomManager.isSpectator("nonexistent", "watcher")).toBe(false);
    });
  });

  describe("isUserInRoom", () => {
    test("should return true for a user in the room", () => {
      roomManager.joinRoom("room1", "admin");
      expect(roomManager.isUserInRoom("room1", "admin")).toBe(true);
    });

    test("should return false for a user not in the room", () => {
      roomManager.joinRoom("room1", "admin");
      expect(roomManager.isUserInRoom("room1", "nonexistent")).toBe(false);
    });

    test("should return false for a non-existent room", () => {
      expect(roomManager.isUserInRoom("nonexistent", "admin")).toBe(false);
    });

    test("should return false after user leaves", () => {
      roomManager.joinRoom("room1", "admin");
      roomManager.joinRoom("room1", "user1");
      roomManager.leaveRoom("room1", "user1");
      expect(roomManager.isUserInRoom("room1", "user1")).toBe(false);
    });
  });
});
