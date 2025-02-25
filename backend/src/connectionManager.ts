import type { ServerWebSocket } from "bun";
import { MessageHandler } from "./messageHandler";

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
   * Remove a participant from a room and close their connection
   * @param roomId - The room ID
   * @param participantToRemove - The username of the participant to remove
   * @param removedBy - The username of the user who initiated the removal
   * @returns True if the participant was removed, false otherwise
   */
  removeParticipant(roomId: string, participantToRemove: string, removedBy: string): boolean {
    const connection = this.getConnection(roomId, participantToRemove);
    if (!connection) return false;

    // Send a message to the user that they've been removed
    connection.send(MessageHandler.createMessage("youWereRemoved", {
      removedBy
    }));

    // Close the connection
    connection.close(1000, "Removed by room admin");

    // Remove from our registry
    return this.removeConnection(roomId, participantToRemove);
  }

  /**
   * Get all connections in a room
   * @param roomId - The room ID
   * @returns A map of username to WebSocket connection
   */
  getRoomConnections(roomId: string): Map<string, ServerWebSocket<WebSocketData>> | undefined {
    return this.connections.get(roomId);
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
