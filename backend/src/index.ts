import { InMemoryRoomManager } from "./roomManager";
import { MessageHandler } from "./messageHandler";
import { parseCookies } from "./utils";

const roomManager = new InMemoryRoomManager();

const server = Bun.serve<WebSocketData>({
  fetch(req, server) {
    const { username } = parseCookies(req.headers.get("cookie"));
    const roomId = new URL(req.url).searchParams.get("roomId");

    if (!username) return new Response("Username is required", { status: 400 });
    if (!roomId) return new Response("Room ID is required", { status: 400 });

    try {
      roomManager.joinRoom(roomId, username);

      if (server.upgrade(req, {
        data: { username, roomId },
        headers: {"Set-Cookie": `username=${username};` },
      })) return;
    } catch (error) {
      return new Response((error as Error).message, { status: 400 });
    }

    return new Response("Upgrade failed", { status: 500 });
  },
  websocket: {
    open(ws) {
      const { roomId, username } = ws.data;
      ws.subscribe(roomId);

      const joinMessage = MessageHandler.createMessage('userJoined', { username } );
      ws.publish(roomId, joinMessage);

      const participants = Object.fromEntries(roomManager.getRoomVotes(roomId));
      const welcomeMessage = MessageHandler.createMessage('joinRoomSuccess', { participants });
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
            roomManager.setVoteVisibility(roomId, true);
            server.publish(roomId, MessageHandler.createVoteStatusMessage(roomId, roomManager));
            break;

          case 'hideVotes':
            roomManager.setVoteVisibility(roomId, false);
            server.publish(roomId, MessageHandler.createVoteStatusMessage(roomId, roomManager));
            break;

          case "clearVotes":
            roomManager.clearVotes(roomId);
            roomManager.setVoteVisibility(roomId, false);
            ws.publish(roomId, MessageHandler.createMessage("votesCleared"));
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

      roomManager.leaveRoom(roomId, username);

      const leaveMessage = MessageHandler.createMessage('userLeft', { username });
      ws.publish(roomId, leaveMessage);
      ws.unsubscribe(roomId);
    },
  },
});

console.log(`Listening on ${server.hostname}:${server.port}`);
