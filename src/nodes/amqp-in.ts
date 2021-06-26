import { NodeRedApp, EditorNodeProperties } from 'node-red'
import { NODE_STATUS } from '../constants'
import { ErrorType, NodeType } from '../types'
import Amqp from '../Amqp'

module.exports = function (RED: NodeRedApp): void {
  RED.events.on('nodes-started', () =>
    console.warn('this has started okay?????'),
  )
  function AmqpIn(config: EditorNodeProperties): void {
    let isConnecting = false

    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
    // @ts-ignore
    RED.nodes.createNode(this, config)
    this.status(NODE_STATUS.Disconnected)
    const amqp = new Amqp(RED, this, config)

    ;(async function initializeNode(
      self,
      doSetupEventHandlers = false,
    ): Promise<void> {
      if (!isConnecting) {
        isConnecting = true

        const reconnect = (doSetupEventHandlers = true) =>
          new Promise<void>(resolve => {
            console.warn('amqp in RECONNECT!!!!')
            setTimeout(async () => {
              try {
                await initializeNode(self, doSetupEventHandlers)
                resolve()
              } catch (e) {
                isConnecting = false
                await reconnect(doSetupEventHandlers)
              }
            }, 2000)
          })
        try {
          const connection = await amqp.connect()

          // istanbul ignore else
          if (connection) {
            isConnecting = false
            self.status(NODE_STATUS.Connected)

            await amqp.initialize()
            await amqp.consume()

            // We don't want to duplicate these handlers on reconnect
            if (!doSetupEventHandlers) {
              console.warn('IN we are setting up event hanlders')
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
            self.error(`AmqpIn() Could not connect to broker ${e}`)
          } else {
            self.status(NODE_STATUS.Error)
            self.error(`AmqpIn() ${e}`)
          }
        }
      }
    })(this)
  }
  // eslint-disable-next-line @typescript-eslint/ban-ts-comment
  // @ts-ignore
  RED.nodes.registerType(NodeType.AMQP_IN, AmqpIn)
}
