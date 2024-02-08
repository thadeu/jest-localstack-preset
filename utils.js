const LABEL_NAME = 'purpose'
const LABEL_VALUE = 'jest_localstack'

const Docker = require('dockerode')

const path = require('path')
const cwd = require('cwd')
const readline = require('readline')

const { DynamoDBClient, CreateTableCommand } = require("@aws-sdk/client-dynamodb");
const { KinesisClient, CreateStreamCommand } = require("@aws-sdk/client-kinesis");
const { S3Client, CreateBucketCommand} = require("@aws-sdk/client-s3");

const ora = require('ora')
const spinner = ora()

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
  autoPullImage: true,
}

const isJestRuning = process.env.JEST_WORKER_ID

const region = process.env.REGION

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
          // spinner.stop(`Stop container ${deadContainer.id}`)
          await deadContainer.kill()
          await deadContainer.remove({ force: true })
        } catch (error) {
          await deadContainer.remove({ force: true })
        }
      }
    }
  }

  spinner.stop()
}

async function dockerPullLocalStack(repoTag) {
  let docker = new Docker()

  return new Promise((resolve, reject) => {
    docker.pull(repoTag, (err, output) => {
      if (err) {
        console.error(err)
        reject(err)
      }

      if (output) {
        output.pipe(process.stdout, { end: true })
        output.on('end', resolve)
      }
    })
  })
}

async function isDockerLocalStackBlank() {
  let docker = new Docker()
  const allImages = await docker.listImages()
  const images = allImages.filter(i => i.RepoTags && i.RepoTags.some(r => r.includes('localstack/localstack')))

  return !images || images.length <= 0
}

async function createContainer(config, services) {
  let docker = new Docker()

  let autoPullImage = JSON.parse(process.env.JEST_LOCALSTACK_AUTO_PULLING || config.autoPullImage)

  if ((await isDockerLocalStackBlank()) && autoPullImage) {
    spinner.warn(`You need to build an image to ${config.image}\n`)

    await dockerPullLocalStack(config.image)
    spinner.start(`Image ${config.image} complete downloaded...`)

    spinner.start(`Creating container...`)
  }

  let container = await docker.createContainer({
    name: 'jest_localstack_main',
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
  const pathConfig = path.resolve(cwd(), 'jest.localstack.js')

  try {
    spinner.start('Building config')

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
        output: undefined,
        console: false,
      })

      return new Promise((resolve, reject) => {
        const timer = setTimeout(() => {
          stream.destroy()
          reject('Error: timeout before localstack was ready.')
        }, config.readyTimeout)

        spinner.start('Waiting for localstack to be ready...')

        readInterface.on('line', function(line) {
          if (config.showLog) {
            spinner.stop()
            console.log(line)
          }

          if (line.match(/Ready/)) {
            spinner.succeed('Environment is Ready!')

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
  spinner.start(`Checking Services...`)

  await Promise.all([
    createDynamoTables(config, services),
    createKinesisStreams(config, services),
    createS3Buckets(config, services),
  ])

  spinner.succeed('Services is running!\n')

  return container
}

async function createDynamoTables(config, services) {
  if (Array.isArray(config.DynamoDB) && services.dynamodb) {
    const client = new DynamoDBClient({
      endpoint: `http://localhost:${services.dynamodb || DEFAULT_PORT}`,
      sslEnabled: false,
      region: region,
    })

    const promises = config.DynamoDB.map(async dynamoTable => {
      const command = new CreateTableCommand(dynamoTable)
      return client.send(command);
    })

    const result = await Promise.all(promises)

    spinner.start('createDynamoTables OK')

    return result
  }

  return Promise.resolve()
}

async function createKinesisStreams(config, services) {
  if (Array.isArray(config.Kinesis) && services.kinesis) {
    const client = new KinesisClient({
      endpoint: `http://localhost:${services.kinesis}`,
      region: region,
    })

    const promises = config.Kinesis.map(kinesisStream => {
      const command = CreateStreamCommand(kinesisStream)
      return client.send(command);
    })

    const result = await Promise.all(promises)

    spinner.start('createKinesisStreams OK')

    return result
  }

  return Promise.resolve()
}

async function createS3Buckets(config, services) {
  if (Array.isArray(config.S3Buckets) && services.s3) {
    const client = new S3Client({
      endpoint: `http://s3.localhost.localstack.cloud:${services.s3}`,
      forcePathStyle: true,
    })

    const promises = config.S3Buckets.map(async s3Bucket => {
      const command = new CreateBucketCommand(s3Bucket);
      try {
        const { Location } = await client.send(command);
        console.log(`Bucket created with location ${Location}`);
      } catch (err) {
        console.error(err);
      }
    })

    const result = await Promise.all(promises)

    spinner.start('createS3Buckets OK')

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
module.exports.spinner = spinner
