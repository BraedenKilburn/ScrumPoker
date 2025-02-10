import { InMemoryRoomManager } from "./roomManager";
import { MessageHandler } from "./messageHandler";

const roomManager = new InMemoryRoomManager();

const server = Bun.serve<WebSocketData>({
  fetch(req, server) {
    const roomId = new URL(req.url).searchParams.get("roomId");
    const username = new URL(req.url).searchParams.get("username");

    if (!username) return new Response("Username is required", { status: 400 });
    if (!roomId) return new Response("Room ID is required", { status: 400 });

    try {
      roomManager.joinRoom(roomId, username);

      if (server.upgrade(req, { data: { username, roomId } })) return;
    } catch (error) {
      return new Response((error as Error).message, { status: 400 });
    }

    return new Response("Upgrade failed", { status: 500 });
  },
  websocket: {
    idleTimeout: 960,
    open(ws) {
      const { roomId, username } = ws.data;
      ws.subscribe(roomId);

      const joinMessage = MessageHandler.createMessage('userJoined', { username });
      ws.publish(roomId, joinMessage);

      const participants = Object.fromEntries(roomManager.getRoomVotes(roomId));
      const admin = roomManager.getAdmin(roomId);
      const welcomeMessage = MessageHandler.createMessage('joinRoomSuccess', { participants, admin });
      ws.send(welcomeMessage);
    },
    message(ws, message) {
      const { roomId, username } = ws.data;

      try {
        const msg = MessageHandler.parseMessage(message as string) as WebSocketMessage;
        switch (msg.type) {
          case 'submitVote':
            roomManager.submitVote(roomId, username, msg.data.vote);
            ws.publish(roomId, MessageHandler.createUserVotedMessage(roomId, username, roomManager));
            break;

          case 'revealVotes':
            roomManager.setVoteVisibility(roomId, username, true);
            server.publish(roomId, MessageHandler.createVoteStatusMessage(roomId, roomManager));
            break;

          case 'hideVotes':
            roomManager.setVoteVisibility(roomId, username, false);
            server.publish(roomId, MessageHandler.createVoteStatusMessage(roomId, roomManager));
            break;

          case "clearVotes":
            roomManager.clearVotes(roomId, username);
            roomManager.setVoteVisibility(roomId, username, false);
            ws.publish(roomId, MessageHandler.createMessage("votesCleared"));
            break;

          case "transferAdmin":
            roomManager.transferAdmin(roomId, username, msg.data.newAdmin);
            server.publish(roomId, MessageHandler.createMessage("adminTransferred", { newAdmin: msg.data.newAdmin }));
            break;

          default:
            ws.send(MessageHandler.createMessage("error", { message: "Unknown message type" }));
        }
      } catch (error) {
        console.error(`Invalid JSON received from ${username} in ${roomId}:`, message);

        const errorMessage = MessageHandler.createMessage('error', {
          message: (error as Error).message,
        });
        ws.send(errorMessage);
      }
    },
    close(ws) {
      const { roomId, username } = ws.data;
      if (!roomId || !username) return;

      const { shouldDestroyRoom } = roomManager.leaveRoom(roomId, username);
      if (shouldDestroyRoom) {
        const message = MessageHandler.createMessage('roomClosed', { reason: 'Admin left the room' });
        server.publish(roomId, message);
      } else {
        const message = MessageHandler.createMessage('userLeft', { username });
        server.publish(roomId, message);
      }
    },
  },
});

console.log(`Listening on ${server.hostname}:${server.port}`);
