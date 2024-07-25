import express from 'express'
import http from 'http'
import { Server } from 'socket.io'
import cors from 'cors'

export const app = express()
const server = http.createServer(app)

export const io = new Server(server, {
  cors: {
    origin: 'https://scrum.braedenkilburn.com',
    methods: ['GET', 'POST'],
  },
})

app.use(cors())

export const PORT = process.env.PORT || 3000
export default server
