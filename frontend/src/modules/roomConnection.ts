import {
  CloseCode,
  CloseReason,
  type ClientMessage,
  type DeckId,
  type ReactionEmoji,
  type ServerMessage,
} from "@shared/types";

export type ConnectionStatus = "connected" | "disconnected" | "reconnecting" | "failed";

/**
 * The slice of the browser WebSocket this module actually uses. Narrowing
 * it to these members is the test seam: a fake socket can satisfy the
 * whole interface without a DOM, so the reconnect state machine below is
 * unit-testable with an injected `socketFactory`.
 */
export interface WebSocketLike {
  onopen: (() => void) | null;
  onmessage: ((event: { data: unknown }) => void) | null;
  onclose: ((event: { code: number; reason: string }) => void) | null;
  onerror: ((event: unknown) => void) | null;
  send(data: string): void;
  close(code?: number, reason?: string): void;
}

export type SocketFactory = (url: URL) => WebSocketLike;

export interface RoomConnectionConfig {
  /** Where to connect. `updateUrl` replaces the URL replayed on reconnect. */
  url: URL;
  /** Every inbound server message — real, or synthetic like the failure `roomClosed`. */
  onMessage: (message: ServerMessage) => void;
  /** Connection lifecycle changes. */
  onStatus: (status: ConnectionStatus) => void;
  /** Defaults to a real WebSocket; tests inject a fake. */
  socketFactory?: SocketFactory;
}

/**
 * One live room connection. Owns the whole reconnect state machine —
 * exponential backoff, attempt cap, intentional-close suppression, the
 * username-taken and removed-by-admin close paths — behind named senders
 * and a small lifecycle surface. There is exactly one per room (a tab is
 * only ever in one room), so the session holds a single handle.
 */
export interface RoomConnection {
  submitVote(data: { vote?: string }): void;
  revealVotes(): void;
  hideVotes(): void;
  lockVotes(): void;
  unlockVotes(): void;
  clearVotes(): void;
  changeDeck(deck: DeckId): void;
  sendReaction(emoji: ReactionEmoji): void;
  transferAdmin(newAdmin: string): void;
  removeParticipant(participant: string): void;
  /** Close intentionally: no grace-period reconnect, sends the "User left room" reason. */
  disconnect(): void;
  /**
   * Replace the URL replayed by auto-reconnect. Room state lives only in
   * server memory, so a reconnect can recreate a destroyed room — the URL
   * it replays must carry the room's current settings, not connect-time ones.
   */
  updateUrl(url: URL): void;
}

const MAX_RECONNECT_ATTEMPTS = 5;
const BASE_DELAY_MS = 1000;

export function createRoomConnection(config: RoomConnectionConfig): RoomConnection {
  const { onMessage, onStatus } = config;
  const socketFactory: SocketFactory =
    config.socketFactory ?? ((url) => new WebSocket(url) as unknown as WebSocketLike);

  let socket: WebSocketLike | null = null;
  let currentUrl = config.url;
  let intentionalClose = false;
  let reconnectAttempts = 0;
  let reconnectTimer: ReturnType<typeof setTimeout> | null = null;

  function clearReconnectTimer() {
    if (reconnectTimer) {
      clearTimeout(reconnectTimer);
      reconnectTimer = null;
    }
  }

  function attemptReconnect() {
    if (reconnectAttempts >= MAX_RECONNECT_ATTEMPTS) {
      onStatus("failed");
      onMessage({ type: "roomClosed", data: { reason: "Unable to reconnect to the room" } });
      return;
    }

    onStatus("reconnecting");
    const delay = BASE_DELAY_MS * Math.pow(2, reconnectAttempts);
    reconnectAttempts++;

    reconnectTimer = setTimeout(() => {
      if (intentionalClose) return;
      openSocket(true);
    }, delay);
  }

  function openSocket(isReconnect: boolean) {
    socket = socketFactory(currentUrl);

    socket.onopen = () => {
      console.log(isReconnect ? "WebSocket reconnected" : "WebSocket connected");
      reconnectAttempts = 0;
      onStatus("connected");
    };

    socket.onmessage = (event) => {
      onMessage(JSON.parse(event.data as string));
    };

    socket.onclose = (event) => {
      console.log("WebSocket disconnected", event);

      if (intentionalClose) return;

      // Removed by admin comes with its own notification in the room view
      if (event.reason === CloseReason.RemovedByAdmin) return;

      // Username taken — no reconnection
      if (event.code === CloseCode.UsernameTaken) {
        onMessage({ type: "roomClosed", data: { reason: event.reason ?? "Username is taken" } });
        return;
      }

      // Unexpected close — attempt reconnection
      onStatus("reconnecting");
      attemptReconnect();
    };

    socket.onerror = (event) => {
      console.error("WebSocket error:", event);
    };
  }

  function send(message: ClientMessage) {
    socket?.send(JSON.stringify(message));
  }

  // Open immediately on construction, the way connectWebSocket used to.
  openSocket(false);

  return {
    submitVote: (data) => send({ type: "submitVote", data }),
    revealVotes: () => send({ type: "revealVotes" }),
    hideVotes: () => send({ type: "hideVotes" }),
    lockVotes: () => send({ type: "lockVotes" }),
    unlockVotes: () => send({ type: "unlockVotes" }),
    clearVotes: () => send({ type: "clearVotes" }),
    changeDeck: (deck) => send({ type: "changeDeck", data: { deck } }),
    sendReaction: (emoji) => send({ type: "sendReaction", data: { emoji } }),
    transferAdmin: (newAdmin) => send({ type: "transferAdmin", data: { newAdmin } }),
    removeParticipant: (participant) => send({ type: "removeParticipant", data: { participant } }),
    disconnect: () => {
      intentionalClose = true;
      clearReconnectTimer();
      reconnectAttempts = 0;
      socket?.close(1000, CloseReason.UserLeft);
      socket = null;
    },
    updateUrl: (url) => {
      currentUrl = url;
    },
  };
}
