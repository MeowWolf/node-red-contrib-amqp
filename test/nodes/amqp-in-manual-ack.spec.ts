/* eslint-disable @typescript-eslint/no-var-requires */
/* eslint-disable @typescript-eslint/ban-ts-comment */
import { expect } from 'chai'
import * as sinon from 'sinon'
import Amqp from '../../src/Amqp'
import { ErrorType, ManualAckType, NodeType } from '../../src/types'
import {
  CustomError,
  amqpInManualAckFlowFixture,
  credentialsFixture,
} from '../doubles'
const helper = require('node-red-node-test-helper')
const amqpInManualAck = require('../../src/nodes/amqp-in-manual-ack')
const amqpBroker = require('../../src/nodes/amqp-broker')

helper.init(require.resolve('node-red'))

describe('amqp-in-manual-ack Node', () => {
  beforeEach(function (done) {
    helper.startServer(done)
  })

  afterEach(function (done) {
    helper.unload()
    helper.stopServer(done)
    sinon.restore()
  })

  it('should be loaded', done => {
    sinon.stub(Amqp.prototype, 'connect')
    const flow = [
      { id: 'n1', type: NodeType.AmqpInManualAck, name: 'test name' },
    ]
    helper.load(amqpInManualAck, flow, () => {
      const n1 = helper.getNode('n1')
      n1.should.have.property('name', 'test name')
      done()
    })
  })

  it('should connect to the server', function (done) {
    // @ts-ignore
    Amqp.prototype.channel = {
      unbindQueue: (): null => null,
      close: (): null => null,
      ack: (): null => null,
    }
    // @ts-ignore
    Amqp.prototype.connection = {
      close: (): null => null,
    }
    const connectStub = sinon
      .stub(Amqp.prototype, 'connect')
      // @ts-ignore
      .resolves(true)
    const initializeStub = sinon.stub(Amqp.prototype, 'initialize')

    helper.load(
      [amqpInManualAck, amqpBroker],
      amqpInManualAckFlowFixture,
      credentialsFixture,
      async function () {
        expect(connectStub.calledOnce).to.be.true

        // FIXME: Figure out why this isn't working:
        // expect(initializeStub.calledOnce).to.be.true

        const amqpInManualAckNode = helper.getNode('n1')

        // FIXME: these tests are essentially meaningless.
        // For some reason the node is not being properly loaded by the helper
        // They are not executing code
        amqpInManualAckNode.receive({ payload: 'foo', routingKey: 'bar' })
        amqpInManualAckNode.receive({
          payload: 'foo',
          routingKey: 'bar',
          manualAck: {
            ackMode: ManualAckType.Ack,
          },
        })
        amqpInManualAckNode.receive({
          payload: 'foo',
          routingKey: 'bar',
          manualAck: {
            ackMode: ManualAckType.AckAll,
          },
        })
        amqpInManualAckNode.receive({
          payload: 'foo',
          routingKey: 'bar',
          manualAck: {
            ackMode: ManualAckType.Nack,
          },
        })
        amqpInManualAckNode.receive({
          payload: 'foo',
          routingKey: 'bar',
          manualAck: {
            ackMode: ManualAckType.NackAll,
          },
        })
        amqpInManualAckNode.receive({
          payload: 'foo',
          routingKey: 'bar',
          manualAck: {
            ackMode: ManualAckType.Reject,
          },
        })
        amqpInManualAckNode.on('input', () => {
          console.warn('this is input?')
          done()
        })
        amqpInManualAckNode.close(true)
        done()
      },
    )
  })

  it('tries to connect but the broker is down', function (done) {
    const connectStub = sinon
      .stub(Amqp.prototype, 'connect')
      .throws(new CustomError(ErrorType.ConnectionRefused))
    helper.load(
      [amqpInManualAck, amqpBroker],
      amqpInManualAckFlowFixture,
      credentialsFixture,
      function () {
        expect(connectStub).to.throw()
        done()
      },
    )
  })

  it('catches an invalid login exception', function (done) {
    const connectStub = sinon
      .stub(Amqp.prototype, 'connect')
      .throws(new CustomError(ErrorType.InvalidLogin))
    helper.load(
      [amqpInManualAck, amqpBroker],
      amqpInManualAckFlowFixture,
      credentialsFixture,
      function () {
        expect(connectStub).to.throw()
        done()
      },
    )
  })

  it('catches a generic exception', function (done) {
    const connectStub = sinon.stub(Amqp.prototype, 'connect').throws()
    helper.load(
      [amqpInManualAck, amqpBroker],
      amqpInManualAckFlowFixture,
      credentialsFixture,
      function () {
        expect(connectStub).to.throw()
        done()
      },
    )
  })
})
