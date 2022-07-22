const localstackConfig = {
  accessKeyId: 'access-key',
  secretAccessKey: 'secret-key',
  region: 'us-east-1',
  endpoint: 'http://localhost:4566',
  s3ForcePathStyle: true,
}

const configureMockSDK = sdk => {
  sdk.config.update(localstackConfig)
}

module.exports = {
  configureMockSDK,
  localstackConfig,
}
