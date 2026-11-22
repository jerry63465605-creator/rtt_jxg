/*
 * 【本体 #5 / B49】17730《贝尔萨列里神射手团》只认【战斗移除】。
 *
 * 卡面：「<巴尔干>或相邻地区的意大利陆军被攻击时：使其在本次战斗中不会被移除」
 * 玩家报障（2026-11-22）：「意大利被『卡效果/移除』时，不应该触发神射手，bug 是此时也触发了」。
 *
 * 根因：`piece_removed` 的 ctx 早带 `reason`（'piece_removed' 战斗 / 'econ' 经济战 /
 * 'eliminate' 卡效果消灭 / 'supply' 补给移除），但 17730 的 filter 没有这一条。
 * 修法：filter 增加 `ct.reason === 'piece_removed'` 白名单。
 *
 * 用法：node tools/_real_test_B49_17730_battle_only.js
 */
const path = require('path')
const fs = require('fs')
const MOD = path.join(__dirname, '..', 'server-official', 'public', 'quartermaster-sub-wars')
const R = require(path.join(MOD, 'rules.js'))
const I = R._internal
const D = require(path.join(MOD, 'data.js')).data
const J = x => JSON.stringify(x)
const BALK = D.id_of('巴尔干')
const EAST = D.id_of('东欧')
const WEST = D.id_of('西欧')

let pass = 0, fail = 0
const ok = (m, c, extra) => {
	if (c) { pass++; console.log('  ✓ ' + m) }
	else { fail++; console.log('  ✗ ' + m + (extra !== undefined ? '  | ' + extra : '')) }
}

/* 通用：开局 → 清棋盘 → 放一支意大利陆军在 space → 把 17730 暗置到意大利桌面 */
function seed(space = BALK, opts = {}) {
	const g = R.setup(20261112, 'Standard')
	let q = 0
	while (g.opening && q++ < 15) {
		const n = g.current_nation
		R.action(g, g.active, 'opening_discard', { cards: (g.hands[n] || []).slice(0, 3) })
	}
	g.location = {}; g.piece_nation = {}; g.piece_type = {}
	const nat = opts.nation || '意大利'
	const type = opts.type || 'army'
	g.location.it1 = space
	g.piece_nation.it1 = nat
	g.piece_type.it1 = type
	I.grant_supply(g, 'it1', g.turn || 1)
	I.compute_supply(g)
	g.table_responses = [{
		card_id: '17730#r1', card_face: '17730',
		owner_side: 'axis', name: '贝尔萨列里神射手团',
	}]
	return g
}
const hit17730 = g => (g.response_queue || []).some(e =>
	(e.candidates || []).some(c => String(c.card_face) === '17730'))

console.log('=== A. filter 单元级：只有战斗（piece_removed）命中 ===')
{
	const rows = [
		['piece_removed（战斗）', 'piece_removed', 1],
		['econ（经济战）', 'econ', 0],
		['eliminate（卡效果消灭）', 'eliminate', 0],
		['supply（补给移除）', 'supply', 0],
		['undefined（未标来源，防御性）', undefined, 0],
	]
	for (const [label, reason, exp] of rows) {
		const g = seed()
		const r = I.fire_trigger(g, 'piece_removed', {
			piece_nation: '意大利', piece_type: 'army', space: BALK, reason,
		})
		const n = (r && r.length) || 0
		ok('★ reason=' + label + ' -> 命中 ' + exp, n === exp, J({ got: n }))
	}
}

console.log('\n=== B. 真实战斗：英国陆军从<东欧>打<巴尔干>意大利陆军 -> 触发 ===')
{
	const g = seed()
	g.location.uk1 = EAST
	g.piece_nation.uk1 = '英国'
	g.piece_type.uk1 = 'army'
	I.grant_supply(g, 'uk1', g.turn || 1)
	I.compute_supply(g)
	const r = I.do_battle(g, '英国', BALK, 'it1', 'land')
	ok('★★ 战斗成功移除意大利陆军', r.ok === true && !g.location.it1, J(r))
	ok('★★ 战斗移除后 response_queue 出现 17730（可发动）',
		hit17730(g), J((g.response_queue || []).map(e => (e.candidates || []).map(c => c.card_face))))
}

