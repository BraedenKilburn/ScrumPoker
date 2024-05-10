import { io } from '@/serverConfig'
import {
  rooms,
  userMap,
  createRoom,
  joinRoom,
  isHost,
  leaveRoom,
  getMembers,
} from '@/roomManager'

/**
 * Provides an updated list of members to all clients in the room
 */
function updateMembers(roomId: string) {
  io.to(roomId).emit('update-members', getMembers(roomId))
}

export function setupEventHandlers() {
  io.on('connection', (socket) => {

    // Create a room
    socket.on('createRoom', ({ roomId, username }) => {
      // If the room already exists, emit an error message
      if (rooms[roomId]) {
        socket.emit('error', 'Room already exists. Try another name or join the existing room.')
      } else {
        // Otherwise, create the room and emit a success message
        createRoom(socket, roomId, username)
        socket.emit('roomCreated', { roomId, socketId: socket.id })
      }
    })

    // Join a room
    socket.on('joinRoom', ({ roomId, username }) => {
      // If the user successfully joins the room
      if (joinRoom(socket, roomId, username)) {
        updateMembers(roomId)
        socket.emit('roomJoined', roomId)

        io.to(roomId).emit(
          'notification',
          `${username} has joined the room`,
        )
      }
    })

    // Get members in the room
    socket.on('getMembers', (roomId: string) => {
      socket.emit('update-members', getMembers(roomId))
    })

    // Cast a vote
    socket.on('vote', ({ roomId, point }) => {
      // If the room does not exist, return
      const room = rooms[roomId]
      if (!room) return

      // Update the user's point and emit the voteReceived event
      // to all clients in the room
      const user = userMap[socket.id]
      if (user) {
        user.point = point
        io.to(roomId).emit('voteReceived', userMap[socket.id])
      }
    })

    // Toggle vote visibility
    socket.on('toggleVoteVisibility', ({ roomId, visible }) => {
      if (!rooms[roomId]) return
      if (!isHost(socket, roomId)) return

      // If visible is true, emit the revealAllVotes event
      // to all clients in the room; otherwise, emit the hideAllVotes event
      if (visible) io.to(roomId).emit('revealAllVotes')
      else io.to(roomId).emit('hideAllVotes')
    })

    // Clear all votes
    socket.on('clearAllVotes', (roomId: string) => {
      const room = rooms[roomId]
      if (!room) return
      if (!isHost(socket, roomId)) return

      // For each member in the room, set the point to undefined
      room.members.forEach((member) => {
        userMap[member].point = undefined
      })
      io.to(roomId).emit('allVotesCleared')
    })

    // Leave the room
    socket.on('leaveRoom', (roomId: string) => {
      const user = userMap[socket.id]
      if (user && leaveRoom(socket, roomId)) {
        updateMembers(roomId)
        io.to(roomId).emit('notification', `${user.username} has left the room`)
      }
    })

    // On disconnect, leave the room
    socket.on('disconnect', () => {
      leaveRoom(socket, userMap[socket.id]?.roomId)
    })
  })
}
