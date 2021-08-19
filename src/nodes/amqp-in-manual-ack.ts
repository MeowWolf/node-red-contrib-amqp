import { NodeRedApp, EditorNodeProperties } from 'node-red'
import { NODE_STATUS } from '../constants'
import { ErrorType, NodeType, ManualAckType } from '../types'
import Amqp from '../Amqp'

module.exports = function (RED: NodeRedApp): void {
  function AmqpInManualAck(config: EditorNodeProperties): void {
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

          self.on('input', async (msg, send, done) => {
            if (msg.manualAck) {
              const ackMode = msg.manualAck.ackMode

              switch (ackMode) {
                case ManualAckType.AckAll:
                  amqp.ackAll()
                  break
                case ManualAckType.Nack:
                  amqp.nack(msg)
                  break
                case ManualAckType.NackAll:
                  amqp.nackAll(msg)
                  break
                case ManualAckType.Reject:
                  amqp.reject(msg)
                  break
                case ManualAckType.Ack:
                default:
                  amqp.ack(msg)
                  break
              }
            } else {
              amqp.ack(msg)
            }

            /* istanbul ignore else */
            done && done()
          })

          // When the server goes down
          self.once('close', async (done: () => void): Promise<void> => {
            await amqp.close()
            done && done()
          })

          // When the server goes down
          connection.on('close', async e => {
            e && (await reconnect())
          })

          self.status(NODE_STATUS.Connected)
        }
      } catch (e) {
        if (e.code === ErrorType.ConnectionRefused || e.isOperational) {
          await reconnect()
        } else if (e.code === ErrorType.InvalidLogin) {
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
  RED.nodes.registerType(NodeType.AmqpInManualAck, AmqpInManualAck)
}
