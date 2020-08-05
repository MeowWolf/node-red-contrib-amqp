import { ConsumeMessage, MessageProperties } from 'amqplib'

export interface BrokerConfig extends Node {
  host: string
  port: number
  vhost: string
  tls: boolean
  credentials: {
    username: string
    password: string
  }
}

export interface AmqpConfig {
  name?: string
  broker: string
  prefetch: number
  noAck: boolean
  exchange: {
    name: string
    type: ExchangeType
    routingKey: string
    durable: boolean
  }
  queue: {
    name: string
    exclusive: boolean
    durable: boolean
    autoDelete: boolean
  }
  amqpProperties: MessageProperties
  headers: GenericJsonObject
}

export interface AmqpInNodeDefaults {
  name?: any
  broker?: any
  prefetch?: any
  noAck?: any
  exchangeName?: any
  exchangeType?: any
  exchangeRoutingKey?: any
  exchangeDurable?: any
  queueName?: any
  queueExclusive?: any
  queueDurable?: any
  queueAutoDelete?: any
  headers?: any
}

export interface AmqpOutNodeDefaults {
  name?: any
  broker?: any
  exchangeName?: any
  exchangeType?: any
  exchangeRoutingKey?: any
  exchangeDurable?: any
  queueName?: any
  queueExclusive?: any
  queueDurable?: any
  queueAutoDelete?: any
  amqpProperties?: any
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type GenericJsonObject = Record<string, any>

export type AssembledMessage = ConsumeMessage & {
  payload: GenericJsonObject | string
}

export enum ErrorType {
  INALID_LOGIN = 'ENOTFOUND',
}

export enum NodeType {
  AMQP_IN = 'amqp-in',
  AMQP_OUT = 'amqp-out',
  AMQP_IN_MANUAL_ACK = 'amqp-in-manual-ack',
}

export enum ExchangeType {
  Direct = 'direct',
  Fanout = 'fanout',
  Topic = 'topic',
  Headers = 'headers',
}

export enum DefaultExchangeName {
  Direct = 'amq.direct',
  Fanout = 'amq.fanout',
  Topic = 'amq.topic',
  Headers = 'amq.headers',
}
