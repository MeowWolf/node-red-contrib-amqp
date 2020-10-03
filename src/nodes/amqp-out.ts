import { NodeRedApp, EditorNodeProperties } from 'node-red'
import { NODE_STATUS } from '../constants'
import { ErrorType, NodeType } from '../types'
import Amqp from '../Amqp'

module.exports = function (RED: NodeRedApp): void {
  function AmqpOut(config: EditorNodeProperties): void {
    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
    // @ts-ignore
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

          // We don't want to duplicate these handlers on reconnect
          if (!isReconnect) {
            self.on(
              'input',
              async ({ payload, routingKey, properties }, send, done) => {
                if (routingKey) {
                  amqp.setRoutingKey(routingKey)
                }

                amqp.publish(JSON.stringify(payload), properties)

                /* istanbul ignore else */
                if (done) {
                  done()
                }
              },
            )

            // When the node is re-deployed
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

        if (e.code === ErrorType.INVALID_LOGIN) {
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
