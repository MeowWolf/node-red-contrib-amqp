/* eslint-disable @typescript-eslint/no-var-requires */
/* eslint-disable @typescript-eslint/ban-ts-comment */
import { expect } from 'chai'
import * as sinon from 'sinon'
import Amqp from '../../src/Amqp'
import { ErrorType, NodeType } from '../../src/types'
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
    const flow = [
      { id: 'n1', type: NodeType.AMQP_IN_MANUAL_ACK, name: 'test name' },
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

        // TODO: Figure out why this isn't working:
        // expect(initializeStub.calledOnce).to.be.true

        const amqpInManualAckNode = helper.getNode('n1')
        // @ts-ignore
        amqpInManualAckNode.receive({ payload: 'foo', routingKey: 'bar' })
        amqpInManualAckNode.close(true)
        done()
      },
    )
  })

  it('catches an invalid login exception', function (done) {
    const connectStub = sinon
      .stub(Amqp.prototype, 'connect')
      .throws(new CustomError(ErrorType.INVALID_LOGIN))
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
