import {
  ApiGatewayManagementApiClient,
  PostToConnectionCommand,
} from '@aws-sdk/client-apigatewaymanagementapi'

// Initialize the API Gateway Management API client
let apigwManagementApi
async function sendToClient(connectionId, message) {
  try {
    const params = {
      ConnectionId: connectionId,
      Data: Buffer.from(message),
    }
    await apigwManagementApi.send(new PostToConnectionCommand(params))
  } catch (error) {
    console.error('Error sending message to client:', error)
    if (error.statusCode === 410) {
      console.log(`Found stale connection, deleting ${connectionId}`)
      // Handle stale connection if necessary
    }
  }
}

export const handler = async (event) => {
  const connectionId = event.requestContext.connectionId

  console.log('Received message from connection:', connectionId)
  console.log('Message body:', event.body)

  const message = `Unrecognized action: ${event.body}`

  const REGION = 'us-east-1'
  apigwManagementApi = new ApiGatewayManagementApiClient({
    region: REGION,
    endpoint: `https://${event.requestContext.domainName}/${event.requestContext.stage}`,
  })

  try {
    // Send an error message back to the client
    await sendToClient(connectionId, message)

    return {
      statusCode: 200,
    }
  } catch (error) {
    console.error('Error handling $default route:', error)
    return {
      statusCode: 500,
      body: JSON.stringify({ message: 'Failed to process request' }),
    }
  }
}
