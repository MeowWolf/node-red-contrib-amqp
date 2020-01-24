import { Red } from 'node-red'
import { NODE_STATUS } from '../constants'
import { ErrorType, NodeType } from '../types'
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

        await amqp.initialize()
        await amqp.consume()

        // istanbul ignore else
        if (connection) {
          self.status(NODE_STATUS.Connected)

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
  RED.nodes.registerType(NodeType.AMQP_IN, AmqpIn)
}
