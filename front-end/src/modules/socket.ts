import { io } from "socket.io-client";

export function createSocketIo() {
  const socket = io('http://23.20.128.131:3000'); // Your Node.js server URL
  return socket;
}
