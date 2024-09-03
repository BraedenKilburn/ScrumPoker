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

async function leaveRoom(roomId, connectionId) {
  try {
    // Delete the user from the room
    const params = {
      TableName: 'scrum-poker',
      Key: {
        room_id: roomId,
        connection_id: connectionId,
      },
    }
    await ddb.send(new DeleteCommand(params))
  } catch (error) {
    console.error('Error leaving room:', error)
    throw new Error('Could not leave room')
  }
}

async function notifyUsersOfDeparture(roomId, departedConnectionId) {
  try {
    // Query to get all remaining connections in the room
    const queryParams = {
      TableName: 'scrum-poker',
      KeyConditionExpression: 'room_id = :roomId',
      ExpressionAttributeValues: {
        ':roomId': roomId,
      },
    }
    const result = await ddb.send(new QueryCommand(queryParams))

    // Prepare the message to notify remaining users
    const message = {
      message: 'UserLeft',
      connection_id: departedConnectionId,
    }

    // Send the message to each remaining connection in the room
    for (const item of result.Items) {
      await sendToClient(item.connection_id, JSON.stringify(message))
    }
  } catch (error) {
    console.error('Error notifying users of departure:', error)
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
  const connectionId = event.requestContext.connectionId

  apigwManagementApi = new ApiGatewayManagementApiClient({
    endpoint: `https://${event.requestContext.domainName}/${event.requestContext.stage}`,
  })

  try {
    // Remove the user from the room
    await leaveRoom(roomId, connectionId)

    // Notify other users that the user has left
    await notifyUsersOfDeparture(roomId, connectionId)

    return {
      statusCode: 200,
      body: JSON.stringify({ message: 'User left the room successfully' }),
    }
  } catch (error) {
    const errorMessage = {
      message: 'error',
      details: 'Failed to leave room',
    }
    await sendToClient(
      event.requestContext.connectionId,
      JSON.stringify(errorMessage),
    )
    console.error('Error during leaveRoom:', error)
    return {
      statusCode: 500,
      body: JSON.stringify({ message: 'Failed to leave room' }),
    }
  }
}
