import {
  DynamoDBDocumentClient,
  DeleteCommand,
  QueryCommand,
  GetCommand,
  BatchWriteCommand
} from '@aws-sdk/lib-dynamodb'
import { DynamoDBClient } from '@aws-sdk/client-dynamodb'
import {
  ApiGatewayManagementApiClient,
  PostToConnectionCommand
} from '@aws-sdk/client-apigatewaymanagementapi'

// Initialize DynamoDBDocumentClient
const ddbClient = new DynamoDBClient({})
const ddb = DynamoDBDocumentClient.from(ddbClient)

// Initialize ApiGatewayManagementApiClient
let apigwManagementApi

export const handler = async (event) => {
  const connectionId = event.requestContext.connectionId
  const { domainName, stage } = event.requestContext

  apigwManagementApi = new ApiGatewayManagementApiClient({
    endpoint: `https://${domainName}/${stage}`
  })

  try {
    // Remove connection ID from the connections table
    await removeConnectionId(connectionId)

    // Handle user disconnection from rooms
    await handleUserDisconnection(connectionId)

    return {
      statusCode: 200,
      body: JSON.stringify({
        message: 'Disconnected successfully'
      })
    }
  } catch (error) {
    console.error('Error during $disconnect:', error)
    return {
      statusCode: 500,
      body: JSON.stringify({
        message: 'Failed to disconnect'
      })
    }
  }
}

// Remove the connection ID from the connections table
async function removeConnectionId(connectionId) {
  try {
    const params = {
      TableName: 'scrum-poker-connections',
      Key: {
        connection_id: connectionId
      }
    }
    await ddb.send(new DeleteCommand(params))
  } catch (error) {
    console.error('Error removing connection ID:', error)
  }
}

// Handle user disconnection from rooms
async function handleUserDisconnection(connectionId) {
  try {
    // Query the scrum-poker table to find all rooms where the user is present
    const queryParams = {
      TableName: 'scrum-poker',
      IndexName: 'connection_id-index',
      KeyConditionExpression: 'connection_id = :connectionId',
      ExpressionAttributeValues: {
        ':connectionId': connectionId
      }
    }

    const queryResult = await ddb.send(new QueryCommand(queryParams))

    for (const item of queryResult.Items) {
      const roomId = item.room_id
      const username = item.username

      // Check if the user is the admin of the room
      const isAdmin = await checkIfUserIsAdmin(roomId, connectionId)

      if (isAdmin) {
        // Admin disconnected; destroy the room
        await notifyRoomClosed(roomId)
        await destroyRoom(roomId)
        await removeUsersFromRoom(roomId)
      } else {
        // Non-admin user disconnected; remove them from the room
        await leaveRoom(roomId, connectionId, username)
        await notifyUsersOfDeparture(roomId, username)
      }
    }
  } catch (error) {
    console.error('Error handling user disconnection from rooms:', error)
  }
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

// Function to destroy the room when the admin disconnects
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

// Remove the user from the room
async function leaveRoom(roomId, connectionId, username) {
  // Delete the user from the scrum-poker table
  await ddb.send(
    new DeleteCommand({
      TableName: 'scrum-poker',
      Key: {
        room_id: roomId,
        connection_id: connectionId
      }
    })
  )
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
