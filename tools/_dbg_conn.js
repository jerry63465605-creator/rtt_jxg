const path = require('path')
const DIR = path.join(__dirname, '..', 'server-official', 'public', 'quartermaster-sub-wars')
const rules = require(path.join(DIR, 'rules.js'))
const { data } = require(path.join(DIR, 'data.js'))
const { compute_connections } = rules._internal

const g = rules.setup(20260922, 'Standard', {})
console.log('data.spaces type:', Array.isArray(data.spaces), 'len:', data.spaces.length)
console.log('sample space[1]:', JSON.stringify(data.spaces[1]))
const c = compute_connections(g)
console.log('allies keys len:', Object.keys(c.allies).length)
console.log('allies[1]:', JSON.stringify(c.allies[1]))
let landCount = data.spaces.filter(s => s && s.type === 'land').length
console.log('land count:', landCount)
// 打印第一个有 neighbors 的陆地
for (const sp of data.spaces) {
  if (!sp || sp.type !== 'land') continue
  const nb = c.allies[sp.id] || c.axis[sp.id]
  if (nb && nb.length) { console.log('first land with nbr:', sp.id, sp.name, '->', JSON.stringify(nb)); break }
}
