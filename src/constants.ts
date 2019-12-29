import { NodeStatus } from 'node-red'

export const NODE_STATUS: { [index: string]: NodeStatus } = Object.freeze({
  Connected: { fill: 'green', shape: 'dot', text: 'Connected' },
  Disconnected: { fill: 'grey', shape: 'ring', text: 'Disconnected' },
  Error: { fill: 'red', shape: 'dot', text: 'Error' },
  Invalid: { fill: 'red', shape: 'ring', text: 'Unable to connect' },
})
