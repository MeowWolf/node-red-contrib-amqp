import { NodeRedApp, Node } from 'node-red'
import { v4 as uuidv4 } from 'uuid'
import cloneDeep = require('lodash.clonedeep')
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
    private readonly RED: NodeRedApp,
    private readonly node: Node,
    config: AmqpInNodeDefaults & AmqpOutNodeDefaults,
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
      amqpProperties: this.parseJson(
        config.amqpProperties,
      ) as MessageProperties,
      headers: this.parseJson(config.headers),
      outputs: config.outputs,
      rpcTimeout: config.rpcTimeoutMilliseconds,
    }
  }

  public async connect(): Promise<Connection> {
    const { broker } = this.config

    // wtf happened to the types?
    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
    // @ts-ignore
    this.broker = this.RED.nodes.getNode(broker)

    const brokerUrl = this.getBrokerUrl(this.broker)
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
    const allUpTo = !!msg.manualAck?.allUpTo
    this.channel.ack(msg, allUpTo)
  }

  public ackAll(): void {
    this.channel.ackAll()
  }

  public nack(msg: AssembledMessage): void {
    const allUpTo = !!msg.manualAck?.allUpTo
    const requeue = msg.manualAck?.requeue ?? true
    this.channel.nack(msg, allUpTo, requeue)
  }

  public nackAll(msg: AssembledMessage): void {
    const requeue = msg.manualAck?.requeue ?? true
    this.channel.nackAll(requeue)
  }

  public reject(msg: AssembledMessage): void {
    const requeue = msg.manualAck?.requeue ?? true
    this.channel.reject(msg, requeue)
  }

  public async publish(
    msg: unknown,
    properties?: MessageProperties,
  ): Promise<void> {
    this.parseRoutingKeys().forEach(async routingKey => {
      this.handlePublish(this.config, msg, properties, routingKey)
    })
  }

  private async handlePublish(
    config: AmqpConfig,
    msg: unknown,
    properties?: MessageProperties,
    routingKey?: string,
  ) {
    const {
      exchange: { name },
      outputs: rpcRequested,
    } = config

    try {
      let correlationId = ''
      let replyTo = ''

      if (rpcRequested) {
        // Send request for remote procedure call
        correlationId =
          properties?.correlationId ||
          this.config.amqpProperties?.correlationId ||
          uuidv4()
        replyTo =
          properties?.replyTo || this.config.amqpProperties?.replyTo || uuidv4()
        await this.handleRemoteProcedureCall(correlationId, replyTo)
      }

      const options = {
        correlationId,
        replyTo,
        ...this.config.amqpProperties,
        ...properties,
      }
      if (name) {
        this.channel.publish(
          name,
          routingKey,
          Buffer.from(msg as string),
          options,
        )
      } else {
        this.channel.sendToQueue(
          options.replyTo,
          Buffer.from(msg as string),
          options,
        )
      }
    } catch (e) {
      this.node.error(`Could not publish message: ${e}`)
    }
  }

  private getRpcConfig(replyTo: string): AmqpConfig {
    const rpcConfig = cloneDeep(this.config)
    rpcConfig.exchange.name = ''
    rpcConfig.queue.name = replyTo
    rpcConfig.queue.autoDelete = true
    rpcConfig.queue.exclusive = true
    rpcConfig.queue.durable = false
    rpcConfig.noAck = true

    return rpcConfig
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
      let additionalErrorMessaging = ''

      /************************************
       * assert queue and set up consumer
       ************************************/
      const queueName = await this.assertQueue(rpcConfig)

      await this.channel.consume(
        queueName,
        async amqpMessage => {
          if (amqpMessage) {
            const msg = this.assembleMessage(amqpMessage)
            if (msg.properties.correlationId === correlationId) {
              this.node.send(msg)
              /* istanbul ignore else */
              if (!rpcQueueHasBeenDeleted) {
                await this.channel.deleteQueue(queueName)
                rpcQueueHasBeenDeleted = true
              }
            } else {
              additionalErrorMessaging += ` Correlation ids do not match. Expecting: ${correlationId}, received: ${msg.properties.correlationId}`
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
              payload: {
                message: `Timeout while waiting for RPC response.${additionalErrorMessaging}`,
                config: rpcConfig,
              },
            })
            await this.channel.deleteQueue(queueName)
          }
        } catch (e) {
          // TODO: Keep an eye on this
          // This might close the whole channel
          this.node.error(`Error trying to cancel RPC consumer: ${e}`)
        }
      }, rpcConfig.rpcTimeout || 3000)
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

  private async assertQueue(configParams?: AmqpConfig): Promise<string> {
    const { queue } = configParams || this.config
    const { name, exclusive, durable, autoDelete } = queue

    this.q = await this.channel.assertQueue(name, {
      exclusive,
      durable,
      autoDelete,
    })

    return name
  }

  private async bindQueue(configParams?: AmqpConfig): Promise<void> {
    const { name, type, routingKey } =
      configParams?.exchange || this.config.exchange
    const { headers } = configParams?.amqpProperties || this.config

    if (this.canHaveRoutingKey(type)) {
      /* istanbul ignore else */
      if (name) {
        this.parseRoutingKeys(routingKey).forEach(async routingKey => {
          await this.channel.bindQueue(this.q.queue, name, routingKey)
        })
      }
    }

    if (type === ExchangeType.Fanout) {
      await this.channel.bindQueue(this.q.queue, name, '')
    }

    if (type === ExchangeType.Headers) {
      await this.channel.bindQueue(this.q.queue, name, '', headers)
    }
  }

  private canHaveRoutingKey(type: ExchangeType): boolean {
    return type === ExchangeType.Direct || type === ExchangeType.Topic
  }

  private getBrokerUrl(broker: Node): string {
    let url = ''

    if (broker) {
      const { host, port, vhost, tls, credsFromSettings, credentials } =
        broker as unknown as BrokerConfig

      const { username, password } = credsFromSettings
        ? this.getCredsFromSettings()
        : credentials

      const protocol = tls ? /* istanbul ignore next */ 'amqps' : 'amqp'
      url = `${protocol}://${encodeURIComponent(username)}:${encodeURIComponent(
        password,
      )}@${host}:${port}/${vhost}`
    }

    return url
  }

  private getCredsFromSettings(): {
    username: string
    password: string
  } {
    return {
      // eslint-disable-next-line @typescript-eslint/ban-ts-comment
      // @ts-ignore
      username: this.RED.settings.MW_CONTRIB_AMQP_USERNAME,
      // eslint-disable-next-line @typescript-eslint/ban-ts-comment
      // @ts-ignore
      password: this.RED.settings.MW_CONTRIB_AMQP_PASSWORD,
    }
  }

  private parseRoutingKeys(routingKeyArg?: string): string[] {
    const routingKey =
      routingKeyArg || this.config.exchange.routingKey || this.q?.queue || ''
    const keys = routingKey?.split(',').map(key => key.trim())
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
    return this.node.type === NodeType.AmqpInManualAck
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
