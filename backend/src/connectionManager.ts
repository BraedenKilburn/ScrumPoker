import type { ServerWebSocket } from "bun";
import type { WebSocketData } from "@shared/types";

/**
 * Pure socket registry: which member of which room holds which live
 * connection. It knows nothing about message types — deciding who hears
 * what is the RoomBroadcaster's job.
 */
export class ConnectionManager {
  private connections = new Map<string, Map<string, ServerWebSocket<WebSocketData>>>();

  /**
   * Register a new WebSocket connection
   * @param roomId - The room ID the connection belongs to
   * @param username - The username associated with the connection
   * @param ws - The WebSocket connection
   */
  registerConnection(roomId: string, username: string, ws: ServerWebSocket<WebSocketData>): void {
    if (!this.connections.has(roomId)) this.connections.set(roomId, new Map());
    this.connections.get(roomId)?.set(username, ws);
  }

  /**
   * Remove a WebSocket connection
   * @param roomId - The room ID the connection belongs to
   * @param username - The username associated with the connection
   * @returns True if the connection was removed, false otherwise
   */
  removeConnection(roomId: string, username: string): boolean {
    const roomConnections = this.connections.get(roomId);
    if (!roomConnections) return false;

    const result = roomConnections.delete(username);

    // Clean up empty room maps
    if (roomConnections.size === 0) this.connections.delete(roomId);
    return result;
  }

  /**
   * Get a WebSocket connection
   * @param roomId - The room ID the connection belongs to
   * @param username - The username associated with the connection
   * @returns The WebSocket connection or undefined if not found
   */
  getConnection(roomId: string, username: string): ServerWebSocket<WebSocketData> | undefined {
    return this.connections.get(roomId)?.get(username);
  }

  /**
   * Close a user's connection and drop it from the registry
   * @param roomId - The room ID the connection belongs to
   * @param username - The username associated with the connection
   * @param reason - The close reason sent with the normal-closure code
   * @returns True if a connection existed and was closed, false otherwise
   */
  closeConnection(roomId: string, username: string, reason: string): boolean {
    const connection = this.getConnection(roomId, username);
    if (!connection) return false;

    connection.close(1000, reason);
    return this.removeConnection(roomId, username);
  }

  /**
   * Check if a user is connected to a room
   * @param roomId - The room ID
   * @param username - The username
   * @returns True if the user is connected, false otherwise
   */
  isConnected(roomId: string, username: string): boolean {
    return !!this.getConnection(roomId, username);
  }
}
