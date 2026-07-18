import { expect, test, describe, beforeEach } from "bun:test";
import { ConnectionManager } from "../connectionManager";

// Mock ServerWebSocket
class MockWebSocket {
  closed = false;
  closeCode?: number;
  closeReason?: string;

  close(code?: number, reason?: string) {
    this.closed = true;
    this.closeCode = code;
    this.closeReason = reason;
  }
}

describe("ConnectionManager", () => {
  let connectionManager: ConnectionManager;
  let mockWs1: MockWebSocket;
  let mockWs2: MockWebSocket;

  beforeEach(() => {
    connectionManager = new ConnectionManager();
    mockWs1 = new MockWebSocket() as any;
    mockWs2 = new MockWebSocket() as any;
  });

  describe("registerConnection", () => {
    test("should register a new connection", () => {
      connectionManager.registerConnection("room1", "user1", mockWs1 as any);
      expect(connectionManager.isConnected("room1", "user1")).toBe(true);
    });

    test("should register multiple connections in the same room", () => {
      connectionManager.registerConnection("room1", "user1", mockWs1 as any);
      connectionManager.registerConnection("room1", "user2", mockWs2 as any);

      expect(connectionManager.isConnected("room1", "user1")).toBe(true);
      expect(connectionManager.isConnected("room1", "user2")).toBe(true);
    });

    test("should register connections in different rooms", () => {
      connectionManager.registerConnection("room1", "user1", mockWs1 as any);
      connectionManager.registerConnection("room2", "user2", mockWs2 as any);

      expect(connectionManager.isConnected("room1", "user1")).toBe(true);
      expect(connectionManager.isConnected("room2", "user2")).toBe(true);
    });

    test("should override existing connection for same room and username", () => {
      connectionManager.registerConnection("room1", "user1", mockWs1 as any);
      connectionManager.registerConnection("room1", "user1", mockWs2 as any);

      const connection = connectionManager.getConnection("room1", "user1");
      expect(connection).toBe(mockWs2 as any);
    });
  });

  describe("removeConnection", () => {
    beforeEach(() => {
      connectionManager.registerConnection("room1", "user1", mockWs1 as any);
      connectionManager.registerConnection("room1", "user2", mockWs2 as any);
      connectionManager.registerConnection("room2", "user3", mockWs1 as any);
    });

    test("should remove an existing connection", () => {
      const result = connectionManager.removeConnection("room1", "user1");

      expect(result).toBe(true);
      expect(connectionManager.isConnected("room1", "user1")).toBe(false);
      expect(connectionManager.isConnected("room1", "user2")).toBe(true);
    });

    test("should return false when removing non-existent connection", () => {
      const result = connectionManager.removeConnection("room1", "nonexistent");

      expect(result).toBe(false);
    });

    test("should return false when removing from non-existent room", () => {
      const result = connectionManager.removeConnection("nonexistent", "user1");

      expect(result).toBe(false);
    });

    test("should clean up empty rooms", () => {
      connectionManager.removeConnection("room2", "user3");

      expect(connectionManager.getConnection("room2", "user3")).toBeUndefined();
      expect(connectionManager.isConnected("room2", "user3")).toBe(false);
    });
  });

  describe("getConnection", () => {
    beforeEach(() => {
      connectionManager.registerConnection("room1", "user1", mockWs1 as any);
    });

    test("should return the connection for an existing user", () => {
      const connection = connectionManager.getConnection("room1", "user1");
      expect(connection).toBe(mockWs1 as any);
    });

    test("should return undefined for non-existent user", () => {
      const connection = connectionManager.getConnection("room1", "nonexistent");
      expect(connection).toBeUndefined();
    });

    test("should return undefined for non-existent room", () => {
      const connection = connectionManager.getConnection("nonexistent", "user1");
      expect(connection).toBeUndefined();
    });
  });

  describe("closeConnection", () => {
    beforeEach(() => {
      connectionManager.registerConnection("room1", "user1", mockWs1 as any);
    });

    test("should close the socket with the given reason and drop it from the registry", () => {
      const result = connectionManager.closeConnection("room1", "user1", "Removed by admin");

      expect(result).toBe(true);
      expect(mockWs1.closed).toBe(true);
      expect(mockWs1.closeCode).toBe(1000);
      expect(mockWs1.closeReason).toBe("Removed by admin");
      expect(connectionManager.isConnected("room1", "user1")).toBe(false);
    });

    test("should return false for a user without a connection", () => {
      const result = connectionManager.closeConnection("room1", "nonexistent", "whatever");
      expect(result).toBe(false);
    });

    test("should return false for a non-existent room", () => {
      const result = connectionManager.closeConnection("nonexistent", "user1", "whatever");
      expect(result).toBe(false);
    });
  });

  describe("forRoom", () => {
    test("should return every live connection in the room as pairs", () => {
      connectionManager.registerConnection("room1", "user1", mockWs1 as any);
      connectionManager.registerConnection("room1", "user2", mockWs2 as any);
      connectionManager.registerConnection("room2", "user3", mockWs1 as any);

      expect(connectionManager.forRoom("room1")).toEqual([
        ["user1", mockWs1 as any],
        ["user2", mockWs2 as any],
      ]);
    });

    test("should return an empty list for an unknown room", () => {
      expect(connectionManager.forRoom("nonexistent")).toEqual([]);
    });

    test("should return a snapshot that is safe to iterate while removing", () => {
      connectionManager.registerConnection("room1", "user1", mockWs1 as any);
      connectionManager.registerConnection("room1", "user2", mockWs2 as any);

      const members = connectionManager.forRoom("room1");
      for (const [username] of members) connectionManager.removeConnection("room1", username);

      expect(members).toHaveLength(2);
      expect(connectionManager.forRoom("room1")).toEqual([]);
    });
  });

  describe("isConnected", () => {
    beforeEach(() => {
      connectionManager.registerConnection("room1", "user1", mockWs1 as any);
    });

    test("should return true for connected user", () => {
      expect(connectionManager.isConnected("room1", "user1")).toBe(true);
    });

    test("should return false for non-existent user", () => {
      expect(connectionManager.isConnected("room1", "nonexistent")).toBe(false);
    });

    test("should return false for non-existent room", () => {
      expect(connectionManager.isConnected("nonexistent", "user1")).toBe(false);
    });
  });
});
