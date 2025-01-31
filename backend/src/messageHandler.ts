export class MessageHandler implements MessageHandler {
  static parseMessage(message: string) {
    try {
      return JSON.parse(message);
    } catch (error) {
      throw new Error("Invalid message format. Please send valid JSON.");
    }
  }

  static createMessage(type: string, data?: Record<string, any> | Map<string, Vote>) {
    // Convert Map to Object for JSON serialization
    if (data instanceof Map) data = Object.fromEntries(data);
    return JSON.stringify({ type, data });
  }

  static createUserVotedMessage(roomId: string, username: string, roomManager: RoomManager) {
    const vote = roomManager.getUsersVote(roomId, username);
    return this.createMessage("userVoted", { username, vote });
  }

  static createVoteStatusMessage(roomId: string, roomManager: RoomManager) {
    const revealed = roomManager.getRoomVisibility(roomId);
    const votes = roomManager.getRoomVotes(roomId);
    return this.createMessage("voteStatus", {
      revealed,
      votes: Object.fromEntries(votes),
    });
  }
}
