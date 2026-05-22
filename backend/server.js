const { createApp } = require('./src/app')
const { env } = require('./src/config/env')
const {
  startNotificationCleanupJob,
} = require('./src/services/notification.service')

const app = createApp()

app.listen(env.PORT, () => {
  startNotificationCleanupJob()
  console.log(`WikiCodex backend listening on http://localhost:${env.PORT}`)
})
