export type Message = {
  type: string
  data: Record<string, any>
}

let socket: WebSocket
let pingInterval: number

interface ReconnectionState {
  roomId: string
  username: string
  maxRetries: number
  currentRetry: number
  baseDelay: number
}

let reconnectionState: ReconnectionState | null = null
let reconnectionTimeout: number | null = null

function calculateBackoffDelay(retryCount: number, baseDelay: number): number {
  // Exponential backoff with jitter and max delay of 30 seconds
  const exponentialDelay = Math.min(baseDelay * Math.pow(2, retryCount), 30000)
  const jitter = Math.random() * 1000 // Add up to 1 second of jitter
  return exponentialDelay + jitter
}

function clearReconnectionState() {
  if (reconnectionTimeout) {
    clearTimeout(reconnectionTimeout)
    reconnectionTimeout = null
  }
  reconnectionState = null
}

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
  // Store reconnection information
  if (!reconnectionState) {
    reconnectionState = {
      roomId: apiUrl.searchParams.get('roomId') || '',
      username: apiUrl.searchParams.get('username') || '',
      maxRetries: 10,
      currentRetry: 0,
      baseDelay: 1000 // Start with 1 second delay
    }
  }

  socket = new WebSocket(apiUrl)

  socket.onopen = () => {
    console.log('WebSocket connected')

    // Reset reconnection state on successful connection
    if (reconnectionState) {
      reconnectionState.currentRetry = 0
    }
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

    // Don't reconnect if explicitly removed by admin
    if (event.reason === 'Removed by admin') {
      clearReconnectionState()
      return
    }

    // Attempt reconnection if we have reconnection state
    if (reconnectionState && reconnectionState.currentRetry < reconnectionState.maxRetries) {
      const delay = calculateBackoffDelay(
        reconnectionState.currentRetry,
        reconnectionState.baseDelay
      )

      reconnectionTimeout = setTimeout(() => {
        reconnectionState!.currentRetry++
        // Reconstruct the URL with the same parameters
        const newUrl = new URL(apiUrl.toString())
        newUrl.searchParams.set('roomId', reconnectionState!.roomId)
        newUrl.searchParams.set('username', reconnectionState!.username)
        connectWebSocket(newUrl, onMessage)
      }, delay)

      return
    }

    // If we've exceeded max retries or have no reconnection state, close permanently
    clearReconnectionState()
    onMessage({
      type: 'roomClosed',
      data: {
        reason: event.reason ?? 'Connection lost after maximum reconnection attempts'
      }
    })
  }

  socket.onerror = (event) => {
    console.error('WebSocket error:', event)
    clearPingInterval()
  }

  return socket
}

export function transferAdmin(newAdmin: string) {
  socket.send(JSON.stringify({ type: 'transferAdmin', data: { newAdmin } }))
}

export function submitVote(data: { vote?: string }) {
  socket.send(JSON.stringify({ type: 'submitVote', data }))
}

export function clearVotes() {
  socket.send(JSON.stringify({ type: 'clearVotes' }))
}

export function revealVotes() {
  socket.send(JSON.stringify({ type: 'revealVotes' }))
}

export function hideVotes() {
  socket.send(JSON.stringify({ type: 'hideVotes' }))
}

export function lockVotes() {
  socket.send(JSON.stringify({ type: 'lockVotes' }))
}

export function unlockVotes() {
  socket.send(JSON.stringify({ type: 'unlockVotes' }))
}

export function removeParticipant(participant: string) {
  socket.send(JSON.stringify({ type: 'removeParticipant', data: { participant } }))
}

/**
 * Stop the reconnection process, used when navigating away from the page.
 */
export function stopReconnection() {
  clearReconnectionState()
}
