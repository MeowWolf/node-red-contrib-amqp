import { ErrorType, AmqpConfig, ExchangeType, BrokerConfig } from '../src/types'

export const amqpInFlowFixture = [
  {
    id: 'n1',
    type: 'amqp-in',
    wires: [['n2']],
    name: '',
    broker: 'n3',
    noAck: true,
    exchangeName: 'testtopic',
    exchangeType: 'topic',
    routingKey: '#',
    durable: true,
    queueName: '',
    exclusive: true,
  },
  { id: 'n2', type: 'helper' },
  {
    id: 'n3',
    type: 'amqp-broker',
    z: '',
    host: 'localhost',
    port: '5672',
  },
]

export const credentialsFixture = { username: 'username', password: 'password' }

export const amqpConfigFixture: AmqpConfig = {
  name: 'name',
  noAck: false,
  broker: 'b1',
  exchangeType: ExchangeType.TOPIC,
  exchangeName: 'exchangeName',
  routingKey: 'routing.key',
  durable: true,
  queueName: 'queueName',
  exclusive: true,
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const brokerConfigFixture: any & BrokerConfig = {
  host: 'host',
  port: 222,
  credentials: {
    username: 'username',
    password: 'password',
  },
}

export class CustomError extends Error {
  constructor(private readonly code: ErrorType, ...params: undefined[]) {
    super(...params)

    // Maintains proper stack trace for where our error was thrown (only available on V8)
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, CustomError)
    }

    this.name = 'CustomError'
  }
}
