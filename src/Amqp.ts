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
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    config: Record<string, any>,
  ) {
    this.config = {
      name: config.name,
      broker: config.broker,
      prefetch: config.prefetch,
      noAck: config.noAck,
      exchange: {
        name: config.exchangeName,
        type: config.exchangeType,
        routingKey: config.exchangeRoutingKey,
        durable: config.exchangeDurable,
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
    this.connection.on("close", () => {
      this.node.status(NODE_STATUS.Disconnected)
    })

    return this.connection
  }

  public async initialize(): Promise<void> {
    await this.createChannel()
    await this.assertExchange()
  }

  public async consume(): Promise<void> {
    try {
      await this.assertQueue()
      this.bindQueue()
      const { noAck } = this.config
      await this.channel.consume(
        this.q.queue,
        amqpMessage => {
          const msg = this.assembleMessage(amqpMessage)
          this.node.send(msg)
          /* istanbul ignore else */
          if (!noAck) {
            this.channel.ack(msg)
          }
        },
        { noAck },
      )
    } catch (e) {
      this.node.error(`Could not consume message: ${e}`)
    }
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  public publish(msg: any): void {
    const { name } = this.config.exchange

    try {
      this.parseRoutingKeys().forEach(routingKey => {
        this.channel.publish(name, routingKey, Buffer.from(msg))
      })
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
    const { prefetch } = this.config

    this.channel = await this.connection.createChannel()
    this.channel.prefetch(Number(prefetch))

    /* istanbul ignore next */
    this.channel.on('error', (): void => {
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
  }

  private bindQueue(): void {
    const { name } = this.config.exchange

    /* istanbul ignore else */
    if (name) {
      this.parseRoutingKeys().forEach(routingKey => {
        this.channel.bindQueue(this.q.queue, name, routingKey)
      })
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

  private parseRoutingKeys(): string[] {
    const keys = this.config.exchange.routingKey
      .split(',')
      .map(key => key.trim())
    return keys
  }

  private assembleMessage(
    amqpMessage: ConsumeMessage,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
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
