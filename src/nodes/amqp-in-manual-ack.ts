import { Red, NodeProperties } from 'node-red'
import { NODE_STATUS } from '../constants'
import { ErrorType, NodeType } from '../types'
import Amqp from '../Amqp'

module.exports = function (RED: Red): void {
  function AmqpInManualAck(config: NodeProperties): void {
    RED.nodes.createNode(this, config)
    this.status(NODE_STATUS.Disconnected)
    const amqp = new Amqp(RED, this, config)

    // So we can use async/await here
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const iife = (async function initializeNode(
      self,
      isReconnect = false,
    ): Promise<void> {
      try {
        const connection = await amqp.connect()

        // istanbul ignore else
        if (connection) {
          self.status(NODE_STATUS.Connected)

          await amqp.initialize()
          await amqp.consume()

          // We don't want to duplicate these handlers on reconnect
          if (!isReconnect) {
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
                const reconnect = () =>
                  new Promise(resolve => {
                    setTimeout(async () => {
                      try {
                        await initializeNode(self, true)
                        resolve()
                      } catch (e) {
                        await reconnect()
                      }
                    }, 2000)
                  })

                await reconnect()
              }
            })
          }
        }
      } catch (e) {
        if (isReconnect) {
          throw e
        }

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
