import { NodeStatus } from 'node-red'

export const NODE_STATUS: { [index: string]: NodeStatus } = Object.freeze({
  Connected: { fill: 'green', shape: 'dot', text: 'connected' },
  Disconnected: { fill: 'grey', shape: 'ring', text: 'disconnected' },
  Error: { fill: 'red', shape: 'dot', text: 'error' },
  Invalid: { fill: 'red', shape: 'ring', text: 'could not connect' },
})
