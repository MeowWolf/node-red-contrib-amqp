import { NodeRedApp, EditorNodeProperties } from 'node-red'
import { NODE_STATUS } from '../constants'
import { ErrorType, NodeType } from '../types'
import Amqp from '../Amqp'

module.exports = function (RED: NodeRedApp): void {
  function AmqpOut(config: EditorNodeProperties): void {
    let reconnectTimeout: NodeJS.Timeout
    RED.events.once('nodes-stopped', () => {
      clearTimeout(reconnectTimeout)
    })

    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
    // @ts-ignore
    RED.nodes.createNode(this, config)
    this.status(NODE_STATUS.Disconnected)
    const amqp = new Amqp(RED, this, config)

    ;(async function initializeNode(self): Promise<void> {
      const reconnect = () =>
        new Promise<void>(resolve => {
          reconnectTimeout = setTimeout(async () => {
            try {
              await initializeNode(self)
              resolve()
            } catch (e) {
              await reconnect()
            }
          }, 2000)
        })

      try {
        const connection = await amqp.connect()

        // istanbul ignore else
        if (connection) {
          await amqp.initialize()

          self.on(
            'input',
            async ({ payload, routingKey, properties }, send, done) => {
              if (routingKey) {
                amqp.setRoutingKey(routingKey)
              }
              amqp.publish(JSON.stringify(payload), properties)

              done && done()
            },
          )

          // When the node is re-deployed
          self.once(
            'close',
            async (done: () => void): Promise<void> => {
              await amqp.close()
              done && done()
            },
          )

          // When the server goes down
          connection.once('close', async e => {
            e && (await reconnect())
          })

          self.status(NODE_STATUS.Connected)
        }
      } catch (e) {
        if (e.code === ErrorType.CONNECTION_REFUSED || e.isOperational) {
          await reconnect()
        } else if (e.code === ErrorType.INVALID_LOGIN) {
          self.status(NODE_STATUS.Invalid)
          self.error(`AmqpOut() Could not connect to broker ${e}`)
        } else {
          self.status(NODE_STATUS.Error)
          self.error(`AmqpOut() ${e}`)
        }
      }
    })(this)
  }
  // eslint-disable-next-line @typescript-eslint/ban-ts-comment
  // @ts-ignore
  RED.nodes.registerType(NodeType.AMQP_OUT, AmqpOut)
}
