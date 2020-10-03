import { Red, Node } from 'node-red'
import { v4 as uuidv4 } from 'uuid'
import cloneDeep from 'lodash.clonedeep'
import {
  Connection,
  Channel,
  Replies,
  connect,
  ConsumeMessage,
  MessageProperties,
} from 'amqplib'
import {
  AmqpConfig,
  BrokerConfig,
  NodeType,
  AssembledMessage,
  GenericJsonObject,
  ExchangeType,
  DefaultExchangeName,
  AmqpInNodeDefaults,
  AmqpOutNodeDefaults,
} from './types'
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
    config: AmqpInNodeDefaults & AmqpOutNodeDefaults,
  ) {
    this.config = {
      name: config.name,
      broker: config.broker,
      prefetch: config.prefetch,
      noAck: config.noAck,
      exchange: {
        name:
          config.exchangeName ||
          this.determineDefaultExchange(config.exchangeType),
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
      amqpProperties: this.parseJson(
        config.amqpProperties,
      ) as MessageProperties,
      headers: this.parseJson(config.headers),
      outputs: config.outputs,
      rpcTimeout: config.rpcTimeoutMilliseconds,
    }
  }

  private determineDefaultExchange(
    exchangeType: ExchangeType,
  ): DefaultExchangeName {
    switch (exchangeType) {
      case ExchangeType.Direct:
        return DefaultExchangeName.Direct
      case ExchangeType.Fanout:
        return DefaultExchangeName.Fanout
      case ExchangeType.Topic:
        return DefaultExchangeName.Topic
      case ExchangeType.Headers:
        return DefaultExchangeName.Headers
      default:
        return DefaultExchangeName.Direct
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
  }

  public async consume(): Promise<void> {
    try {
      const { noAck } = this.config
      await this.assertQueue()
      this.bindQueue()
      await this.channel.consume(
        this.q.queue,
        amqpMessage => {
          const msg = this.assembleMessage(amqpMessage)
          this.node.send(msg)
          /* istanbul ignore else */
          if (!noAck && !this.isManualAck()) {
            this.ack(msg)
          }
        },
        { noAck },
      )
    } catch (e) {
      this.node.error(`Could not consume message: ${e}`)
    }
  }

  public setRoutingKey(newRoutingKey: string): void {
    this.config.exchange.routingKey = newRoutingKey
  }

  public ack(msg: AssembledMessage): void {
    this.channel.ack(msg)
  }

  public async publish(
    msg: unknown,
    properties?: MessageProperties,
  ): Promise<void> {
    const {
      exchange: { name },
      outputs: rpcRequested,
    } = this.config

    try {
      this.parseRoutingKeys().forEach(async routingKey => {
        // correlationId & replyTo in case RPC is requested
        const rpcProperties = rpcRequested
          ? this.getRpcMessageProperties(routingKey)
          : {}

        this.channel.publish(name, routingKey, Buffer.from(msg), {
          ...rpcProperties,
          ...this.config.amqpProperties,
          ...properties,
        })

        if (rpcRequested) {
          const { correlationId, replyTo } = rpcProperties
          this.handleRemoteProcedureCall(correlationId, replyTo)
        }
      })
    } catch (e) {
      this.node.error(`Could not publish message: ${e}`)
    }
  }

  private getRpcConfig(replyTo: string): AmqpConfig {
    const rpcConfig = cloneDeep(this.config)
    rpcConfig.exchange.routingKey = replyTo
    rpcConfig.queue.autoDelete = true
    rpcConfig.queue.durable = false
    rpcConfig.noAck = true
    return rpcConfig
  }

  private getRpcMessageProperties(routingKey: string): GenericJsonObject {
    const correlationId = uuidv4()
    const replyTo = `${routingKey}.rpc-response`

    return {
      correlationId,
      replyTo,
    }
  }

  private async handleRemoteProcedureCall(
    correlationId: string,
    replyTo: string,
  ): Promise<void> {
    const rpcConfig = this.getRpcConfig(replyTo)

    try {
      // If we try to delete a queue that's already deleted
      // bad things will happen.
      let rpcQueueHasBeenDeleted = false

      /************************************
       * bind queue and set up consumer
       ************************************/
      await this.assertQueue(rpcConfig)
      this.bindQueue(rpcConfig)

      await this.channel.consume(
        this.q.queue,
        async amqpMessage => {
          if (amqpMessage) {
            const msg = this.assembleMessage(amqpMessage)
            if (msg.properties.correlationId === correlationId) {
              this.node.send(msg)
              /* istanbul ignore else */
              if (!rpcQueueHasBeenDeleted) {
                await this.channel.deleteQueue(this.q.queue)
                rpcQueueHasBeenDeleted = true
              }
            }
          }
        },
        { noAck: rpcConfig.noAck },
      )

      /****************************************
       * Check if RPC has timed out and handle
       ****************************************/
      setTimeout(async () => {
        try {
          if (!rpcQueueHasBeenDeleted) {
            this.node.send({
              payload: 'Timeout while waiting for RPC response',
              config: rpcConfig,
            })
            await this.channel.deleteQueue(this.q.queue)
          }
        } catch (e) {
          // TODO: Keep an eye on this
          // This might close the whole channel
          console.warn(e)
        }
      }, rpcConfig.rpcTimeout)
    } catch (e) {
      this.node.error(`Could not consume RPC message: ${e}`)
    }
  }

  public async close(): Promise<void> {
    const { name: exchangeName } = this.config.exchange
    const queueName = this.q?.queue

    try {
      /* istanbul ignore else */
      if (exchangeName && queueName) {
        const routingKeys = this.parseRoutingKeys()
        try {
          for (let x = 0; x < routingKeys.length; x++) {
            await this.channel.unbindQueue(
              queueName,
              exchangeName,
              routingKeys[x],
            )
          }
        } catch (e) {
          /* istanbul ignore next */
          console.error('Error unbinding queue: ', e.message)
        }
      }
      await this.channel.close()
      await this.connection.close()
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
        durable,
      })
    }
  }

  private async assertQueue(configParams?: AmqpConfig): Promise<void> {
    const { queue } = configParams || this.config
    const { name, exclusive, durable, autoDelete } = queue

    this.q = await this.channel.assertQueue(name, {
      exclusive,
      durable,
      autoDelete,
    })
  }

  private async bindQueue(configParams?: AmqpConfig): Promise<void> {
    const { name, type } = configParams?.exchange || this.config.exchange

    if (type === ExchangeType.Direct || type === ExchangeType.Topic) {
      /* istanbul ignore else */
      if (name) {
        this.parseRoutingKeys(configParams).forEach(async routingKey => {
          await this.channel.bindQueue(this.q.queue, name, routingKey)
        })
      }
    }

    if (type === ExchangeType.Fanout) {
      await this.channel.bindQueue(this.q.queue, name, '')
    }

    if (type === ExchangeType.Headers) {
      await this.channel.bindQueue(this.q.queue, name, '', this.config.headers)
    }
  }

  private static getBrokerUrl(broker: Node): string {
    let url = ''

    if (broker) {
      const {
        host,
        port,
        vhost,
        tls,
        credentials: { username, password },
      } = (broker as unknown) as BrokerConfig

      const protocol = tls ? /* istanbul ignore next */ 'amqps' : 'amqp'
      url = `${protocol}://${username}:${password}@${host}:${port}/${vhost}`
    }

    return url
  }

  private parseRoutingKeys(configParams?: AmqpConfig): string[] {
    const { routingKey } = configParams?.exchange || this.config.exchange
    const keys = routingKey.split(',').map(key => key.trim())
    return keys
  }

  private assembleMessage(amqpMessage: ConsumeMessage): AssembledMessage {
    const payload = this.parseJson(amqpMessage.content.toString())

    return {
      ...amqpMessage,
      payload,
    }
  }

  private isManualAck(): boolean {
    return this.node.type === NodeType.AMQP_IN_MANUAL_ACK
  }

  private parseJson(jsonInput: unknown): GenericJsonObject {
    let output: unknown
    try {
      output = JSON.parse(jsonInput as string)
    } catch {
      output = jsonInput
    }
    return output
  }
}
