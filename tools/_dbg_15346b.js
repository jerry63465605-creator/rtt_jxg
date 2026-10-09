const path = require('path')
const M = path.resolve('server-official/public/quartermaster-sub-wars')
const r = require(M + '/rules.js')
const I = r._internal
let n = 0; function pid () { return 't' + (++n) }

const g = r.setup(2)
g.table['法国'] = ['15346']
g.neutral = { '美国': false }   // 测试用：让美国已参战，才能对轴心发起战斗
g.current_nation = '美国'; g.active = 'Allies'; g.turn_phase = 'play'; g.turn = 1
const ge = pid(); g.location[ge] = 44; g.piece_nation[ge] = '德国'; g.piece_type[ge] = 'army'
const ge2 = pid(); g.location[ge2] = 44; g.piece_nation[ge2] = '德国'; g.piece_type[ge2] = 'army'  // 第二支德军，供法国反击
const fr = pid(); g.location[fr] = 13; g.piece_nation[fr] = '法国'; g.piece_type[fr] = 'army'
I.set_supply_point(g, '法国', 13)
console.log('44 邻居 =', JSON.stringify(I.get_connections(g, 44, 'allies')), ' 13 邻居含44?', I.get_connections(g, 13, 'allies').indexOf(44) >= 0)
const us = pid(); g.location[us] = 6; g.piece_nation[us] = '美国'; g.piece_type[us] = 'army'
I.set_supply_point(g, '美国', 6)
I.compute_supply(g)

// 美国发起陆战（走真实 do_battle → arm_status_instant after_ally_battle）
const db = I.do_battle(g, '美国', 44, ge, 'land', {})
console.log('do_battle 完整返回 =', JSON.stringify(db))
console.log('sup 西欧(6) in_supply =', I.compute_supply(g).in_supply['6'], ' 美国army at6 =', g.location[us])
console.log('西欧(6) 邻居 =', JSON.stringify(I.get_connections(g, 6, 'allies')))

console.log('\n--- 美国回合点 15346（应成功反击 ge2）---')
const ng = r.action(g, 'Allies', 'activate_status', { card: '15346', from: fr, victim: ge2 })
console.log('status_instant after arm =', JSON.stringify(g.status_instant))
console.log('log 尾部 =', ng.log.slice(-3))
console.log('发动后 status_instant =', JSON.stringify(ng.status_instant))

console.log('\n--- 再点一次（窗口已焚，应被拒）---')
const ng2 = r.action(ng, 'Allies', 'activate_status', { card: '15346', from: fr, victim: ge })
console.log('log 尾部 =', ng2.log.slice(-2))

console.log('\n--- 无关动作（如 discard_one）是否焚窗 ---')
const g3 = r.setup(2); g3.table['法国'] = ['15346']
g3.neutral = { '美国': false }
g3.current_nation = '美国'; g3.active = 'Allies'; g3.turn_phase = 'play'; g3.turn = 1
const ge3 = pid(); g3.location[ge3] = 44; g3.piece_nation[ge3] = '德国'; g3.piece_type[ge3] = 'army'
const fr3 = pid(); g3.location[fr3] = 6; g3.piece_nation[fr3] = '法国'; g3.piece_type[fr3] = 'army'
I.set_supply_point(g3, '法国', 6); I.compute_supply(g3)
I.do_battle(g3, '美国', 44, ge3, 'land', {})
console.log('武装后 status_instant =', JSON.stringify(g3.status_instant))
const ng3 = r.action(g3, 'Allies', 'discard_one', { card: 'x' })
console.log('discard_one 后 status_instant =', JSON.stringify(ng3.status_instant))
