import type { User } from '@/stores/root'

/**
 * Socket Payload Type
 */
export type Message = {
  message: string
  connection_id?: string
  details?: string
  point_estimate?: string | null
  point_estimates?: User[]
  user?: User
  username?: string
  isAdmin?: boolean
  users?: User[]
}

let socket: WebSocket
let pingInterval: ReturnType<typeof setInterval>
export function connectWebSocket(apiUrl: string, onMessage: (message: Message) => void) {
  socket = new WebSocket(apiUrl)

  socket.onopen = () => {
    console.log('WebSocket connected')
    // Start sending pings every 30 seconds
    pingInterval = setInterval(function() {
      if (socket.readyState === WebSocket.OPEN) {
        socket.send(JSON.stringify({ action: 'ping' }));
      }
   }, 30000);
  }

  socket.onmessage = (event) => {
    const message = JSON.parse(event.data)
    onMessage(message)
  }

  socket.onclose = (event) => {
    console.log('WebSocket disconnected', event)

    // Clear the ping interval when the socket is closed
    clearInterval(pingInterval);

    onMessage({
      message: 'error',
      details: 'WebSocket closed, attempting to reconnect',
    })

    // Attempt to reconnect every 5 seconds
    setTimeout(() => {
      connectWebSocket(apiUrl, onMessage)
    }, 5000)
  }

  socket.onerror = (error) => {
    console.error('WebSocket error:', error)
    onMessage({
      message: 'error',
      details: 'WebSocket error, try reloading the page',
    })
    socket.close()
  }
}

export type JoinRoomPayload = {
  roomId: string
  username: string
}
export function joinRoom(payload: JoinRoomPayload) {
  socket.send(
    JSON.stringify({
      ...payload,
      action: 'joinRoom'
    })
  )
}

export function leaveRoom(roomId: string) {
  socket.send(
    JSON.stringify({
      roomId: roomId,
      action: 'leaveRoom'
    })
  )
}

export type SubmitVotePayload = {
  roomId: string
  pointEstimate: string | null
}
export function submitVote(payload: SubmitVotePayload) {
  socket.send(
    JSON.stringify({
      ...payload,
      action: 'submitVote'
    })
  )
}

export function clearVotes(roomId: string) {
  socket.send(
    JSON.stringify({
      action: 'clearVotes',
      roomId: roomId
    })
  )
}

export function revealVotes(roomId: string) {
  socket.send(
    JSON.stringify({
      action: 'revealVotes',
      roomId: roomId
    })
  )
}

export function hideVotes(roomId: string) {
  socket.send(
    JSON.stringify({
      action: 'hideVotes',
      roomId: roomId
    })
  )
}
