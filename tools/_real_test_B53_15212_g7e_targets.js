/*
 * 【本体 #8 / B53】15212《G7e 鱼雷》改为两段式选目标。
 *
 * 卡面：「打出[潜艇行动]后，损耗1张牌：发起1次海战」。
 * 玩家报障（2026-11-22）：「g7e 没有自选」—— 旧实现拿 `find_battle_target` 的
 * 【第一个】合法目标直接 `do_battle`，玩家既不能选海域也不能选发起海军。
 *
 * 修法（仿 16801《哈尔西海军上将》，同为 armed「发起 1 次海战」）：
 *   ① `find_battle_target` 的遍历抽成 `battle_targets`（返回全部），前者保留为「取第一个」薄包装
 *      -> 现有调用方（15212 ready / 16801 等）行为零变化；
 *   ② 新增通用 `battle_froms(game, nation, space, kind)`（参照 us_launch_battle_froms）；
 *   ③ `15212.armed.run(game, ctx, arg)`：
 *        arg.space 缺 -> need:'space'（候选 = 全部合法海域）
 *        arg.piece/arg.from 缺 -> need:'piece'（候选 = 相邻补给德国海军）
 *        齐了才 do_battle（同时修掉旧日志 `data.name_of(tgt.sea)` 恒 undefined 的问题）。
 *
 * 用法：node tools/_real_test_B53_15212_g7e_targets.js
 */
const path = require('path')
const fs = require('fs')
const MOD = path.join(__dirname, '..', 'server-official', 'public', 'quartermaster-sub-wars')
const R = require(path.join(MOD, 'rules.js'))
const I = R._internal
const D = require(path.join(MOD, 'data.js')).data
const J = x => JSON.stringify(x)
const n = id => D.name_of(id)
const BS = D.id_of('北海')
const NA = D.id_of('北大西洋')
const SA = D.id_of('南大西洋')

let pass = 0, fail = 0
const ok = (m, c, extra) => {
	if (c) { pass++; console.log('  ✓ ' + m) }
	else { fail++; console.log('  ✗ ' + m + (extra !== undefined ? '  | ' + extra : '')) }
}

/* 德国海军在北海（补给），英军两支海军分别在北大西洋 / 南大西洋 -> 两个合法海域 */
function seed() {
	const g = R.setup(20261112, 'Standard')
	let q = 0
	while (g.opening && q++ < 15) {
		const c = g.current_nation
		R.action(g, g.active, 'opening_discard', { cards: (g.hands[c] || []).slice(0, 3) })
	}
	g.location = {}; g.piece_nation = {}; g.piece_type = {}
	g.location.de1 = BS; g.piece_nation.de1 = '德国'; g.piece_type.de1 = 'navy'
	g.location.uk1 = NA; g.piece_nation.uk1 = '英国'; g.piece_type.uk1 = 'navy'
	g.location.uk2 = SA; g.piece_nation.uk2 = '英国'; g.piece_type.uk2 = 'navy'
	for (const p of ['de1', 'uk1', 'uk2']) I.grant_supply(g, p, g.turn || 1)
	I.compute_supply(g)
	return g
}
const AR = () => I.ECHO_EFFECTS['15212'].armed

console.log('=== A. ready 预检 ===')
{
	const g = seed()
	ok('★★ 有可发起海战时 ready=true', AR().ready(g, { tag: '潜艇行动' }) === true)
	const g2 = seed()
	g2.location = {}; g2.piece_nation = {}; g2.piece_type = {}
	I.compute_supply(g2)
	ok('★★ 没有任何可打目标时 ready=false（不弹空框）', AR().ready(g2, { tag: '潜艇行动' }) === false)
}

console.log('\n=== B. 第 1 段：need:space，候选 = 全部合法海域（不再取第一个）===')
{
	const g = seed()
	const r = AR().run(g, { tag: '潜艇行动' }, null)
	ok('★★ 返回 need:\'space\'', r && r.need === 'space', J(r && r.need))
	ok('★★ 候选含【两个】合法海域（北大西洋 + 南大西洋）',
		(r.candidates || []).length === 2 &&
		(r.candidates || []).indexOf(NA) >= 0 && (r.candidates || []).indexOf(SA) >= 0,
		J((r.candidates || []).map(n)))
	ok('★★ 此时【没有】开战（敌方海军都还在）',
		!!g.location.uk1 && !!g.location.uk2, J(Object.keys(g.location)))
	ok('★ 带 desc 给客户端提示', /选择发起海战的地区/.test(r.desc || ''), r.desc)
}

