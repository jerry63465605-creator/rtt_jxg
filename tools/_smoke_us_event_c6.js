/* 17531 现购自运政策 —— 美国结束中立（若中立），为友方英/苏/中/法在其本土或相邻征召1支合法部队（选国→选地区→选兵种） */
const path = require('path')
const rules = require(path.join(__dirname, '..', 'server-official', 'public', 'quartermaster-sub-wars', 'rules.js'))
const I = rules._internal

let pass = 0, fail = 0
function ok(name, cond, extra) {
	if (cond) { pass++; console.log('  ✓ ' + name) }
	else { fail++; console.log('  ✗ ' + name + (extra ? '  ' + extra : '')) }
}
function countType(g, n, t) { let c = 0; for (const k of Object.keys(g.location)) if (g.piece_nation[k] === n && g.piece_type[k] === t) c++; return c }
function newGame() {
	const g = rules.setup(1)
	g.current_nation = '美国'; g.active = 'Allies'; g.turn_phase = 'play'
	g.neutral = g.neutral || {}
	return g
}
function pickTarget(g, nation, wantType) {
	const tgs = I.us_merchant_targets(g, nation)
	for (const t of tgs) if (t.types.indexOf(wantType) >= 0) return t
	return null
}

console.log('\n[17531] 现购自运政策（多兵种）')
const g = newGame()
I.offer_us_merchant(g)
ok('offer 进入 us_merchant', !!g.us_merchant)
ok('美国结束中立', g.neutral && g.neutral['美国'] === false)

// 非法选国（德国不可）
const b = JSON.stringify(g.us_merchant)
I.resolve_us_merchant_select(g, { nation: '德国' })
ok('非法选国被拒绝', JSON.stringify(g.us_merchant) === b)

// 选苏联（本土或相邻陆地可征召陆军）
I.resolve_us_merchant_select(g, { nation: '苏联' })
ok('选苏联成功', g.us_merchant.nation === '苏联')
ok('未翻转 active（美国直接操作）', g.active === 'Allies' && g.current_nation === '美国')

const suTgt = pickTarget(g, '苏联', 'army')
ok('苏联候选征召点非空', !!suTgt, 'tgs=' + JSON.stringify(I.us_merchant_targets(g, '苏联').slice(0, 3)))
const a0 = countType(g, '苏联', 'army')
I.resolve_us_merchant_build(g, { space: suTgt.id })
ok('记录征召地区成功', g.us_merchant.space === suTgt.id)
const types0 = I.us_merchant_types(g, '苏联', suTgt.id).map(t => t.type)
ok('苏联该地区含陆军兵种', types0.indexOf('army') >= 0)
I.resolve_us_merchant_type(g, { type: 'army' })
ok('苏联 +1 陆军（美国代理征召）', countType(g, '苏联', 'army') === a0 + 1)
ok('us_merchant 清除', !g.us_merchant)

// 英国：相邻海域可征召海军/空军（之前误判为"候选为空"）
const g2 = newGame()
I.offer_us_merchant(g2)
I.resolve_us_merchant_select(g2, { nation: '英国' })
const ukTgts = I.us_merchant_targets(g2, '英国')
ok('英国候选征召点非空（相邻水域可征召海军/空军）', ukTgts.length > 0, 'tgs=' + JSON.stringify(ukTgts.slice(0, 4)))
const ukSea = ukTgts.find(t => t.types.indexOf('navy') >= 0)
ok('英国存在可征召海军的相邻海域', !!ukSea, JSON.stringify(ukTgts))
if (ukSea) {
	const n0 = countType(g2, '英国', 'navy')
	I.resolve_us_merchant_build(g2, { space: ukSea.id })
	ok('英国记录征召地区成功', g2.us_merchant.space === ukSea.id)
	const ukTypes = I.us_merchant_types(g2, '英国', ukSea.id).map(t => t.type)
	ok('该海域含海军兵种', ukTypes.indexOf('navy') >= 0)
	I.resolve_us_merchant_type(g2, { type: 'navy' })
	ok('英国 +1 海军（美国代理征召）', countType(g2, '英国', 'navy') === n0 + 1)
	ok('us_merchant 清除', !g2.us_merchant)
}

// 法国：相邻海域可征召（与英国同理，非"数据特性为空"）
const g3 = newGame()
I.offer_us_merchant(g3)
I.resolve_us_merchant_select(g3, { nation: '法国' })
const frTgts = I.us_merchant_targets(g3, '法国')
ok('法国候选征召点非空', frTgts.length > 0, 'tgs=' + JSON.stringify(frTgts.slice(0, 4)))

// 非法兵种拒绝（选了该地区不支持的兵种）
const g4 = newGame()
I.offer_us_merchant(g4)
I.resolve_us_merchant_select(g4, { nation: '苏联' })
const suTgt2 = pickTarget(g4, '苏联', 'army')
I.resolve_us_merchant_build(g4, { space: suTgt2.id })
const a0b = countType(g4, '苏联', 'army')
I.resolve_us_merchant_type(g4, { type: 'navy' }) // 苏联陆地无海军
ok('非法兵种被拒绝（苏联陆军点不能征召海军）', countType(g4, '苏联', 'army') === a0b && !!g4.us_merchant)

// 非法地点被拒绝（不在候选集）
const g5 = newGame()
I.offer_us_merchant(g5)
I.resolve_us_merchant_select(g5, { nation: '苏联' })
let bad = null
for (let i = 1; i < I.data.spaces.length; i++) {
	if (!I.us_merchant_targets(g5, '苏联').some(t => t.id === i)) { bad = i; break }
}
const a5 = countType(g5, '苏联', 'army')
I.resolve_us_merchant_build(g5, { space: bad })
ok('非法地点被拒绝（苏联陆军不变）', countType(g5, '苏联', 'army') === a5 && g5.us_merchant.space == null)

console.log('\n结果: ' + pass + ' 通过, ' + fail + ' 失败')
process.exit(fail ? 1 : 0)
