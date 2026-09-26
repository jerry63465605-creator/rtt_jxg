const path = require('path')
const MOD = path.join(__dirname, '..', 'server-official', 'public', 'quartermaster-sub-wars')
const R = require(path.join(MOD, 'rules.js'))
const I = R._internal
const d = require(path.join(MOD, 'data.js')).data

const g = R.setup(1)
g.location = {}; g.piece_nation = {}; g.piece_type = {}; g.piece_seq = 0
g.supply_override = {}; g.supply_granted = {}; g.ongoing = {}
g.hands = {}; g.decks = {}; g.discard = {}
for (const n of ['英国', '法国', '德国']) { g.hands[n] = []; g.decks[n] = []; g.discard[n] = [] }

console.log('--- 南非/加拿大/新西兰 解析 ---')
for (const n of ['南非', '加拿大', '新西兰', '印度', '澳大利亚', '埃及']) {
	console.log(' ', n, '->', I.space_id_of(n), d.name_of(I.space_id_of(n)))
}
console.log('15305 spaces:', JSON.stringify(I.EVENT_EFFECTS['15305'].steps[0].spaces))

console.log('\n--- 15507 自由法国海军：build navy in 17 ---')
console.log('17 =', d.name_of(17), 'terrain=', d.spaces[17].terrain)
const chk = I.can_build_at(g, '法国', 17, 'navy')
console.log('can_build_at:', JSON.stringify(chk))
const r = I.resolve_event_card(g, '法国', '15307', { space: 17 })
console.log('resolve:', JSON.stringify(r))

console.log('\n--- 15309 need ---')
console.log(JSON.stringify(I.event_card_needs(g, '法国', '15309', {})))
console.log('15309 spaces:', JSON.stringify(I.EVENT_EFFECTS['15309'].steps[0].spaces))
console.log('can_build_at 西欧:', JSON.stringify(I.can_build_at(g, '法国', 6, 'army')))
console.log('can_build_at 非洲北部:', JSON.stringify(I.can_build_at(g, '法国', 15, 'army')))

console.log('\n--- 15322 choice 0: build navy (无 spaces) ---')
const cands = I.step_space_candidates(g, '法国', { op: 'build', type: 'navy' }, {})
console.log('candidates count:', cands.length, cands.slice(0, 5))
