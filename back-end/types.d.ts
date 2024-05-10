export type RoomDetail = {
  roomId: string
  hostSocketId: string
  members: Set<string>
}

export type UserDetail = {
  socketId: string
  roomId: string
  username: string
  point?: number
}