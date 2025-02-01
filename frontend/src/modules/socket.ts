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
    if (!event.wasClean) onMessage({
      type: 'error',
      data: {
        message: 'WebSocket closed, attempting to reconnect',
      },
    })

    onMessage({ type: 'roomClosed', data: {} })
  }

  socket.onerror = (event) => {
    console.error('WebSocket error:', event)
    onMessage({ type: 'roomClosed', data: {} })
  }

  return socket
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
