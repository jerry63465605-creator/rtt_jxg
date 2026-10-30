/*
 * 批次 A 回归：A1（battle 卡发起国限定） + A2（KV-2 保护范围 + piece 维度）
 *
 * A1：15431/15422/15435/15437/7902 只认【日本】发起的陆战
 * A2：has_modifier 的 piece 维度 + KV-2 保护的注册/撤销语义
 *
 * 用法：node tools/_smoke_a1a2.js
 */
const path = require('path')
const MOD = path.join(__dirname, '..', 'server-official', 'public', 'quartermaster-sub-wars')
const rules = require(path.join(MOD, 'rules.js'))
const I = rules._internal
const d = require(path.join(MOD, 'data.js')).data

let fails = 0
function ok(label, cond, extra) {
	console.log((cond ? '  PASS  ' : '  FAIL  ') + label + (extra !== undefined ? '  | ' + extra : ''))
	if (!cond) fails++
}

function fresh() {
	const g = rules.setup(1)
	g.opening = null
	g.turn = 2
	g.turn_phase = 'play'
	I.ensure_markers(g)
	g.table_responses = []
	return g
}

function facedown(g, face, nation, side) {
	g.table_responses = g.table_responses || []
	g.table_responses.push({
		card_id: face + '#1', owner_side: side, nation: nation,
	})
}

/* 返回 fire_trigger 命中的卡面 id 列表 */
function faces(g, on, ctx) {
	return (I.fire_trigger(g, on, ctx) || []).map(x => String(x.card_face))
}

console.log('=== A1：battle 型卡的发起国限定 ===')

const CHINA_NE = I.space_id_of('中国东北')
/* 美洲泛称经 space_ids_of 展开（REGION_GROUPS 只配了中国/太平洋/非洲） */
const AMERICA = (() => {
	try {
		const ids = (I.space_ids_of(['美洲']) || []).map(Number)
		for (const id of ids) if (d.spaces[id] && d.spaces[id].terrain === 'land') return id
		return ids[0] || null
	} catch (e) { return null }
})()
const SEA_SEA = I.space_id_of('东南亚')
const INDIA = I.space_id_of('印度')
const AUS = I.space_id_of('澳大利亚')

{
	const g = fresh()
	facedown(g, '15431', '日本', 'axis')
	const jp = faces(g, 'battle', { nation: '日本', space: CHINA_NE, kind: 'land' })
	const su = faces(g, 'battle', { nation: '苏联', space: CHINA_NE, kind: 'land' })
	ok('15431 日本在<中国东北>发起陆战 → 触发', jp.indexOf('15431') >= 0, jp.join(','))
	ok('15431 苏联在<中国东北>发起陆战 → 不触发', su.indexOf('15431') < 0, su.join(',') || '(空)')
}

/* 其余四张：只验"非日本不触发"（位置用各自地区组的代表格） */
const cases = [
	{ face: '15422', name: '太平洋海岸线攻势', space: AMERICA },
	{ face: '15435', name: '攻陷新加坡', space: SEA_SEA },
	{ face: '15437', name: '支援印度民族主义者', space: INDIA },
	{ face: '7902', name: '澳洲海岸线攻势', space: AUS },
]
for (const c of cases) {
	if (c.space == null) { console.log('  SKIP  ' + c.face + ' ' + c.name + '（地区 id 解析失败）'); continue }
	const g = fresh()
	facedown(g, c.face, '日本', 'axis')
	const jp = faces(g, 'battle', { nation: '日本', space: c.space, kind: 'land' })
	const other = faces(g, 'battle', { nation: '苏联', space: c.space, kind: 'land' })
	ok(c.face + ' ' + c.name + ' 日本发起 → 触发', jp.indexOf(c.face) >= 0, jp.join(','))
	ok(c.face + ' ' + c.name + ' 他国发起 → 不触发', other.indexOf(c.face) < 0, other.join(',') || '(空)')
}

/* 15430 奇袭（原本就正确）作为对照，防止误伤 */
{
	const sea = I.space_id_of('东海') || I.space_id_of('地中海')
	const g = fresh()
	facedown(g, '15430', '日本', 'axis')
	const jp = faces(g, 'battle', { nation: '日本', space: sea, kind: 'sea' })
	ok('15430 奇袭 仍能触发（回归）', jp.indexOf('15430') >= 0, jp.join(','))
}

console.log('\n=== A2：protect 的 piece 维度 ===')

{
	const g = fresh()
	const a = I.new_piece_id(g)
	const b = I.new_piece_id(g)
	const someLand = (() => {
		for (let i = 1; i < d.spaces.length; i++)
			if (d.spaces[i] && d.spaces[i].terrain === 'land') return i
		return null
	})()
	g.location[a] = someLand
	g.piece_nation[a] = '苏联'; g.piece_type[a] = 'army'
	g.location[b] = someLand
	g.piece_nation[b] = '苏联'; g.piece_type[b] = 'army'

	const mod = I.register_modifier(g, {
		key: 'protect', nation: '苏联', type: 'army',
		piece: a, spaces: [someLand], untilTurn: g.turn, card: '17837',
	})
	ok('带 piece 的 protect 保护目标部队', I.is_protected(g, a) === true)
	ok('带 piece 的 protect 不影响同地区另一支部队', I.is_protected(g, b) === false)

	/* 模拟"本次战斗结束后撤销" */
	g.modifiers = (g.modifiers || []).filter(m => m !== mod)
	ok('撤销后目标部队不再受保护', I.is_protected(g, a) === false)
}

{
	/* 不带 piece 的旧写法（17853 本回合）行为不变 */
	const g = fresh()
	const a = I.new_piece_id(g)
	const b = I.new_piece_id(g)
	const someLand = (() => {
		for (let i = 1; i < d.spaces.length; i++)
			if (d.spaces[i] && d.spaces[i].terrain === 'land') return i
		return null
	})()
	for (const p of [a, b]) {
		g.location[p] = someLand
		g.piece_nation[p] = '苏联'; g.piece_type[p] = 'army'
	}
	I.register_modifier(g, {
		key: 'protect', nation: '苏联', type: 'army',
		spaces: [someLand], untilTurn: g.turn, card: '17853',
	})
	ok('17853 无 piece 写法：同地区两支部队都受保护（回归）',
		I.is_protected(g, a) === true && I.is_protected(g, b) === true)
}

console.log('\n=== ' + (fails ? fails + ' 项失败' : '全部通过') + ' ===')
process.exit(fails ? 1 : 0)
