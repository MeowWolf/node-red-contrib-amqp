/* eslint-disable @typescript-eslint/ban-ts-ignore */
import { expect } from 'chai'
import * as sinon from 'sinon'
import * as amqplib from 'amqplib'
import Amqp from '../src/Amqp'
import { amqpConfigFixture, nodeFixture, brokerConfigFixture } from './doubles'

let RED: any
let amqp: any

describe('Amqp Class', () => {
  beforeEach(function(done) {
    RED = {
      nodes: {
        getNode: sinon.stub().returns(brokerConfigFixture),
      },
    }

    // @ts-ignore
    amqp = new Amqp(RED, nodeFixture, amqpConfigFixture)
    done()
  })

  afterEach(function(done) {
    sinon.restore()
    done()
  })

  it('connect()', async () => {
    const error = 'error!'
    const result = { on: (): string => error }

    // @ts-ignore
    sinon.stub(amqplib, 'connect').resolves(result)

    const connection = await amqp.connect()
    expect(connection).to.eq(result)
  })

  it('initialize()', async () => {
    const createChannelStub = sinon.stub()
    const assertExchangeStub = sinon.stub()
    const assertQueueStub = sinon.stub()
    const bindQueueStub = sinon.stub()
    const consumeStub = sinon.stub()

    amqp.createChannel = createChannelStub
    amqp.assertExchange = assertExchangeStub
    amqp.assertQueue = assertQueueStub
    amqp.bindQueue = bindQueueStub

    await amqp.initialize()
    expect(createChannelStub.calledOnce).to.equal(true)
    expect(assertExchangeStub.calledOnce).to.equal(true)
    expect(assertQueueStub.calledOnce).to.equal(true)
    expect(bindQueueStub.calledOnce).to.equal(true)
  })

  it('consume()', async () => {
    const messageContent = 'messageContent'
    const send = sinon.stub()
    const node = { send }
    const channel = {
      consume: function(
        queue: string,
        cb: Function,
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        config: Record<string, any>,
      ): void {
        const amqpMessage = { content: messageContent }
        cb(amqpMessage)
      },
    }
    amqp.channel = channel
    amqp.q = { queue: 'queueName' }
    amqp.node = node

    await amqp.consume()
    expect(send.calledOnce).to.equal(true)
    expect(
      send.calledWith({
        content: messageContent,
        payload: messageContent,
      }),
    ).to.equal(true)
  })

  describe('publish()', () => {
    it('publishes a message', () => {
      const publishStub = sinon.stub()
      amqp.channel = {
        publish: publishStub,
      }
      amqp.publish('a message')
      expect(publishStub.calledOnce).to.equal(true)
    })

    it('tries to publish an invalid message', () => {
      const publishStub = sinon.stub().throws()
      const errorStub = sinon.stub()
      amqp.channel = {
        publish: publishStub,
      }
      amqp.node = {
        error: errorStub,
      }
      amqp.publish('a message')
      expect(publishStub.calledOnce).to.equal(true)
      expect(errorStub.calledOnce).to.equal(true)
    })
  })

  it('close()', async () => {
    const unbindQueueStub = sinon.stub()
    const channelCloseStub = sinon.stub()
    const connectionCloseStub = sinon.stub()

    amqp.channel = { unbindQueue: unbindQueueStub, close: channelCloseStub }
    amqp.connection = { close: connectionCloseStub }
    const { queueName, exchangeName, routingKey } = amqpConfigFixture

    await amqp.close()
    expect(unbindQueueStub.calledOnce).to.equal(true)
    expect(
      unbindQueueStub.calledWith(queueName, exchangeName, routingKey),
    ).to.equal(true)
    expect(channelCloseStub.calledOnce).to.equal(true)
    expect(connectionCloseStub.calledOnce).to.equal(true)
  })

  it('createChannel()', async () => {
    const error = 'error!'
    const result = { on: (): string => error }
    const createChannelStub = sinon.stub().returns(result)
    amqp.connection = { createChannel: createChannelStub }

    await amqp.createChannel()
    expect(createChannelStub.calledOnce).to.equal(true)
    expect(amqp.channel).to.eq(result)
  })

  it('assertExchange()', async () => {
    const assertExchangeStub = sinon.stub()
    amqp.channel = { assertExchange: assertExchangeStub }
    const { exchangeName, exchangeType, durable } = amqpConfigFixture

    await amqp.assertExchange()
    expect(assertExchangeStub.calledOnce).to.equal(true)
    expect(
      assertExchangeStub.calledWith(exchangeName, exchangeType, { durable }),
    ).to.equal(true)
  })

  it('assertQueue()', async () => {
    const queue = 'queueName'
    const assertQueueStub = sinon.stub().resolves({ queue })
    amqp.channel = { assertQueue: assertQueueStub }
    const { queueName, exclusive } = amqpConfigFixture

    await amqp.assertQueue()
    expect(assertQueueStub.calledOnce).to.equal(true)
    expect(assertQueueStub.calledWith(queueName, { exclusive })).to.equal(true)
    expect(amqp.queueName).to.equal(amqp.q.queue)
  })

  it('bindQueue()', () => {
    const queue = 'queueName'
    const bindQueueStub = sinon.stub()
    amqp.channel = { bindQueue: bindQueueStub }
    amqp.q = { queue }
    const { exchangeName, routingKey } = amqpConfigFixture

    amqp.bindQueue()
    expect(bindQueueStub.calledOnce).to.equal(true)
    expect(bindQueueStub.calledWith(queue, exchangeName, routingKey)).to.equal(
      true,
    )
  })
})
