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

// Initialize DynamoDBDocumentClient
const ddbClient = new DynamoDBClient({})
const ddb = DynamoDBDocumentClient.from(ddbClient)

async function clearVotes(roomId) {
  try {
    // Query to get all users in the room
    const queryParams = {
      TableName: 'scrum-poker',
      KeyConditionExpression: 'room_id = :roomId',
      ExpressionAttributeValues: {
        ':roomId': roomId,
      },
    }

    const queryResult = await ddb.send(new QueryCommand(queryParams))

    // Clear the votes for each user in the room
    for (const item of queryResult.Items) {
      const updateParams = {
        TableName: 'scrum-poker',
        Key: {
          room_id: item.room_id,
          connection_id: item.connection_id,
        },
        UpdateExpression: 'SET point_estimate = :newValue',
        ExpressionAttributeValues: {
          ':newValue': null, // or an empty string if you prefer
        },
      }
      await ddb.send(new UpdateCommand(updateParams))
    }

    // Notify all users in the room that votes have been cleared
    await notifyUsersOfClearVotes(roomId, queryResult.Items)
  } catch (error) {
    console.error('Error clearing votes:', error)
    throw new Error('Could not clear votes')
  }
}

async function notifyUsersOfClearVotes(roomId, users) {
  try {
    const message = {
      message: 'VotesCleared',
    }

    // Send the message to each connection in the room
    for (const user of users) {
      await sendToClient(user.connection_id, JSON.stringify(message))
    }
  } catch (error) {
    console.error('Error notifying users of cleared votes:', error)
  }
}

// Initialize ApiGatewayManagementApiClient
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
  const { roomId } = JSON.parse(event.body)
  const { connectionId, domainName, stage } = event.requestContext

  apigwManagementApi = new ApiGatewayManagementApiClient({
    endpoint: `https://${domainName}/${stage}`,
  })

  try {
    await clearVotes(roomId)
    return {
      statusCode: 200,
      body: JSON.stringify({
        message: `Votes cleared successfully for room ${roomId}`,
      }),
    }
  } catch (error) {
    const errorMessage = {
      message: 'error',
      details: 'Failed to clear votes',
    }
    await sendToClient(connectionId, JSON.stringify(errorMessage))
    console.error('Error during clearVotes:', error)
    return {
      statusCode: 500,
      body: JSON.stringify({ message: 'Failed to clear votes' }),
    }
  }
}
