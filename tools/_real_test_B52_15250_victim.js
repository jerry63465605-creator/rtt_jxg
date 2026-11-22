/*
 * 【本体 #7 / B52】15250《陆地巡航者》只在【德国陆军本身】被攻击时触发。
 *
 * 卡面：「德国陆军被攻击时：攻击的国家损耗2张牌」—— 主语是"德国陆军"这一枚。
 * 玩家报障（2026-11-22）：「巡航对和德国陆军同地格的意大利陆军也有效了」。
 *
 * 根因：`status_on_attacked(game, space, attacker, kind)` 签名里【没有 victim】，
 * 15250 只能用 `has_army:'德国'` 近似成「该地区【有】德国陆军」，于是：
 *   · 同格同时有德国陆军与意大利陆军、英国打意大利陆军 -> 误触发；
 *   · 空打（没有部队被攻击，target_piece=0）-> 也误触发。
 *
 * 修法：钩子加第 5 参 `victim`（调用点传 target_piece），新增可选判据
 * `victim_nation` / `victim_type`，15250 改用它们并删掉 has_army。
 * 注意：15252《…友方陆军…》（space:'德国'）有空打误触发的同类问题，
 * 但玩家明确本轮不动 -> 记为「窄场景待观察」，本测试用静态守卫锁定它保持原样。
 *
 * 用法：node tools/_real_test_B52_15250_victim.js
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
const GER = D.id_of('德国')

let pass = 0, fail = 0
const ok = (m, c, extra) => {
	if (c) { pass++; console.log('  ✓ ' + m) }
	else { fail++; console.log('  ✗ ' + m + (extra !== undefined ? '  | ' + extra : '')) }
}

/* 英国陆军在〈东欧〉，德国桌面 15250，按 opts 在〈巴尔干〉放棋子后由英国发起陆战 */
function battle(opts = {}) {
	const g = R.setup(20261112, 'Standard')
	let q = 0
	while (g.opening && q++ < 15) {
		const c = g.current_nation
		R.action(g, g.active, 'opening_discard', { cards: (g.hands[c] || []).slice(0, 3) })
	}
	g.location = {}; g.piece_nation = {}; g.piece_type = {}
	const space = opts.space != null ? opts.space : BALK
	g.location.uk1 = EAST
	g.piece_nation.uk1 = '英国'
	g.piece_type.uk1 = 'army'
	if (opts.german) {
		g.location.de1 = space; g.piece_nation.de1 = '德国'
		g.piece_type.de1 = opts.germanType || 'army'
		I.grant_supply(g, 'de1', g.turn || 1)
	}
	if (opts.italian) {
		g.location.it1 = space; g.piece_nation.it1 = '意大利'; g.piece_type.it1 = 'army'
		I.grant_supply(g, 'it1', g.turn || 1)
	}
	I.grant_supply(g, 'uk1', g.turn || 1)
	I.compute_supply(g)
	g.table['德国'] = [opts.card || '15250#k1']
	const before = (g.decks['英国'] || []).length
	const r = I.do_battle(g, '英国', space, opts.target, 'land')
	const after = (g.decks['英国'] || []).length
	return { g, r, lost: before - after }
}

console.log('=== A. 同格德+意，英国打【意大利陆军】-> 不触发（玩家报障场景）===')
{
	const { r, lost } = battle({ german: true, italian: true, target: 'it1' })
	ok('★★ 战斗确实移除了意大利陆军', r.ok === true && r.removed === 'it1', J(r))
	ok('★★ 15250 不触发（英国不损耗牌）', lost === 0, J({ lost }))
}

console.log('\n=== B. 只有德国陆军，英国打【德国陆军】-> 触发 ===')
{
	const { lost } = battle({ german: true, target: 'de1' })
	ok('★★ 15250 触发，英国损耗 2 张', lost === 2, J({ lost }))
}

console.log('\n=== C. 同格德+意，英国打【德国陆军】-> 仍触发 ===')
{
	const { lost } = battle({ german: true, italian: true, target: 'de1' })
	ok('★★ 15250 触发，英国损耗 2 张', lost === 2, J({ lost }))
}

console.log('\n=== D. 空打（target=0），同格有德国陆军 -> 不触发 ===')
{
	const { lost } = battle({ german: true, target: 0 })
	ok('★★ 空打没有部队被攻击 -> 15250 不触发', lost === 0, J({ lost }))
}

console.log('\n=== E. 只有意大利陆军，英国打【意大利陆军】-> 不触发 ===')
{
	const { lost } = battle({ italian: true, target: 'it1' })
	ok('★★ 15250 不触发', lost === 0, J({ lost }))
}

console.log('\n=== F. 德国【海军】被攻击 -> 不触发（victim_type 生效）===')
{
	const { lost } = battle({ german: true, germanType: 'navy', target: 'de1' })
	ok('★★ 15250 只认陆军，海军被移除不触发', lost === 0, J({ lost }))
}

console.log('\n=== G. 其它 react 卡不回归（space 判据照旧）===')
{
	/* 15252：space:'德国'，在〈德国〉打轴心陆军 -> 触发（英国 -3） */
	const { lost } = battle({ german: true, target: 'de1', space: GER, card: '15252#k1' })
	ok('★★ 15252 的 space 判据仍工作（在〈德国〉被攻击触发，-3）', lost === 3, J({ lost }))
}

console.log('\n=== H. 静态守卫 ===')
{
	const src = fs.readFileSync(path.join(MOD, 'rules.js'), 'utf8')
	ok('★★ status_on_attacked 签名含 victim 第 5 参',
		/function status_on_attacked\(game, space, attacker, kind, victim\)/.test(src))
	ok('★★ 调用点已传 target_piece',
		/status_on_attacked\(game, space, nation, kind, target_piece\)/.test(src))
	ok('★★ 含 victim_nation 判据且排除空打（Number(victim) === 0）',
		/rc\.victim_nation/.test(src) && /Number\(victim\) === 0/.test(src))
	ok('★★ 15250 已改 victim_nation/victim_type、不再用 has_army', (() => {
		const i = src.indexOf("'15250': {")
		const seg = src.slice(i, src.indexOf("'15251': {", i))
		return /victim_nation: '德国'/.test(seg) && /victim_type: 'army'/.test(seg) && !/has_army/.test(seg.replace(/\/\*[\s\S]*?\*\//g, ''))
	})())
	ok('★ 15252 本轮保持原样（玩家口径：窄场景待观察）', (() => {
		const i = src.indexOf("'15252': {")
		const seg = src.slice(i, i + 260)
		return /space: '德国', attrition: 3/.test(seg)
	})())
	/* B54 起客户端有改动（17535 遮罩让位）-> 版本串会再 bump，这里只校验统一非空 */
	ok('★ 版本串统一且非空（B52 当轮 20261122a，B54 起 20261122b）',
		(vers => vers.length >= 5 && vers.every(v => v && v === vers[0]))(
			(fs.readFileSync(path.join(MOD, 'play.html'), 'utf8')
				.match(/\?v=([0-9a-z]+)/g) || []).map(s => s.slice(3))))
}

console.log('\n' + (fail === 0 ? 'ALL PASS（' + pass + ' 项）' : 'FAIL ' + fail + ' 项 / PASS ' + pass + ' 项'))
process.exitCode = fail ? 1 : 0
