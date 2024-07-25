import { io } from "socket.io-client";

export function createSocketIo() {
  const socket = io('http://ec2-54-242-175-223.compute-1.amazonaws.com:3000'); // Your Node.js server URL
  return socket;
}
