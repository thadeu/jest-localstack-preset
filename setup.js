const {
  createContainer,
  stopOldContainers,
  waitForReady,
  initializeServices,
  getServices,
  factoryConfig,
} = require('./utils')

// ==========================================
// aws-sdk requires access and secret key
// ==========================================
process.env.AWS_ACCESS_KEY_ID = 'access-key'
process.env.AWS_SECRET_ACCESS_KEY = 'secret-key'
process.env.AWS_REGION = 'us-east-1'
process.env.AWS_ENDPOINT_URL = 'http://localhost:4566'
process.env.AWS_DYNAMODB_ENDPOINT_URL = 'http://localhost:4566'

async function main() {
  const config = await factoryConfig()
  const services = getServices(config)

  await stopOldContainers()
  let { container } = await createContainer(config, services)

  global.__JEST_LOCALSTACK__ = container

  try {
    await container.start()
    await waitForReady(container, config)
    await initializeServices(container, config, services)
  } catch (error) {
    await stopOldContainers().then(() => Promise.reject(error))
  }
}

module.exports = main
