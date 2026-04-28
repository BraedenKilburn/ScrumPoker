import { expect, test, describe, beforeEach, afterEach, mock } from "bun:test";
import { DisconnectManager } from "../disconnectManager";

describe("DisconnectManager", () => {
  let disconnectManager: DisconnectManager;

  beforeEach(() => {
    disconnectManager = new DisconnectManager();
  });

  afterEach(() => {
    // Clean up any remaining timers
    disconnectManager.clearRoom("room1");
    disconnectManager.clearRoom("room2");
  });

  describe("markDisconnected", () => {
    test("should mark a user as disconnected", () => {
      const onExpiry = mock(() => {});
      disconnectManager.markDisconnected("room1", "user1", onExpiry);

      expect(disconnectManager.isDisconnected("room1", "user1")).toBe(true);
    });

    test("should call onExpiry after grace period", async () => {
      const onExpiry = mock(() => {});
      disconnectManager.markDisconnected("room1", "user1", onExpiry, 50);

      expect(onExpiry).not.toHaveBeenCalled();
      await new Promise((resolve) => setTimeout(resolve, 100));
      expect(onExpiry).toHaveBeenCalledTimes(1);
    });

    test("should remove user from disconnected after expiry", async () => {
      const onExpiry = mock(() => {});
      disconnectManager.markDisconnected("room1", "user1", onExpiry, 50);

      await new Promise((resolve) => setTimeout(resolve, 100));
      expect(disconnectManager.isDisconnected("room1", "user1")).toBe(false);
    });
  });

  describe("cancelDisconnect", () => {
    test("should cancel a pending disconnect", () => {
      const onExpiry = mock(() => {});
      disconnectManager.markDisconnected("room1", "user1", onExpiry);

      const result = disconnectManager.cancelDisconnect("room1", "user1");
      expect(result).toBe(true);
      expect(disconnectManager.isDisconnected("room1", "user1")).toBe(false);
    });

    test("should not call onExpiry after cancel", async () => {
      const onExpiry = mock(() => {});
      disconnectManager.markDisconnected("room1", "user1", onExpiry, 50);

      disconnectManager.cancelDisconnect("room1", "user1");
      await new Promise((resolve) => setTimeout(resolve, 100));
      expect(onExpiry).not.toHaveBeenCalled();
    });

    test("should return false for non-existent room", () => {
      const result = disconnectManager.cancelDisconnect("nonexistent", "user1");
      expect(result).toBe(false);
    });

    test("should return false for non-existent user", () => {
      const onExpiry = mock(() => {});
      disconnectManager.markDisconnected("room1", "user1", onExpiry);

      const result = disconnectManager.cancelDisconnect("room1", "nonexistent");
      expect(result).toBe(false);
    });
  });

  describe("isDisconnected", () => {
    test("should return false for unknown room", () => {
      expect(disconnectManager.isDisconnected("room1", "user1")).toBe(false);
    });

    test("should return false for unknown user", () => {
      const onExpiry = mock(() => {});
      disconnectManager.markDisconnected("room1", "user1", onExpiry);

      expect(disconnectManager.isDisconnected("room1", "user2")).toBe(false);
    });

    test("should return true for disconnected user", () => {
      const onExpiry = mock(() => {});
      disconnectManager.markDisconnected("room1", "user1", onExpiry);

      expect(disconnectManager.isDisconnected("room1", "user1")).toBe(true);
    });
  });

  describe("clearRoom", () => {
    test("should clear all disconnects for a room", () => {
      const onExpiry1 = mock(() => {});
      const onExpiry2 = mock(() => {});
      disconnectManager.markDisconnected("room1", "user1", onExpiry1);
      disconnectManager.markDisconnected("room1", "user2", onExpiry2);

      disconnectManager.clearRoom("room1");

      expect(disconnectManager.isDisconnected("room1", "user1")).toBe(false);
      expect(disconnectManager.isDisconnected("room1", "user2")).toBe(false);
    });

    test("should not call onExpiry after clearing", async () => {
      const onExpiry = mock(() => {});
      disconnectManager.markDisconnected("room1", "user1", onExpiry, 50);

      disconnectManager.clearRoom("room1");
      await new Promise((resolve) => setTimeout(resolve, 100));
      expect(onExpiry).not.toHaveBeenCalled();
    });

    test("should not affect other rooms", () => {
      const onExpiry1 = mock(() => {});
      const onExpiry2 = mock(() => {});
      disconnectManager.markDisconnected("room1", "user1", onExpiry1);
      disconnectManager.markDisconnected("room2", "user2", onExpiry2);

      disconnectManager.clearRoom("room1");

      expect(disconnectManager.isDisconnected("room1", "user1")).toBe(false);
      expect(disconnectManager.isDisconnected("room2", "user2")).toBe(true);
    });

    test("should handle clearing non-existent room", () => {
      // Should not throw
      disconnectManager.clearRoom("nonexistent");
    });
  });
});
