import { Red, Node } from 'node-red'
import { Connection, Channel, Replies, connect, ConsumeMessage } from 'amqplib'
import { AmqpConfig, BrokerConfig } from './types'
import { NODE_STATUS } from './constants'

export default class Amqp {
  private config: AmqpConfig
  private broker: Node
  private connection: Connection
  private channel: Channel
  private q: Replies.AssertQueue

  constructor(
    private readonly RED: Red,
    private readonly node: Node,
    config: Record<string, any>,
  ) {
    this.config = {
      name: config.name,
      broker: config.broker,
      exchange: {
        name: config.exchangeName,
        type: config.exchangeType,
        routingKey: config.exchangeRoutingKey,
        durable: config.exchangeDurable,
        noAck: config.exchangeNoAck,
      },
      queue: {
        name: config.queueName,
        exclusive: config.queueExclusive,
        durable: config.queueDurable,
        autoDelete: config.queueAutoDelete,
      },
    }
  }

  public async connect(): Promise<Connection> {
    const { broker } = this.config
    this.broker = this.RED.nodes.getNode(broker)
    const brokerUrl = Amqp.getBrokerUrl(this.broker)
    this.connection = await connect(brokerUrl, { heartbeat: 2 })

    /* istanbul ignore next */
    this.connection.on('error', (): void => {
      // If we don't set up this empty event handler
      // node-red crashes with an Unhandled Exception
      // This method allows the exception to be caught
      // by the try/catch blocks in the amqp nodes
    })

    /* istanbul ignore next */
    this.connection.on('close', () => {
      this.node.status(NODE_STATUS.Disconnected)
    })

    return this.connection
  }

  public async initialize(): Promise<void> {
    await this.createChannel()
    await this.assertExchange()
    await this.assertQueue()
    this.bindQueue()
  }

  public async consume(): Promise<void> {
    const { noAck } = this.config.exchange
    await this.channel.consume(
      this.q.queue,
      amqpMessage => {
        const msg = this.assembleMessage(amqpMessage)
        this.node.send(msg)
      },
      { noAck },
    )
  }

  public publish(msg: any): void {
    const { name, routingKey } = this.config.exchange

    try {
      this.channel.publish(name, routingKey, Buffer.from(msg))
    } catch (e) {
      this.node.error(`Could not publish message: ${e}`)
    }
  }

  public async close(): Promise<void> {
    const { name: exchangeName, routingKey } = this.config.exchange
    const { name: queueName } = this.config.queue

    try {
      /* istanbul ignore else */
      if (exchangeName) {
        await this.channel.unbindQueue(queueName, exchangeName, routingKey)
      }
      this.channel.close()
      this.connection.close()
    } catch (e) {} // Need to catch here but nothing further is necessary
  }

  private async createChannel(): Promise<void> {
    this.channel = await this.connection.createChannel()

    /* istanbul ignore next */
    this.channel.on('error', (e): void => {
      // If we don't set up this empty event handler
      // node-red crashes with an Unhandled Exception
      // This method allows the exception to be caught
      // by the try/catch blocks in the amqp nodes
    })
  }

  private async assertExchange(): Promise<void> {
    const { name, type, durable } = this.config.exchange

    /* istanbul ignore else */
    if (name) {
      await this.channel.assertExchange(name, type, {
        durable: durable,
      })
    }
  }

  private async assertQueue(): Promise<void> {
    const { name, exclusive, durable, autoDelete } = this.config.queue

    this.q = await this.channel.assertQueue(name, {
      exclusive,
      durable,
      autoDelete,
    })
    // Update queue name for unnamed queues
    // TODO: test what happens when we don't do this
    this.config.queue.name = this.q.queue
  }

  private bindQueue(): void {
    const { name, routingKey } = this.config.exchange

    /* istanbul ignore else */
    if (name) {
      // TODO: test with this.config.queue.name
      this.channel.bindQueue(this.q.queue, name, routingKey)
    }
  }

  private static getBrokerUrl(broker: Node): string {
    let url = ''

    if (broker) {
      const {
        host,
        port,
        tls,
        credentials: { username, password },
      } = (broker as unknown) as BrokerConfig

      const protocol = tls ? /* istanbul ignore next */ 'amqps' : 'amqp'
      url = `${protocol}://${username}:${password}@${host}:${port}`
    }

    return url
  }

  private assembleMessage(
    amqpMessage: ConsumeMessage,
  ): ConsumeMessage & { payload: Record<string, any> | string } {
    let payload
    try {
      payload = JSON.parse(amqpMessage.content.toString())
    } catch {
      payload = amqpMessage.content.toString()
    }
    return {
      ...amqpMessage,
      payload,
    }
  }
}
