/* eslint-disable @typescript-eslint/ban-ts-ignore */
import { expect } from 'chai'
import * as sinon from 'sinon'
import * as amqplib from 'amqplib'
import * as helper from 'node-red-node-test-helper'
import * as amqpIn from '../../src/nodes/amqp-in'
import * as amqpBroker from '../../src/nodes/amqp-broker'
import * as util from '../../src/util'

const flowFixture = [
  {
    id: 'n1',
    type: 'amqp-in',
    wires: [['n2']],
    name: '',
    broker: 'n3',
  },
  { id: 'n2', type: 'helper' },
  {
    id: 'n3',
    type: 'amqp-broker',
    z: '',
    host: 'localhost',
    port: '5672',
  },
]
const credentialsFixture = { username: 'username', password: 'password' }

helper.init(require.resolve('node-red'))
// let connectStub
const connectSpy = sinon.spy()

describe('amqp-in Node', () => {
  beforeEach(function(done) {
    helper.startServer(done)
    /* connectStub = */ sinon.stub(amqplib, 'connect').callsFake(connectSpy)

    // suppress console logging
    console.log = (): null => null
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
      flowFixture,
      credentialsFixture,
      function() {
        const n1 = helper.getNode('n1')
        const n2 = helper.getNode('n2')

        expect(connectSpy.calledOnce).to.be.true
        done()
      },
    )
  })

  it('catch an exception', function(done) {
    const brokerUrlStub = sinon.stub(util, 'getBrokerUrl').throws()
    helper.load(
      [amqpIn, amqpBroker],
      flowFixture,
      credentialsFixture,
      function() {
        const n1 = helper.getNode('n1')
        const n2 = helper.getNode('n2')

        expect(brokerUrlStub).to.throw()
        done()
      },
    )
  })
})
