/*
 * 【B60】15430《奇袭》不得自我触发。
 *
 * 玩家报障（2026-11-27）：「在奇袭过程中，触发了奇袭的bug」。
 *
 * 卡面：「发起海战后：发起 1 次海战，发起 1 次陆战」。
 * 它自己发起的那场海战同样会派发 `on:'battle'` 事件，而它的 filter 只判
 * `ctx.kind === 'sea' && ctx.nation === '日本'` —— 于是**又匹配到自己**，
 * 奇袭可以反复响应自己（甚至连锁）。
 *
 * 修法：
 *   ① `do_battle` 记录发起卡 `game.__battle_from_card`（嵌套战斗栈式保存/恢复）；
 *   ② `do_sea_battle_at(game, sea, nat, opt)` 支持透传 `opt`（含 fromCard）；
 *   ③ 15430 的海战步传 `{ fromCard: '15430' }`；
 *   ④ 15430 的 filter 精确排除 `g.__battle_from_card === '15430'`。
 * 只做精确排除 —— 15426《驱逐舰运输》等其它卡在同一片海域仍应正常响应。
 *
 * 用法：node tools/_real_test_B60_surprise_no_self_trigger.js
 */
const path = require('path')
const fs = require('fs')
const MOD = path.join(__dirname, '..', 'server-official', 'public', 'quartermaster-sub-wars')
const R = require(path.join(MOD, 'rules.js'))
const I = R._internal
const D = require(path.join(MOD, 'data.js')).data
const J = x => JSON.stringify(x)
const SRC = fs.readFileSync(path.join(MOD, 'rules.js'), 'utf8')

let pass = 0, fail = 0
const ok = (m, c, extra) => {
	if (c) { pass++; console.log('  ✓ ' + m) }
	else { fail++; console.log('  ✗ ' + m + (extra !== undefined ? '  | ' + extra : '')) }
}

/* 日本海军在〈北海〉（补给），英军海军在〈北大西洋〉；日本桌面暗置 15430 + 15426 */
function seed() {
	const g = R.setup(20261127, 'Standard')
	let q = 0
	while (g.opening && q++ < 15) {
		const c = g.current_nation
		R.action(g, g.active, 'opening_discard', { cards: (g.hands[c] || []).slice(0, 3) })
	}
	g.location = {}; g.piece_nation = {}; g.piece_type = {}
	const bs = D.id_of('北海'), na = D.id_of('北大西洋')
	g.location.jp_navy = bs; g.piece_nation.jp_navy = '日本'; g.piece_type.jp_navy = 'navy'
	g.location.uk_navy = na; g.piece_nation.uk_navy = '英国'; g.piece_type.uk_navy = 'navy'
	for (const p of ['jp_navy', 'uk_navy']) I.grant_supply(g, p, g.turn || 1)
	I.compute_supply(g)
	g.table_responses = [
		{ card_id: '15430#r1', card_face: '15430', owner_side: 'axis', name: '奇袭' },
		{ card_id: '15426#r2', card_face: '15426', owner_side: 'axis', name: '驱逐舰运输' },
	]
	return { g, na }
}
const facesInQueue = g => {
	const out = []
	for (const e of (g.response_queue || [])) {
		for (const c of (e.candidates || [])) out.push(String(c.card_face))
	}
	return out
}

console.log('=== A. 普通海战（非奇袭发起）：15430 可响应 ===')
{
	const { g, na } = seed()
	const r = I.do_sea_battle_at(g, na, '日本')
	ok('★ 海战正常发动', r.ok === true, J(r))
	const faces = facesInQueue(g)
	ok('★★ 候选含 15430（外层正常路径不受影响）', faces.indexOf('15430') >= 0, J(faces))
	ok('★★ 候选也含 15426（其它响应卡照常）', faces.indexOf('15426') >= 0, J(faces))
}

console.log('\n=== B. 奇袭自己发起的海战：15430 不得再出现 ===')
{
	const { g, na } = seed()
	const r = I.do_sea_battle_at(g, na, '日本', { fromCard: '15430' })
	ok('★ 海战正常发动', r.ok === true, J(r))
	const faces = facesInQueue(g)
	ok('★★ 候选【不含】15430（防自触发生效）', faces.indexOf('15430') < 0, J(faces))
	ok('★★ 候选【仍含】15426（只精确排除奇袭自己）', faces.indexOf('15426') >= 0, J(faces))
}

console.log('\n=== C. 标记是栈式恢复的（内层不污染外层）===')
{
	const { g, na } = seed()
	I.do_sea_battle_at(g, na, '日本', { fromCard: '15430' })
	ok('★★ do_battle 返回后 __battle_from_card 已恢复（无残留）',
		g.__battle_from_card === undefined || g.__battle_from_card === null,
		J(g.__battle_from_card))
	/* 紧接着再打一场普通海战，15430 应重新可用 */
	const g2 = seed()
	I.do_sea_battle_at(g2.g, g2.na, '日本')
	ok('★ 后续普通海战仍能触发 15430', facesInQueue(g2.g).indexOf('15430') >= 0, J(facesInQueue(g2.g)))
}

console.log('\n=== D. 静态守卫 ===')
{
	ok('★★ do_battle 记录并栈式恢复 __battle_from_card',
		/const _prevFromCard = game\.__battle_from_card/.test(SRC) &&
		/game\.__battle_from_card = _prevFromCard/.test(SRC))
	ok('★★ do_sea_battle_at 支持 opt 透传',
		/function do_sea_battle_at\(game, sea, nat, opt\)/.test(SRC) &&
		/Object\.assign\(\{ from: inits\[0\]\.id \}, opt \|\| \{\}\)/.test(SRC))
	ok('★★ 15430 的海战步带 fromCard 标记',
		/do_sea_battle_at\(game, seaId, '日本', \{ fromCard: '15430' \}\)/.test(SRC))
	ok('★★ 15430 的 filter 排除自发起', (() => {
		const i = SRC.indexOf("'15430': {")
		const seg = SRC.slice(i, i + 1200)
		return /g\.__battle_from_card === '15430'/.test(seg)
	})())
}

console.log('\n' + (fail === 0 ? 'ALL PASS（' + pass + ' 项）' : 'FAIL ' + fail + ' 项 / PASS ' + pass + ' 项'))
process.exitCode = fail ? 1 : 0
