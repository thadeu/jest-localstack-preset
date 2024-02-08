const localstackConfig = {
  credentials: {
    accessKeyId: 'access-key',
    secretAccessKey: 'secret-key',
  },
  region: 'us-east-1',
  endpoint: 'http://s3.localhost.localstack.cloud:4566',
  forcePathStyle: true,
}

module.exports = { localstackConfig }
