import { io } from "socket.io-client";

export function createSocketIo() {
  const socket = io('http://localhost:3000'); // Your Node.js server URL
  return socket;
}