console.log('\n=== C. 第 2 段：need:piece，候选 = 相邻补给德国海军 ===')
{
	const g = seed()
	const r = AR().run(g, { tag: '潜艇行动' }, { space: NA })
	ok('★★ 返回 need:\'piece\'', r && r.need === 'piece', J(r && r.need))
	ok('★★ 候选含 {de1}（北海的德国海军）',
		(r.candidates || []).indexOf('de1') >= 0, J(r.candidates))
	ok('★★ 此时仍未开战', !!g.location.uk1)
}

console.log('\n=== D. 参数齐 -> 真实发起海战（打玩家选的那片海）===')
{
	const g = seed()
	const r = AR().run(g, { tag: '潜艇行动' }, { space: NA, piece: 'de1' })
	ok('★★ 返回 ok 且 desc 指明海域', r && r.ok === true && /北大西洋/.test(r.desc || ''), J(r))
	ok('★★ 北大西洋的英军海军被移除（打的是选中的那片）', !g.location.uk1, J(g.location.uk1))
	ok('★★ 南大西洋的英军海军【没被】波及', !!g.location.uk2, J(g.location.uk2))
}

console.log('\n=== E. 非法海域 -> skip + 真实原因（不静默）===')
{
	const g = seed()
	const r = AR().run(g, { tag: '潜艇行动' }, { space: BS, piece: 'de1' })
	ok('★★ 打自家所在海域被拒且给出原因',
		r && r.skip === true && /不能攻击/.test(r.desc || ''), J(r))
}

console.log('\n=== F. 非潜艇行动不发动 ===')
{
	const g = seed()
	const r = AR().run(g, { tag: '北方行动' }, null)
	ok('★ 其他 econ tag -> skip', r && r.skip === true, J(r))
}

console.log('\n=== G. battle_targets / find_battle_target 兼容性 ===')
{
	const g = seed()
	const all = I.battle_targets(g, '德国', 'sea', { enemyOnly: true })
	const one = I.find_battle_target(g, '德国', 'sea', { enemyOnly: true })
	ok('★★ battle_targets 返回全部（2 个）', Array.isArray(all) && all.length === 2, J(all && all.map(t => t.space)))
	ok('★★ find_battle_target 仍返回第一个且与数组首项一致',
		one && all.length > 0 && one.space === all[0].space, J({ one: one && one.space, first: all[0] && all[0].space }))
	ok('★ 每项都带 space + initiator',
		all.every(t => t.space != null && t.initiator != null))
	const froms = I.battle_froms(g, '德国', NA, 'sea')
	ok('★★ battle_froms 返回相邻补给海军', froms.length === 1 && froms[0] === 'de1', J(froms))
	ok('★ battle_froms 对不可达海域返回空', I.battle_froms(g, '德国', D.id_of('北太平洋'), 'sea').length === 0)
}

console.log('\n=== H. 静态守卫 ===')
{
	const src = fs.readFileSync(path.join(MOD, 'rules.js'), 'utf8')
	ok('★★ find_battle_target 只有 1 处定义（薄包装）',
		(src.match(/function find_battle_target\(/g) || []).length === 1)
	ok('★★ battle_targets / battle_froms 各 1 处定义',
		(src.match(/function battle_targets\(/g) || []).length === 1 &&
		(src.match(/function battle_froms\(/g) || []).length === 1)
	ok('★★ 15212 的 run 含 need:\'space\' 与 need:\'piece\'', (() => {
		const i = src.indexOf("'15212': {")
		const seg = src.slice(i, src.indexOf("/* ============", i))
		return /need: 'space'/.test(seg) && /need: 'piece'/.test(seg) && /battle_targets\(/.test(seg)
	})())
	ok('★ 旧日志 bug 已修（代码不再引用 tgt.sea 这种恒 undefined 字段）', (() => {
		const i = src.indexOf("'15212': {")
		const seg = src.slice(i, src.indexOf("/* ============", i))
		/* 去注释后再判：注释里会提到旧 bug 的写法 */
		const code = seg.replace(/\/\*[\s\S]*?\*\//g, '')
		return !/tgt\.sea/.test(code)
	})())
	/* B54 起客户端有改动（17535 遮罩让位）-> 版本串会再 bump，这里只校验统一非空 */
	ok('★ 版本串统一且非空（B53 当轮 20261122a，B54 起 20261122b）',
		(vers => vers.length >= 5 && vers.every(v => v && v === vers[0]))(
			(fs.readFileSync(path.join(MOD, 'play.html'), 'utf8')
				.match(/\?v=([0-9a-z]+)/g) || []).map(s => s.slice(3))))
}

console.log('\n' + (fail === 0 ? 'ALL PASS（' + pass + ' 项）' : 'FAIL ' + fail + ' 项 / PASS ' + pass + ' 项'))
process.exitCode = fail ? 1 : 0
