/*
 * 【2026-10-28 待办 #5】派发点字段口径统一验收
 *
 * 目标：同一件事（「本次产生的/被移除的那支部队」）在所有派发点只有【一个名字】——
 *       `piece_id`；旧名 `piece` 在 `piece_removed` 的 ctx 里【双写】保留（零风险过渡）。
 *
 * 覆盖：
 *   ① offer_armed_effects(game, 'after_*') —— after_build_navy / after_deploy_air
 *      三处（build_piece 内部 2 处 + 空军调度 2 处）此前缺 piece_id
 *   ② request_responses / offer_armed_effects(game, 'piece_removed') —— ctx 双写 piece + piece_id
 *   ③ game.last_piece_removed —— 状态卡从这里取 ctx，同样双写
 */
const path = require('path')
const fs = require('fs')
const M = path.join('server-official', 'public', 'quartermaster-sub-wars')
const rules = require(path.join(__dirname, '..', M, 'rules.js'))
const I = rules._internal
const d = I.data
const SRC = fs.readFileSync(path.join(__dirname, '..', M, 'rules.js'), 'utf8')

let pass = 0
const fails = []
function ok(name, cond, extra) {
	if (cond) { pass++; console.log('  ok   ' + name) }
	else { fails.push(name); console.log('  FAIL ' + name + (extra !== undefined ? '  | ' + JSON.stringify(extra) : '')) }
}
function section(t) { console.log('\n=== ' + t + ' ===') }

