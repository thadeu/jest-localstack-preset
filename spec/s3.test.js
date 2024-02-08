const { S3Client, ListBucketsCommand} = require("@aws-sdk/client-s3");

const { localstackConfig } = require('../aws')

const client = new S3Client(localstackConfig);

it('must be create a bucket', async () => {
  const command = new ListBucketsCommand({});

  const { Buckets } =  await client.send(command);

  // console.log("TEST", Buckets)
  expect(Buckets[0].Name).toBe('examplebucket')
})
