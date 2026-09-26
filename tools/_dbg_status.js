const path = require('path')
const M = path.resolve('server-official/public/quartermaster-sub-wars')
const r = require(path.join(M, 'rules.js'))
const I = r._internal
const d = require(path.join(M, 'data.js')).data

let g = r.setup(1)
g.current_nation = '英国'
g.active = 'Allies'
g.turn_phase = 'play'
g.play_done = {}
g.hands['英国'].push('15346#1')
g = r.action(g, 'Allies', 'play_card', { card: '15346#1' })
console.log('aura:', JSON.stringify(g.status_aura))
console.log('table 英国:', JSON.stringify(g.table['英国']))
console.log('supply_immune[法国]:', g.status_aura.supply_immune['法国'])
