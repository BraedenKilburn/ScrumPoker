import { InMemoryRoomManager } from "./roomManager";
import { MessageHandler } from "./messageHandler";
import { ConnectionManager } from "./connectionManager";
import { logger } from "./logger";

const connectionManager = new ConnectionManager();
const roomManager = new InMemoryRoomManager();

const server = Bun.serve<WebSocketData, undefined>({
  fetch(req, server) {
    const roomId = new URL(req.url).searchParams.get("roomId");
    const username = new URL(req.url).searchParams.get("username");

    if (!username) return new Response("Username is required", { status: 400 });
    if (!roomId) return new Response("Room ID is required", { status: 400 });

    try {
      roomManager.joinRoom(roomId, username);

      const ip =
        req.headers.get("x-forwarded-for") ||
        req.headers.get("x-real-ip") ||
        req.headers.get("cf-connecting-ip") ||
        "unknown";
      logger.websocket(`Connection attempt`, { roomId, username, ip });

      if (server.upgrade(req, { data: { username, roomId } })) return;
    } catch (error) {
      logger.error(`Connection failed`, { roomId, username, error: (error as Error).message });
      return new Response((error as Error).message, { status: 400 });
    }

    logger.error(`Upgrade failed`, { roomId, username });
    return new Response("Upgrade failed", { status: 500 });
  },
  websocket: {
    idleTimeout: 960,
    open(ws) {
      const { roomId, username } = ws.data;
      ws.subscribe(roomId);

      // Register the connection
      connectionManager.registerConnection(roomId, username, ws);

      logger.websocket(`Connection opened`, { roomId, username });

      const joinMessage = MessageHandler.createMessage('userJoined', { username });
      ws.publish(roomId, joinMessage);

      const participants = Object.fromEntries(roomManager.getRoomVotes(roomId));
      const admin = roomManager.getAdmin(roomId);
      const locked = roomManager.getRoomLockState(roomId);
      const welcomeMessage = MessageHandler.createMessage('joinRoomSuccess', { participants, admin, locked });
      ws.send(welcomeMessage);
    },
    message(ws, message) {
      // Keep the connection alive
      if (message === 'ping') {
        ws.send('pong');
        return;
      }

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

          case 'lockVotes':
            roomManager.setVoteLock(roomId, username, true);
            server.publish(roomId, MessageHandler.createMessage("voteLockStatus", { locked: true }));
            break;

          case 'unlockVotes':
            roomManager.setVoteLock(roomId, username, false);
            server.publish(roomId, MessageHandler.createMessage("voteLockStatus", { locked: false }));
            break;

          case 'removeParticipant':
            const participantToRemove = msg.data.participant;
            if (!participantToRemove) break;

            // Remove the participant from the room and the connection
            roomManager.removeParticipant(roomId, username, participantToRemove);
            connectionManager.removeParticipant(roomId, participantToRemove, username);
            break;

          default:
            ws.send(MessageHandler.createMessage("error", { message: "Unknown message type" }));
        }
      } catch (error) {
        logger.warn(`Error parsing message`, { roomId, username, message, error: (error as Error).message });
        const errorMessage = MessageHandler.createMessage('error', {
          message: (error as Error).message,
        });
        ws.send(errorMessage);
      }
    },
    close(ws, code, reason) {
      const { roomId, username } = ws.data;
      if (!roomId || !username) return;

       // Log the disconnection with detailed information
       const log = code === 1000 ? logger.websocket : logger.error;
       log(`Connection closed`, {
        roomId,
        username,
        code,
        reason: reason || 'No reason provided'
      });

      // Remove the connection
      connectionManager.removeConnection(roomId, username);

      const { shouldDestroyRoom } = roomManager.leaveRoom(roomId, username);
      if (reason === 'Removed by admin') return;
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
