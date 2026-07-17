import type {
  JoinRoomSuccessMessage,
  UserVotedMessage,
  VoteStatusMessage,
} from "@shared/types";
import type { RoomManager } from "./roomManager";

/**
 * Snapshot builders: the authoritative views of a room a client receives.
 * The masking rule (hidden votes read as "?") lives in the RoomManager's
 * vote getters; these builders shape that state into typed wire messages.
 * Reactions are live-only and never appear in a snapshot.
 */

/** Full room state, sent to a client on join and on reconnect. */
export function joinRoomSuccessMessage(
  roomId: string,
  roomManager: RoomManager,
): JoinRoomSuccessMessage {
  return {
    type: "joinRoomSuccess",
    data: {
      participants: Object.fromEntries(roomManager.getRoomVotes(roomId)),
      spectators: roomManager.getRoomSpectators(roomId),
      admin: roomManager.getAdmin(roomId)!,
      locked: roomManager.getRoomLockState(roomId),
      revealed: roomManager.getRoomVisibility(roomId),
      deck: roomManager.getRoomDeck(roomId),
    },
  };
}

/** The vote board after a visibility change (reveal/hide). */
export function voteStatusMessage(roomId: string, roomManager: RoomManager): VoteStatusMessage {
  return {
    type: "voteStatus",
    data: {
      revealed: roomManager.getRoomVisibility(roomId),
      votes: Object.fromEntries(roomManager.getRoomVotes(roomId)),
    },
  };
}

/** One member's (masked) vote after they cast or retract it. */
export function userVotedMessage(
  roomId: string,
  username: string,
  roomManager: RoomManager,
): UserVotedMessage {
  return {
    type: "userVoted",
    data: { username, vote: roomManager.getUsersVote(roomId, username) },
  };
}
