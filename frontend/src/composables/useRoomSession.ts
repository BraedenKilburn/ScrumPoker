import { computed, ref } from "vue";
import { useRoute, useRouter } from "vue-router";
import { storeToRefs } from "pinia";
import { useToast } from "primevue/usetoast";
import { decks, isDeckId, type DeckId, type ServerMessage } from "@shared/types";
import { usernameKey } from "@/modules/constants";
import {
  clearVotes,
  connectWebSocket,
  disconnect,
  hideVotes,
  lockVotes,
  onConnectionStatusChange,
  removeParticipant,
  revealVotes,
  submitVote,
  transferAdmin,
  unlockVotes,
  type ConnectionStatus,
} from "@/modules/socket";
import { createRoomMembers } from "@/modules/roomMembers";
import { rememberRoomDeck } from "@/composables/useRecentRooms";
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
    isAdmin,
    adminUsername,
    votesLocked,
    pointEstimate,
    deck,
  } = storeToRefs(store);

  const connectionStatus = ref<ConnectionStatus>("disconnected");
  const usernameModel = ref(localStorage.getItem(usernameKey) ?? "");
  const copiedRoomLink = ref(false);
  const adminSheetOpen = ref(false);

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
  const wsUrl = computed(() => {
    const url = new URL(socketUrl);
    url.searchParams.append("roomId", roomId.value);
    url.searchParams.append("username", username.value);
    if (pendingDeck.value) url.searchParams.append("deck", pendingDeck.value);
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
  const votedCount = computed(() => members.value.filter((m) => m.point != null).length);
  const totalCount = computed(() => members.value.length);
  const hasVotes = computed(() => votedCount.value > 0);

  onConnectionStatusChange((status) => {
    connectionStatus.value = status;
  });

  if (!roomId.value) {
    addNotification("No room ID provided");
    router.push({ name: "Home" });
  }

  if (!isMissingUsername.value) connectWebSocket(wsUrl.value, handleWebSocketMessage);

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

  function handleWebSocketMessage(msg: ServerMessage) {
    switch (msg.type) {
      case "joinRoomSuccess":
        participants.value = new Map(Object.entries(msg.data.participants));
        store.setAdmin(msg.data.admin);
        votesLocked.value = msg.data.locked;
        votesVisible.value = msg.data.revealed;
        store.setDeck(msg.data.deck);
        rememberRoomDeck(roomId.value, msg.data.deck);
        syncDeckQuery(msg.data.deck);
        if (!msg.data.revealed) store.setUserPointEstimate();
        break;
      case "deckChanged":
        store.setDeck(msg.data.deck);
        rememberRoomDeck(roomId.value, msg.data.deck);
        syncDeckQuery(msg.data.deck);
        store.clearVotes();
        addNotification(`Deck changed to ${decks[msg.data.deck].label} — votes were reset`);
        break;
      case "userJoined":
        store.addParticipant({ username: msg.data.username });
        addNotification(`${msg.data.username} joined the room`);
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
        participants.value = new Map(Object.entries(msg.data.votes));
        votesVisible.value = msg.data.revealed;
        if (!msg.data.revealed) store.setUserPointEstimate();
        break;
      case "votesCleared":
        store.clearVotes();
        votesVisible.value = false;
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
    connectWebSocket(wsUrl.value, handleWebSocketMessage);
  }

  function toggleVoteVisibility() {
    if (votesVisible.value) hideVotes();
    else revealVotes();
  }

  function toggleVoteLock() {
    if (votesLocked.value) unlockVotes();
    else lockVotes();
  }

  function vote(point?: string) {
    if (votesLocked.value) return;
    const next = point === pointEstimate.value ? undefined : point;
    store.pointEstimate = next;
    store.setUserPointEstimate(next);
    submitVote({ vote: next });
  }

  function clearMyVote() {
    store.pointEstimate = undefined;
    vote();
  }

  function clearAllVotes() {
    clearVotes();
    store.clearVotes();
  }

  function startNewRound() {
    clearAllVotes();
  }

  function makeAdmin(name: string) {
    if (!isAdmin.value || name === store.adminUsername) return;
    transferAdmin(name);
    adminSheetOpen.value = false;
  }

  function handleRemoveParticipant(name: string) {
    if (!isAdmin.value || name === store.username) return;
    removeParticipant(name);
  }

  function copyRoomLink() {
    navigator.clipboard.writeText(window.location.href);
    copiedRoomLink.value = true;
    setTimeout(() => (copiedRoomLink.value = false), 2000);
  }

  function leaveRoom() {
    router.push({ name: "Home" });
  }

  function teardownRoomSession() {
    disconnect();
    store.$reset();
  }

  return {
    adminSheetOpen,
    connectionStatus,
    copiedRoomLink,
    deck,
    deckLabel,
    hasVotes,
    isAdmin,
    isMissingUsername,
    members,
    pointEstimate,
    points,
    roomId,
    totalCount,
    usernameModel,
    votedCount,
    votesLocked,
    votesVisible,
    clearAllVotes,
    clearMyVote,
    copyRoomLink,
    handleRemoveParticipant,
    join,
    leaveRoom,
    makeAdmin,
    startNewRound,
    teardownRoomSession,
    toggleVoteLock,
    toggleVoteVisibility,
    vote,
  };
}
