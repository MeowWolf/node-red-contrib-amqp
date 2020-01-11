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
}

export enum ErrorType {
  INALID_LOGIN = 'ENOTFOUND',
}

export enum ExchangeType {
  DIRECT = 'direct',
  FANOUT = 'fanout',
  TOPIC = 'topic',
  HEADERS = 'header',
}
