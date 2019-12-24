export interface BrokerConfig extends Node {
  host: string
  port: number
  credentials: {
    username: string
    password: string
  }
}
