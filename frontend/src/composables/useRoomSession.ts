import { computed, ref } from "vue";
import { useRoute, useRouter } from "vue-router";
import { storeToRefs } from "pinia";
import { useToast } from "primevue/usetoast";
import { decks, isDeckId, normalizeRoomId, type DeckId, type ServerMessage } from "@shared/types";
import { usernameKey } from "@/modules/constants";
import {
  createRoomConnection,
  type ConnectionStatus,
  type RoomConnection,
} from "@/modules/roomConnection";
import { createRoomState } from "@/modules/roomState";
import { rememberRoomDeck } from "@/composables/useRecentRooms";
import { useReactions } from "@/composables/useReactions";
import { useRoomNotifications } from "@/composables/useRoomNotifications";
import type { NotificationBrowser } from "@/modules/notificationBrowser";
import { useSoundCues } from "@/composables/useSoundCues";
import { useRootStore } from "@/stores/root";

export function useRoomSession(
  id: string,
  options: { notificationBrowser?: NotificationBrowser } = {},
) {
  const toast = useToast();
  const router = useRouter();
  const route = useRoute();
  const store = useRootStore();
  const { username } = storeToRefs(store);
  // The session's one replica of the room. The switch below calls one
  // transition per message; the rules live in the room state.
  const room = createRoomState({ me: username });

  // Cues fire on incoming server messages. The switch below gates the
  // actor's votesCleared echo so self-initiated rounds stay silent.
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

  const roomId = computed(() => normalizeRoomId(id ?? ""));
  const notifications = useRoomNotifications({
    roomId: roomId.value,
    username,
    connectionStatus,
    playCue: (kind) => (kind === "reveal" ? playRevealCue() : playNewRoundCue()),
    browser: options.notificationBrowser,
  });
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

  // Everything outside the room state that must track its authoritative
  // deck: the recent-rooms hint, the URL query, and the auto-reconnect
  // URL — the last one so an admin reconnect after the room is destroyed
  // recreates it on the current deck, not the connect-time one.
  function followDeck(deckId: DeckId) {
    rememberRoomDeck(roomId.value, deckId);
    syncDeckQuery(deckId);
    const url = new URL(wsUrl.value);
    url.searchParams.set("deck", deckId);
    connection?.updateUrl(url);
  }

  function handleWebSocketMessage(msg: ServerMessage) {
    switch (msg.type) {
      case "joinRoomSuccess":
        reactions.clearRateLimit();
        room.adoptSnapshot(msg.data);
        followDeck(msg.data.deck);
        break;
      case "deckChanged":
        room.deckChanged(msg.data.deck);
        followDeck(msg.data.deck);
        notifications.newRound(msg.event);
        addNotification(`Deck changed to ${decks[msg.data.deck].label} — votes were reset`);
        break;
      case "reaction":
        reactions.show(msg.data.emoji, msg.data.username);
        break;
      case "reactionRateLimited":
        reactions.applyRateLimit(msg.data.retryAfterMs);
        break;
      case "userJoined":
        room.memberArrived(msg.data.username, msg.data.role);
        if (msg.data.role === "spectator") {
          addNotification(`${msg.data.username} is watching the room`);
        } else {
          addNotification(`${msg.data.username} joined the room`);
        }
        break;
      case "userLeft":
        room.memberLeft(msg.data.username);
        addNotification(`${msg.data.username} left the room`);
        break;
      case "adminTransferred":
        room.adminChanged(msg.data.newAdmin);
        addNotification(`Admin role transferred to ${msg.data.newAdmin}`);
        break;
      case "userVoted":
        room.memberVoted(msg.data.username, msg.data.vote);
        break;
      case "voteStatus":
        if (room.adoptVoteSnapshot(msg.data)) notifications.reveal(msg.event);
        break;
      case "votesCleared":
        // Our own clear's echo is acknowledged silently — no cue replay.
        if (room.roundCleared(msg.data.clearedBy)) notifications.newRound(msg.event);
        break;
      case "voteLockStatus":
        room.lockChanged(msg.data.locked);
        break;
      case "participantRemoved":
        room.memberLeft(msg.data.participant);
        addNotification(
          `${msg.data.participant} was removed from the room by ${msg.data.removedBy}`,
        );
        break;
      case "youWereRemoved":
        addErrorNotification(
          "Removed from Room",
          `You were removed from the room by ${msg.data.removedBy}`,
        );
        router.push({ name: "Home" });
        break;
      case "roomClosed":
        addErrorNotification("Room Closed", msg.data.reason);
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
    if (room.votesVisible.value) connection?.hideVotes();
    else connection?.revealVotes();
  }

  function toggleVoteLock() {
    if (room.votesLocked.value) connection?.unlockVotes();
    else connection?.lockVotes();
  }

  function vote(point: string) {
    const cast = room.castOwnVote(point);
    if (cast) connection?.submitVote(cast);
  }

  function clearMyVote() {
    const cast = room.withdrawOwnVote();
    if (cast) connection?.submitVote(cast);
  }

  function clearAllVotes() {
    connection?.clearVotes();
    room.clearRound();
  }

  function startNewRound() {
    clearAllVotes();
  }

  function makeAdmin(name: string) {
    if (!room.isAdmin.value || name === room.adminUsername.value) return;
    connection?.transferAdmin(name);
    adminSheetOpen.value = false;
  }

  function handleRemoveParticipant(name: string) {
    if (!room.isAdmin.value || name === username.value) return;
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
    notifications.dispose();
    connection?.disconnect();
    connection = null;
    store.clearUsername();
  }

  return {
    notificationsEnabled: notifications.notificationsEnabled,
    notificationsUnavailable: notifications.notificationsUnavailable,
    notificationDescription: notifications.notificationDescription,
    toggleNotifications: notifications.toggleNotifications,
    adminSheetOpen,
    canReact: reactions.canReact,
    connectionStatus,
    copiedRoomLink,
    deck: room.deck,
    deckLabel: room.deckLabel,
    hasVotes: room.hasVotes,
    isAdmin: room.isAdmin,
    isMissingUsername,
    isSpectator: room.isSpectator,
    isVoter: room.isVoter,
    joinAsSpectator,
    members: room.members,
    pointEstimate: room.ownVote,
    points: room.points,
    reactionBursts: reactions.reactionBursts,
    reactionFeed: reactions.reactionFeed,
    reactionsRateLimited: reactions.reactionsRateLimited,
    roomId,
    soundCuesEnabled,
    spectatorMembers: room.spectatorMembers,
    totalCount: room.totalCount,
    usernameModel,
    votedCount: room.votedCount,
    votesLocked: room.votesLocked,
    votesVisible: room.votesVisible,
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
