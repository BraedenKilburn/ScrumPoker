import {
  DynamoDBDocumentClient,
  DeleteCommand,
  QueryCommand,
} from '@aws-sdk/lib-dynamodb'
import { DynamoDBClient } from '@aws-sdk/client-dynamodb'
import {
  ApiGatewayManagementApiClient,
  PostToConnectionCommand,
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
    await leaveRoom(roomId, connectionId)
    await notifyUsersOfDeparture(roomId, connectionId)

    return successResponse('User left the room successfully')
  } catch (error) {
    return handleError(connectionId, 'Failed to leave room', error)
  }
}

// Initialize the ApiGatewayManagementApiClient
function initializeApiGatewayManagementClient(domainName, stage) {
  return new ApiGatewayManagementApiClient({
    endpoint: `https://${domainName}/${stage}`,
  })
}

// Remove the user from the room
async function leaveRoom(roomId, connectionId) {
  const deleteParams = {
    TableName: 'scrum-poker',
    Key: {
      room_id: roomId,
      connection_id: connectionId,
    },
  }
  await ddb.send(new DeleteCommand(deleteParams))
}

// Notify all remaining users in the room that a user has left
async function notifyUsersOfDeparture(roomId, departedConnectionId) {
  const queryParams = {
    TableName: 'scrum-poker',
    KeyConditionExpression: 'room_id = :roomId',
    ExpressionAttributeValues: {
      ':roomId': roomId,
    },
  }
  const result = await ddb.send(new QueryCommand(queryParams))

  const message = {
    message: 'UserLeft',
    connection_id: departedConnectionId,
  }

  for (const item of result.Items) {
    await sendToClient(item.connection_id, JSON.stringify(message))
  }
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
