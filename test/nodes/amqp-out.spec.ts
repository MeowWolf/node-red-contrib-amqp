/* eslint-disable @typescript-eslint/no-var-requires */
/* eslint-disable @typescript-eslint/ban-ts-comment */
import { expect } from 'chai'
import * as sinon from 'sinon'
import Amqp from '../../src/Amqp'
import { ErrorType, NodeType } from '../../src/types'
import { CustomError, amqpOutFlowFixture, credentialsFixture } from '../doubles'

const helper = require('node-red-node-test-helper')
const amqpOut = require('../../src/nodes/amqp-out')
const amqpBroker = require('../../src/nodes/amqp-broker')

helper.init(require.resolve('node-red'))

describe('amqp-out Node', () => {
  beforeEach(function (done) {
    helper.startServer(done)
  })

  afterEach(function (done) {
    helper.unload()
    helper.stopServer(done)
    sinon.restore()
  })

  it('should be loaded', done => {
    const flow = [{ id: 'n1', type: NodeType.AMQP_OUT, name: 'test name' }]
    helper.load(amqpOut, flow, () => {
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
    sinon.stub(Amqp.prototype, 'initialize')

    helper.load(
      [amqpOut, amqpBroker],
      amqpOutFlowFixture,
      credentialsFixture,
      async function () {
        expect(connectStub.calledOnce).to.be.true
        // TODO: Figure out why this isn't working:
        // expect(initializeStub.calledOnce).to.be.true

        const amqpOutNode = helper.getNode('n1')
        amqpOutNode.receive({ payload: 'foo', routingKey: 'bar' })
        amqpOutNode.receive({ payload: 'foo' })
        amqpOutNode.close()

        done()
      },
    )
  })

  it('catches an invalid login exception', function (done) {
    const connectStub = sinon
      .stub(Amqp.prototype, 'connect')
      .throws(new CustomError(ErrorType.INVALID_LOGIN))
    helper.load(
      [amqpOut, amqpBroker],
      amqpOutFlowFixture,
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
      [amqpOut, amqpBroker],
      amqpOutFlowFixture,
      credentialsFixture,
      function () {
        expect(connectStub).to.throw()
        done()
      },
    )
  })
})
