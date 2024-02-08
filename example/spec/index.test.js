const { S3Client, ListBucketsCommand, CreateBucketCommand} = require("@aws-sdk/client-s3");

const { localstackConfig } = require('../aws')

const client = new S3Client(localstackConfig);

it('must be create a bucket', async () => {
  const createBucketCmd = new CreateBucketCommand({ Bucket: 'examplebucket-1' });
  
  try {
    const { Location } = await client.send(createBucketCmd);
    console.log(`Bucket created with location ${Location}`);
  } catch (err) {
    console.error(err);
  }

  const listBucketCmd = new ListBucketsCommand({});

  const { Buckets } =  await client.send(listBucketCmd);

  expect(Buckets[0].Name).toBe('examplebucket-1')
})
