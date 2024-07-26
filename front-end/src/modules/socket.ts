import { io } from "socket.io-client";

export function createSocketIo() {
  if (!import.meta.env.VITE_SOCKET_URL) {
    throw new Error("VITE_SOCKET_URL is not set");
  }

  const socket = io(`//${import.meta.env.VITE_SOCKET_URL}`);
  return socket;
}
