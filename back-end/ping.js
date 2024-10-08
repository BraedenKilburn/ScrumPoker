import {
  ApiGatewayManagementApiClient,
  PostToConnectionCommand,
} from '@aws-sdk/client-apigatewaymanagementapi';

// Initialize ApiGatewayManagementApiClient
let apigwManagementApi;

export const handler = async (event) => {
  const { connectionId, domainName, stage } = event.requestContext;

  apigwManagementApi = new ApiGatewayManagementApiClient({
    endpoint: `https://${domainName}/${stage}`,
  });

  try {
    // Respond with a 'pong' message to acknowledge the 'ping'
    await sendToClient(connectionId, JSON.stringify({ message: 'pong' }));

    return {
      statusCode: 200,
      body: JSON.stringify({ message: 'Ping handled successfully' }),
    };
  } catch (error) {
    console.error('Error handling ping:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({ message: 'Failed to handle ping' }),
    };
  }
};

// Send data to a specific client via WebSocket
async function sendToClient(connectionId, data) {
  const params = {
    ConnectionId: connectionId,
    Data: Buffer.from(data),
  };
  try {
    await apigwManagementApi.send(new PostToConnectionCommand(params));
  } catch (error) {
    console.error('Error sending message to client:', error);
  }
}
