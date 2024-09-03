import { DynamoDBDocumentClient, QueryCommand } from '@aws-sdk/lib-dynamodb'
import { DynamoDBClient } from '@aws-sdk/client-dynamodb'
import {
  ApiGatewayManagementApiClient,
  PostToConnectionCommand,
} from '@aws-sdk/client-apigatewaymanagementapi'

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
  }
}

async function notifyHideVotes(roomId) {
  try {
    const queryParams = {
      TableName: 'scrum-poker',
      KeyConditionExpression: 'room_id = :roomId',
      ExpressionAttributeValues: {
        ':roomId': roomId,
      },
    }

    const queryResult = await ddb.send(new QueryCommand(queryParams))

    const message = {
      message: 'HideVotes',
    }

    for (const item of queryResult.Items) {
      await sendToClient(item.connection_id, JSON.stringify(message))
    }
  } catch (error) {
    console.error('Error notifying users to hide votes:', error)
  }
}

export const handler = async (event) => {
  const { roomId } = JSON.parse(event.body)

  apigwManagementApi = new ApiGatewayManagementApiClient({
    endpoint: `https://${event.requestContext.domainName}/${event.requestContext.stage}`,
  })

  try {
    await notifyHideVotes(roomId)

    return {
      statusCode: 200,
      body: JSON.stringify({ message: 'Votes hidden successfully' }),
    }
  } catch (error) {
    const errorMessage = {
      message: 'error',
      details: 'Failed to hide votes',
    }
    await sendToClient(
      event.requestContext.connectionId,
      JSON.stringify(errorMessage),
    )
    console.error('Error during hideVotes:', error)
    return {
      statusCode: 500,
      body: JSON.stringify({ message: 'Failed to hide votes' }),
    }
  }
}
