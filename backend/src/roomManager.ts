import type { Vote } from "@shared/types";

export type Room = {
  users: Set<string>;
  votes: Map<string, Vote>;
  revealed: boolean;
  locked: boolean;
  admin: string;
};

export interface RoomManager {
  joinRoom(roomId: string, username: string): Room;
  transferAdmin(roomId: string, currentAdmin: string, newAdmin: string): void;
  isAdmin(roomId: string, username: string): boolean;
  getAdmin(roomId: string): string | null;
  leaveRoom(roomId: string, username: string): { shouldDestroyRoom: boolean };
  submitVote(roomId: string, username: string, vote: Vote): void;
  setVoteVisibility(roomId: string, username: string, revealed: boolean): void;
  clearVotes(roomId: string, username: string): void;
  getRoomUsers(roomId: string): string[];
  getRoomVisibility(roomId: string): boolean;
  getUsersVote(roomId: string, username: string): Vote;
  getRoomVotes(roomId: string): Map<string, Vote>;
  setVoteLock(roomId: string, username: string, locked: boolean): void;
  getRoomLockState(roomId: string): boolean;
  removeParticipant(roomId: string, adminUsername: string, participantToRemove: string): void;
  isUserInRoom(roomId: string, username: string): boolean;
}

export class InMemoryRoomManager implements RoomManager {
  private rooms = new Map<string, Room>();

  joinRoom(roomId: string, username: string) {
    if (!this.rooms.has(roomId)) {
      const room: Room = {
        users: new Set(),
        votes: new Map(),
        revealed: false,
        locked: false,
        admin: username,
      };
      this.rooms.set(roomId, room);
    }

    const room = this.rooms.get(roomId)!;
    if (room.users.has(username)) throw new Error("Username is already taken");

    room.users.add(username);
    room.votes.set(username, null);
    return room;
  }

  transferAdmin(roomId: string, currentAdmin: string, newAdmin: string) {
    const room = this.rooms.get(roomId);
    if (!room) throw new Error("Room does not exist");
    if (room.admin !== currentAdmin) throw new Error("Only the admin can transfer admin rights");
    if (!room.users.has(newAdmin)) throw new Error("New admin must be in the room");

    room.admin = newAdmin;
  }

  isAdmin(roomId: string, username: string): boolean {
    const room = this.rooms.get(roomId);
    return room ? room.admin === username : false;
  }

  getAdmin(roomId: string): string | null {
    const room = this.rooms.get(roomId);
    return room ? room.admin : null;
  }

  leaveRoom(roomId: string, username: string) {
    const room = this.rooms.get(roomId);
    if (!room) return { shouldDestroyRoom: false };

    room.users.delete(username);
    room.votes.delete(username);

    const isAdmin = room.admin === username;

    if (room.users.size === 0 || isAdmin) {
      this.rooms.delete(roomId);
    }

    return { shouldDestroyRoom: isAdmin };
  }

  submitVote(roomId: string, username: string, vote: Vote) {
    const room = this.rooms.get(roomId);
    if (!room) throw new Error("Room does not exist");
    if (!room.users.has(username)) throw new Error("User not in room");
    if (room.locked) throw new Error("Votes are locked");
    room.votes.set(username, vote ? vote : null);
  }

  setVoteVisibility(roomId: string, username: string, revealed: boolean) {
    const room = this.rooms.get(roomId);
    if (!room) throw new Error("Room does not exist");
    if (room.admin !== username) throw new Error("Only the admin can reveal/hide votes");

    room.revealed = revealed;
  }

  clearVotes(roomId: string, username: string) {
    const room = this.rooms.get(roomId);
    if (!room) throw new Error("Room does not exist");
    if (room.admin !== username) throw new Error("Only the admin can clear votes");

    room.votes.forEach((_, username) => room.votes.set(username, null));
    room.locked = false;
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
    return room.revealed ? vote : vote == null ? null : "?";
  }

  getRoomVotes(roomId: string) {
    const room = this.rooms.get(roomId);
    if (!room) return new Map();

    return room.revealed
      ? room.votes
      : new Map(room.votes.entries().map(([key, value]) => [key, value == null ? value : "?"]));
  }

  setVoteLock(roomId: string, username: string, locked: boolean) {
    const room = this.rooms.get(roomId);
    if (!room) throw new Error("Room does not exist");
    if (room.admin !== username) throw new Error("Only the admin can lock/unlock votes");

    room.locked = locked;
  }

  getRoomLockState(roomId: string): boolean {
    const room = this.rooms.get(roomId);
    return room ? room.locked : false;
  }

  removeParticipant(roomId: string, adminUsername: string, participantToRemove: string) {
    const room = this.rooms.get(roomId);
    if (!room) throw new Error("Room does not exist");
    if (room.admin !== adminUsername) throw new Error("Only the admin can remove participants");
    if (!room.users.has(participantToRemove)) throw new Error("Participant not found in room");
    if (participantToRemove === adminUsername) throw new Error("Admin cannot remove themselves");

    room.users.delete(participantToRemove);
    room.votes.delete(participantToRemove);
  }

  isUserInRoom(roomId: string, username: string): boolean {
    const room = this.rooms.get(roomId);
    return room ? room.users.has(username) : false;
  }
}
