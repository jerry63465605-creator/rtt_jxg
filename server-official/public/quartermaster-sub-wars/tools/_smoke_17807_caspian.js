/*
 * 回归：17807《里海舰队》候选地区（2026-10-23）
 *
 * 卡面：计分阶段开始时：在<里海>相邻地区征召 1 支陆军。
 *
 * 原配置写死 `space_ids_of(['中亚','中东'])`，但里海几何相邻的陆地实际有 3 个：
 *   中亚(10) / 中东(16) / **乌克兰(45)**  —— 漏了乌克兰，
 *   表现为"卡面说相邻地区，乌克兰却不给选"。
 *
 * 现改为 spacesFn 动态算（get_connections 阵营视角 + 地形过滤），
 * 后续由 event_cands_filter 按 can_recruit_at 过滤空位。
 *
 * 用法：node tools/_smoke_17807_caspian.js
 */
const path = require('path')
const fs = require('fs')
const MOD = path.resolve(__dirname, '..')
const rules = require(path.join(MOD, 'rules.js'))
const I = rules._internal
const data = I.data

const SRC = fs.readFileSync(path.join(MOD, 'rules.js'), 'utf8')

let fail = 0
const ok = (label, cond, extra) => {
	console.log((cond ? '  PASS  ' : '  FAIL  ') + label + (extra !== undefined ? '  | ' + extra : ''))
	if (!cond) fail++
}

const CAS = data.id_of('里海')
const terrainOf = id => (data.spaces[id] || {}).terrain
const LAND_NBS = (data.spaces[CAS].connections || []).filter(id => terrainOf(id) === 'land')
const UK = data.id_of('乌克兰')

function mk() {
	const g = rules.setup(1, rules.default_scenario, {})
	g.opening = null
	g.neutral = g.neutral || {}
	g.neutral['苏联'] = false
	g.log.length = 0
	return g
}

console.log('=== A. 里海相邻陆地（前提） ===')
{
	ok('里海存在且是海域', CAS != null && terrainOf(CAS) === 'sea', CAS + '/' + terrainOf(CAS))
	ok('相邻陆地恰好 3 个（含乌克兰）', LAND_NBS.length === 3,
		LAND_NBS.map(id => data.name_of(id)).join(' , '))
	ok('其中包含乌克兰', LAND_NBS.indexOf(UK) >= 0)
}

console.log('\n=== B. 配置改为动态（不再写死） ===')
{
	const cfg = I.ECHO_EFFECTS['17807']
	ok('steps[0] 有 spacesFn', typeof (cfg.steps[0] || {}).spacesFn === 'function')
	ok('steps[0] 不再有固定 spaces', !cfg.steps[0].spaces)
	ok('源码里已无写死的 中亚+中东 列表',
		!/space_ids_of\(\['中亚', '中东'\]\)/.test(SRC))

	const got = cfg.steps[0].spacesFn(mk(), '苏联')
	ok('spacesFn 返回 = 里海相邻陆地',
		JSON.stringify(got.slice().sort()) === JSON.stringify(LAND_NBS.slice().sort()),
		got.map(id => data.name_of(id)).join(' , '))
	ok('返回值中【含乌克兰】', got.indexOf(UK) >= 0)
}

console.log('\n=== C. 完整链路：event_card_needs 的候选 ===')
{
	const g = mk()
	const needs = I.event_card_needs(g, '苏联', '17807#1', {})
	ok('need = space', needs && needs.need === 'space', needs && needs.need)
	ok('候选 3 个', (needs.candidates || []).length === 3, JSON.stringify(needs.candidates))
	ok('候选中含乌克兰', (needs.candidates || []).indexOf(UK) >= 0, JSON.stringify(needs.candidates))
}

console.log('\n=== D. 已被占用的地区自动剔除 ===')
{
	const g = mk()
	const pid = I.new_piece_id(g)
	g.location[pid] = UK; g.piece_nation[pid] = '苏联'; g.piece_type[pid] = 'army'
	const needs = I.event_card_needs(g, '苏联', '17807#1', {})
	ok('乌克兰已有苏军 -> 从候选剔除',
		(needs.candidates || []).indexOf(UK) < 0, JSON.stringify(needs.candidates))
	ok('其余 2 个仍在', (needs.candidates || []).length === 2, JSON.stringify(needs.candidates))
}

console.log('\n=== E. 敌方占领时也不可征召 ===')
{
	const g = mk()
	const pid = I.new_piece_id(g)
	g.location[pid] = UK; g.piece_nation[pid] = '德国'; g.piece_type[pid] = 'army'
	const needs = I.event_card_needs(g, '苏联', '17807#1', {})
	ok('乌克兰有德军 -> 也不在候选', (needs.candidates || []).indexOf(UK) < 0,
		JSON.stringify(needs.candidates))
}

console.log('\n=== F. 全部被占时不出候选（need 退化为 null） ===')
{
	const g = mk()
	for (const sp of LAND_NBS) {
		const pid = I.new_piece_id(g)
		g.location[pid] = sp; g.piece_nation[pid] = '德国'; g.piece_type[pid] = 'army'
	}
	const needs = I.event_card_needs(g, '苏联', '17807#1', {})
	const noSpace = !needs || needs.need !== 'space' || !(needs.candidates || []).length
	ok('三地全占 -> 不再要求选地区', noSpace, JSON.stringify(needs))
}

console.log('\n----------------------------------------')
if (fail) {
	console.log('SOME ' + fail + ' FAILED')
	process.exit(1)
}
console.log('ALL PASS')
