import { Red, Node } from 'node-red'
import * as amqplib from 'amqplib'
import { getBrokerUrl } from '../util'

module.exports = function(RED: Red): void {
  function AmqpIn(config): void {
    try {
      RED.nodes.createNode(this, config)

      // So we can use async/await here
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const iife = (async function(): Promise<void> {
        const broker: Node = RED.nodes.getNode(config.broker)

        if (broker) {
          const brokerUrl = getBrokerUrl(broker)
          const connection = await amqplib.connect(brokerUrl)

          console.log('there is a broker')
          console.log(broker)
        } else {
          console.log('there is no broker')
        }
      })()
    } catch (e) {
      console.error('AmqpIn() Problem!', e)
    }
  }
  RED.nodes.registerType('amqp-in', AmqpIn)
}
