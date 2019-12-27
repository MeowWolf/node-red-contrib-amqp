export interface AmqpInDefaults {
  name: {
    value: string
  }
  broker: {
    value: string
    type: string
  }
}

export interface BrokerConfig extends Node {
  host: string
  port: number
  credentials: {
    username: string
    password: string
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
