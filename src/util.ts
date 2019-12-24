import { Node } from 'node-red'
import { BrokerConfig } from './types'

export const getBrokerUrl = (broker: Node): string => {
  let url = ''

  if (broker) {
    const {
      host,
      port,
      credentials: { username, password },
    } = (broker as unknown) as BrokerConfig

    url = `amqp://${username}:${password}@${host}:${port}`
  }

  return url
}
