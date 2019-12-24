/* eslint-disable @typescript-eslint/ban-ts-ignore */
import { expect } from 'chai'
import { getBrokerUrl } from '../src/util'

const urlFixture = 'amqp://username:password@host:222'
const brokerFixture = {
  host: 'host',
  port: 222,
  credentials: {
    username: 'username',
    password: 'password',
  },
}

describe('util', function() {
  describe('getBrokerUrl()', () => {
    it('should return the broker url', () => {
      // @ts-ignore
      const url = getBrokerUrl(brokerFixture)
      expect(url).to.equal(urlFixture)
    })

    it('should return empty string with no input', () => {
      // @ts-ignore
      const url = getBrokerUrl()
      expect(url).to.be.empty
    })
  })
})
