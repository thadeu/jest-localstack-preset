const debug = require('debug')('jest-localstack-preset')
const Docker = require('dockerode')

const path = require('path')
const cwd = require('cwd')
const readline = require('readline')

const DynamoDB = require('aws-sdk/clients/dynamodb')
const Kinesis = require('aws-sdk/clients/kinesis')

const LABEL_NAME = 'purpose'
const LABEL_VALUE = 'jest-localstack-preset'

const DEFAULT_SERVICES = {
  kinesis: 4566,
  dynamodb: 4566,
}

const DEFAULT_PORT = 4566

const CONFIG_DEFAULTS = {
  image: 'localstack/localstack',
  readyTimeout: 120000,
  showLog: false,
}

const isJestRuning = process.env.JEST_WORKER_ID

async function getContainers() {
  let docker = new Docker()

  let listContainerOpts = {
    all: true,
    filters: `{"label": ["${LABEL_NAME}=${LABEL_VALUE}"]}`,
  }

  const containers = await docker.listContainers(listContainerOpts)
  return containers
}

async function stopOldContainers() {
  let docker = new Docker()

  const containers = await getContainers(docker)

  for (let target of containers) {
    if (target) {
      const deadContainer = docker.getContainer(target.Id)

      if (deadContainer) {
        try {
          debug(`\nKill container ${deadContainer.id}`)
          await deadContainer.kill()
          await deadContainer.remove({ force: true })
        } catch (error) {
          await deadContainer.remove({ force: true })
        }
      }
    }
  }
}

async function createContainer(config, services) {
  let docker = new Docker()

  let container = await docker.createContainer({
    Image: config.image,
    AttachStdin: false,
    AttachStdout: true,
    AttachStderr: true,
    Tty: true,
    OpenStdin: false,
    StdinOnce: false,
    Env: buildEnv(config),
    Labels: {
      [LABEL_NAME]: LABEL_VALUE,
    },
    ...buildExposedPortsAndHostConfig(services),
  })

  return { docker, container }
}

function buildExposedPortsAndHostConfig(services) {
  const serviceNames = Object.keys(services)

  return serviceNames.reduce(
    (config, serviceName) => {
      const port = services[serviceName] || DEFAULT_PORT
      const key = `${port}/tcp`

      config.ExposedPorts[key] = {}
      config.HostConfig.PortBindings[key] = [{ HostPort: String(port) }]

      return config
    },
    {
      ExposedPorts: {},
      HostConfig: {
        PortBindings: {},
      },
    },
  )
}

async function factoryConfig() {
  const pathConfig = path.resolve(cwd(), 'jest-localstack-config.js')

  const config = require(pathConfig)

  return { ...CONFIG_DEFAULTS, ...(typeof config === 'function' ? await config() : config) }
}

function buildEnv(config) {
  const env = ['FORCE_NONINTERACTIVE=true']

  if (config.services) {
    env.push(`SERVICES=${Array.isArray(config.services) ? config.services.join(',') : config.services}`)
  }

  return env
}

async function waitForReady(container, config) {
  return container
    .logs({
      follow: true,
      stdout: true,
      stderr: true,
    })
    .then(stream => {
      const readInterface = readline.createInterface({
        input: stream,
        output: config.showLog ? process.stdout : undefined,
        console: false,
      })

      return new Promise((resolve, reject) => {
        const timer = setTimeout(() => {
          stream.destroy()
          reject('Error: timeout before LocalStack was ready.')
        }, config.readyTimeout)

        debug('\nWaiting for LocalStack to be ready...')

        readInterface.on('line', function(line) {
          if (line.match(/Ready/)) {
            debug("It's Ready!")

            clearTimeout(timer)
            resolve(container)
          }
        })
      })
    })
}

function getServices(config) {
  let { services } = config

  if (typeof services === 'string') {
    services = services.split(',')
  } else if (!services) {
    return DEFAULT_SERVICES
  }

  return services.reduce((hash, service) => {
    var nameAndPort = service.trim().split(':')
    hash[nameAndPort[0]] = nameAndPort.length > 1 ? nameAndPort[1] || DEFAULT_PORT : DEFAULT_SERVICES[service]

    return hash
  }, {})
}

async function initializeServices(container, config, services) {
  debug('Checking Services...')

  await Promise.all([createDynamoTables(config, services), createKinesisStreams(config, services)])
  debug('All Services Running!')

  return container
}

async function createDynamoTables(config, services) {
  if (Array.isArray(config.dynamoTables) && services.dynamodb) {
    const dynamoDB = new DynamoDB({
      endpoint: `http://localhost:${services.dynamodb || DEFAULT_PORT}`,
      sslEnabled: false,
      region: 'us-east-1',
    })

    debug('CreateDynamoTables initializing')
    await Promise.all(config.dynamoTables.map(dynamoTable => dynamoDB.createTable(dynamoTable).promise()))
    debug('createDynamoTables finished')

    return
  }

  return Promise.resolve()
}

async function createKinesisStreams(config, services) {
  if (Array.isArray(config.kinesisStreams) && services.kinesis) {
    const kinesis = new Kinesis({
      endpoint: `localhost:${services.kinesis}`,
      sslEnabled: false,
      region: 'local-env',
    })

    return Promise.all(config.kinesisStreams.map(kinesisStream => kinesis.createStream(kinesisStream).promise()))
  }

  return Promise.resolve()
}

module.exports.isJestRuning = isJestRuning
module.exports.factoryConfig = factoryConfig
module.exports.getServices = getServices
module.exports.waitForReady = waitForReady
module.exports.initializeServices = initializeServices
module.exports.createContainer = createContainer
module.exports.getContainers = getContainers
module.exports.stopOldContainers = stopOldContainers
