import { DynamoDBDocumentClient, QueryCommand } from '@aws-sdk/lib-dynamodb'
import { DynamoDBClient } from '@aws-sdk/client-dynamodb'
import {
  ApiGatewayManagementApiClient,
  PostToConnectionCommand,
} from '@aws-sdk/client-apigatewaymanagementapi'

// Initialize DynamoDBDocumentClient
const ddbClient = new DynamoDBClient({})
const ddb = DynamoDBDocumentClient.from(ddbClient)

async function revealPointEstimates(roomId) {
  try {
    const params = {
      TableName: 'scrum-poker',
      KeyConditionExpression: 'room_id = :roomId',
      ExpressionAttributeValues: {
        ':roomId': roomId,
      },
    }
    const result = await ddb.send(new QueryCommand(params))
    return result.Items ? result.Items : []
  } catch (error) {
    console.error('Error revealing point estimates:', error)
    throw new Error('Could not reveal point estimates')
  }
}

let apigwManagementApi
async function sendToClient(connectionId, data) {
  try {
    const params = {
      ConnectionId: connectionId,
      Data: Buffer.from(data),
    }
    await apigwManagementApi.send(new PostToConnectionCommand(params))
  } catch (error) {
    console.error(`Failed to send data to connection ${connectionId}:`, error)
    // Optionally, handle stale connections here by deleting them from DynamoDB
  }
}

export const handler = async (event) => {
  // Initialize ApiGatewayManagementApiClient
  apigwManagementApi = new ApiGatewayManagementApiClient({
    endpoint: `https://${event.requestContext.domainName}/${event.requestContext.stage}`,
  })
  const { roomId } = JSON.parse(event.body)

  try {
    const pointEstimates = await revealPointEstimates(roomId)

    // Iterate over all connections in the room and send the revealed votes
    for (const item of pointEstimates) {
      const data = JSON.stringify({
        message: 'RevealVotes',
        point_estimates: pointEstimates,
      })
      await sendToClient(item.connection_id, data)
    }

    return {
      statusCode: 200,
      body: JSON.stringify({ message: 'Votes revealed successfully' }),
    }
  } catch (error) {
    const errorMessage = {
      message: 'error',
      details: 'Failed to reveal votes',
    }
    await sendToClient(
      event.requestContext.connectionId,
      JSON.stringify(errorMessage),
    )
    console.error('Error during revealVotes:', error)
    return {
      statusCode: 500,
      body: JSON.stringify({ message: 'Failed to reveal votes' }),
    }
  }
}
