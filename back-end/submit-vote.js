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

async function submitPointEstimate(roomId, connectionId, pointEstimate) {
  try {
    const params = {
      TableName: 'scrum-poker',
      Key: {
        room_id: roomId,
        connection_id: connectionId,
      },
      UpdateExpression: 'SET point_estimate = :pointEstimate',
      ExpressionAttributeValues: {
        ':pointEstimate': pointEstimate,
      },
    }
    await ddb.send(new UpdateCommand(params))
  } catch (error) {
    console.error('Error submitting point estimate:', error)
    throw new Error('Could not submit point estimate')
  }
}

async function notifyUsersOfVote(roomId, votingConnectionId, pointEstimate) {
  try {
    // Query to get all connections in the room
    const queryParams = {
      TableName: 'scrum-poker',
      KeyConditionExpression: 'room_id = :roomId',
      ExpressionAttributeValues: {
        ':roomId': roomId,
      },
    }

    const queryResult = await ddb.send(new QueryCommand(queryParams))

    // Prepare the message to notify other users
    const message = {
      message: 'UserVoted',
      connection_id: votingConnectionId,
      point_estimate: pointEstimate,
    }
    console.log('Items', queryResult.Items)
    // Send the message to each connection in the room, except the one that just voted
    for (const item of queryResult.Items) {
      if (item.connection_id !== votingConnectionId) {
        await sendToClient(item.connection_id, JSON.stringify(message))
      }
    }
  } catch (error) {
    console.error('Error notifying users of vote:', error)
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
  const { roomId, pointEstimate } = JSON.parse(event.body)
  const connectionId = event.requestContext.connectionId

  apigwManagementApi = new ApiGatewayManagementApiClient({
    endpoint: `https://${event.requestContext.domainName}/${event.requestContext.stage}`,
  })

  try {
    // Submit the user's point estimate
    await submitPointEstimate(roomId, connectionId, pointEstimate)

    // Notify other users in the room that a vote has been submitted
    const pointPlaceholder = pointEstimate ? '?' : null
    await notifyUsersOfVote(roomId, connectionId, pointPlaceholder)

    return {
      statusCode: 200,
      body: JSON.stringify({
        message: 'Point estimate submitted successfully',
      }),
    }
  } catch (error) {
    const errorMessage = {
      message: 'error',
      details: 'Failed to submit vote',
    }
    await sendToClient(
      event.requestContext.connectionId,
      JSON.stringify(errorMessage),
    )
    console.error('Error during submitVote:', error)
    return {
      statusCode: 500,
      body: JSON.stringify({ message: 'Failed to submit point estimate' }),
    }
  }
}