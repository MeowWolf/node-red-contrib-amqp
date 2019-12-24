import { Red, Node } from 'node-red'
import * as amqplib from 'amqplib'
import { getBrokerUrl } from '../util'

module.exports = function(RED: Red): void {
  function AmqpIn(config): void {
    RED.nodes.createNode(this, config)

    this.status({ fill: 'red', shape: 'ring', text: 'disconnected' })
    // So we can use async/await here
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const iife = (async function(self): Promise<void> {
      try {
        const broker: Node = RED.nodes.getNode(config.broker)

        if (broker) {
          const brokerUrl = getBrokerUrl(broker)

          /* istanbul ignore next */
          const connection = await amqplib.connect(brokerUrl)
          self.status({ fill: 'green', shape: 'dot', text: 'connected' })
        }
      } catch (e) {
        self.status({ fill: 'red', shape: 'dot', text: 'error' })
        self.error(`AmqpIn() ${e}`)
      }
    })(this)
  }
  RED.nodes.registerType('amqp-in', AmqpIn)
}
