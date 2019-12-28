/* eslint-disable @typescript-eslint/ban-ts-ignore */
import { expect } from 'chai'
import * as sinon from 'sinon'
import * as amqplib from 'amqplib'
import Amqp from '../src/Amqp'
import { amqpConfigFixture, brokerConfigFixture } from './doubles'

let RED
let amqp

describe('Amqp Class', () => {
  beforeEach(function(done) {
    RED = {
      nodes: {
        getNode: sinon.stub().returns(brokerConfigFixture),
      },
    }
    amqp = new Amqp(RED, amqpConfigFixture)
    done()
  })

  afterEach(function(done) {
    sinon.restore()
    done()
  })

  it('connect()', async () => {
    const result = 'connected!'
    // @ts-ignore
    sinon.stub(amqplib, 'connect').resolves(result)
    const connection = await amqp.connect()
    expect(connection).to.eq(result)
  })

  it('createChannel()', async () => {
    const result = 'channel!'
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

  it('consume()', async () => {
    const queue = 'queueName'
    const consumeStub = sinon.stub()
    amqp.channel = { consume: consumeStub }
    amqp.q = { queue }

    await amqp.consume()
    expect(consumeStub.calledOnce).to.equal(true)
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
})
