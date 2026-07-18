import { computed, ref } from "vue";
import { useRoute, useRouter } from "vue-router";
import { storeToRefs } from "pinia";
import { useToast } from "primevue/usetoast";
import { decks, isDeckId, type DeckId, type ServerMessage } from "@shared/types";
import { usernameKey } from "@/modules/constants";
import {
  createRoomConnection,
  type ConnectionStatus,
  type RoomConnection,
} from "@/modules/roomConnection";
import { createRoomMembers, createSpectatorMembers } from "@/modules/roomMembers";
import { rememberRoomDeck } from "@/composables/useRecentRooms";
import { useReactions } from "@/composables/useReactions";
import { useSoundCues } from "@/composables/useSoundCues";
import { useRootStore } from "@/stores/root";

export function useRoomSession(id: string) {
  const toast = useToast();
  const router = useRouter();
  const route = useRoute();
  const store = useRootStore();
  const {
    username,
    votesVisible,
    participants,
    spectators,
    isSpectator,
    isAdmin,
    adminUsername,
    votesLocked,
    pointEstimate,
    deck,
  } = storeToRefs(store);

  // Cues fire only on incoming server messages, so self-initiated new
  // rounds stay silent (the server doesn't echo votesCleared to the actor).
  const { soundCuesEnabled, toggleSoundCues, playRevealCue, playNewRoundCue } = useSoundCues();

  const connectionStatus = ref<ConnectionStatus>("disconnected");
  const usernameModel = ref(localStorage.getItem(usernameKey) ?? "");
  const copiedRoomLink = ref(false);
  const adminSheetOpen = ref(false);

  // The session owns the single room connection. Composables and views
  // receive the senders they need through the session rather than
  // importing them — the connection has no module-level home.
  let connection: RoomConnection | null = null;
  const reactions = useReactions({
    username,
    connectionStatus,
    sendReaction: (emoji) => connection?.sendReaction(emoji),
  });

  const socketUrl = import.meta.env.VITE_SOCKET_URL;
  if (!socketUrl) {
    throw new Error(
      "VITE_SOCKET_URL is not defined. Create frontend/.env from .env.sample and set the backend WebSocket URL.",
    );
  }

  const roomId = computed(() => id?.toLowerCase() ?? "");
  // Deck chosen at creation arrives as a `?deck=` route query; harmless
  // for joiners since the backend ignores it when the room exists.
  const pendingDeck = computed<DeckId | undefined>(() => {
    const queryDeck = route.query.deck;
    return typeof queryDeck === "string" && isDeckId(queryDeck) ? queryDeck : undefined;
  });
  // Role chosen before entering the room (`?role=spectator`); the welcome
  // dialog can flip it for direct-link joiners before connecting. After
  // joinRoomSuccess the server's spectator list is authoritative.
  const joinAsSpectator = ref(route.query.role === "spectator");
  const wsUrl = computed(() => {
    const url = new URL(socketUrl);
    url.searchParams.append("roomId", roomId.value);
    url.searchParams.append("username", username.value);
    if (pendingDeck.value) url.searchParams.append("deck", pendingDeck.value);
    if (joinAsSpectator.value) url.searchParams.append("role", "spectator");
    return url;
  });
  const isMissingUsername = computed(() => !username.value);
  const points = computed(() => decks[deck.value].cards);
  const deckLabel = computed(() => decks[deck.value].label);
  const members = computed(() =>
    createRoomMembers(
      participants.value,
      adminUsername.value,
      username.value,
      votesVisible.value,
      points.value,
    ),
  );
  const spectatorMembers = computed(() =>
    createSpectatorMembers(spectators.value, adminUsername.value, username.value),
  );
  // Voted counts derive from `members` (voters only) — spectators are
  // structurally excluded from the X/Y tally.
  const votedCount = computed(() => members.value.filter((m) => m.point != null).length);
  const totalCount = computed(() => members.value.length);
  const hasVotes = computed(() => votedCount.value > 0);

  function connect() {
    connection = createRoomConnection({
      url: wsUrl.value,
      onMessage: handleWebSocketMessage,
      onStatus: (status) => {
        connectionStatus.value = status;
      },
    });
  }

  if (!roomId.value) {
    addNotification("No room ID provided");
    router.push({ name: "Home" });
  }

  if (!isMissingUsername.value) connect();

  function addNotification(detail: string) {
    toast.add({ severity: "info", summary: "Notification", detail, life: 3000 });
  }

  function addErrorNotification(summary: string, detail: string) {
    toast.add({ severity: "error", summary, detail, life: 3000 });
  }

  // Keep the URL's `?deck=` truthful so an admin refresh after a
  // mid-session deck change recreates the room on the current deck and
  // copied invite links carry the right hint.
  function syncDeckQuery(deckId: DeckId) {
    if (route.query.deck === deckId) return;
    router.replace({ query: { ...route.query, deck: deckId } });
  }

  // Everything that must track the room's authoritative deck: the store,
  // the recent-rooms hint, the URL query, and the auto-reconnect URL —
  // the last one so an admin reconnect after the room is destroyed
  // recreates it on the current deck, not the connect-time one.
  function applyDeck(deckId: DeckId) {
    store.setDeck(deckId);
    rememberRoomDeck(roomId.value, deckId);
    syncDeckQuery(deckId);
    const url = new URL(wsUrl.value);
    url.searchParams.set("deck", deckId);
    connection?.updateUrl(url);
  }

  // The server never masks our own vote back to us, so a snapshot is
  // authoritative for it — adopt the value rather than reconciling
  // against local state. Covers the round being reset (deck change, new
  // round) while we were disconnected: the snapshot simply says null.
  function adoptOwnVote() {
    store.pointEstimate = participants.value.get(username.value) ?? undefined;
  }

  function handleWebSocketMessage(msg: ServerMessage) {
    switch (msg.type) {
      case "joinRoomSuccess":
        reactions.clearRateLimit();
        participants.value = new Map(Object.entries(msg.data.participants));
        store.setSpectators(msg.data.spectators);
        store.setAdmin(msg.data.admin);
        votesLocked.value = msg.data.locked;
        votesVisible.value = msg.data.revealed;
        applyDeck(msg.data.deck);
        adoptOwnVote();
        break;
      case "deckChanged":
        applyDeck(msg.data.deck);
        store.clearVotes();
        playNewRoundCue();
        addNotification(`Deck changed to ${decks[msg.data.deck].label} — votes were reset`);
        break;
      case "reaction":
        reactions.show(msg.data.emoji, msg.data.username);
        break;
      case "reactionRateLimited":
        reactions.applyRateLimit(msg.data.retryAfterMs);
        break;
      case "userJoined":
        if (msg.data.role === "spectator") {
          store.addSpectator(msg.data.username);
          addNotification(`${msg.data.username} is watching the room`);
        } else {
          store.addParticipant({ username: msg.data.username });
          addNotification(`${msg.data.username} joined the room`);
        }
        break;
      case "userLeft":
        store.removeParticipant(msg.data.username);
        addNotification(`${msg.data.username} left the room`);
        break;
      case "adminTransferred":
        store.setAdmin(msg.data.newAdmin);
        addNotification(`Admin role transferred to ${msg.data.newAdmin}`);
        break;
      case "userVoted":
        store.setParticipantPointEstimate(msg.data.username, msg.data.vote);
        break;
      case "voteStatus":
        if (msg.data.revealed && !votesVisible.value) playRevealCue();
        participants.value = new Map(Object.entries(msg.data.votes));
        votesVisible.value = msg.data.revealed;
        adoptOwnVote();
        break;
      case "votesCleared":
        store.clearVotes();
        votesVisible.value = false;
        playNewRoundCue();
        break;
      case "voteLockStatus":
        votesLocked.value = msg.data.locked;
        break;
      case "participantRemoved":
        store.removeParticipant(msg.data.participant);
        addNotification(
          `${msg.data.participant} was removed from the room by ${msg.data.removedBy}`,
        );
        break;
      case "youWereRemoved":
        addErrorNotification(
          "Removed from Room",
          `You were removed from the room by ${msg.data.removedBy}`,
        );
        store.$reset();
        router.push({ name: "Home" });
        break;
      case "roomClosed":
        addErrorNotification("Room Closed", msg.data.reason);
        store.$reset();
        router.push({ name: "Home" });
        break;
      case "notification":
        addNotification(msg.data.details);
        break;
      case "userDisconnected":
        addNotification(`${msg.data.username} lost connection`);
        break;
      case "userReconnected":
        addNotification(`${msg.data.username} reconnected`);
        break;
      case "error":
        addErrorNotification("Error", msg.data.message);
        break;
      default:
        console.error("Unknown message:", msg);
    }
  }

  function join() {
    if (!roomId.value || !usernameModel.value) return;
    store.setUsername(usernameModel.value);
    // Keep `?role=` truthful so a refresh rejoins with the same role — set it
    // when spectating, drop it when voting (the dialog can toggle either way).
    const desiredRole = joinAsSpectator.value ? "spectator" : undefined;
    if (route.query.role !== desiredRole) {
      const query = { ...route.query };
      if (desiredRole) query.role = desiredRole;
      else delete query.role;
      router.replace({ query });
    }
    connect();
  }

  function toggleVoteVisibility() {
    if (votesVisible.value) connection?.hideVotes();
    else connection?.revealVotes();
  }

  function toggleVoteLock() {
    if (votesLocked.value) connection?.unlockVotes();
    else connection?.lockVotes();
  }

  function vote(point?: string) {
    if (votesLocked.value || isSpectator.value) return;
    const next = point === pointEstimate.value ? undefined : point;
    store.pointEstimate = next;
    store.setUserPointEstimate(next);
    connection?.submitVote({ vote: next });
  }

  function clearMyVote() {
    store.pointEstimate = undefined;
    vote();
  }

  function clearAllVotes() {
    connection?.clearVotes();
    store.clearVotes();
  }

  function startNewRound() {
    clearAllVotes();
  }

  function makeAdmin(name: string) {
    if (!isAdmin.value || name === store.adminUsername) return;
    connection?.transferAdmin(name);
    adminSheetOpen.value = false;
  }

  function handleRemoveParticipant(name: string) {
    if (!isAdmin.value || name === store.username) return;
    connection?.removeParticipant(name);
  }

  function copyRoomLink() {
    // Strip our own `?role=spectator` so invitees pick their own role in the
    // welcome dialog; keep `?deck=` since that's an intentional room hint.
    const url = new URL(window.location.href);
    url.searchParams.delete("role");
    navigator.clipboard.writeText(url.toString());
    copiedRoomLink.value = true;
    setTimeout(() => (copiedRoomLink.value = false), 2000);
  }

  function leaveRoom() {
    router.push({ name: "Home" });
  }

  function changeDeck(deck: DeckId) {
    connection?.changeDeck(deck);
  }

  function teardownRoomSession() {
    reactions.dispose();
    connection?.disconnect();
    connection = null;
    store.$reset();
  }

  return {
    adminSheetOpen,
    canReact: reactions.canReact,
    connectionStatus,
    copiedRoomLink,
    deck,
    deckLabel,
    hasVotes,
    isAdmin,
    isMissingUsername,
    isSpectator,
    joinAsSpectator,
    members,
    pointEstimate,
    points,
    reactionBursts: reactions.reactionBursts,
    reactionFeed: reactions.reactionFeed,
    reactionsRateLimited: reactions.reactionsRateLimited,
    roomId,
    soundCuesEnabled,
    spectatorMembers,
    totalCount,
    usernameModel,
    votedCount,
    votesLocked,
    votesVisible,
    changeDeck,
    clearAllVotes,
    clearMyVote,
    copyRoomLink,
    handleRemoveParticipant,
    join,
    leaveRoom,
    makeAdmin,
    sendReaction: reactions.sendReaction,
    startNewRound,
    teardownRoomSession,
    toggleSoundCues,
    toggleVoteLock,
    toggleVoteVisibility,
    vote,
  };
}
