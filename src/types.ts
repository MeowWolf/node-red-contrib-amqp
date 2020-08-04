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
  DIRECT = 'direct',
  FANOUT = 'fanout',
  TOPIC = 'topic',
  HEADERS = 'header',
}
