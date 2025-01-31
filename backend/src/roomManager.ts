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
};

export class InMemoryRoomManager implements RoomManager {
  private rooms = new Map<string, Room>();

  joinRoom(roomId: string, username: string) {
    // Create room if it doesn't exist
    if (!this.rooms.has(roomId)) {
      const room: Room = {
        users: new Set(),
        votes: new Map(),
        revealed: false,
      };
      this.rooms.set(roomId, room);
    }

    // Check if username is already taken
    const room = this.rooms.get(roomId)!;
    if (room.users.has(username)) throw new Error("Username is already taken");

    room.users.add(username); // Add user to room
    room.votes.set(username, null); // Initialize with no vote
    return room;
  }

  leaveRoom(roomId: string, username: string) {
    const room = this.rooms.get(roomId);
    if (room) {
      room.users.delete(username);
      room.votes.delete(username);

      if (room.users.size === 0) {
        this.rooms.delete(roomId);
      }
    }
  }

  submitVote(roomId: string, username: string, vote: Vote) {
    const room = this.rooms.get(roomId);
    if (!room) throw new Error("Room does not exist");
    if (!room.users.has(username)) throw new Error("User not in room");

    room.votes.set(username, !!vote ? vote : null);
  }

  setVoteVisibility(roomId: string, revealed: boolean) {
    const room = this.rooms.get(roomId);
    if (!room) throw new Error("Room does not exist");

    room.revealed = revealed;
  }

  clearVotes(roomId: string) {
    const room = this.rooms.get(roomId);
    if (!room) throw new Error("Room does not exist");

    room.votes.forEach((_, username) => {
      room.votes.set(username, null);
    });
  }

  getRoomUsers(roomId: string) {
    const room = this.rooms.get(roomId);
    return room ? Array.from(room.users) : [];
  }

  getRoomVisibility(roomId: string) {
    const room = this.rooms.get(roomId);
    return room ? room.revealed : false;
  }

  getUsersVote(roomId: string, username: string) {
    const room = this.rooms.get(roomId);
    if (!room) throw new Error("Room does not exist");
    if (!room.users.has(username)) throw new Error("User not in room");

    const vote = room.votes.get(username) ?? null;
    return room.revealed ? vote : (vote == null ? null : "?");
  }

  getRoomVotes(roomId: string) {
    const room = this.rooms.get(roomId);
    if (!room) return new Map();

    // If votes aren't revealed, return placeholders
    return room.revealed
      ? room.votes
      : new Map(room.votes
        .entries()
        .map(([key, value]) => [key, value == null ? value : "?"])
      );
  }
}
