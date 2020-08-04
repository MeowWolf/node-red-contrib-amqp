import { Red } from 'node-red'
import { NODE_STATUS } from '../constants'
import { ErrorType, NodeType } from '../types'
import Amqp from '../Amqp'

module.exports = function (RED: Red): void {
  function AmqpOut(config): void {
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

          self.on(
            'input',
            async ({ payload, topic, properties }, send, done) => {
              if (topic) {
                amqp.setRoutingKey(topic)
              }

              amqp.publish(JSON.stringify(payload), properties)

              /* istanbul ignore else */
              if (done) {
                done()
              }
            },
          )

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
          self.error(`AmqpOut() Could not connect to broker ${e}`)
        } else {
          self.status(NODE_STATUS.Error)
          self.error(`AmqpOut() ${e}`)
        }
      }
    })(this)
  }
  RED.nodes.registerType(NodeType.AMQP_OUT, AmqpOut)
}
