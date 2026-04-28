import type { ServerMessage, ClientMessage } from "@shared/types";

export type ConnectionStatus = "connected" | "disconnected" | "reconnecting" | "failed";

let socket: WebSocket | null = null;
let intentionalClose = false;
let reconnectAttempts = 0;
let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
let currentUrl: URL | null = null;
let currentOnMessage: ((message: ServerMessage) => void) | null = null;
let onStatusChange: ((status: ConnectionStatus) => void) | null = null;

const MAX_RECONNECT_ATTEMPTS = 5;
const BASE_DELAY_MS = 1000;

function clearReconnectTimer() {
  if (reconnectTimer) {
    clearTimeout(reconnectTimer);
    reconnectTimer = null;
  }
}

function attemptReconnect() {
  if (!currentUrl || !currentOnMessage || reconnectAttempts >= MAX_RECONNECT_ATTEMPTS) {
    onStatusChange?.("failed");
    currentOnMessage?.({ type: "roomClosed", data: { reason: "Unable to reconnect to the room" } });
    return;
  }

  onStatusChange?.("reconnecting");
  const delay = BASE_DELAY_MS * Math.pow(2, reconnectAttempts);
  reconnectAttempts++;

  reconnectTimer = setTimeout(() => {
    if (intentionalClose) return;
    createSocket(currentUrl!, currentOnMessage!, true);
  }, delay);
}

function createSocket(
  apiUrl: URL,
  onMessage: (message: ServerMessage) => void,
  isReconnect: boolean = false,
): WebSocket {
  socket = new WebSocket(apiUrl);

  socket.onopen = () => {
    console.log(isReconnect ? "WebSocket reconnected" : "WebSocket connected");
    reconnectAttempts = 0;
    onStatusChange?.("connected");
  };

  socket.onmessage = (event) => {
    const message = JSON.parse(event.data);
    onMessage(message);
  };

  socket.onclose = (event) => {
    console.log("WebSocket disconnected", event);

    if (intentionalClose) return;

    // Removed by admin comes with its own notification in the room view
    if (event.reason === "Removed by admin") return;

    // Username taken — no reconnection
    if (event.code === 4001) {
      onMessage({ type: "roomClosed", data: { reason: event.reason ?? "Username is taken" } });
      return;
    }

    // Unexpected close — attempt reconnection
    onStatusChange?.("reconnecting");
    attemptReconnect();
  };

  socket.onerror = (event) => {
    console.error("WebSocket error:", event);
  };

  return socket;
}

export function connectWebSocket(
  apiUrl: URL,
  onMessage: (message: ServerMessage) => void,
): WebSocket {
  intentionalClose = false;
  reconnectAttempts = 0;
  clearReconnectTimer();
  currentUrl = apiUrl;
  currentOnMessage = onMessage;
  return createSocket(apiUrl, onMessage);
}

export function disconnect() {
  intentionalClose = true;
  clearReconnectTimer();
  reconnectAttempts = 0;
  socket?.close(1000, "User left room");
  socket = null;
}

export function onConnectionStatusChange(callback: (status: ConnectionStatus) => void) {
  onStatusChange = callback;
}

function send(message: ClientMessage) {
  socket?.send(JSON.stringify(message));
}

export function transferAdmin(newAdmin: string) {
  send({ type: "transferAdmin", data: { newAdmin } });
}

export function submitVote(data: { vote?: string }) {
  send({ type: "submitVote", data });
}

export function clearVotes() {
  send({ type: "clearVotes" });
}

export function revealVotes() {
  send({ type: "revealVotes" });
}

export function hideVotes() {
  send({ type: "hideVotes" });
}

export function lockVotes() {
  send({ type: "lockVotes" });
}

export function unlockVotes() {
  send({ type: "unlockVotes" });
}

export function removeParticipant(participant: string) {
  send({ type: "removeParticipant", data: { participant } });
}