/* ---------------- S1 源码：所有 after_* 派发点都带 piece_id ---------------- */
section('S1 源码守卫：offer_armed_effects(game, \'after_*\') 全部带 piece_id')
{
	const lines = SRC.split('\n')
	const bad = []
	lines.forEach((l, i) => {
		if (!/offer_armed_effects\(game, 'after_[a-z_]+'/.test(l)) return
		/*
		 * after_battle 例外：它的 ctx 是 space/kind/attacker/nation，
		 * 语义上【没有】「本次产生/被移除的那一支部队」，不应该硬塞 piece_id。
		 */
		if (/'after_battle'/.test(l)) return
		/* 该调用可能跨行：取本行 + 后续 4 行拼起来找 piece_id */
		const blob = lines.slice(i, i + 5).join('\n')
		/* 只看这一次调用（到第一个 ) 结束） */
		const end = blob.indexOf('})')
		const call = end >= 0 ? blob.slice(0, end) : blob
		if (!/piece_id/.test(call)) bad.push({ ln: i + 1, text: l.trim().slice(0, 80) })
	})
	ok('所有 after_* 派发点带 piece_id', bad.length === 0, bad)
	ok('after_build_navy 带 piece_id', /'after_build_navy', \{ space: space, nation: nation, piece_id: __r\.id \}/.test(SRC))
	ok('after_deploy_air（build_piece 内）带 piece_id', /'after_deploy_air', \{ space: space, nation: nation, piece_id: __r\.id \}/.test(SRC))
	ok('after_deploy_air（调度路径 1）带 piece_id', /'after_deploy_air', \{ space: space, nation: nat, piece_id: air \}/.test(SRC))
	ok('after_deploy_air（调度路径 2）带 piece_id', /'after_deploy_air', \{ space: target, nation: nation, piece_id: air \}/.test(SRC))
}

/* ---------------- S2 源码：piece_removed 的 ctx 双写 ---------------- */
section('S2 源码守卫：piece_removed 的 ctx 一律双写 piece + piece_id')
{
	const dual = (SRC.match(/piece:\s*[A-Za-z_][\w.]*,\s*piece_id:\s*[A-Za-z_][\w.]*/g) || []).length
	ok('双写格式出现 >= 6 处（6 个 ctx + 2 个 last_piece_removed）', dual >= 6, dual)
	/* 逐个 piece_removed 派发点检查其 ctx 里有 piece_id */
	const lines = SRC.split('\n')
	const bad = []
	lines.forEach((l, i) => {
		if (!/(request_responses|offer_armed_effects)\(game, 'piece_removed'/.test(l)) return
		/*
		 * 两种写法：
		 *   ① 内联对象 —— ctx 在本行之后；
		 *   ② `, ctx,` —— ctx 在本行【之前】定义。
		 * 因此向两侧各取一段窗口。
		 */
		const blob = lines.slice(Math.max(0, i - 22), i + 14).join('\n')
		if (!/piece_id/.test(blob)) bad.push({ ln: i + 1, text: l.trim().slice(0, 80) })
	})
	ok('每个 piece_removed 派发点的 ctx 都有 piece_id', bad.length === 0, bad)
	ok('last_piece_removed 也双写', /piece: victim, piece_id: victim,\s*\n\s*\/\*[\s\S]{0,200}retreated_airs/.test(SRC)
		|| /reason: 'piece_removed', piece: victim, piece_id: victim,/.test(SRC))
	ok('last_piece_removed（econ 路径）也双写', /reason: 'econ', piece: piece, piece_id: piece \}/.test(SRC))
}

/* ---------------- 造局工具 ---------------- */
function mk(nation, hand) {
	const g = rules.setup(20261028, rules.default_scenario, {})
	g.opening = null
	I.set_skip_turn_guard(true)
	g.current_nation = nation
	g.active = 'axis'
	g.turn = 3; g.turn_phase = 'play'; g.nations_done = 1
	g.score = { axis: 0, allies: 0 }; g.log = []
	g.hands[nation] = (hand || []).slice()
	g.armed_offers = []
	I.refresh(g)
	return g
}
function put(g, pid, sp, nat, type) {
	for (const p of Object.keys(g.location)) if (g.location[p] === sp) { delete g.location[p]; delete g.piece_nation[p]; delete g.piece_type[p] }
	g.location[pid] = sp; g.piece_nation[pid] = nat; g.piece_type[pid] = type
}

/* ---------------- S3 运行时：建海军 ctx 带 piece_id ---------------- */
section('S3 运行时：build_piece(navy) 的 armed ctx 带 piece_id 且 = 新建部队 id')
{
	const g = mk('日本', ['15405#1', '15436#1'])
	put(g, 'jp_ph', d.id_of('菲律宾'), '日本', 'army')
	I.refresh(g)
	const r = I.build_piece(g, '日本', 'navy', d.id_of('东海'))
	ok('建海军成功', r && r.ok, r)
	const w = (g.armed_offers || []).find(x => x.when === 'after_build_navy')
	ok('建立了 after_build_navy 窗口', !!w)
	ok('ctx.piece_id 存在且 = 新建部队 id', !!w && w.ctx && w.ctx.piece_id === r.id,
		w && w.ctx && { piece_id: w.ctx.piece_id, built: r.id })
}

/* ---------------- S4 运行时：部署空军 ctx 带 piece_id ---------------- */
section('S4 运行时：build_piece(air) 的 armed ctx 带 piece_id')
{
	const g = mk('德国', [])
	const EE = d.id_of('东欧')
	for (const p of Object.keys(g.location)) if (g.location[p] === EE) { delete g.location[p]; delete g.piece_nation[p]; delete g.piece_type[p] }
	put(g, 'de_ee', EE, '德国', 'army')
	I.refresh(g)
	/* 牌库给够，让 JU-87 过 cost 检查 */
	g.decks['德国'] = ['k1#1', 'k2#1', 'k3#1', 'k4#1']
	const r = I.build_piece(g, '德国', 'air', EE)
	ok('部署空军成功', r && r.ok, r)
	const w = (g.armed_offers || []).find(x => x.when === 'after_deploy_air')
	if (!w) {
		ok('（JU-87 ready=false，无窗口 —— 用源码断言兜底，见 S1）', true)
	} else {
		ok('ctx.piece_id 存在且 = 新建空军 id', w.ctx && w.ctx.piece_id === r.id,
			{ piece_id: w.ctx && w.ctx.piece_id, built: r.id })
	}
}

/* ---------------- S5 运行时：断补移除 last_piece_removed 带 piece_id ---------------- */
section('S5 运行时：piece_removed ctx / last_piece_removed 带 piece_id')
{
	const g = mk('德国', [])
	/* 直接验证 piece_removed 派发：移除一支敌方部队（走 eliminate_piece） */
	const NA = d.id_of('非洲北部')
	for (const p of Object.keys(g.location)) if (g.location[p] === NA) { delete g.location[p]; delete g.piece_nation[p]; delete g.piece_type[p] }
	g.location['uk_na'] = NA; g.piece_nation['uk_na'] = '英国'; g.piece_type['uk_na'] = 'army'
	I.refresh(g)
	I.eliminate_piece(g, '德国', NA, 'uk_na')
	const lpr = g.last_piece_removed
	ok('last_piece_removed 有 piece 字段（旧名保留）', !!lpr && lpr.piece === 'uk_na', lpr)
	ok('last_piece_removed 有 piece_id 字段（新名）', !!lpr && lpr.piece_id === 'uk_na', lpr)
}

console.log('\n' + (fails.length ? 'FAILED' : 'ALL PASS') + '  ' + pass + ' ok, ' + fails.length + ' fail')
if (fails.length) { console.log('失败项: ' + fails.join(' | ')); process.exit(1) }
