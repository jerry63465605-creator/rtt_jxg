/*
 * 【D1/P12】打出牌不摸牌 + 前奏手牌区全程常驻 + 友军手牌区可见
 * 真实 R.setup / R.action / R.view 驱动 + 客户端静态守卫。
 * 用法：node tools/_real_test_P12_visibility.js
 */
const path = require('path')
const fs = require('fs')
const MOD = path.join(__dirname, '..', 'server-official', 'public', 'quartermaster-sub-wars')
const R = require(path.join(MOD, 'rules.js'))
const J = x => JSON.stringify(x)

let pass = 0, fail = 0
const ok = (m, c, extra) => {
	if (c) { pass++; console.log('  ✓ ' + m) }
	else { fail++; console.log('  ✗ ' + m + (extra !== undefined ? '  | ' + extra : '')) }
}
function started() {
	const g = R.setup(20261112, 'Episode 2')
	let guard = 0
	while (g.opening && guard++ < 12) {
		const n = g.current_nation
		R.action(g, g.active, 'opening_discard', { cards: (g.hands[n] || []).slice(0, 3) })
	}
	return g
}
const src = fs.readFileSync(path.join(MOD, 'rules.js'), 'utf8')
const pjs = fs.readFileSync(path.join(MOD, 'play.js'), 'utf8')
const phtml = fs.readFileSync(path.join(MOD, 'play.html'), 'utf8')

console.log('=== A. 服务端 view：同阵营友军完整下发、敌方只见数量 ===')
{
	const g = started()
	const v = R.view(g, g.active)
	const hands = v.prelude.hands || {}
	const tops = v.prelude.deck_top || {}
	const arr = Object.keys(hands).filter(k => Array.isArray(hands[k]))
	const num = Object.keys(hands).filter(k => typeof hands[k] === 'number')
	ok('★★ 同阵营 3 国下发完整卡面（数组）',
		arr.length === 3, J(arr))
	ok('★★ 敌方 3 国只下发张数（数字）',
		num.length === 3, J(num))
	ok('★★ 友军手牌卡带 img / type（真实卡图所需）',
		arr.every(k => hands[k].length > 0 &&
			hands[k].every(c => c.img && c.type && c.name)),
		J(arr.map(k => [k, (hands[k][0] || {}).img])))
	ok('★★ 友军牌堆顶也下发 img / type（可见）',
		arr.every(k => tops[k] && tops[k].img && tops[k].type && tops[k].name),
		J(arr.map(k => [k, tops[k] && tops[k].name])))
	ok('★★ 敌方牌堆顶仍为 null（牌面保密）',
		num.every(k => tops[k] === null), J(num.map(k => [k, tops[k]])))
	/* 换到对方阵营视角，应镜像 */
	const other = g.active === 'Axis' ? 'Allies' : 'Axis'
	const v2 = R.view(g, other)
	const h2 = v2.prelude.hands || {}
	const arr2 = Object.keys(h2).filter(k => Array.isArray(h2[k]))
	ok('★ 换阵营视角后镜像（另 3 国变数组、原 3 国变数字）',
		arr2.length === 3 && arr2.every(k => num.indexOf(k) >= 0),
		J(arr2))
}

console.log('\n=== B. 打出 1 张前奏手牌 → 不摸牌 ===')
{
	const g = started()
	const n = g.current_nation
	g.prelude.hands[n] = ['99999#a', '99999#b']
	const d0 = (g.prelude.decks[n] || []).length
	const top0 = (g.prelude.decks[n] || [])[0]
	const n0 = g.log.length
	R.action(g, g.active, 'prelude_play_hand', { card: '99999#a' })
	ok('★★ 牌堆长度不变', (g.prelude.decks[n] || []).length === d0,
		J({ before: d0, after: (g.prelude.decks[n] || []).length }))
	ok('★★ 牌堆顶不变', (g.prelude.decks[n] || [])[0] === top0,
		J((g.prelude.decks[n] || [])[0]))
	ok('★★ 手牌 -1，原牌堆顶没进手牌',
		(g.prelude.hands[n] || []).length === 1 &&
		(g.prelude.hands[n] || []).indexOf(top0) < 0,
		J(g.prelude.hands[n]))
	ok('★★ 日志无补牌记录',
		!(g.log || []).slice(n0).some(l => /加入手牌/.test(l)),
		J((g.log || []).slice(n0)))
	/* 卡牌阶段「弃光 → 摸 2 张」保留（规则书 :121-123） */
	const g2 = started()
	const n2 = g2.current_nation
	g2.prelude.hands[n2] = ['99999#a']
	g2.prelude.phase = 'prelude_cards'
	R.action(g2, g2.active, 'prelude_next', {})
	ok('★ 卡牌阶段点「继续」仍弃光 → 摸 2 张（未撤销）',
		(g2.prelude.hands[n2] || []).length === 2 &&
		(g2.log || []).some(l => /弃置前奏手牌/.test(l)),
		J((g2.prelude.hands[n2] || []).length))
}

