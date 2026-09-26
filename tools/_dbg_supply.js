const path = require('path')
const M = path.resolve('server-official/public/quartermaster-sub-wars')
const d = require(path.join(M, 'data.js')).data
const r = require(path.join(M, 'rules.js'))
const I = r._internal

const sp = d.spaces.find(s => s && s.name === '澳大利亚')
console.log('澳大利亚:', JSON.stringify({star: sp.star, home_base: sp.home_base, supply: sp.supply}))

/* 复现：15346 离场后 fr_far 仍 in_supply */
let g = r.setup(1)
g.current_nation = '英国'
g.active = 'Allies'
g.turn_phase = 'play'
g.play_done = {}
g.hands['英国'].push('15346#1')
g = r.action(g, 'Allies', 'play_card', { card: '15346#1' })
I.compute_supply(g)

/* 放法国陆军在澳大利亚 */
g.location['fr_far'] = d.id_of('澳大利亚')
g.piece_nation['fr_far'] = '法国'
g.piece_type['fr_far'] = 'army'
let s1 = I.compute_supply(g)
console.log('before revert: fr_far in_supply=', !!s1.in_supply['fr_far'], 'src=', s1.sources['fr_far'])

I.revert_status_ongoing(g, '15346#1', '英国')
console.log('aura after:', JSON.stringify(g.status_aura))
let s2 = I.compute_supply(g)
console.log('after revert: fr_far in_supply=', !!s2.in_supply['fr_far'], 'src=', s2.sources['fr_far'])

/* 看是否澳大利亚本身被算成补给点（法国在澳大利亚、澳大利亚是★？） */
console.log('is_supply_point(澳大利亚, allies):',
	I.is_supply_point ? I.is_supply_point(g, d.id_of('澳大利亚'), 'allies') : 'no fn')
