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

async function removeConnectionId(connectionId) {
  try {
    // Remove the connection ID from the connections table
    const params = {
      TableName: 'scrum-poker-connections',
      Key: {
        connection_id: connectionId,
      },
    }
    await ddb.send(new DeleteCommand(params))
  } catch (error) {
    console.error('Error removing connection ID:', error)
  }
}

async function removeUserFromRooms(connectionId) {
  try {
    // Query the rooms table to find all rooms where the user is present
    const queryParams = {
      TableName: 'scrum-poker',
      IndexName: 'connection_id-index', // Assuming you have a secondary index on connection_id
      KeyConditionExpression: 'connection_id = :connectionId',
      ExpressionAttributeValues: {
        ':connectionId': connectionId,
      },
    }

    const queryResult = await ddb.send(new QueryCommand(queryParams))

    // Remove the user from each room they are part of and notify others
    for (const item of queryResult.Items) {
      const deleteParams = {
        TableName: 'scrum-poker',
        Key: {
          room_id: item.room_id,
          connection_id: connectionId,
        },
      }
      await ddb.send(new DeleteCommand(deleteParams))

      // Notify other users in the room
      await notifyUsersOfDeparture(item.room_id, connectionId)
    }
  } catch (error) {
    console.error('Error removing user from rooms:', error)
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
  const connectionId = event.requestContext.connectionId
  apigwManagementApi = new ApiGatewayManagementApiClient({
    endpoint: `https://${event.requestContext.domainName}/${event.requestContext.stage}`,
  })

  try {
    // Remove connection ID from the connections table
    await removeConnectionId(connectionId)

    // Remove user from all rooms they were part of and notify others
    await removeUserFromRooms(connectionId)

    return {
      statusCode: 200,
      body: JSON.stringify({
        message: 'Disconnected successfully',
      }),
    }
  } catch (error) {
    console.error('Error during $disconnect:', error)
    return {
      statusCode: 500,
      body: JSON.stringify({
        message: 'Failed to disconnect',
      }),
    }
  }
}
