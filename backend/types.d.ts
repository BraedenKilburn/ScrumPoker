type WebSocketData = {
  roomId: string;
  username: string;
};

type WebSocketMessage = {
  type: string;
  data: Record<string, any>;
};

/**
 * A user's point estimation.
 * If the vote is not set, it is null; otherwise, it is a string
 * (e.g., "3", "5", "?", etc.)
 */
type Vote = string | null;

type Room = {
  /**
   * All users in the room
   */
  users: Set<string>;

  /**
   * The votes in the room for each user
   */
  votes: Map<string, Vote>;

  /**
   * Whether the votes are revealed for the room
   */
  revealed: boolean;

  /**
   * Whether the votes are locked
   */
  locked: boolean;

  /**
   * The admin of the room
   */
  admin: string;
};

/**
 * A manager for rooms
 */
interface RoomManager {
  /**
   * Join a room if it exists, otherwise create it.
   * @param roomId - The ID of the room to join
   * @param username - The username of the user to join the room
   */
  joinRoom(roomId: string, username: string): void;

  /**
   * Transfer the admin rights of a room to another user
   * @param roomId - The ID of the room to transfer the admin rights for
   * @param currentAdmin - The current admin of the room
   * @param newAdmin - The new admin of the room
   */
  transferAdmin(roomId: string, currentAdmin: string, newAdmin: string): void;

  /**
   * Check if a user is the admin of a room
   * @param roomId - The ID of the room to check the admin rights for
   * @param username - The username of the user to check the admin rights for
   * @returns Whether the user is the admin of the room
   */
  isAdmin(roomId: string, username: string): boolean;

  /**
   * Get the admin of a room
   * @param roomId - The ID of the room to get the admin of
   * @returns The admin of the room
   */
  getAdmin(roomId: string): string | null;

  /**
   * Leave a room, if the room is empty, it will be deleted.
   * @param roomId - The ID of the room to leave
   * @param username - The username of the user to leave the room
   * @returns Whether the room should be destroyed
   */
  leaveRoom(roomId: string, username: string): { shouldDestroyRoom: boolean };

  /**
   * Submit a vote for a user in a room
   * @param roomId - The ID of the room to submit the vote to
   * @param username - The username of the user to submit the vote for
   * @param vote - The vote to submit
   */
  submitVote(roomId: string, username: string, vote: Vote): void;

  /**
   * Set the visibility of the votes in a room
   * @param roomId - The ID of the room to set the visibility of the votes for
   * @param username - The username of the user trying to set the visibility of the votes
   * @param revealed - Whether the votes are revealed
   */
  setVoteVisibility(roomId: string, username: string, revealed: boolean): void;

  /**
   * Clear the votes in a room
   * @param roomId - The ID of the room to clear the votes for
   * @param username - The username of the user trying to clear the votes
   */
  clearVotes(roomId: string, username: string): void;

  /**
   * Get the users in a room
   * @param roomId - The ID of the room to get the users from
   * @returns An array of usernames
   */
  getRoomUsers(roomId: string): string[];

  /**
   * Get the visibility of the votes in a room
   * @param roomId - The ID of the room to get the visibility of the votes for
   * @returns Whether the votes are revealed
   */
  getRoomVisibility(roomId: string): boolean;

  /**
   * Get the vote of a user in a room
   * @param roomId - The ID of the room to get the vote from
   * @param username - The username of the user to get the vote for
   * @returns The vote of the user
   */
  getUsersVote(roomId: string, username: string): Vote;

  /**
   * Get the votes in a room
   * @param roomId - The ID of the room to get the votes from
   * @returns A map of usernames to their votes
   */
  getRoomVotes(roomId: string): Map<string, Vote>;

  /**
   * Set the lock state of votes in a room
   * @param roomId - The ID of the room to set the lock state for
   * @param username - The username of the user trying to set the lock state
   * @param locked - Whether the votes should be locked
   */
  setVoteLock(roomId: string, username: string, locked: boolean): void;

  /**
   * Get the lock state of votes in a room
   * @param roomId - The ID of the room to get the lock state from
   * @returns Whether the votes are locked
   */
  getRoomLockState(roomId: string): boolean;
}

/**
 * A handler for parsing and creating WebSocket messages
 */
interface MessageHandler {
  /**
   * Parse a message from a string to a WebSocketMessage
   * @param message - The message to parse
   * @returns A WebSocketMessage
   */
  parseMessage(message: string): WebSocketMessage;

  /**
   * Create a message from a type and data
   * @param type - The type of the message
   * @param data - The data of the message
   * @returns A stringified WebSocketMessage
   */
  createMessage(type: string, data: Record<string, any>): string;

  /**
   * Create a message for when a user has voted
   * @param vote - The vote of the user
   * @returns A stringified WebSocketMessage
   */
  createUserVotedMessage(vote: Vote): string;

  /**
   * Create a vote status message
   * @param roomId - The ID of the room to create the vote status message for
   * @param roomManager - The room manager to get the votes from
   * @returns A stringified WebSocketMessage
   */
  createVoteStatusMessage(roomId: string, roomManager: RoomManager): string;
}
