import { NodeRedApp, EditorNodeProperties } from 'node-red'
import { NODE_STATUS } from '../constants'
import { ErrorType, NodeType } from '../types'
import Amqp from '../Amqp'

module.exports = function (RED: NodeRedApp): void {
  function AmqpIn(config: EditorNodeProperties): void {
    let reconnectTimeout: NodeJS.Timeout
    RED.events.once('flows:stopped', () => {
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
          await amqp.consume()

          // When the node is re-deployed
          self.once('close', async (done: () => void): Promise<void> => {
            await amqp.close()
            done && done()
          })

          // When the server goes down
          connection.once('close', async e => {
            e && (await reconnect())
          })

          self.status(NODE_STATUS.Connected)
        }
      } catch (e) {
        if (e.code === ErrorType.ConnectionRefused || e.isOperational) {
          await reconnect()
        } else if (e.code === ErrorType.InvalidLogin) {
          self.status(NODE_STATUS.Invalid)
          self.error(`AmqpIn() Could not connect to broker ${e}`)
        } else {
          self.status(NODE_STATUS.Error)
          self.error(`AmqpIn() ${e}`)
        }
      }
    })(this)
  }
  // eslint-disable-next-line @typescript-eslint/ban-ts-comment
  // @ts-ignore
  RED.nodes.registerType(NodeType.AmqpIn, AmqpIn)
}
