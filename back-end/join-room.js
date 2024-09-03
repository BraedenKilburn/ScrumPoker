import {
  DynamoDBDocumentClient,
  PutCommand,
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

async function broadcastToRoom(roomId, newUser) {
  try {
    // Query to get all connections in the room
    const params = {
      TableName: 'scrum-poker',
      KeyConditionExpression: 'room_id = :roomId',
      ExpressionAttributeValues: {
        ':roomId': roomId,
      },
    }
    const result = await ddb.send(new QueryCommand(params))

    // Prepare the message to notify existing users
    const message = {
      message: 'UserJoined',
      user: newUser,
    }

    // Send the message to each existing connection in the room
    for (const item of result.Items) {
      if (item.connection_id !== newUser.connection_id) {
        await sendToClient(item.connection_id, JSON.stringify(message))
      }
    }

    // Send the list of existing users to the new user
    const existingUsersMessage = {
      message: 'ExistingUsers',
      users: result.Items,
    }
    await sendToClient(
      newUser.connection_id,
      JSON.stringify(existingUsersMessage),
    )
  } catch (error) {
    console.error('Error broadcasting to room:', error)
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
  const { roomId, username } = JSON.parse(event.body) // Accept username from the request body
  const { connectionId } = event.requestContext

  apigwManagementApi = new ApiGatewayManagementApiClient({
    endpoint: `https://${event.requestContext.domainName}/${event.requestContext.stage}`,
  })

  try {
    // Check if the username is already taken in the room
    const queryParams = {
      TableName: 'scrum-poker',
      KeyConditionExpression: 'room_id = :roomId',
      FilterExpression: 'username = :username',
      ExpressionAttributeValues: {
        ':roomId': roomId,
        ':username': username,
      },
    }
    const result = await ddb.send(new QueryCommand(queryParams))

    if (result.Items.length > 0) {
      const errorMessage = {
        message: 'error',
        details: 'Username is already taken in this room',
      }
      await sendToClient(connectionId, JSON.stringify(errorMessage))
      return {
        statusCode: 400,
        body: JSON.stringify({ message: errorMessage.details }),
      }
    }

    // Add user to the room with username
    const putParams = {
      TableName: 'scrum-poker',
      Item: {
        room_id: roomId,
        connection_id: connectionId,
        username: username, // Store the username
        point_estimate: null, // or initial value
      },
    }
    await ddb.send(new PutCommand(putParams))

    // Broadcast the new user to the room and send the list of existing users to the new user
    const newUser = {
      connection_id: connectionId,
      username: username,
      point_estimate: null,
    }
    await broadcastToRoom(roomId, newUser)

    return {
      statusCode: 200,
      body: JSON.stringify({
        message: `Joined room ${roomId} successfully`,
      }),
    }
  } catch (error) {
    const errorMessage = {
      message: 'error',
      details: 'Failed to join room',
    }
    await sendToClient(connectionId, JSON.stringify(errorMessage))
    console.error('Error during joinRoom:', error)
    return {
      statusCode: 500,
      body: JSON.stringify({
        message: 'Failed to join room',
      }),
    }
  }
}
