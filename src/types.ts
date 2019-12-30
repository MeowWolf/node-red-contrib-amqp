export interface BrokerConfig extends Node {
  host: string
  port: number
  tls: boolean
  credentials: {
    username: string
    password: string
  }
}

export interface AmqpConfig {
  name?: string
  broker: string
  exchange: {
    name: string
    type: ExchangeType
    routingKey: string
    durable: boolean
    noAck: boolean
  }
  queue: {
    name: string
    exclusive: boolean
    durable: boolean
    autoDelete: boolean
  }
}

export enum ErrorType {
  INALID_LOGIN = 'ENOTFOUND',
}

export enum ExchangeType {
  DIRECT = 'direct',
  FANOUT = 'fanout',
  TOPIC = 'topic',
  HEADER = 'header',
}
