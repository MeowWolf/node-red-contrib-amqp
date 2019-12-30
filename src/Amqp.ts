import { Red, Node } from 'node-red'
import { Connection, Channel, Replies, connect, ConsumeMessage } from 'amqplib'
import { AmqpConfig, BrokerConfig } from './types'
import { NODE_STATUS } from './constants'

export default class Amqp {
  private RED: Red
  private node: Node
  private noAck: boolean
  private brokerId: string
  private exchangeType: string
  private exchangeName: string
  private routingKey: string
  private queueName: string
  private durable: boolean
  private exclusive: boolean

  private broker: Node
  private connection: Connection
  private channel: Channel
  private q: Replies.AssertQueue

  constructor(RED: Red, node: Node, config: AmqpConfig) {
    this.RED = RED
    this.node = node
    this.noAck = config.noAck
    this.brokerId = config.broker
    this.exchangeType = config.exchangeType
    this.exchangeName = config.exchangeName
    this.routingKey = config.routingKey
    this.durable = config.durable
    this.queueName = config.queueName
    this.exclusive = config.exclusive
  }

  public async connect(): Promise<Connection> {
    this.broker = this.RED.nodes.getNode(this.brokerId)
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
    await this.channel.consume(
      this.q.queue,
      amqpMessage => {
        const msg = this.assembleMessage(amqpMessage)
        this.node.send(msg)
      },
      { noAck: this.noAck },
    )
  }

  public publish(msg: any): void {
    try {
      this.channel.publish(this.exchangeName, this.routingKey, Buffer.from(msg))
    } catch (e) {
      this.node.error(`Could not publish message: ${e}`)
    }
  }

  public async close(): Promise<void> {
    try {
      /* istanbul ignore else */
      if (this.exchangeName) {
        await this.channel.unbindQueue(
          this.queueName,
          this.exchangeName,
          this.routingKey,
        )
      }
      this.channel.close()
      this.connection.close()
    } catch (e) {} // Need to catch here but nothing further is necessary
  }

  private async createChannel(): Promise<void> {
    this.channel = await this.connection.createChannel()

    /* istanbul ignore next */
    this.channel.on('error', (e): void => {
      this.node.error(`Channel Error: ${e}`)
    })
  }

  private async assertExchange(): Promise<void> {
    /* istanbul ignore else */
    if (this.exchangeName) {
      await this.channel.assertExchange(this.exchangeName, this.exchangeType, {
        durable: this.durable,
      })
    }
  }

  private async assertQueue(): Promise<void> {
    this.q = await this.channel.assertQueue(this.queueName, {
      exclusive: this.exclusive,
    })
    // Update queue name for unnamed queues
    this.queueName = this.q.queue
  }

  private bindQueue(): void {
    /* istanbul ignore else */
    if (this.exchangeName) {
      this.channel.bindQueue(this.q.queue, this.exchangeName, this.routingKey)
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

      const protocol = tls ? 'amqps' : 'amqp'
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
