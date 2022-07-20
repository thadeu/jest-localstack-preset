const debug = require('debug')('jest-localstack-preset')
const { stopOldContainers } = require('./utils')

module.exports = async function() {
  debug('Teardown')
  await stopOldContainers()
}
