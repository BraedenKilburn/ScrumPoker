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
      expect(() => roomManager.clearVotes("room1", "user1")).toThrow("Only the admin can clear votes");
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
      expect(() => roomManager.transferAdmin("room2", admin, user))
        .toThrow("Room does not exist");
    });

    test("should not allow non-admin to transfer admin rights", () => {
      expect(() => roomManager.transferAdmin(roomId, user, admin))
        .toThrow("Only the admin can transfer admin rights");
    });

    test("should throw error if user is not in room", () => {
      expect(() => roomManager.transferAdmin(roomId, admin, "user2"))
        .toThrow("New admin must be in the room");
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
      expect(roomManager.getRoomVotes("room1"))
        .toEqual(new Map([["admin", "?"], ["user1", "?"]]));

      roomManager.setVoteVisibility("room1", "admin", true);
      expect(roomManager.getRoomVotes("room1"))
        .toEqual(new Map([["admin", "5"], ["user1", "3"]]));
    });
  });

  describe("leaving room", () => {
    test("should destroy room when admin leaves", () => {
      roomManager.joinRoom("room1", "admin");
      roomManager.joinRoom("room1", "user1");
      const result = roomManager.leaveRoom("room1", "admin");
      expect(result.shouldDestroyRoom).toBe(true);
      expect(roomManager.getRoomUsers("room1")).toEqual([]);
      expect(() => roomManager.submitVote("room1", "user1", "5"))
        .toThrow("Room does not exist");
    });

    test("should not destroy room when non-admin leaves", () => {
      roomManager.joinRoom("room1", "admin");
      roomManager.joinRoom("room1", "user1");
      const result = roomManager.leaveRoom("room1", "user1");
      expect(result.shouldDestroyRoom).toBe(false);
      expect(roomManager.getRoomUsers("room1")).toEqual(["admin"]);
    });
  });
});
