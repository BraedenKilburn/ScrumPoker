import type {
  JoinRoomSuccessMessage,
  UserVotedMessage,
  VoteStatusMessage,
} from "@shared/types";
import type { RoomManager } from "./roomManager";

/**
 * Snapshot builders: the authoritative views of a room a client receives.
 * Every snapshot is built *for a recipient* — the masking rule in the
 * RoomManager gives them their own vote unmasked and everyone else's as
 * "?" until the round is revealed, so a snapshot can never carry another
 * member's estimate. Reactions are live-only and never appear in one.
 */

/** Full room state, sent to a client on join and on reconnect. */
export function joinRoomSuccessMessage(
  roomId: string,
  roomManager: RoomManager,
  forUser: string,
): JoinRoomSuccessMessage {
  return {
    type: "joinRoomSuccess",
    data: {
      participants: Object.fromEntries(roomManager.voteSnapshot(roomId, forUser)),
      spectators: roomManager.getRoomSpectators(roomId),
      admin: roomManager.getAdmin(roomId)!,
      locked: roomManager.getRoomLockState(roomId),
      revealed: roomManager.getRoomVisibility(roomId),
      deck: roomManager.getRoomDeck(roomId),
    },
  };
}

/** The vote board after a visibility change (reveal/hide), per recipient. */
export function voteStatusMessage(
  roomId: string,
  roomManager: RoomManager,
  forUser: string,
): VoteStatusMessage {
  return {
    type: "voteStatus",
    data: {
      revealed: roomManager.getRoomVisibility(roomId),
      votes: Object.fromEntries(roomManager.voteSnapshot(roomId, forUser)),
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
