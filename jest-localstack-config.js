module.exports = {
  services: ['dynamodb', 'kinesis', 'lambda', 'apigateway', 'ssm'],
  showLog: process.env.LOCALSTACK_SHOW_LOGS || false,
  dynamoTables: [
    {
      TableName: `users_test`,
      BillingMode: 'PAY_PER_REQUEST',
      KeySchema: [
        { AttributeName: 'pk', KeyType: 'HASH' },
        { AttributeName: 'sk', KeyType: 'RANGE' },
      ],
      AttributeDefinitions: [
        { AttributeName: 'pk', AttributeType: 'S' },
        { AttributeName: 'sk', AttributeType: 'S' },
      ],
    },
  ],
}
