import { Red, Node } from 'node-red'
import * as amqplib from 'amqplib'
import { NODE_STATUS } from '../constants'
import { getBrokerUrl } from '../util'

module.exports = function(RED: Red): void {
  function AmqpIn(config): void {
    RED.nodes.createNode(this, config)

    this.status(NODE_STATUS.Disconnected)
    // So we can use async/await here
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const iife = (async function(self): Promise<void> {
      try {
        const broker: Node = RED.nodes.getNode(config.broker)

        if (broker) {
          const brokerUrl = getBrokerUrl(broker)
          const connection = await amqplib.connect(brokerUrl)

          // istanbul ignore else
          if (connection) {
            self.status(NODE_STATUS.Connected)
          }
        }
      } catch (e) {
        self.status(NODE_STATUS.Error)
        self.error(`AmqpIn() ${e}`)
      }
    })(this)
  }
  RED.nodes.registerType('amqp-in', AmqpIn)
}
