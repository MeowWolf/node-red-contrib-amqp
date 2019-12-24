import { Red, Node } from 'node-red'
import * as amqplib from 'amqplib'
import { getBrokerUrl } from '../util'

module.exports = function(RED: Red): void {
  function AmqpIn(config): void {
    RED.nodes.createNode(this, config)

    // So we can use async/await here
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const iife = (async function(): Promise<void> {
      try {
        const broker: Node = RED.nodes.getNode(config.broker)

        if (broker) {
          const brokerUrl = getBrokerUrl(broker)
          const connection = await amqplib.connect(brokerUrl)
        } else {
        }
      } catch (e) {
        console.log('AmqpIn() Error', e)
      }
    })()
  }
  RED.nodes.registerType('amqp-in', AmqpIn)
}
