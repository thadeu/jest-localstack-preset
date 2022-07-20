module.exports = {
  // https://docs.localstack.cloud/aws/feature-coverage/
  services: ['dynamodb', 'kinesis', 's3', 'apigateway', 'lambda'],
  showLog: JSON.parse(process.env.LOCALSTACK_DEBUG || false),
  S3Buckets: [
    {
      Bucket: 'examplebucket',
    },
  ],
  DynamoDB: [
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
