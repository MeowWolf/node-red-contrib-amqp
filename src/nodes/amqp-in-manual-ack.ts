import { NodeRedApp, EditorNodeProperties } from 'node-red'
import { NODE_STATUS } from '../constants'
import { ErrorType, NodeType } from '../types'
import Amqp from '../Amqp'

module.exports = function (RED: NodeRedApp): void {
  function AmqpInManualAck(config: EditorNodeProperties): void {
    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
    // @ts-ignore
    RED.nodes.createNode(this, config)
    this.status(NODE_STATUS.Disconnected)
    const amqp = new Amqp(RED, this, config)

    ;(async function initializeNode(
      self,
      doSetupEventHandlers = false,
    ): Promise<void> {
      const reconnect = (doSetupEventHandlers = true) =>
        new Promise<void>(resolve => {
          console.warn('amqp in manual ack RECONNECT!!!!')
          setTimeout(async () => {
            try {
              await initializeNode(self, doSetupEventHandlers)
              resolve()
            } catch (e) {
              await reconnect(doSetupEventHandlers)
            }
          }, 2000)
        })

      try {
        const connection = await amqp.connect()

        // istanbul ignore else
        if (connection) {
          self.status(NODE_STATUS.Connected)

          await amqp.initialize()
          await amqp.consume()

          // We don't want to duplicate these handlers on reconnect
          if (!doSetupEventHandlers) {
            console.warn('ACK we are setting up event hanlders')
            self.on('input', async (msg, send, done) => {
              amqp.ack(msg)

              /* istanbul ignore else */
              if (done) {
                done()
              }
            })

            // When the server goes down
            self.on(
              'close',
              async (done: () => void): Promise<void> => {
                await amqp.close()
                done()
              },
            )

            // When the server goes down
            connection.on('close', async e => {
              if (e) {
                await reconnect()
              }
            })
          }
        }
      } catch (e) {
        if (e.code === ErrorType.CONNECTION_REFUSED || e.isOperational) {
          await reconnect(false)
        } else if (e.code === ErrorType.INVALID_LOGIN) {
          self.status(NODE_STATUS.Invalid)
          self.error(`AmqpInManualAck() Could not connect to broker ${e}`)
        } else {
          self.status(NODE_STATUS.Error)
          self.error(`AmqpInManualAck() ${e}`)
        }
      }
    })(this)
  }
  // eslint-disable-next-line @typescript-eslint/ban-ts-comment
  // @ts-ignore
  RED.nodes.registerType(NodeType.AMQP_IN_MANUAL_ACK, AmqpInManualAck)
}
