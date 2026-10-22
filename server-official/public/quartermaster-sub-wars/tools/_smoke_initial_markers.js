/*
 * 回归：游戏初设额外计分标记（2026-10-23 玩家口径）
 *
 * 玩家要求：初设时 <中国东北> / <东欧> / <巴尔干> 各 +1 计分标记。
 *
 * 实现：init_markers() 在"每个初始补给点 2 个无主标记"之后，
 *       再给这三个地区各 push 1 个 { owner:null, faction:null, value:1 }。
 *
 * 口径说明（重要）：
 *   · 无主标记 = 任何占领该地的国家（任一阵营）都能拿，与该地 2 分补给点同款语义
 *   · 三地原本都不是初始补给点（0 个标记），加完为 1 个
 *   · 计分仍走 score_of_space：该地要有本国/本集团部队才结算
 *     -> 等于开局摆下的三处争夺点，开局无人得分，谁打进去谁拿
 *
 * 用法：node tools/_smoke_initial_markers.js
 */
const path = require('path')
const MOD = path.resolve(__dirname, '..')
const rules = require(path.join(MOD, 'rules.js'))
const I = rules._internal
const data = I.data

let fail = 0
const ok = (label, cond, extra) => {
	console.log((cond ? '  PASS  ' : '  FAIL  ') + label + (extra !== undefined ? '  | ' + extra : ''))
	if (!cond) fail++
}

const NAMES = ['中国东北', '东欧', '巴尔干']
const IDS = NAMES.map(n => data.id_of(n))

console.log('=== A. 三地各 +1 个无主标记 ===')
{
	const g = rules.setup(11, rules.default_scenario, {})
	NAMES.forEach((nm, i) => {
		const list = g.markers[IDS[i]] || []
		ok(nm + ' 标记数 = 1', list.length === 1, list.length)
		ok(nm + ' 标记无主（owner=null）', list.length === 1 && list[0].owner === null,
			list[0] && JSON.stringify(list[0]))
		ok(nm + ' 标记不属于任何阵营（faction=null）', list.length === 1 && list[0].faction === null)
		ok(nm + ' 标记值 = 1', list.length === 1 && list[0].value === 1)
	})
}

console.log('\n=== B. 三地都不是初始补给点（前提确认） ===')
{
	NAMES.forEach((nm, i) => {
		const sp = (data.spaces || []).find(x => x.id === IDS[i])
		ok(nm + ' 非初始补给点', !!sp && !sp.supply, sp ? String(!!sp.supply) : 'NOT FOUND')
	})
}

console.log('\n=== C. 初始补给点的 2 个标记不受影响 ===')
{
	const g = rules.setup(12, rules.default_scenario, {})
	const supSpaces = (data.spaces || []).filter(x => x && x.supply)
	ok('存在初始补给点', supSpaces.length > 0, supSpaces.length + ' 个')
	let bad = []
	for (const sp of supSpaces) {
		const list = g.markers[sp.id] || []
		if (list.length !== 2) bad.push(data.name_of(sp.id) + '=' + list.length)
	}
	ok('所有初始补给点仍是 2 个标记', bad.length === 0, bad.join(' , '))
}

console.log('\n=== D. 计分口径：需有部队才算，敌军也能拿 ===')
{
	const g = rules.setup(13, rules.default_scenario, {})
	const EE = data.id_of('东欧')

	/* 无部队 -> 0 分 */
	const none = I.score_of_space(g, EE, '苏联', [])
	ok('东欧无部队 -> 苏联得 0 分', none.gained === 0, none.gained)

	/* 苏联陆军 -> 苏联 1 分 */
	const p1 = I.new_piece_id(g)
	g.location[p1] = EE; g.piece_nation[p1] = '苏联'; g.piece_type[p1] = 'army'
	const su = I.score_of_space(g, EE, '苏联', [p1])
	ok('东欧有苏联陆军 -> 苏联得 1 分', su.gained === 1, su.gained)
	ok('同一局面德国得 0 分', I.score_of_space(g, EE, '德国', [p1]).gained === 0)

	/* 德国陆军占领 -> 德国 1 分（无主标记谁占谁拿） */
	const p2 = I.new_piece_id(g)
	g.location[p2] = EE; g.piece_nation[p2] = '德国'; g.piece_type[p2] = 'army'
	const de = I.score_of_space(g, EE, '德国', [p2])
	ok('东欧被德国陆军占领 -> 德国得 1 分（无主）', de.gained === 1, de.gained)
}

console.log('\n=== E. init_markers 幂等（重复调用结果一致） ===')
{
	const a = I.init_markers()
	const b = I.init_markers()
	ok('两次调用 JSON 一致', JSON.stringify(a) === JSON.stringify(b))
	ok('每次三地各 1 个（不会累加）',
		IDS.every(id => (b[id] || []).length === 1),
		IDS.map(id => (b[id] || []).length).join(','))
}

console.log('\n=== F. 老对局惰性迁移不覆盖已有 markers ===')
{
	const g = rules.setup(14, rules.default_scenario, {})
	/* 模拟老对局：markers 已存在（哪怕是空对象），ensure_markers 不应重播种 */
	g.markers = {}
	I.ensure_markers(g)
	ok('已有 markers 对象时不重新播种', Object.keys(g.markers).length === 0,
		Object.keys(g.markers).length)
}

console.log('\n----------------------------------------')
if (fail) {
	console.log('SOME ' + fail + ' FAILED')
	process.exit(1)
}
console.log('ALL PASS')
