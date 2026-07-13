import {
  defaultDeckId,
  isVoteForDeck,
  type DeckId,
  type ParticipantRole,
  type Vote,
} from "@shared/types";

export type Room = {
  users: Set<string>;
  // Subset of `users`. Spectators never get a `votes` entry, so every
  // vote-derived surface (counts, snapshots, distribution) is voters-only
  // without filtering.
  spectators: Set<string>;
  votes: Map<string, Vote>;
  revealed: boolean;
  locked: boolean;
  admin: string;
  deck: DeckId;
};

export interface RoomManager {
  joinRoom(roomId: string, username: string, deck?: DeckId, role?: ParticipantRole): Room;
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
  roomExists(roomId: string): boolean;
  getRoomDeck(roomId: string): DeckId;
  setDeck(roomId: string, username: string, deck: DeckId): boolean;
  getRoomSpectators(roomId: string): string[];
  isSpectator(roomId: string, username: string): boolean;
}

export class InMemoryRoomManager implements RoomManager {
  private rooms = new Map<string, Room>();

  // The deck argument is only honored when the room doesn't exist yet
  // (rooms are created implicitly by the first join); joiners inherit
  // the room's deck.
  joinRoom(roomId: string, username: string, deck?: DeckId, role?: ParticipantRole) {
    if (!this.rooms.has(roomId)) {
      const room: Room = {
        users: new Set(),
        spectators: new Set(),
        votes: new Map(),
        revealed: false,
        locked: false,
        admin: username,
        deck: deck ?? defaultDeckId,
      };
      this.rooms.set(roomId, room);
    }

    const room = this.rooms.get(roomId)!;
    if (room.users.has(username)) throw new Error("Username is already taken");

    room.users.add(username);
    if (role === "spectator") room.spectators.add(username);
    else room.votes.set(username, null);
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
    room.spectators.delete(username);
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
    if (room.spectators.has(username)) throw new Error("Spectators cannot vote");
    if (room.locked) throw new Error("Votes are locked");
    if (vote != null && !isVoteForDeck(room.deck, vote)) throw new Error("Invalid vote value");
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
    room.spectators.delete(participantToRemove);
    room.votes.delete(participantToRemove);
  }

  isUserInRoom(roomId: string, username: string): boolean {
    const room = this.rooms.get(roomId);
    return room ? room.users.has(username) : false;
  }

  roomExists(roomId: string): boolean {
    return this.rooms.has(roomId);
  }

  getRoomDeck(roomId: string): DeckId {
    const room = this.rooms.get(roomId);
    if (!room) throw new Error("Room does not exist");
    return room.deck;
  }

  getRoomSpectators(roomId: string): string[] {
    const room = this.rooms.get(roomId);
    return room ? Array.from(room.spectators) : [];
  }

  isSpectator(roomId: string, username: string): boolean {
    const room = this.rooms.get(roomId);
    return room ? room.spectators.has(username) : false;
  }

  // Returns whether the deck actually changed — a same-deck call is a
  // no-op so an accidental confirm can't wipe votes.
  setDeck(roomId: string, username: string, deck: DeckId): boolean {
    const room = this.rooms.get(roomId);
    if (!room) throw new Error("Room does not exist");
    if (room.admin !== username) throw new Error("Only the admin can change the deck");
    if (room.deck === deck) return false;

    room.deck = deck;
    room.votes.forEach((_, username) => room.votes.set(username, null));
    room.revealed = false;
    room.locked = false;
    return true;
  }
}
