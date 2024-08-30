import type { User } from "@/stores/root";

/**
 * Socket Payload Type
 */
export type Message = {
  message: string;
  connection_id?: string;
  details?: string;
  point_estimate?: string | null;
  point_estimates?: User[];
  user?: User;
  users?: User[];
};

let socket: WebSocket;
export function connectWebSocket(apiUrl: string, onMessage: (message: Message) => void) {
  socket = new WebSocket(apiUrl);
  console.log('socket', socket);

  socket.onopen = () => {
    console.log('WebSocket connected');
  };

  socket.onmessage = (event) => {
    const message = JSON.parse(event.data);
    onMessage(message);
  };

  socket.onclose = () => {
    console.log('WebSocket disconnected');
  };

  socket.onerror = (error) => {
    console.error('WebSocket error:', error);
  };
}

export type JoinRoomPayload = {
  roomId: string;
  username: string;
};
export function joinRoom(payload: JoinRoomPayload) {
  socket.send(JSON.stringify({
    ...payload,
    action: 'joinRoom',
  }));
}

export function leaveRoom(roomId: string) {
  socket.send(JSON.stringify({
    roomId: roomId,
    action: 'leaveRoom',
  }));
}

export type SubmitVotePayload = {
  roomId: string;
  pointEstimate: string | null;
};
export function submitVote(payload: SubmitVotePayload) {
  socket.send(JSON.stringify({
    ...payload,
    action: 'submitVote',
  }));
}

export function clearVotes(roomId: string) {
  socket.send(JSON.stringify({
    action: 'clearVotes',
    roomId: roomId,
  }));
}

export function revealVotes(roomId: string) {
  socket.send(JSON.stringify({
    action: 'revealVotes',
    roomId: roomId,
  }));
}

export function hideVotes(roomId: string) {
  socket.send(JSON.stringify({
    action: 'hideVotes',
    roomId: roomId,
  }));
}