console.log('\n=== C. 整个前奏阶段常驻（卡牌阶段 / 空手牌 / 窗口未决）===')
{
	const g = started()
	const n = g.current_nation
	/* 空手牌 + 卡牌阶段 */
	g.prelude.hands[n] = []
	g.prelude.phase = 'prelude_cards'
	const v = R.view(g, g.active)
	ok('★★ 卡牌阶段 + 空手牌时 view 仍 enabled，且该国仍是数组型（客户端会渲染占位）',
		v.prelude.enabled === true && !v.prelude.ended &&
		Array.isArray(v.prelude.hands[n]) && v.prelude.hands[n].length === 0,
		J({ enabled: v.prelude.enabled, phase: v.prelude.phase,
			hand: v.prelude.hands[n] }))
	/* 段窗口 / op 窗口未决 */
	const g2 = started()
	g2.prelude.op_window = {
		nation: g2.current_nation, owner: g2.current_nation, kind: 'choice',
		candidates: [{ id: 'top', name: 'top' }],
		op: { op: 'peek_reorder', source: 'prelude', n: 2 },
		seg: null, pendingOps: [], desc: 'test',
	}
	const v2 = R.view(g2, g2.active)
	ok('★★ op 分步窗口未决时手牌区数据仍在（客户端照常渲染）',
		v2.prelude.enabled && !!v2.prelude.op_window &&
		Array.isArray(v2.prelude.hands[g2.current_nation]),
		J({ enabled: v2.prelude.enabled, win: !!v2.prelude.op_window }))
	ok('★ 前奏结束后才隐藏（ended=true 下发）', (() => {
		const g3 = started()
		g3.prelude.ended = true
		const v3 = R.view(g3, g3.active)
		return v3.prelude.ended === true
	})())
}

console.log('\n=== D. 静态守卫 ===')
{
	ok('★★ play_hand 分支不再有 prelude_draw', (() => {
		const fn = src.slice(src.indexOf("if (action === 'prelude_play_hand')"),
			src.indexOf("if (action === 'prelude_play_top')"))
		return !/prelude_draw\(game/.test(fn) && /prelude_resolve_card\(/.test(fn)
	})())
	ok('★★ 客户端遍历同阵营各国（数组型）分组渲染',
		/const own = Object\.keys\(hands\)\.filter\(k => Array\.isArray\(hands\[k\]\)\)/.test(pjs) &&
		/for \(const nat of own\)/.test(pjs) && /box\.appendChild\(group\)/.test(pjs))
	ok('★★ 前奏全程不再因空手牌隐藏',
		!/if \(!myHand\.length && !top\)/.test(pjs) &&
		/（无前奏手牌）/.test(pjs))
	ok('★ 只按 enabled / ended 隐藏',
		/if \(!p \|\| !p\.enabled \|\| p\.ended\) \{ hide\(\); return \}/.test(pjs))
	ok('★ 友军卡片只读、当前国才可点',
		/const isCur = \(nat === cur\)/.test(pjs) &&
		/isCur && !discardWin && view\.actions/.test(pjs))
	ok('★ 牌堆顶仍在各分组最右',
		/el\.style\.order = "999"/.test(pjs) &&
		/el\.style\.marginLeft = "auto"/.test(pjs))
	const vers = (phtml.match(/\?v=([0-9a-z]+)/g) || []).map(s => s.slice(3))
	ok('★ 版本串统一且非空',
		vers.length >= 5 && vers.every(v => v && v === vers[0]), vers)
}

console.log('\n' + (fail === 0 ? 'ALL PASS（' + pass + ' 项）' : 'FAIL ' + fail + ' 项 / PASS ' + pass + ' 项'))
process.exitCode = fail ? 1 : 0
