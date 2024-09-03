import {
  DynamoDBDocumentClient,
  QueryCommand,
  UpdateCommand,
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
  const { domainName, stage, connectionId } = event.requestContext

  apigwManagementApi = initializeApiGatewayManagementClient(domainName, stage)

  try {
    await revealVotesAndNotifyUsers(roomId)
    return successResponse('Votes revealed successfully')
  } catch (error) {
    return handleError(connectionId, 'Failed to reveal votes', error)
  }
}

// Initialize the ApiGatewayManagementApiClient
function initializeApiGatewayManagementClient(domainName, stage) {
  return new ApiGatewayManagementApiClient({
    endpoint: `https://${domainName}/${stage}`,
  })
}

// Update the votes_visible attribute in the scrum-poker-rooms table
async function updateVotesVisible(roomId) {
  const params = {
    TableName: 'scrum-poker-rooms',
    Key: { room_id: roomId },
    UpdateExpression: 'SET votes_visible = :votesVisible',
    ExpressionAttributeValues: {
      ':votesVisible': true,
    },
  }
  await ddb.send(new UpdateCommand(params))
}

// Reveal the point estimates for the room
async function revealPointEstimates(roomId) {
  const params = {
    TableName: 'scrum-poker',
    KeyConditionExpression: 'room_id = :roomId',
    ExpressionAttributeValues: {
      ':roomId': roomId,
    },
  }
  const result = await ddb.send(new QueryCommand(params))
  return result.Items || []
}

// Notify all users in the room with the revealed votes
async function notifyUsersOfRevealedVotes(roomId, pointEstimates) {
  for (const item of pointEstimates) {
    const data = JSON.stringify({
      message: 'RevealVotes',
      point_estimates: pointEstimates,
    })
    await sendToClient(item.connection_id, data)
  }
}

// Reveal votes and notify users
async function revealVotesAndNotifyUsers(roomId) {
  await updateVotesVisible(roomId)
  const pointEstimates = await revealPointEstimates(roomId)
  await notifyUsersOfRevealedVotes(roomId, pointEstimates)
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
