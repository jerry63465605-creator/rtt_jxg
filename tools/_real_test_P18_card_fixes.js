/*
 * 【D1/P18】14905 洗入 15234 + 14907 无条件检视 10 张二选一
 * 真实 R.setup / R.action / R.view 驱动。用法：node tools/_real_test_P18_card_fixes.js
 */
const path = require('path')
const fs = require('fs')
const MOD = path.join(__dirname, '..', 'server-official', 'public', 'quartermaster-sub-wars')
const R = require(path.join(MOD, 'rules.js'))
const C = require(path.join(MOD, 'cards.js'))
const P = require(path.join(MOD, 'prelude_compiler.js'))
const J = x => JSON.stringify(x)

let pass = 0, fail = 0
const ok = (m, c, extra) => {
	if (c) { pass++; console.log('  ✓ ' + m) }
	else { fail++; console.log('  ✗ ' + m + (extra !== undefined ? '  | ' + extra : '')) }
}
function started() {
	const g = R.setup(20261112, 'Episode 2')
	let q = 0
	while (g.opening && q++ < 12) {
		const n = g.current_nation
		R.action(g, g.active, 'opening_discard', { cards: (g.hands[n] || []).slice(0, 3) })
	}
	return g
}
const cfgOf = id => {
	const x = C.CARD_BY_ID[id]
	return P.compile({ id: x.id, nation: x.nation, deck: x.deck,
		type: x.type, name: x.name, text: x.text }).config
}
const segOps = cfg => cfg.segments.reduce((a, s) => a.concat(s.steps || []), [])

console.log('=== A. 14905 四年计划：洗入的是 15234 ===')
{
	const g = started()
	const n = g.current_nation
	g.prelude.hands[n] = ['14905#t1', '18416#h1']   /* seg1 只剩 1 张手牌，直接打 */
	const deck0 = (g.decks[n] || []).length
	const l0 = g.log.length
	R.action(g, g.active, 'prelude_play_hand', { card: '14905#t1' })
	const added = (g.decks[n] || []).filter(x => String(x).indexOf('15234#pd') === 0)
	ok('★★ 正式牌堆新增 1 张 15234 实例（不是「缺少卡名引用」）',
		added.length === 1 && (g.decks[n] || []).length === deck0 + 1,
		J({ added: added, len: (g.decks[n] || []).length }))
	ok('★★ 日志用真实卡名《枪支或黄油》，无跳过日志',
		(g.log || []).slice(l0).some(l => /《枪支或黄油》洗入/.test(l)) &&
		!(g.log || []).slice(l0).some(l => /缺少卡名引用/.test(l)),
		J((g.log || []).slice(l0)))
	ok('★ 15234 卡面名确实是「枪支或黄油」（别名来源）',
		C.CARD_BY_ID[15234].name === '枪支或黄油',
		J(C.CARD_BY_ID[15234].name))
	ok('★ 别名表按配置定位、不写死在逻辑里',
		/const PRELUDE_CARD_ALIAS = \{ '枪支与黄油': 15234 \}/.test(
			fs.readFileSync(path.join(MOD, 'rules.js'), 'utf8')),
		'(见 F 组静态守卫)')
}

console.log('\n=== B. 14907 编译层：二选一收口 ===')
{
	const ops = segOps(cfgOf(14907))
	const pp = ops.find(o => o.op === 'peek_and_play')
	ok('★★ 收口为单个选牌窗口：无 join_hand、filter=null',
		!!pp && !ops.some(o => o.op === 'join_hand') && pp.filter === null,
		J(ops))
	ok('★★ 无条件检视 10 张（peek_scope=10、source=formal）',
		pp.source === 'formal' && pp.peek_scope === 10 &&
		ops.some(o => o.op === 'peek_reorder' && o.n === 10 && o.silent),
		J(pp))
	ok('★★ pick_mode=status_play_or_hand（选中后按类型分流）',
		pp.pick_mode === 'status_play_or_hand', J(pp.pick_mode))
	for (const id of [18004, 17204]) {
		const p2 = segOps(cfgOf(id)).find(o => o.op === 'peek_and_play')
		ok('★★ ' + id + ' 不误伤：仍只选状态卡',
			!!p2 && p2.filter === '状态卡' && !p2.pick_mode,
			J(p2))
	}
}

console.log('\n=== C. 14907 实机：候选是前 10 张全部（含非状态卡）===')
{
	const g = started()
	const n = g.current_nation
	/* 摆 10 张：3 张 STATUS + 2 张 RESPONSE + 5 张其它 */
	g.decks[n] = [
		'15255#f1', '15255#f2', '15255#f3',
		'15328#f4', '15328#f5',
		'15400#f6', '15400#f7', '15400#f8', '15400#f9', '15400#f10',
	]
	g.prelude.hands[n] = ['14907#t1']
	R.action(g, g.active, 'prelude_play_hand', { card: '14907#t1' })
	const w = g.prelude.op_window
	ok('★★ 开出单一检视选牌窗口（P14 卡图弹窗、不可放弃）',
		!!w && w.kind === 'card' && w.inspect === true &&
		w.cancellable === false && w.op.pick_mode === 'status_play_or_hand',
		J(w && { kind: w.kind, inspect: w.inspect }))
	ok('★★ 候选 = 前 10 张全部（状态卡/响应卡/其它都在）',
		!!w && w.candidates.length === 10 &&
		w.candidates.some(c => c.id === '15255#f1') &&
		w.candidates.some(c => c.id === '15328#f4') &&
		w.candidates.some(c => c.id === '15400#f10') &&
		w.candidates.every(c => c.img && c.type),
		J(w && w.candidates.map(c => c.id)))
	ok('★ 窗口标题说明二选一规则',
		w && /选状态卡打出，选其它牌加入手牌/.test(w.desc || ''),
		J(w && w.desc))
	console.log('    [info] tension=' + g.prelude.tension)
}

