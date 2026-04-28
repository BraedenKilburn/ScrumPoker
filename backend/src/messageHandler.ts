import type { ClientMessage, ServerMessage } from "@shared/types";
import type { RoomManager } from "./roomManager";

export class MessageHandler {
  static parseMessage(message: string): ClientMessage {
    try {
      return JSON.parse(message);
    } catch {
      throw new Error("Invalid message format. Please send valid JSON.");
    }
  }

  static createMessage(msg: ServerMessage): string {
    if ("data" in msg && msg.data instanceof Map) {
      return JSON.stringify({ type: msg.type, data: Object.fromEntries(msg.data) });
    }
    return JSON.stringify(msg);
  }

  static createUserVotedMessage(
    roomId: string,
    username: string,
    roomManager: RoomManager,
  ): string {
    const vote = roomManager.getUsersVote(roomId, username);
    return this.createMessage({ type: "userVoted", data: { username, vote } });
  }

  static createVoteStatusMessage(roomId: string, roomManager: RoomManager): string {
    const revealed = roomManager.getRoomVisibility(roomId);
    const votes = roomManager.getRoomVotes(roomId);
    return this.createMessage({
      type: "voteStatus",
      data: { revealed, votes: Object.fromEntries(votes) },
    });
  }
}