console.log('\n=== C. 真实经济战移除 -> 不触发 ===')
{
	const g = seed()
	const r = I.econ_remove_piece(g, BALK, 'it1')
	ok('★ 经济战确实移除了陆军', !!(r && r.ok) && !g.location.it1, J(r))
	ok('★★ 经济战移除后不出现 17730',
		!hit17730(g) && (g.response_queue || []).length === 0,
		J(g.response_queue))
}

console.log('\n=== D. 真实卡效果消灭（eliminate_piece）-> 不触发 ===')
{
	const g = seed()
	/* 执行方传对立阵营（英国视角消灭意大利陆军 = 卡效果消灭的典型场景） */
	const r = I.eliminate_piece(g, '英国', BALK, 'it1', { type: 'army' })
	ok('★ 卡效果确实消灭了陆军', !!(r && r.ok) && !g.location.it1, J(r))
	ok('★★ 卡效果消灭后不出现 17730',
		!hit17730(g) && (g.response_queue || []).length === 0,
		J(g.response_queue))
}

console.log('\n=== E. 原有判据不回归（空间 / 国别 / 兵种）===')
{
	const g1 = seed(WEST)
	const r1 = I.fire_trigger(g1, 'piece_removed', {
		piece_nation: '意大利', piece_type: 'army', space: WEST, reason: 'piece_removed',
	})
	ok('★★ <西欧>（非巴尔干或相邻）战斗移除 -> 不触发', !r1 || r1.length === 0, J(r1 && r1.length))

	const g2 = seed(BALK, { nation: '德国' })
	const r2 = I.fire_trigger(g2, 'piece_removed', {
		piece_nation: '德国', piece_type: 'army', space: BALK, reason: 'piece_removed',
	})
	ok('★★ 德国陆军在<巴尔干>被战斗移除 -> 不触发（只认意大利）', !r2 || r2.length === 0, J(r2 && r2.length))

	const g3 = seed(BALK, { type: 'navy' })
	const r3 = I.fire_trigger(g3, 'piece_removed', {
		piece_nation: '意大利', piece_type: 'navy', space: BALK, reason: 'piece_removed',
	})
	ok('★★ 意大利海军被战斗移除 -> 不触发（只认陆军）', !r3 || r3.length === 0, J(r3 && r3.length))
}

console.log('\n=== F. 相邻地区也认（卡面「或相邻地区」）===')
{
	const g = seed(EAST)   // 东欧 与 巴尔干 相邻
	const r = I.fire_trigger(g, 'piece_removed', {
		piece_nation: '意大利', piece_type: 'army', space: EAST, reason: 'piece_removed',
	})
	ok('★★ 意大利陆军在相邻的<东欧>被战斗移除 -> 触发', (r && r.length) === 1, J(r && r.length))
}

console.log('\n=== G. 静态守卫 ===')
{
	const src = fs.readFileSync(path.join(MOD, 'rules.js'), 'utf8')
	const i = src.indexOf("'17730': {")
	const seg = src.slice(i, i + 1600)
	ok('★★ 17730 filter 已含 ct.reason === \'piece_removed\'',
		/ct\.reason === 'piece_removed'/.test(seg))
	ok('★ 原有三条判据仍在（国别 / 兵种 / 巴尔干或相邻）',
		/ct\.piece_nation === '意大利'/.test(seg) &&
		/ct\.piece_type === 'army'/.test(seg) &&
		/space_is_or_adjacent_to\(g, ct\.space, '巴尔干', owner_side\)/.test(seg))
	/* B50 起客户端有改动（15255 sbuild 登记）-> 版本串会继续 bump，这里只校验统一非空 */
	ok('★ 版本串统一且非空（B49 当轮 20261114a，B50 起 20261122a）',
		(vers => vers.length >= 5 && vers.every(v => v && v === vers[0]))(
			(fs.readFileSync(path.join(MOD, 'play.html'), 'utf8')
				.match(/\?v=([0-9a-z]+)/g) || []).map(s => s.slice(3))))
}

console.log('\n' + (fail === 0 ? 'ALL PASS（' + pass + ' 项）' : 'FAIL ' + fail + ' 项 / PASS ' + pass + ' 项'))
process.exitCode = fail ? 1 : 0
