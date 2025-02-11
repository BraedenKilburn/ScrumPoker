export type Message = {
  type: string
  data: Record<string, any>
}

let socket: WebSocket
export function connectWebSocket(apiUrl: URL, onMessage: (message: Message) => void): WebSocket {
  socket = new WebSocket(apiUrl)

  socket.onopen = () => {
    console.log('WebSocket connected')
  }

  socket.onmessage = (event) => {
    const message = JSON.parse(event.data)
    onMessage(message)
  }

  socket.onclose = (event) => {
    console.log('WebSocket disconnected', event)
  }

  socket.onerror = (event) => {
    console.error('WebSocket error:', event)
    onMessage({ type: 'roomClosed', data: { reason: 'WebSocket error' } })
  }

  return socket
}

export function transferAdmin(newAdmin: string) {
  socket.send(
    JSON.stringify({ type: 'transferAdmin', data: { newAdmin } })
  )
}

export function submitVote(data: { vote?: string }) {
  socket.send(
    JSON.stringify({ type: 'submitVote', data })
  )
}

export function clearVotes() {
  socket.send(
    JSON.stringify({ type: 'clearVotes' })
  )
}

export function revealVotes() {
  socket.send(
    JSON.stringify({ type: 'revealVotes' })
  )
}

export function hideVotes() {
  socket.send(
    JSON.stringify({ type: 'hideVotes' })
  )
}

export function lockVotes() {
  socket.send(
    JSON.stringify({ type: 'lockVotes' })
  )
}

export function unlockVotes() {
  socket.send(
    JSON.stringify({ type: 'unlockVotes' })
  )
}
