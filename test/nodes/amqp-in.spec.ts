/* eslint-disable @typescript-eslint/ban-ts-comment */
import { expect } from 'chai'
import * as sinon from 'sinon'
import * as helper from 'node-red-node-test-helper'
import * as amqpIn from '../../src/nodes/amqp-in'
import Amqp from '../../src/Amqp'
import * as amqpBroker from '../../src/nodes/amqp-broker'
import { ErrorType, NodeType } from '../../src/types'
import { CustomError, amqpInFlowFixture, credentialsFixture } from '../doubles'

helper.init(require.resolve('node-red'))

describe('amqp-in Node', () => {
  beforeEach(function (done) {
    helper.startServer(done)
  })

  afterEach(function (done) {
    helper.unload()
    helper.stopServer(done)
    sinon.restore()
  })

  it('should be loaded', (done) => {
    const flow = [{ id: 'n1', type: NodeType.AMQP_IN, name: 'test name' }]
    helper.load(amqpIn, flow, () => {
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
      [amqpIn, amqpBroker],
      amqpInFlowFixture,
      credentialsFixture,
      async function () {
        expect(connectStub.calledOnce).to.be.true

        // TODO: Figure out why this isn't working:
        // expect(initializeStub.calledOnce).to.be.true

        const amqpInNode = helper.getNode('n1')
        amqpInNode.close()
        done()
      },
    )
  })

  it('catches an invalid login exception', function (done) {
    const connectStub = sinon
      .stub(Amqp.prototype, 'connect')
      .throws(new CustomError(ErrorType.INALID_LOGIN))
    helper.load(
      [amqpIn, amqpBroker],
      amqpInFlowFixture,
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
      [amqpIn, amqpBroker],
      amqpInFlowFixture,
      credentialsFixture,
      function () {
        expect(connectStub).to.throw()
        done()
      },
    )
  })
})
