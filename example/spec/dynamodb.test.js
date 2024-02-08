const { DynamoDBClient } = require("@aws-sdk/client-dynamodb");
const { PutCommand, ScanCommand, DynamoDBDocumentClient } = require("@aws-sdk/lib-dynamodb");

const client = new DynamoDBClient({
  endpoint: process.env.AWS_DYNAMODB_ENDPOINT_URL,
});
const docClient = DynamoDBDocumentClient.from(client);

it('should insert item into table', async () => {
  const putCmd = new PutCommand({ TableName: 'users_test', Item: { pk: '1', sk: 'jest-localstack-preset' } });
  await docClient.send(putCmd);

  const scanCmd = new ScanCommand({ TableName: 'users_test' });
  const { Count } = 
  await docClient.send(scanCmd);

  expect(Count).toBe(1)
})