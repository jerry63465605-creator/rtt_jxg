const path = require('path')
const MOD = path.join(__dirname, '..', 'server-official', 'public', 'quartermaster-sub-wars')
const d = require(path.join(MOD, 'data.js')).data
const R = require(path.join(MOD, 'rules.js'))
const I = R._internal

console.log('=== 海峡 ===')
console.log('数量 =', d.straits.length, '（规则书说 5 个）')
d.straits.forEach(s => console.log('  ', s.id, s.name, 'def=' + s.def, '连接', d.name_of(s.a), '<->', d.name_of(s.b)))

console.log('\n=== strait=true 的地块 ===')
d.spaces.forEach(sp => { if (sp && sp.strait) console.log('  ', sp.id, sp.name) })

console.log('\n=== 卡牌类型分布 ===')
const C = require(path.join(MOD, 'cards.js'))
const arr = C.CARDS || []
const by = {}
arr.forEach(c => { by[c.type] = (by[c.type] || 0) + 1 })
console.log(JSON.stringify(by), '总计', arr.length)

console.log('\n=== 各国卡牌数 ===')
const byNat = {}
arr.forEach(c => { const n = c.nation || '?'; byNat[n] = (byNat[n] || 0) + 1 })
console.log(JSON.stringify(byNat))

console.log('\n=== 已实现效果的卡（BASIC） ===')
arr.filter(c => c.type === 'BASIC').forEach(c => console.log('  ', c.id, c.name))

console.log('\n=== 检查：棋子库存 ===')
const g = R.setup(1)
console.log('state 里是否有 piece_stock / reserve 之类:',
	Object.keys(g).filter(k => /stock|reserve|supply_pool|pool/i.test(k)).join(',') || '无')

console.log('\n=== 检查：前奏/紧张度 ===')
console.log(Object.keys(g).filter(k => /intro|prelude|tension|紧张|前奏/i.test(k)).join(',') || '无')

console.log('\n=== 检查：purge_basic_cards 第6回合 ===')
console.log('存在:', typeof I.purge_basic_cards === 'function')
