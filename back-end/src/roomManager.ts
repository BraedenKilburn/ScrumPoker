import { Socket } from "socket.io"
import { RoomDetail, UserDetail } from "types"

export const rooms: Record<string, RoomDetail> = {}
export const userMap: Record<string, UserDetail> = {}

export function createRoom(
  socket: Socket,
  roomId: string,
  username: string,
): void {
  // Add the room to the rooms object
  rooms[roomId] = {
    roomId,
    hostSocketId: socket.id,
    members: new Set([socket.id])
  }

  // Add the user to the userMap object
  userMap[socket.id] = {
    socketId: socket.id,
    roomId,
    username,
    point: undefined,
  }

  // Connect the user to the room
  socket.join(roomId)
}

export function leaveRoom(socket: Socket, roomId: string) {
  // If there is no room with the given roomId, return false
  const room = rooms[roomId]
  if (!room) return false

  // If the host leaves the room, kick all members out
  // and delete the room
  if (room.hostSocketId === socket.id) {
    room.members.forEach((member) => {
      if (member !== socket.id) {
        delete userMap[member]
        socket.to(member).emit('notification', 'Host has ended the session')
        socket.to(member).emit('roomDestroyed')
      }
    })
    delete rooms[roomId]
    socket.emit('notification', 'Host has ended the session')
    return false
  }

  // If a member leaves the room, remove them from the room
  if (room.members.has(socket.id)) {
    rooms[roomId].members.delete(socket.id)
    delete userMap[socket.id]
    socket.leave(roomId)
    return true
  }

  // If the user is not in the room, return false
  return false
}

/**
 * Handles the user switching rooms.
 * 
 * If the user is currently in a room and the new room is different from the current room,
 * the user will leave the current room.
 */
function handleUserSwitchRoom(socket: Socket, newRoomId: string) {
  const currentRoomId = userMap[socket.id]?.roomId
  if (currentRoomId && currentRoomId !== newRoomId) {
    leaveRoom(socket, currentRoomId)
  }
}

/**
 * Checks if a username is invalid by comparing it with existing usernames in the userMap.
 */
function isInvalidUsername(username: string) {
  return Object.values(userMap).some((user) => user.username === username)
}

export function joinRoom(
  socket: Socket,
  roomId: string,
  username: string,
): boolean {
  // If the room does not exist, emit an error and return false
  const room = rooms[roomId]
  if (!room) {
    socket.emit('bad-room', `Room ${roomId} does not exist`)
    socket.emit('error', 'Room does not exist')
    return false
  }

  // If the username is invalid, emit an error and return false
  if (isInvalidUsername(username)) {
    socket.emit('bad-username', `Username ${username} is already taken`)
    socket.emit('error', `Username ${username} is already taken`)
    return false
  }

  // If the username is valid, add the user to the room
  handleUserSwitchRoom(socket, roomId)
  socket.join(roomId)
  rooms[roomId].members.add(socket.id)
  userMap[socket.id] = {
    socketId: socket.id,
    roomId,
    username,
    point: undefined,
  }
  return true
}

/**
 * Returns an array of members in the room with the given roomId.
 */
export function getMembers(roomId: string) {
  if (!rooms[roomId]) return []
  return Array.from(rooms[roomId].members).map((member) => userMap[member])
}
