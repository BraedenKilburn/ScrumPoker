/**
 * A user's point estimation.
 * If the vote is not set, it is null; otherwise, it is a string
 * (e.g., "3", "5", "?", etc.)
 */
export type Vote = string | null

export type WebSocketData = {
  roomId: string
  username: string
}

// ── Client → Server messages ──

export type SubmitVoteMessage = {
  type: 'submitVote'
  data: { vote?: string }
}

export type RevealVotesMessage = {
  type: 'revealVotes'
}

export type HideVotesMessage = {
  type: 'hideVotes'
}

export type ClearVotesMessage = {
  type: 'clearVotes'
}

export type LockVotesMessage = {
  type: 'lockVotes'
}

export type UnlockVotesMessage = {
  type: 'unlockVotes'
}

export type TransferAdminMessage = {
  type: 'transferAdmin'
  data: { newAdmin: string }
}

export type RemoveParticipantMessage = {
  type: 'removeParticipant'
  data: { participant: string }
}

export type ClientMessage =
  | SubmitVoteMessage
  | RevealVotesMessage
  | HideVotesMessage
  | ClearVotesMessage
  | LockVotesMessage
  | UnlockVotesMessage
  | TransferAdminMessage
  | RemoveParticipantMessage

// ── Server → Client messages ──

export type JoinRoomSuccessMessage = {
  type: 'joinRoomSuccess'
  data: { participants: Record<string, string | null>; admin: string; locked: boolean }
}

export type UserJoinedMessage = {
  type: 'userJoined'
  data: { username: string }
}

export type UserLeftMessage = {
  type: 'userLeft'
  data: { username: string }
}

export type UserVotedMessage = {
  type: 'userVoted'
  data: { username: string; vote: string | null }
}

export type VoteStatusMessage = {
  type: 'voteStatus'
  data: { revealed: boolean; votes: Record<string, string | null> }
}

export type VotesClearedMessage = {
  type: 'votesCleared'
}

export type AdminTransferredMessage = {
  type: 'adminTransferred'
  data: { newAdmin: string }
}

export type VoteLockStatusMessage = {
  type: 'voteLockStatus'
  data: { locked: boolean }
}

export type ParticipantRemovedMessage = {
  type: 'participantRemoved'
  data: { removedBy: string; participant: string }
}

export type YouWereRemovedMessage = {
  type: 'youWereRemoved'
  data: { removedBy: string }
}

export type RoomClosedMessage = {
  type: 'roomClosed'
  data: { reason: string }
}

export type NotificationMessage = {
  type: 'notification'
  data: { details: string }
}

export type ErrorMessage = {
  type: 'error'
  data: { message: string }
}

export type UserDisconnectedMessage = {
  type: 'userDisconnected'
  data: { username: string }
}

export type UserReconnectedMessage = {
  type: 'userReconnected'
  data: { username: string }
}

export type ServerMessage =
  | JoinRoomSuccessMessage
  | UserJoinedMessage
  | UserLeftMessage
  | UserVotedMessage
  | VoteStatusMessage
  | VotesClearedMessage
  | AdminTransferredMessage
  | VoteLockStatusMessage
  | ParticipantRemovedMessage
  | YouWereRemovedMessage
  | RoomClosedMessage
  | NotificationMessage
  | ErrorMessage
  | UserDisconnectedMessage
  | UserReconnectedMessage
