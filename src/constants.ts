import { NodeStatus } from 'node-red'

export const NODE_STATUS: { [index: string]: NodeStatus } = Object.freeze({
  Disconnected: { fill: 'grey', shape: 'ring', text: 'disconnected' },
  Connected: { fill: 'green', shape: 'dot', text: 'connected' },
  Error: { fill: 'red', shape: 'dot', text: 'error' },
})
