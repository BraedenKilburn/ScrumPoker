export type Message = {
  type: string
  data: Record<string, any>
}

let socket: WebSocket
let pingInterval: number
function startPingInterval() {
  // Send ping every 45 seconds
  pingInterval = setInterval(() => {
    if (socket.readyState === WebSocket.OPEN) socket.send('ping')
  }, 1000 * 45)
}

function clearPingInterval() {
  if (pingInterval) clearInterval(pingInterval)
}

export function connectWebSocket(apiUrl: URL, onMessage: (message: Message) => void): WebSocket {
  socket = new WebSocket(apiUrl)

  socket.onopen = () => {
    console.log('WebSocket connected')
    startPingInterval()
  }

  socket.onmessage = (event) => {
    if (event.data === 'pong') return
    const message = JSON.parse(event.data)
    onMessage(message)
  }

  socket.onclose = (event) => {
    console.log('WebSocket disconnected', event)
    clearPingInterval()
    onMessage({ type: 'roomClosed', data: { reason: 'WebSocket disconnected' } })
  }

  socket.onerror = (event) => {
    console.error('WebSocket error:', event)
    clearPingInterval()
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
