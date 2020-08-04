import {
  ErrorType,
  ExchangeType,
  BrokerConfig,
  NodeType,
  GenericJsonObject,
} from '../src/types'

export const amqpInFlowFixture = [
  {
    id: 'n1',
    type: NodeType.AMQP_IN,
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

export const amqpInManualAckFlowFixture = [
  {
    id: 'n1',
    type: NodeType.AMQP_IN_MANUAL_ACK,
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

export const amqpOutFlowFixture = [
  {
    id: 'n1',
    type: NodeType.AMQP_OUT,
    wires: [['n2']],
    name: '',
    broker: 'n3',
    noAck: true,
    exchangeName: 'testtopic',
    exchangeType: 'topic',
    routingKey: 'test.message.topic',
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

export const nodeConfigFixture: GenericJsonObject = {
  name: 'name',
  broker: 'b1',
  exchangeName: 'exchangeName',
  exchangeType: ExchangeType.TOPIC,
  noAck: false,
  exchangeRoutingKey: 'routing.key',
  exchangeDurable: true,
  queueName: '',
  queueExclusive: true,
  queueDurable: false,
  queueAutoDelete: true,
}

export const nodeFixture = {
  status: (): null => null,
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
