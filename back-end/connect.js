import { DynamoDBDocumentClient, PutCommand } from '@aws-sdk/lib-dynamodb'
import { DynamoDBClient } from '@aws-sdk/client-dynamodb'
import {
  ApiGatewayManagementApiClient,
  PostToConnectionCommand,
} from '@aws-sdk/client-apigatewaymanagementapi'

// Initialize DynamoDBDocumentClient
const ddbClient = new DynamoDBClient({})
const ddb = DynamoDBDocumentClient.from(ddbClient)

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
  const connectionId = event.requestContext.connectionId

  apigwManagementApi = new ApiGatewayManagementApiClient({
    endpoint: `https://${event.requestContext.domainName}/${event.requestContext.stage}`,
  })

  try {
    // Store the connection ID
    const params = {
      TableName: 'scrum-poker-connections',
      Item: {
        connection_id: connectionId,
        connectedAt: new Date().toISOString(),
      },
    }
    await ddb.send(new PutCommand(params))

    // Prepare the response message
    const response = {
      message: 'Connected successfully',
      connectionId: connectionId,
    }
    await sendToClient(connectionId, JSON.stringify(response))

    return {
      statusCode: 200,
      body: JSON.stringify({ message: 'Connection ID sent successfully' }),
    }
  } catch (error) {
    const errorMessage = {
      message: 'error',
      details: 'Error conencting to backend websocket',
    }
    await sendToClient(connectionId, JSON.stringify(errorMessage))
    console.error('Error during $connect:', error)
    return {
      statusCode: 500,
      body: JSON.stringify({ message: 'Failed to connect' }),
    }
  }
}
