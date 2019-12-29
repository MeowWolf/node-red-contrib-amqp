import { Red, Node } from 'node-red'
// import * as amqplib from 'amqplib'
import { Connection, Channel, Replies, connect, ConsumeMessage } from 'amqplib'
import { AmqpConfig, BrokerConfig } from './types'

export default class Amqp {
  private RED: Red
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

  constructor(RED: Red, config: AmqpConfig) {
    this.RED = RED
    this.noAck = config.noAck
    this.brokerId = config.broker
    this.exchangeType = config.exchangeType
    this.exchangeName = config.exchangeName
    this.routingKey = config.routingKey
    this.durable = config.durable
    this.queueName = config.queueName
    this.exclusive = config.exclusive
  }

  public async connect(amqpNode: any): Promise<Connection> {
    this.broker = this.RED.nodes.getNode(this.brokerId)
    const brokerUrl = Amqp.getBrokerUrl(this.broker)
    this.connection = await connect(brokerUrl)

    /* istanbul ignore next */
    this.connection.on('error', e => {
      amqpNode.error(`amqplib ${e}`)
    })

    return this.connection
  }

  public async createChannel(): Promise<void> {
    this.channel = await this.connection.createChannel()
  }

  public async assertExchange(): Promise<void> {
    /* istanbul ignore else */
    if (this.exchangeName) {
      await this.channel.assertExchange(this.exchangeName, this.exchangeType, {
        durable: this.durable,
      })
    }
  }

  public async assertQueue(): Promise<void> {
    this.q = await this.channel.assertQueue(this.queueName, {
      exclusive: this.exclusive,
    })
    // Update queue name for unnamed queues
    this.queueName = this.q.queue
  }

  public bindQueue(): void {
    /* istanbul ignore else */
    if (this.exchangeName) {
      this.channel.bindQueue(this.q.queue, this.exchangeName, this.routingKey)
    }
  }

  public async consume(node: any): Promise<void> {
    await this.channel.consume(
      this.q.queue,
      amqpMessage => {
        const msg = this.assembleMessage(amqpMessage)
        node.send(msg)
      },
      { noAck: this.noAck },
    )
  }

  public async close(): Promise<void> {
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
  }

  private static getBrokerUrl(broker: Node): string {
    let url = ''

    if (broker) {
      const {
        host,
        port,
        credentials: { username, password },
      } = (broker as unknown) as BrokerConfig

      url = `amqp://${username}:${password}@${host}:${port}`
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
