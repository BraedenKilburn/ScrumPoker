import server, { PORT } from './serverConfig'
import { setupEventHandlers } from './eventHandlers'

setupEventHandlers()

server.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}`)
})
