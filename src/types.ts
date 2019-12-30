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
  noAck: boolean
  broker: string
  exchangeType: ExchangeType
  exchangeName: string
  routingKey: string
  durable: boolean
  queueName: string
  exclusive: boolean
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
