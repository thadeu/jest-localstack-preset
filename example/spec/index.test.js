const AWS = require('aws-sdk')

const s3 = new AWS.S3()

it('must be create a bucket', async () => {
  await s3.createBucket({ Bucket: 'examplebucket-1' }).promise()

  const { Buckets } = await s3.listBuckets().promise()

  expect(Buckets.length).toBe(1)
  expect(Buckets[0].Name).toBe('examplebucket-1')
})
