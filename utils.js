const debug = require('debug')('jest-localstack-preset')
const Docker = require('dockerode')

const path = require('path')
const cwd = require('cwd')
const readline = require('readline')

const DynamoDB = require('aws-sdk/clients/dynamodb')
const Kinesis = require('aws-sdk/clients/kinesis')
const S3 = require('aws-sdk/clients/s3')

const LABEL_NAME = 'purpose'
const LABEL_VALUE = 'jest-localstack-preset'

const DEFAULT_SERVICES = {
  kinesis: 4566,
  dynamodb: 4566,
  s3: 4566,
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
    name: 'jest-localstack-preset_main',
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

  try {
    const config = require(pathConfig)
    let result = { ...CONFIG_DEFAULTS, ...(typeof config === 'function' ? await config() : config) }

    return result
  } catch (error) {
    return {
      ...CONFIG_DEFAULTS,
      services: Object.entries(DEFAULT_SERVICES).map(o => o.join(':')),
    }
  }
}

function buildEnv(config) {
  const env = ['FORCE_NONINTERACTIVE=true']

  if (config.services) {
    env.push(`SERVICES=${Array.isArray(config.services) ? config.services.join(',') : config.services}`)
    env.push(`DYNAMODB_OPTIMIZE_DB_BEFORE_STARTUP=1`)
    env.push(`EAGER_SERVICE_LOADING=1`)
    env.push(`TRANSPARENT_LOCAL_ENDPOINTS=1`)
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
  const defaultServices = Object.entries(DEFAULT_SERVICES).map(o => o.join(':'))
  let { services } = { services: defaultServices, ...config }

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
  debug(`Checking Services...`)

  await Promise.all([
    createDynamoTables(config, services),
    createKinesisStreams(config, services),
    createS3Buckets(config, services),
  ])

  debug('All Services Running!')

  return container
}

async function createDynamoTables(config, services) {
  if (Array.isArray(config.DynamoDB) && services.dynamodb) {
    const dynamoDB = new DynamoDB({
      endpoint: `http://localhost:${services.dynamodb || DEFAULT_PORT}`,
      sslEnabled: false,
      region: 'us-east-1',
    })

    const result = await Promise.all(config.DynamoDB.map(dynamoTable => dynamoDB.createTable(dynamoTable).promise()))
    debug('createDynamoTables OK')

    return result
  }

  return Promise.resolve()
}

async function createKinesisStreams(config, services) {
  if (Array.isArray(config.Kinesis) && services.kinesis) {
    const kinesis = new Kinesis({
      endpoint: `http://localhost:${services.kinesis}`,
      region: 'us-east-1',
    })

    const promises = config.Kinesis.map(kinesisStream => {
      return kinesis.createStream(kinesisStream).promise()
    })

    const result = await Promise.all(promises)

    debug('createKinesisStreams OK')

    return result
  }

  return Promise.resolve()
}

async function createS3Buckets(config, services) {
  if (Array.isArray(config.S3Buckets) && services.s3) {
    const s3 = new S3({
      endpoint: `http://localhost:${services.s3}`,
      s3ForcePathStyle: true,
    })

    const result = await Promise.all(config.S3Buckets.map(s3Bucket => s3.createBucket(s3Bucket).promise()))
    debug('createS3Buckets OK')

    return result
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
