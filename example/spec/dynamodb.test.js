const AWS = require('aws-sdk')

const Table = new AWS.DynamoDB.DocumentClient()

it('should insert item into table', async () => {
  await Table.put({ TableName: 'users_test', Item: { pk: '1', sk: 'jest-localstack-preset' } }).promise()

  const { Count } = await Table.scan({ TableName: 'users_test' }).promise()
  expect(Count).toBe(1)
})
