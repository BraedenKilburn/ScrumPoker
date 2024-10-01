import {
  DynamoDBDocumentClient,
  UpdateCommand,
  QueryCommand,
} from '@aws-sdk/lib-dynamodb'
import { DynamoDBClient } from '@aws-sdk/client-dynamodb'
import {
  ApiGatewayManagementApiClient,
  PostToConnectionCommand,
} from '@aws-sdk/client-apigatewaymanagementapi'

// Initialize DynamoDBDocumentClient and ApiGatewayManagementApiClient
const ddbClient = new DynamoDBClient({})
const ddb = DynamoDBDocumentClient.from(ddbClient)
let apigwManagementApi

export const handler = async (event) => {
  const { roomId } = JSON.parse(event.body)
  const { connectionId, domainName, stage } = event.requestContext

  apigwManagementApi = initializeApiGatewayManagementClient(domainName, stage)

  try {
    const users = await getUsersInRoom(roomId)

    // Notify users before updating the database
    await notifyUsers(roomId, users, 'VotesCleared')

    // Proceed to update the database after notifying users
    await updateVotesVisible(roomId, false)
    await clearVotesInRoom(roomId)

    return successResponse(`Votes cleared successfully for room ${roomId}`)
  } catch (error) {
    return handleError(connectionId, 'Failed to clear votes', error)
  }
}

// Initialize the ApiGatewayManagementApiClient
function initializeApiGatewayManagementClient(domainName, stage) {
  return new ApiGatewayManagementApiClient({
    endpoint: `https://${domainName}/${stage}`,
  })
}

// Get all users in the room
async function getUsersInRoom(roomId) {
  const queryParams = {
    TableName: 'scrum-poker',
    KeyConditionExpression: 'room_id = :roomId',
    ExpressionAttributeValues: {
      ':roomId': roomId,
    },
  }

  const result = await ddb.send(new QueryCommand(queryParams))
  return result.Items || []
}

// Notify all users in the room with a specific message
async function notifyUsers(roomId, users, message) {
  const notification = { message }

  const notifyPromises = users.map((user) =>
    sendToClient(user.connection_id, JSON.stringify(notification)),
  )

  await Promise.allSettled(notifyPromises)
}

// Update the votes_visible attribute in the scrum-poker-rooms table
async function updateVotesVisible(roomId, visible) {
  const updateParams = {
    TableName: 'scrum-poker-rooms',
    Key: { room_id: roomId },
    UpdateExpression: 'SET votes_visible = :visible',
    ExpressionAttributeValues: {
      ':visible': visible,
    },
  }
  await ddb.send(new UpdateCommand(updateParams))
}

// Clear votes for all users in the room and return the list of users
async function clearVotesInRoom(roomId) {
  const users = await getUsersInRoom(roomId)

  const updatePromises = users.map((user) => {
    const params = {
      TableName: 'scrum-poker',
      Key: {
        room_id: user.room_id,
        connection_id: user.connection_id,
      },
      UpdateExpression: 'SET point_estimate = :null',
      ExpressionAttributeValues: {
        ':null': null,
      },
    }
    return ddb.send(new UpdateCommand(params))
  })

  await Promise.all(updatePromises)
}

// Send data to a specific client via WebSocket
async function sendToClient(connectionId, data) {
  const params = {
    ConnectionId: connectionId,
    Data: Buffer.from(data),
  }
  await apigwManagementApi.send(new PostToConnectionCommand(params))
}

// Handle errors and notify the client
async function handleError(connectionId, message, error) {
  console.error(message, error)
  await sendToClient(
    connectionId,
    JSON.stringify({ message: 'error', details: message }),
  )
  return {
    statusCode: 500,
    body: JSON.stringify({ message }),
  }
}

// Success response
function successResponse(message) {
  return {
    statusCode: 200,
    body: JSON.stringify({ message }),
  }
}
