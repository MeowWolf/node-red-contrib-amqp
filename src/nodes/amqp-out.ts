import { NodeRedApp, EditorNodeProperties } from 'node-red'
import { NODE_STATUS } from '../constants'
import { ErrorType, NodeType } from '../types'
import Amqp from '../Amqp'
import { MessageProperties } from 'amqplib'

module.exports = function (RED: NodeRedApp): void {
  function AmqpOut(
    config: EditorNodeProperties & {
      exchangeRoutingKey: string
      exchangeRoutingKeyType: string
      amqpProperties: string
    },
  ): void {
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

          self.on('input', async (msg, _, done) => {
            const { payload, routingKey, properties: msgProperties } = msg
            const {
              exchangeRoutingKey,
              exchangeRoutingKeyType,
              amqpProperties,
            } = config

            // message properties override config properties
            let properties: MessageProperties
            try {
              properties = {
                ...JSON.parse(amqpProperties),
                ...msgProperties,
              }
            } catch (e) {
              properties = msgProperties
            }

            switch (exchangeRoutingKeyType) {
              case 'msg':
              case 'flow':
              case 'global':
                amqp.setRoutingKey(
                  RED.util.evaluateNodeProperty(
                    exchangeRoutingKey,
                    exchangeRoutingKeyType,
                    self,
                    msg,
                  ),
                )
                break
              case 'jsonata':
                amqp.setRoutingKey(
                  RED.util.evaluateJSONataExpression(
                    RED.util.prepareJSONataExpression(exchangeRoutingKey, self),
                    msg,
                  ),
                )
                break
              case 'str':
              default:
                if (routingKey) {
                  // if incoming payload contains a routingKey value
                  // override our string value with it.

                  // Superfluous (and possibly confusing) at this point
                  // but keeping it to retain backwards compatibility
                  amqp.setRoutingKey(routingKey)
                }
                break
            }

            if (!!properties?.headers?.doNotStringifyPayload) {
              amqp.publish(payload, properties)
            } else {
              amqp.publish(JSON.stringify(payload), properties)
            }

            done && done()
          })

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
  RED.nodes.registerType(NodeType.AmqpOut, AmqpOut)
}