console.log('\n=== D. 选状态卡 -> 打出（桌面留场），不多取牌 ===')
{
	const g = started()
	const n = g.current_nation
	g.decks[n] = ['15255#f1', '15328#f2', '15400#f3']
	g.prelude.hands[n] = ['14907#t1']
	const hand0 = (g.hands[n] || []).length
	const table0 = (g.table[n] || []).length
	R.action(g, g.active, 'prelude_play_hand', { card: '14907#t1' })
	const w = g.prelude.op_window
	const side = ['Axis', 'Allies'].find(s => (R.view(g, s).actions || {}).prelude_op_pick)
	R.action(g, side, 'prelude_op_pick', { pick: '15255#f1' })
	ok('★★ 状态卡进 game.table 留场（不触发正式效果）',
		(g.table[n] || []).indexOf('15255#f1') >= 0 &&
		(g.table[n] || []).length === table0 + 1,
		J(g.table[n]))
	ok('★★ 正式手牌不增、牌堆移除该张、窗口清空',
		(g.hands[n] || []).length === hand0 &&
		(g.decks[n] || []).indexOf('15255#f1') < 0 &&
		!g.prelude.op_window,
		J({ hand: (g.hands[n] || []).length, deck: g.decks[n] }))
	ok('★★ 没有 join_hand 额外取牌（其余两张仍在牌堆）',
		(g.decks[n] || []).length === 2,
		J(g.decks[n]))
}

console.log('\n=== E. 选其它牌 -> 加入手牌（含响应卡）===')
for (const pick of ['15400#f3', '15328#f2']) {
	const g = started()
	const n = g.current_nation
	g.decks[n] = ['15255#f1', '15328#f2', '15400#f3']
	g.prelude.hands[n] = ['14907#t1']
	const hand0 = (g.hands[n] || []).length
	const table0 = (g.table[n] || []).length
	R.action(g, g.active, 'prelude_play_hand', { card: '14907#t1' })
	const side = ['Axis', 'Allies'].find(s => (R.view(g, s).actions || {}).prelude_op_pick)
	R.action(g, side, 'prelude_op_pick', { pick: pick })
	ok('★★ ' + pick + ' 进正式手牌、桌面不变、不多取牌',
		(g.hands[n] || []).indexOf(pick) >= 0 &&
		(g.hands[n] || []).length === hand0 + 1 &&
		(g.table[n] || []).length === table0 &&
		(g.decks[n] || []).length === 2 &&
		!g.prelude.op_window,
		J({ hand: (g.hands[n] || []).slice(-2), table: g.table[n],
			deck: g.decks[n] }))
}

console.log('\n=== F. 静态守卫 ===')
{
	const src = fs.readFileSync(path.join(MOD, 'rules.js'), 'utf8')
	const pcsrc = fs.readFileSync(path.join(MOD, 'prelude_compiler.js'), 'utf8')
	const phtml = fs.readFileSync(path.join(MOD, 'play.html'), 'utf8')
	ok('★★ 别名表 + shuffle_into_deck 优先查别名、日志用真实卡名',
		/const PRELUDE_CARD_ALIAS = \{ '枪支与黄油': 15234 \}/.test(src) &&
		/const aliasId = PRELUDE_CARD_ALIAS\[r\]/.test(src) &&
		/const realName = \(CARD_BY_ID\[face\] \|\| \{\}\)\.name \|\| refs\[0\]/.test(src))
	/* 注释里提到卡号是依据说明，只检查逻辑里没有按 id 分支 */
	ok('★★ 编译层按结构收口（逻辑无卡 id 硬编码）',
		/pick_mode = 'status_play_or_hand'/.test(pcsrc) &&
		/s\.steps = \(s\.steps \|\| \[\]\)\.filter\(o => o\.op !== 'join_hand'\)/.test(pcsrc) &&
		!/(id|card_id)\s*===?\s*14907/.test(pcsrc))
	ok('★★ 引擎按 pick_mode 分流，P8 原分支保留',
		/op\.pick_mode === 'status_play_or_hand'/.test(src) &&
		/将选中的 1 张牌加入手牌/.test(src) &&
		/facedown_response\(game, owner, pick, 'hand'\)/.test(src))
	/* 【D1/P20】后续期因客户端改动 bump 过，这里只校验统一性 */
	ok('★ 版本串统一且非空（P18 当轮客户端零改动）',
		(phtml.match(/\?v=([0-9a-z]+)/g) || []).map(s => s.slice(3))
			.every(v => v && v === (phtml.match(/\?v=([0-9a-z]+)/) || [])[1]),
		[...new Set((phtml.match(/\?v=([0-9a-z]+)/g) || []).map(s => s.slice(3)))])
}

console.log('\n' + (fail === 0 ? 'ALL PASS（' + pass + ' 项）' : 'FAIL ' + fail + ' 项 / PASS ' + pass + ' 项'))
process.exitCode = fail ? 1 : 0
