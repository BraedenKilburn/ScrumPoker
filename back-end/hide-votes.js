import {
  DynamoDBDocumentClient,
  GetCommand,
  QueryCommand,
  UpdateCommand
} from '@aws-sdk/lib-dynamodb'
import { DynamoDBClient } from '@aws-sdk/client-dynamodb'
import {
  ApiGatewayManagementApiClient,
  PostToConnectionCommand
} from '@aws-sdk/client-apigatewaymanagementapi'

const ddbClient = new DynamoDBClient({})
const ddb = DynamoDBDocumentClient.from(ddbClient)
let apigwManagementApi

export const handler = async (event) => {
  const { roomId } = JSON.parse(event.body)
  const { domainName, stage, connectionId } = event.requestContext

  apigwManagementApi = initializeApiGatewayManagementClient(domainName, stage)

  try {
    // Check if the requesting user is the admin
    const isAdmin = await checkIfAdmin(roomId, connectionId)
    if (!isAdmin) {
      return forbiddenResponse('Only the admin can hide votes.')
    }

    await hideVotesAndNotifyUsers(roomId)
    return successResponse('Votes hidden successfully')
  } catch (error) {
    return handleError(connectionId, 'Failed to hide votes', error)
  }
}

// Initialize the ApiGatewayManagementApiClient
function initializeApiGatewayManagementClient(domainName, stage) {
  return new ApiGatewayManagementApiClient({
    endpoint: `https://${domainName}/${stage}`
  })
}

// Function to check if the requesting user is the admin of the room
async function checkIfAdmin(roomId, connectionId) {
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

// Update the votes_visible attribute in the scrum-poker-rooms table to false
async function updateVotesVisible(roomId) {
  const params = {
    TableName: 'scrum-poker-rooms',
    Key: { room_id: roomId },
    UpdateExpression: 'SET votes_visible = :votesVisible',
    ExpressionAttributeValues: {
      ':votesVisible': false
    }
  }
  await ddb.send(new UpdateCommand(params))
}

// Notify all users in the room to hide votes
async function notifyHideVotes(roomId) {
  const queryParams = {
    TableName: 'scrum-poker',
    KeyConditionExpression: 'room_id = :roomId',
    ExpressionAttributeValues: {
      ':roomId': roomId
    }
  }
  const queryResult = await ddb.send(new QueryCommand(queryParams))

  const message = {
    message: 'HideVotes'
  }

  for (const item of queryResult.Items) {
    await sendToClient(item.connection_id, JSON.stringify(message))
  }
}

// Hide votes and notify users
async function hideVotesAndNotifyUsers(roomId) {
  await updateVotesVisible(roomId)
  await notifyHideVotes(roomId)
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

// Forbidden response
function forbiddenResponse(message) {
  return {
    statusCode: 403,
    body: JSON.stringify({ message })
  }
}
