const { stopOldContainers, spinner } = require('./utils')

module.exports = async function() {
  await stopOldContainers()

  spinner.stopAndPersist({ symbol: '✨', text: ' Done teardown' })
}
