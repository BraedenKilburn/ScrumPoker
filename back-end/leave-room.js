import {
  DynamoDBDocumentClient,
  BatchWriteCommand,
  GetCommand,
  DeleteCommand,
  QueryCommand
} from '@aws-sdk/lib-dynamodb'
import { DynamoDBClient } from '@aws-sdk/client-dynamodb'
import {
  ApiGatewayManagementApiClient,
  PostToConnectionCommand
} from '@aws-sdk/client-apigatewaymanagementapi'

// Initialize DynamoDBDocumentClient
const ddbClient = new DynamoDBClient({})
const ddb = DynamoDBDocumentClient.from(ddbClient)
let apigwManagementApi

export const handler = async (event) => {
  const { roomId } = JSON.parse(event.body)
  const connectionId = event.requestContext.connectionId
  const { domainName, stage } = event.requestContext

  apigwManagementApi = initializeApiGatewayManagementClient(domainName, stage)

  try {
    // Check if the user is the admin
    const isAdmin = await checkIfUserIsAdmin(roomId, connectionId)

    if (isAdmin) {
      // Admin is leaving; destroy the room
      await notifyRoomClosed(roomId)
      await destroyRoom(roomId)
      await removeUsersFromRoom(roomId)
    } else {
      // Non-admin user is leaving
      const username = await leaveRoom(roomId, connectionId)
      await notifyUsersOfDeparture(roomId, username)
    }

    return successResponse('User left the room successfully')
  } catch (error) {
    return handleError(connectionId, 'Failed to leave room', error)
  }
}

// Initialize the ApiGatewayManagementApiClient
function initializeApiGatewayManagementClient(domainName, stage) {
  return new ApiGatewayManagementApiClient({
    endpoint: `https://${domainName}/${stage}`
  })
}

// Function to check if the user is the admin of the room
async function checkIfUserIsAdmin(roomId, connectionId) {
  const params = {
    TableName: 'scrum-poker-rooms',
    Key: { room_id: roomId }
  }

  const result = await ddb.send(new GetCommand(params))

  if (!result.Item) {
    throw new Error('Room not found.')
  }

  return result.Item.admin === connectionId
}

// Notify all participants that the room has been closed
async function notifyRoomClosed(roomId) {
  const participants = await getUsersInRoom(roomId)

  const message = {
    message: 'RoomClosed'
  }

  const notifyPromises = participants.map((participant) =>
    sendToClient(participant.connection_id, JSON.stringify(message))
  )

  await Promise.allSettled(notifyPromises)
}

// Function to destroy the room when the admin leaves
async function destroyRoom(roomId) {
  // Delete the room from scrum-poker-rooms
  await ddb.send(
    new DeleteCommand({
      TableName: 'scrum-poker-rooms',
      Key: { room_id: roomId }
    })
  )
}

// Remove all users from the room
async function removeUsersFromRoom(roomId) {
  // Get all participants in the room
  const participants = await getUsersInRoom(roomId)

  // Delete all participants from scrum-poker
  if (participants.length > 0) {
    const deleteRequests = participants.map((participant) => ({
      DeleteRequest: {
        Key: {
          room_id: participant.room_id,
          connection_id: participant.connection_id
        }
      }
    }))

    // DynamoDB batch write allows up to 25 items per request
    const batches = []
    while (deleteRequests.length > 0) {
      batches.push(deleteRequests.splice(0, 25))
    }

    for (const batch of batches) {
      await ddb.send(
        new BatchWriteCommand({
          RequestItems: {
            'scrum-poker': batch
          }
        })
      )
    }
  }
}

// Remove a single user from the room
async function leaveRoom(roomId, connectionId) {
  // Get the user's username before deleting
  const getUserParams = {
    TableName: 'scrum-poker',
    Key: {
      room_id: roomId,
      connection_id: connectionId
    }
  }
  const userResult = await ddb.send(new GetCommand(getUserParams))

  if (!userResult.Item) {
    throw new Error('User not found in the room.')
  }

  const username = userResult.Item.username

  // Delete the user from the scrum-poker table
  const deleteParams = {
    TableName: 'scrum-poker',
    Key: {
      room_id: roomId,
      connection_id: connectionId
    }
  }
  await ddb.send(new DeleteCommand(deleteParams))

  return username
}

// Notify all remaining users in the room that a user has left
async function notifyUsersOfDeparture(roomId, departedUsername) {
  const participants = await getUsersInRoom(roomId)

  const message = {
    message: 'UserLeft',
    username: departedUsername
  }

  const notifyPromises = participants.map((participant) =>
    sendToClient(participant.connection_id, JSON.stringify(message))
  )

  await Promise.allSettled(notifyPromises)
}

// Get all users in the room
async function getUsersInRoom(roomId) {
  const queryParams = {
    TableName: 'scrum-poker',
    KeyConditionExpression: 'room_id = :roomId',
    ExpressionAttributeValues: {
      ':roomId': roomId
    }
  }
  const result = await ddb.send(new QueryCommand(queryParams))
  return result.Items || []
}

// Send data to a specific client via WebSocket
async function sendToClient(connectionId, data) {
  const params = {
    ConnectionId: connectionId,
    Data: Buffer.from(data)
  }
  await apigwManagementApi.send(new PostToConnectionCommand(params))
}

// Handle errors and notify the client
async function handleError(connectionId, message, error) {
  console.error(message, error)
  await sendToClient(connectionId, JSON.stringify({ message: 'error', details: message }))
  return {
    statusCode: 500,
    body: JSON.stringify({ message })
  }
}

// Success response
function successResponse(message) {
  return {
    statusCode: 200,
    body: JSON.stringify({ message })
  }
}
