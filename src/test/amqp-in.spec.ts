// const helper = require('node-red-node-test-helper')
import * as helper from 'node-red-node-test-helper'
import * as amqpIn from '../nodes/amqp-in'

describe('amqp-in Node', function() {
  afterEach(function() {
    helper.unload()
  })

  it('should be loaded', function(done) {
    const flow = [{ id: 'n1', type: 'amqp-in', name: 'test name' }]
    helper.load(amqpIn, flow, function() {
      const n1 = helper.getNode('n1')
      n1.should.have.property('name', 'test name')
      done()
    })
  })

  // it('should make payload lower case', function(done) {
  //   const flow = [
  //     { id: 'n1', type: 'lower-case', name: 'test name', wires: [['n2']] },
  //     { id: 'n2', type: 'helper' },
  //   ]
  //   helper.load(lowerNode, flow, function() {
  //     const n2 = helper.getNode('n2')
  //     const n1 = helper.getNode('n1')
  //     n2.on('input', function(msg) {
  //       msg.should.have.property('payload', 'uppercase')
  //       done()
  //     })
  //     n1.receive({ payload: 'UpperCase' })
  //   })
  // })
})
