import { Red } from 'node-red'
import { NODE_STATUS } from '../constants'
import { ErrorType, NodeType } from '../types'
import Amqp from '../Amqp'

module.exports = function (RED: Red): void {
  function AmqpInManualAck(config): void {
    RED.nodes.createNode(this, config)
    this.status(NODE_STATUS.Disconnected)
    const amqp = new Amqp(RED, this, config)

    // So we can use async/await here
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const iife = (async function (self): Promise<void> {
      try {
        const connection = await amqp.connect()

        // istanbul ignore else
        if (connection) {
          self.status(NODE_STATUS.Connected)

          await amqp.initialize()
          await amqp.consume()

          self.on('input', async (msg, send, done) => {
            amqp.ack(msg)

            /* istanbul ignore else */
            if (done) {
              done()
            }
          })

          self.on(
            'close',
            async (done: () => void): Promise<void> => {
              await amqp.close()
              done()
            },
          )
        }
      } catch (e) {
        if (e.code === ErrorType.INALID_LOGIN) {
          self.status(NODE_STATUS.Invalid)
          self.error(`AmqpInManualAck() Could not connect to broker ${e}`)
        } else {
          self.status(NODE_STATUS.Error)
          self.error(`AmqpInManualAck() ${e}`)
        }
      }
    })(this)
  }
  RED.nodes.registerType(NodeType.AMQP_IN_MANUAL_ACK, AmqpInManualAck)
}
