import { expect, test, describe, beforeEach, mock } from 'bun:test';
import { ConnectionManager } from '../connectionManager';

// Mock ServerWebSocket
class MockWebSocket {
  sent: any[] = [];
  closed = false;
  closeCode?: number;
  closeReason?: string;

  send(data: any) {
    this.sent.push(data);
  }

  close(code?: number, reason?: string) {
    this.closed = true;
    this.closeCode = code;
    this.closeReason = reason;
  }
}

describe('ConnectionManager', () => {
  let connectionManager: ConnectionManager;
  let mockWs1: MockWebSocket;
  let mockWs2: MockWebSocket;

  beforeEach(() => {
    connectionManager = new ConnectionManager();
    mockWs1 = new MockWebSocket() as any;
    mockWs2 = new MockWebSocket() as any;
  });

  describe('registerConnection', () => {
    test('should register a new connection', () => {
      connectionManager.registerConnection('room1', 'user1', mockWs1 as any);
      expect(connectionManager.isConnected('room1', 'user1')).toBe(true);
    });

    test('should register multiple connections in the same room', () => {
      connectionManager.registerConnection('room1', 'user1', mockWs1 as any);
      connectionManager.registerConnection('room1', 'user2', mockWs2 as any);

      expect(connectionManager.isConnected('room1', 'user1')).toBe(true);
      expect(connectionManager.isConnected('room1', 'user2')).toBe(true);
    });

    test('should register connections in different rooms', () => {
      connectionManager.registerConnection('room1', 'user1', mockWs1 as any);
      connectionManager.registerConnection('room2', 'user2', mockWs2 as any);

      expect(connectionManager.isConnected('room1', 'user1')).toBe(true);
      expect(connectionManager.isConnected('room2', 'user2')).toBe(true);
    });

    test('should override existing connection for same room and username', () => {
      connectionManager.registerConnection('room1', 'user1', mockWs1 as any);
      connectionManager.registerConnection('room1', 'user1', mockWs2 as any);

      const connection = connectionManager.getConnection('room1', 'user1');
      expect(connection).toBe(mockWs2 as any);
    });
  });

  describe('removeConnection', () => {
    beforeEach(() => {
      connectionManager.registerConnection('room1', 'user1', mockWs1 as any);
      connectionManager.registerConnection('room1', 'user2', mockWs2 as any);
      connectionManager.registerConnection('room2', 'user3', mockWs1 as any);
    });

    test('should remove an existing connection', () => {
      const result = connectionManager.removeConnection('room1', 'user1');

      expect(result).toBe(true);
      expect(connectionManager.isConnected('room1', 'user1')).toBe(false);
      expect(connectionManager.isConnected('room1', 'user2')).toBe(true);
    });

    test('should return false when removing non-existent connection', () => {
      const result = connectionManager.removeConnection('room1', 'nonexistent');

      expect(result).toBe(false);
    });

    test('should return false when removing from non-existent room', () => {
      const result = connectionManager.removeConnection('nonexistent', 'user1');

      expect(result).toBe(false);
    });

    test('should clean up empty rooms', () => {
      connectionManager.removeConnection('room2', 'user3');

      // Try to get connections for the now-empty room
      const roomConnections = connectionManager.getRoomConnections('room2');
      expect(roomConnections).toBeUndefined();
    });
  });

  describe('getConnection', () => {
    beforeEach(() => {
      connectionManager.registerConnection('room1', 'user1', mockWs1 as any);
    });

    test('should return the connection for an existing user', () => {
      const connection = connectionManager.getConnection('room1', 'user1');
      expect(connection).toBe(mockWs1 as any);
    });

    test('should return undefined for non-existent user', () => {
      const connection = connectionManager.getConnection('room1', 'nonexistent');
      expect(connection).toBeUndefined();
    });

    test('should return undefined for non-existent room', () => {
      const connection = connectionManager.getConnection('nonexistent', 'user1');
      expect(connection).toBeUndefined();
    });
  });

  describe('removeParticipant', () => {
    beforeEach(() => {
      connectionManager.registerConnection('room1', 'user1', mockWs1 as any);
    });

    test('should remove participant and close their connection', () => {
      const result = connectionManager.removeParticipant('room1', 'user1', 'admin');

      expect(result).toBe(true);
      expect(connectionManager.isConnected('room1', 'user1')).toBe(false);

      // Check that the connection was closed properly
      expect(mockWs1.closed).toBe(true);
      expect(mockWs1.closeCode).toBe(1000);
      expect(mockWs1.closeReason).toBe('Removed by room admin');

      // Check that the user was notified
      expect(mockWs1.sent.length).toBe(1);
      const sentMessage = JSON.parse(mockWs1.sent[0]);
      expect(sentMessage.type).toBe('youWereRemoved');
      expect(sentMessage.data.removedBy).toBe('admin');
    });

    test('should return false when removing non-existent participant', () => {
      const result = connectionManager.removeParticipant('room1', 'nonexistent', 'admin');
      expect(result).toBe(false);
    });

    test('should return false when removing from non-existent room', () => {
      const result = connectionManager.removeParticipant('nonexistent', 'user1', 'admin');
      expect(result).toBe(false);
    });
  });

  describe('getRoomConnections', () => {
    beforeEach(() => {
      connectionManager.registerConnection('room1', 'user1', mockWs1 as any);
      connectionManager.registerConnection('room1', 'user2', mockWs2 as any);
    });

    test('should return all connections in a room', () => {
      const connections = connectionManager.getRoomConnections('room1');

      expect(connections).toBeDefined();
      expect(connections?.size).toBe(2);
      expect(connections?.get('user1')).toBe(mockWs1 as any);
      expect(connections?.get('user2')).toBe(mockWs2 as any);
    });

    test('should return undefined for non-existent room', () => {
      const connections = connectionManager.getRoomConnections('nonexistent');
      expect(connections).toBeUndefined();
    });
  });

  describe('isConnected', () => {
    beforeEach(() => {
      connectionManager.registerConnection('room1', 'user1', mockWs1 as any);
    });

    test('should return true for connected user', () => {
      expect(connectionManager.isConnected('room1', 'user1')).toBe(true);
    });

    test('should return false for non-existent user', () => {
      expect(connectionManager.isConnected('room1', 'nonexistent')).toBe(false);
    });

    test('should return false for non-existent room', () => {
      expect(connectionManager.isConnected('nonexistent', 'user1')).toBe(false);
    });
  });
});
