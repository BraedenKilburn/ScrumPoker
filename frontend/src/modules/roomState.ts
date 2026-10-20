import { computed, readonly, ref, type Ref } from "vue";
import {
  decks,
  defaultDeckId,
  isSpecialToken,
  type DeckId,
  type JoinRoomSuccessMessage,
  type ParticipantRole,
  type VoteStatusMessage,
} from "@shared/types";

export type RoomMember = {
  name: string;
  point?: string;
  isAdmin: boolean;
  isCurrentUser: boolean;
};

export type SpectatorMember = {
  name: string;
  isAdmin: boolean;
  isCurrentUser: boolean;
};

export type RoomSnapshot = JoinRoomSuccessMessage["data"];
export type VoteSnapshot = VoteStatusMessage["data"];

/**
 * The client's replica of one room (see CONTEXT.md "Room state"). The
 * session creates one per room visit and calls one transition per server
 * message; the rules that keep the replica honest — own-vote adoption,
 * echo acknowledgement, the round reset — live here and nowhere else.
 *
 * `me` is a ref because a direct-link visitor only names themselves after
 * the session starts; every "is this me" fact derives from it.
 */
export function createRoomState({ me }: { me: Ref<string> }) {
  // Voters only: spectators have no vote slot, so every vote-derived
  // read below is voters-only by construction.
  const votes = ref<Map<string, string | undefined>>(new Map());
  const spectators = ref<Set<string>>(new Set());
  const admin = ref("");
  const ownVote = ref<string | undefined>(undefined);
  const votesVisible = ref(false);
  const votesLocked = ref(false);
  const deck = ref<DeckId>(defaultDeckId);

  const points = computed(() => decks[deck.value].cards);
  const deckLabel = computed(() => decks[deck.value].label);
  const isAdmin = computed(() => !!me.value && admin.value === me.value);
  const isSpectator = computed(() => spectators.value.has(me.value));
  const members = computed<RoomMember[]>(() =>
    Array.from(votes.value.entries())
      .map(([name, point]) => ({
        name,
        point,
        isAdmin: name === admin.value,
        isCurrentUser: name === me.value,
      }))
      .sort((a, b) => compareMembers(a, b, votesVisible.value, points.value)),
  );
  const votedCount = computed(() => members.value.filter((m) => m.point != null).length);
  const totalCount = computed(() => members.value.length);
  const hasVotes = computed(() => votedCount.value > 0);
  const spectatorMembers = computed<SpectatorMember[]>(() =>
    Array.from(spectators.value)
      .map((name) => ({
        name,
        isAdmin: name === admin.value,
        isCurrentUser: name === me.value,
      }))
      .sort((a, b) => a.name.localeCompare(b.name)),
  );

  function replaceVotes(next: VoteSnapshot["votes"]) {
    votes.value = new Map(Object.entries(next).map(([name, vote]) => [name, vote ?? undefined]));
    // The server never masks our own vote back to us, so a snapshot is
    // authoritative for it — adopt it rather than reconciling against
    // local state. Covers a round reset we missed while disconnected.
    ownVote.value = votes.value.get(me.value);
  }

  function adoptSnapshot(snapshot: RoomSnapshot) {
    replaceVotes(snapshot.participants);
    spectators.value = new Set(snapshot.spectators);
    admin.value = snapshot.admin;
    votesLocked.value = snapshot.locked;
    votesVisible.value = snapshot.revealed;
    deck.value = snapshot.deck;
  }

  /** Returns true when this snapshot reveals a round that was hidden. */
  function adoptVoteSnapshot(snapshot: VoteSnapshot) {
    const revealedNow = snapshot.revealed && !votesVisible.value;
    replaceVotes(snapshot.votes);
    votesVisible.value = snapshot.revealed;
    return revealedNow;
  }

  // Our own vote is optimistic: applied here before the server hears of
  // it, which is why memberVoted ignores its (masked) echo.
  function setOwnVote(vote: string | undefined): { vote: string | undefined } | null {
    if (votesLocked.value || isSpectator.value || !me.value) return null;
    ownVote.value = vote;
    votes.value.set(me.value, vote);
    return { vote };
  }

  /** Plays a card; the same card again withdraws. Null when refused. */
  function castOwnVote(point: string) {
    return setOwnVote(point === ownVote.value ? undefined : point);
  }

  function withdrawOwnVote() {
    return setOwnVote(undefined);
  }

  function memberVoted(name: string, vote: string | null) {
    if (name === me.value) return;
    votes.value.set(name, vote ?? undefined);
  }

  // Mirrors the backend's clear and deck change: every vote gone, the
  // round hidden and unlocked.
  function resetRound() {
    ownVote.value = undefined;
    votes.value.forEach((_, name) => votes.value.set(name, undefined));
    votesVisible.value = false;
    votesLocked.value = false;
  }

  /** The admin's own clear, applied before the server confirms it. */
  function clearRound() {
    resetRound();
  }

  /**
   * Returns true when the round was reset. Our own clear was already
   * applied by clearRound, so its echo is acknowledged, not replayed.
   */
  function roundCleared(by: string) {
    if (by === me.value) return false;
    resetRound();
    return true;
  }

  function deckChanged(next: DeckId) {
    deck.value = next;
    resetRound();
  }

  function memberArrived(name: string, role: ParticipantRole) {
    if (role === "spectator") spectators.value.add(name);
    else votes.value.set(name, undefined);
  }

  function memberLeft(name: string) {
    votes.value.delete(name);
    spectators.value.delete(name);
  }

  function adminChanged(name: string) {
    admin.value = name;
  }

  function lockChanged(locked: boolean) {
    votesLocked.value = locked;
  }

  return {
    members,
    spectatorMembers,
    votedCount,
    totalCount,
    hasVotes,
    adminUsername: readonly(admin),
    ownVote: readonly(ownVote),
    votesVisible: readonly(votesVisible),
    votesLocked: readonly(votesLocked),
    deck: readonly(deck),
    points,
    deckLabel,
    isAdmin,
    isSpectator,
    adoptSnapshot,
    adoptVoteSnapshot,
    castOwnVote,
    withdrawOwnVote,
    memberVoted,
    clearRound,
    roundCleared,
    deckChanged,
    memberArrived,
    memberLeft,
    adminChanged,
    lockChanged,
  };
}

export type RoomState = ReturnType<typeof createRoomState>;

function compareMembers(
  a: RoomMember,
  b: RoomMember,
  votesVisible: boolean,
  cards: readonly string[],
): number {
  if (votesVisible) {
    if (a.point == null && b.point != null) return 1;
    if (b.point == null && a.point != null) return -1;
    if (a.point != null && b.point != null) {
      const aSpecial = isSpecialToken(a.point);
      const bSpecial = isSpecialToken(b.point);
      if (aSpecial && !bSpecial) return 1;
      if (bSpecial && !aSpecial) return -1;
      // Sort revealed votes by rank within the deck so non-numeric
      // scales (T-shirt) order correctly; unknown values sink last.
      const rankA = pointRank(a.point, cards);
      const rankB = pointRank(b.point, cards);
      if (rankA !== rankB) return rankA - rankB;
    }
  }
  return a.name.localeCompare(b.name);
}

function pointRank(point: string, cards: readonly string[]): number {
  const rank = cards.indexOf(point);
  return rank === -1 ? Infinity : rank;
}
