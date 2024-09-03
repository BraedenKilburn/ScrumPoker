import {
  DynamoDBDocumentClient,
  PutCommand,
  QueryCommand,
  GetCommand,
} from '@aws-sdk/lib-dynamodb'
import { DynamoDBClient } from '@aws-sdk/client-dynamodb'
import {
  ApiGatewayManagementApiClient,
  PostToConnectionCommand,
} from '@aws-sdk/client-apigatewaymanagementapi'

// Initialize DynamoDBDocumentClient
const ddbClient = new DynamoDBClient({})
const ddb = DynamoDBDocumentClient.from(ddbClient)

// Initialize ApiGatewayManagementApiClient
let apigwManagementApi

export const handler = async (event) => {
  const { roomId, username } = JSON.parse(event.body) // Accept username from the request body
  const { connectionId, domainName, stage } = event.requestContext

  apigwManagementApi = new ApiGatewayManagementApiClient({
    endpoint: `https://${domainName}/${stage}`,
  })

  try {
    await ensureRoomExists(roomId, connectionId)
    await ensureUsernameIsUnique(roomId, username, connectionId)
    await addUserToRoom(roomId, connectionId, username)
    await notifyRoomOfNewUser(roomId, connectionId, username)

    return {
      statusCode: 200,
      body: JSON.stringify({
        message: `Joined room ${roomId} successfully`,
      }),
    }
  } catch (error) {
    return handleJoinRoomError(connectionId, error)
  }
}

// Ensure the room exists and create it if it doesn't
async function ensureRoomExists(roomId, connectionId) {
  try {
    const room = await getRoom(roomId)
    if (!room) {
      await createRoom(roomId, connectionId)
    }
  } catch (error) {
    throw new Error('Failed to ensure room existence')
  }
}

async function getRoom(roomId) {
  const getParams = {
    TableName: 'scrum-poker-rooms',
    Key: { room_id: roomId },
  }
  const roomCheck = await ddb.send(new GetCommand(getParams))
  return roomCheck.Item
}

async function createRoom(roomId, connectionId) {
  const putParams = {
    TableName: 'scrum-poker-rooms',
    Item: {
      room_id: roomId,
      votes_visible: false,
      admin: connectionId,
    },
  }
  await ddb.send(new PutCommand(putParams))
}

// Ensure the username is unique within the room
async function ensureUsernameIsUnique(roomId, username, connectionId) {
  const existingUser = await checkUsernameInRoom(roomId, username)
  if (existingUser) {
    await sendErrorToClient(
      connectionId,
      'Username is already taken in this room',
    )
    throw new Error('Username is already taken in this room')
  }
}

async function checkUsernameInRoom(roomId, username) {
  const queryParams = {
    TableName: 'scrum-poker',
    KeyConditionExpression: 'room_id = :roomId',
    FilterExpression: 'username = :username',
    ExpressionAttributeValues: {
      ':roomId': roomId,
      ':username': username,
    },
  }
  const result = await ddb.send(new QueryCommand(queryParams))
  return result.Items.length > 0
}

// Add the user to the room
async function addUserToRoom(roomId, connectionId, username) {
  const putParams = {
    TableName: 'scrum-poker',
    Item: {
      room_id: roomId,
      connection_id: connectionId,
      username: username,
      point_estimate: null, // or initial value
    },
  }
  await ddb.send(new PutCommand(putParams))
}

// Notify the room that a new user has joined
async function notifyRoomOfNewUser(roomId, connectionId, username) {
  const newUser = {
    connection_id: connectionId,
    username: username,
    point_estimate: null,
  }
  await broadcastToRoom(roomId, newUser)
}

async function broadcastToRoom(roomId, newUser) {
  try {
    const users = await getUsersInRoom(roomId)
    await sendUserJoinedMessage(users, newUser)
    await sendExistingUsersList(newUser.connection_id, users)
  } catch (error) {
    console.error('Error broadcasting to room:', error)
  }
}

async function getUsersInRoom(roomId) {
  const queryParams = {
    TableName: 'scrum-poker',
    KeyConditionExpression: 'room_id = :roomId',
    ExpressionAttributeValues: { ':roomId': roomId },
  }
  const result = await ddb.send(new QueryCommand(queryParams))
  return result.Items
}

async function sendUserJoinedMessage(users, newUser) {
  const message = {
    message: 'UserJoined',
    user: newUser,
  }
  for (const user of users) {
    if (user.connection_id !== newUser.connection_id) {
      await sendToClient(user.connection_id, JSON.stringify(message))
    }
  }
}

async function sendExistingUsersList(connectionId, users) {
  const existingUsersMessage = {
    message: 'ExistingUsers',
    users,
  }
  await sendToClient(connectionId, JSON.stringify(existingUsersMessage))
}

// Handle any errors that occur during the join room process
async function handleJoinRoomError(connectionId, error) {
  console.error('Error during joinRoom:', error)
  await sendErrorToClient(connectionId, 'Failed to join room')
  return {
    statusCode: 500,
    body: JSON.stringify({ message: 'Failed to join room' }),
  }
}

async function sendErrorToClient(connectionId, details) {
  const errorMessage = {
    message: 'error',
    details,
  }
  await sendToClient(connectionId, JSON.stringify(errorMessage))
}

// Send data to a specific client via WebSocket
async function sendToClient(connectionId, data) {
  try {
    const params = {
      ConnectionId: connectionId,
      Data: Buffer.from(data),
    }
    await apigwManagementApi.send(new PostToConnectionCommand(params))
  } catch (error) {
    console.error(`Failed to send data to connection ${connectionId}:`, error)
  }
}
