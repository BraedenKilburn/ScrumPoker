/**
 * A user's point estimation.
 * If the vote is not set, it is null; otherwise, it is a string
 * (e.g., "3", "5", "?", etc.)
 */
export type Vote = string | null

/**
 * The estimation deck presets a room can use. Shared between the
 * frontend (to render the hand) and the backend (to validate votes).
 * "?" is the off-scale "unknown" token present in every deck.
 */
export const deckIds = ['fibonacci', 'tshirt', 'powers2', 'linear'] as const
export type DeckId = (typeof deckIds)[number]

export type Deck = {
  id: DeckId
  label: string
  hint: string
  cards: readonly string[]
}

export const decks: Record<DeckId, Deck> = {
  fibonacci: {
    id: 'fibonacci',
    label: 'Fibonacci',
    hint: '1 · 2 · 3 · 5 · 8 · 13 …',
    cards: ['?', '1', '2', '3', '5', '8', '13', '21', '40'],
  },
  tshirt: {
    id: 'tshirt',
    label: 'T-shirt',
    hint: 'XS · S · M · L · XL',
    cards: ['?', 'XS', 'S', 'M', 'L', 'XL'],
  },
  powers2: {
    id: 'powers2',
    label: 'Powers of 2',
    hint: '1 · 2 · 4 · 8 · 16 …',
    cards: ['?', '1', '2', '4', '8', '16', '32', '64'],
  },
  linear: {
    id: 'linear',
    label: 'Linear',
    hint: '1 through 10',
    cards: ['?', '1', '2', '3', '4', '5', '6', '7', '8', '9', '10'],
  },
}

export const defaultDeckId: DeckId = 'fibonacci'

/**
 * Tokens that sit off the estimation scale (unknowns / abstentions) in
 * any deck that includes them — excluded from ranking, sorting, and
 * stats. Single source for every consumer of "is this card special?".
 */
export const specialTokens: readonly string[] = ['?', '∞', '☕', '½']

/**
 * Whether a card sits off the estimation scale.
 */
export function isSpecialToken(value: string): boolean {
  return specialTokens.includes(value)
}

/**
 * Type guard: whether an arbitrary string is a valid deck id.
 */
export function isDeckId(value: string): value is DeckId {
  return (deckIds as readonly string[]).includes(value)
}

/**
 * Whether a vote value is a valid card in the given deck.
 */
export function isVoteForDeck(deckId: DeckId, value: string): boolean {
  return decks[deckId].cards.includes(value)
}

/**
 * The deliberately small reaction set available in a room. Keeping this
 * shared lets the frontend render the picker while the backend validates
 * every incoming reaction against the same allowlist.
 */
export const reactionEmojis = ['👍', '🎉', '🤔', '👀', '⏳', '☕'] as const
export type ReactionEmoji = (typeof reactionEmojis)[number]

export function isReactionEmoji(value: unknown): value is ReactionEmoji {
  return (
    typeof value === 'string' &&
    (reactionEmojis as readonly string[]).includes(value)
  )
}

/**
 * A participant's role in the room. Voters play cards and count toward
 * the X/Y voted tally; spectators are present but structurally out of
 * the vote — no card slot, no vote entry, never counted.
 */
export const participantRoles = ['voter', 'spectator'] as const
export type ParticipantRole = (typeof participantRoles)[number]

export function isParticipantRole(value: string): value is ParticipantRole {
  return (participantRoles as readonly string[]).includes(value)
}

/**
 * Room ids are case- and whitespace-insensitive: `Sprint42` and
 * `sprint42 ` name the same room. Every entry point normalizes through
 * here — the HTTP existence probe and the socket upgrade must agree, or a
 * room can exist under one spelling while the probe reports it missing
 * under another, and two people "in the same room" never meet.
 */
export function normalizeRoomId(raw: string): string {
  return raw.trim().toLowerCase()
}

export type WebSocketData = {
  /** Always normalized — see {@link normalizeRoomId}. */
  roomId: string
  username: string
  /** Deck chosen at creation — only meaningful for the room creator's connection. */
  deck?: DeckId
  /** Role chosen at join — defaults to voter when absent. */
  role?: ParticipantRole
}

// ── Close frame contract ──

/**
 * The close frame is part of the wire contract: the backend classifies a
 * departure from the code and reason it arrives with, so both sides must
 * agree on the exact strings. A silent typo here reclassifies a clean
 * leave as an unexpected drop (a 30s ghost in the room), which is why
 * these are constants rather than literals at each site.
 */
export const CloseReason = {
  /** The member chose to leave — no grace period. */
  UserLeft: 'User left room',
  /** The admin removed them; the room was already told. */
  RemovedByAdmin: 'Removed by admin',
} as const

export type CloseReason = (typeof CloseReason)[keyof typeof CloseReason]

export const CloseCode = {
  Unknown: 4000,
  /** The username is already taken in this room; the client must not retry. */
  UsernameTaken: 4001,
} as const

export type CloseCode = (typeof CloseCode)[keyof typeof CloseCode]

// ── Client → Server messages ──
//
// These describe messages that have already been validated at the
// backend's inbound seam (`clientMessageParser`). Values drawn from a
// closed set are typed as that set, because the door checks membership
// before anything downstream sees the message. `vote` stays a plain
// string: whether a card belongs to the room's deck depends on room
// state, so only the domain can answer it.

export type SubmitVoteMessage = {
  type: 'submitVote'
  /** An absent `vote` retracts: `{"type":"submitVote","data":{}}`. */
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

export type ChangeDeckMessage = {
  type: 'changeDeck'
  data: { deck: DeckId }
}

export type SendReactionMessage = {
  type: 'sendReaction'
  data: { emoji: ReactionEmoji }
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
  | ChangeDeckMessage
  | SendReactionMessage

// ── Server → Client messages ──

export type JoinRoomSuccessMessage = {
  type: 'joinRoomSuccess'
  data: {
    /** Voters and their (masked) votes — spectators never appear here. */
    participants: Record<string, string | null>
    /** Usernames watching the room without voting. */
    spectators: string[]
    admin: string
    locked: boolean
    revealed: boolean
    deck: DeckId
  }
}

export type UserJoinedMessage = {
  type: 'userJoined'
  data: { username: string; role: ParticipantRole }
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

/**
 * Broadcast when the admin changes the room's deck. Implies the current
 * round's votes were cleared — clients treat it as "deck changed + round
 * reset" so no paired votesCleared broadcast is needed.
 */
export type DeckChangedMessage = {
  type: 'deckChanged'
  data: { deck: DeckId }
}

/**
 * A reaction is broadcast live and is never included in room snapshots.
 * The backend supplies `username` from the authenticated socket rather
 * than accepting it from the client.
 */
export type ReactionMessage = {
  type: 'reaction'
  data: { username: string; emoji: ReactionEmoji }
}

/** Sent only to the participant whose reaction exceeded the live rate limit. */
export type ReactionRateLimitedMessage = {
  type: 'reactionRateLimited'
  data: { retryAfterMs: number }
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
  | DeckChangedMessage
  | ReactionMessage
  | ReactionRateLimitedMessage
