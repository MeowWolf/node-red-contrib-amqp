import { Red } from 'node-red'

module.exports = function(RED: Red): void {
  function AmqpBroker(n): void {
    RED.nodes.createNode(this, n)
    this.host = n.host
    this.port = n.port
  }
  RED.nodes.registerType('amqp-broker', AmqpBroker, {
    credentials: {
      username: { type: 'text' },
      password: { type: 'password' },
    },
  })
}
