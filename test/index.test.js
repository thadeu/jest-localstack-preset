const AWS = require('aws-sdk')

const ddb = new AWS.DynamoDB.DocumentClient({
  endpoint: process.env.AWS_DYNAMODB_ENDPOINT_URL,
})

it('should insert item into table', async () => {
  await ddb.put({ TableName: 'users_test', Item: { pk: '1', sk: 'jest-localstack-preset' } }).promise()

  const { Count } = await ddb.scan({ TableName: 'users_test' }).promise()
  expect(Count).toBe(1)
})
