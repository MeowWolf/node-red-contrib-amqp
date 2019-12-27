/* eslint-disable @typescript-eslint/ban-ts-ignore */
import { expect } from 'chai'
import * as sinon from 'sinon'
import * as amqplib from 'amqplib'
import * as helper from 'node-red-node-test-helper'
import * as amqpIn from '../../src/nodes/amqp-in'
import * as amqpBroker from '../../src/nodes/amqp-broker'
import * as util from '../../src/util'
import { ErrorType } from '../../src/types'
import { CustomError, amqpInFlowFixture } from '../doubles'

const credentialsFixture = { username: 'username', password: 'password' }

helper.init(require.resolve('node-red'))
// let connectStub
const connectStub = sinon.stub().returns(Promise.resolve(true))

describe('amqp-in Node', () => {
  beforeEach(function(done) {
    helper.startServer(done)
    /* connectStub = */ sinon.stub(amqplib, 'connect').callsFake(connectStub)
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

  it('should connect to server', function(done) {
    helper.load(
      [amqpIn, amqpBroker],
      amqpInFlowFixture,
      credentialsFixture,
      function() {
        const n1 = helper.getNode('n1')
        const n2 = helper.getNode('n2')

        expect(connectStub.calledOnce).to.be.true
        done()
      },
    )
  })

  it('catches an invalid login exception', function(done) {
    const brokerUrlStub = sinon
      .stub(util, 'getBrokerUrl')
      .throws(new CustomError(ErrorType.INALID_LOGIN))
    helper.load(
      [amqpIn, amqpBroker],
      amqpInFlowFixture,
      credentialsFixture,
      function() {
        expect(brokerUrlStub).to.throw()
        done()
      },
    )
  })

  it('catches a generic exception', function(done) {
    const brokerUrlStub = sinon.stub(util, 'getBrokerUrl').throws()
    helper.load(
      [amqpIn, amqpBroker],
      amqpInFlowFixture,
      credentialsFixture,
      function() {
        expect(brokerUrlStub).to.throw()
        done()
      },
    )
  })
})
