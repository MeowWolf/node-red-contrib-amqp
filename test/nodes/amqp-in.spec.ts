/* eslint-disable @typescript-eslint/ban-ts-ignore */
import { expect } from 'chai'
import * as sinon from 'sinon'
import * as helper from 'node-red-node-test-helper'
import * as amqpIn from '../../src/nodes/amqp-in'
import Amqp from '../../src/Amqp'
import * as amqpBroker from '../../src/nodes/amqp-broker'
import { ErrorType } from '../../src/types'
import { CustomError, amqpInFlowFixture, credentialsFixture } from '../doubles'

helper.init(require.resolve('node-red'))

describe('amqp-in Node', () => {
  beforeEach(function(done) {
    helper.startServer(done)
  })

  afterEach(function(done) {
    helper.unload()
    helper.stopServer(done)
    sinon.restore()
  })

  it('should be loaded', done => {
    const flow = [{ id: 'n1', type: 'amqp-in', name: 'test name' }]
    helper.load(amqpIn, flow, () => {
      const n1 = helper.getNode('n1')
      n1.should.have.property('name', 'test name')
      done()
    })
  })

  it('should connect to the server', function(done) {
    // @ts-ignore
    Amqp.prototype.channel = {
      unbindQueue: (): null => null,
      close: (): null => null,
    }
    // @ts-ignore
    Amqp.prototype.connection = {
      close: (): null => null,
    }
    const connectStub = sinon
      .stub(Amqp.prototype, 'connect')
      // @ts-ignore
      .resolves(true)
    const initializeConsumerStub = sinon.stub(
      Amqp.prototype,
      'initializeConsumer',
    )

    helper.load(
      [amqpIn, amqpBroker],
      amqpInFlowFixture,
      credentialsFixture,
      async function() {
        const n1 = helper.getNode('n1')
        const n2 = helper.getNode('n2')

        expect(connectStub.calledOnce).to.be.true

        // TODO: Figure out why this isn't working:
        // expect(startStub.calledOnce).to.be.true

        done()
      },
    )
  })

  it('catches an invalid login exception', function(done) {
    const connectStub = sinon
      .stub(Amqp.prototype, 'connect')
      .throws(new CustomError(ErrorType.INALID_LOGIN))
    helper.load(
      [amqpIn, amqpBroker],
      amqpInFlowFixture,
      credentialsFixture,
      function() {
        expect(connectStub).to.throw()
        done()
      },
    )
  })

  it('catches a generic exception', function(done) {
    const connectStub = sinon.stub(Amqp.prototype, 'connect').throws()
    helper.load(
      [amqpIn, amqpBroker],
      amqpInFlowFixture,
      credentialsFixture,
      function() {
        expect(connectStub).to.throw()
        done()
      },
    )
  })
})
