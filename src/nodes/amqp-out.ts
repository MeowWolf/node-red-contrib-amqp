import { Red } from 'node-red'
import { NODE_STATUS } from '../constants'
import { ErrorType } from '../types'
import Amqp from '../Amqp'

module.exports = function(RED: Red): void {
  function AmqpIn(config): void {
    RED.nodes.createNode(this, config)
    this.status(NODE_STATUS.Disconnected)
    const amqp = new Amqp(RED, this, config)

    // So we can use async/await here
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const iife = (async function(self): Promise<void> {
      try {
        const connection = await amqp.connect()

        // istanbul ignore else
        if (connection) {
          self.status(NODE_STATUS.Connected)

          await amqp.initialize()

          self.on('input', async ({ payload }, send, done) => {
            amqp.publish(JSON.stringify(payload))

            /* istanbul ignore else */
            if (done) {
              done()
            }
          })

          self.on(
            'close',
            async (done: Function): Promise<void> => {
              await amqp.close()
              done()
            },
          )
        }
      } catch (e) {
        if (e.code === ErrorType.INALID_LOGIN) {
          self.status(NODE_STATUS.Invalid)
          self.error(`AmqpIn() Could not connect to broker ${e}`)
        } else {
          self.status(NODE_STATUS.Error)
          self.error(`AmqpIn() ${e}`)
        }
      }
    })(this)
  }
  RED.nodes.registerType('amqp-out', AmqpIn)
}
