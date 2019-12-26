import { ErrorTypes } from '../src/types'

export const amqpInFlowFixture = [
  {
    id: 'n1',
    type: 'amqp-in',
    wires: [['n2']],
    name: '',
    broker: 'n3',
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

export class CustomError extends Error {
  constructor(private readonly code: ErrorTypes, ...params: undefined[]) {
    super(...params)

    // Maintains proper stack trace for where our error was thrown (only available on V8)
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, CustomError)
    }

    this.name = 'CustomError'
  }
}
