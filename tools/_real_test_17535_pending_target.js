/*
 * 真实测试：17535《租借法案》委托打出「需补目标」多步卡（17828/17829）不再残留
 *
 * 报障（玩家 2026-11-10）：委托苏联/英国打出 17828《百团大战》/17829《毛泽东》
 * 这类「需补目标」多步卡时，delegate.nation=null 导致委托残留。
 *
 * 根因（只读核查）：resolve_event_card 返回 pending:true 时，
 * resolve_us_lend_lease_play 重建 game.delegate 把 nation 清成 null（被委托国只写进 nat），
 * 下游 6 处只读 nation 的判据全部失效 -> 不能补目标、不能打牌、不能结束归还。
 *
 * 全程真实 R.action 驱动（不手写状态替代引擎流程）。
 * ★ 标记的断言在【修复前】会变红，修复后转绿。
 *
 * 用法：node tools/_real_test_17535_pending_target.js
 */
const L = require('./_board_lib')
const { R, I, d, faceOf, new_board, give, place } = L

let pass = 0, fail = 0
function ok(name, cond, extra) {
	if (cond) { pass++; console.log('  ✓ ' + name) }
	else { fail++; console.log('  ✗ ' + name + (extra ? '  | ' + extra : '')) }
}
const logSince = (g, n) => (g.log || []).slice(n).join(' | ')
const J = o => JSON.stringify(o)

function scene() {
	const g = new_board(20261108, { nation: '美国', phase: 'play' })
	give(g, '17535', '美国')
	return g
}

/* 与 tools/_real_test_17535_manual_return.js 同款：真实 play_card 打出 17535 并选国 */
function play17535(g, nat) {
	const cid = (g.hands['美国'] || []).find(x => faceOf(x) === '17535')
	R.action(g, 'Allies', 'play_card', { card: cid })
	I.refresh(g)
	if (g.us_depression_discard && g.us_depression_discard.pending) {
		const drop = (g.hands['美国'] || []).find(x => faceOf(x) !== '17535')
		if (drop) R.action(g, 'Allies', 'us_depression_discard', { card: drop })
		I.refresh(g)
	}
	R.action(g, 'Allies', 'resolve_us_lend_lease_select', { nation: nat })
	I.refresh(g)
}

function snap(g, tag) {
	const v = R.view(g, 'Allies')
	const a = v.actions || {}
	const dg = g.delegate || {}
	console.log('  [' + tag + '] current=' + g.current_nation + ' active=' + g.active +
		' dg.nation=' + dg.nation + ' dg.nat=' + dg.nat + ' dg.played=' + dg.played +
		' step=' + (v.us_lend_lease && v.us_lend_lease.step) +
		' v.nation=' + (v.us_lend_lease && v.us_lend_lease.nation) +
		' acts[sel/play/fin]=' + [a.resolve_us_lend_lease_select, a.resolve_us_lend_lease_play, a.finish_lend_lease].join('/'))
}

/* ================= A：17828《百团大战》需补目标 ================= */
console.log('\n=== A 17828《百团大战》委托苏联：需补目标后委托仍可继续 ===')
{
	const g = scene()
	give(g, '17828', '苏联')
	/* 照抄 _real_test_17828_yiyongjun.js：日军@中亚（与中国西部相邻） */
	place(g, 'jp_a1', '日本', 'army', '中亚')
	I.grant_supply(g, 'jp_a1', g.turn)
	I.refresh(g)
	play17535(g, '苏联')
	const cid = (g.hands['苏联'] || []).find(x => faceOf(x) === '17828')
	snap(g, 'A0 选国后')
	ok('A0 打出 17535 并选苏联后处于打牌步', g.delegate && g.delegate.nation === '苏联' &&
		(R.view(g, 'Allies').us_lend_lease || {}).step === 'play', J(g.delegate))

	const q = R.query(g, 'Allies', 'event_targets', { card: cid, nation: '苏联' })
	console.log('  [A] event_targets = ' + J(q).slice(0, 320))

	let l0 = (g.log || []).length
	R.action(g, 'Allies', 'resolve_us_lend_lease_play', { card: cid, nation: '苏联' })
	I.refresh(g)
	snap(g, 'A1 打出后（需补目标）')
	console.log('  [A] log = ' + logSince(g, l0).slice(0, 300))
	console.log('  [A] pending_event_step = ' + J(g.pending_event_step) + '  event_budget = ' + J(g.event_budget))
	console.log('  [A] 17828 是否仍在苏联手牌 = ' + ((g.hands['苏联'] || []).indexOf(cid) >= 0))

	ok('A1 卡回到苏联手牌（待补目标，未吞牌）', (g.hands['苏联'] || []).indexOf(cid) >= 0)
	ok('★A2 委托仍记得被委托国（delegate.nation=苏联）',
		!!(g.delegate && g.delegate.nation === '苏联'), J(g.delegate))
	ok('★A3 view 仍是打牌步（客户端可继续补目标）',
		(R.view(g, 'Allies').us_lend_lease || {}).step === 'play',
		J(R.view(g, 'Allies').us_lend_lease))
	ok('★A4 resolve_us_lend_lease_play 仍在动作白名单',
		(R.view(g, 'Allies').actions || {}).resolve_us_lend_lease_play === 1,
		J(R.view(g, 'Allies').actions))
	ok('A5 控制权仍在被委托国（未误归还美国）', g.current_nation === '苏联')
}

/* ================= B：17829《毛泽东》需补目标 ================= */
console.log('\n=== B 17829《毛泽东》委托苏联：需补目标后委托仍可继续 ===')
{
	const g = scene()
	give(g, '17829', '苏联')
	place(g, 'jp_a2', '日本', 'army', '中国西部')
	I.grant_supply(g, 'jp_a2', g.turn)
	I.refresh(g)
	play17535(g, '苏联')
	const cid = (g.hands['苏联'] || []).find(x => faceOf(x) === '17829')
	const q = R.query(g, 'Allies', 'event_targets', { card: cid, nation: '苏联' })
	console.log('  [B] event_targets = ' + J(q).slice(0, 320))

	let l0 = (g.log || []).length
	R.action(g, 'Allies', 'resolve_us_lend_lease_play', { card: cid, nation: '苏联' })
	I.refresh(g)
	snap(g, 'B1 打出后（需补目标）')
	console.log('  [B] log = ' + logSince(g, l0).slice(0, 300))

	ok('B1 卡回到苏联手牌（待补目标，未吞牌）', (g.hands['苏联'] || []).indexOf(cid) >= 0)
	ok('★B2 委托仍记得被委托国（delegate.nation=苏联）',
		!!(g.delegate && g.delegate.nation === '苏联'), J(g.delegate))
	ok('★B3 view 仍是打牌步',
		(R.view(g, 'Allies').us_lend_lease || {}).step === 'play',
		J(R.view(g, 'Allies').us_lend_lease))
	ok('★B4 resolve_us_lend_lease_play 仍在动作白名单',
		(R.view(g, 'Allies').actions || {}).resolve_us_lend_lease_play === 1)
}

/* ================= C：闭环 —— 补完目标后真的能重提（端到端） ================= */
console.log('\n=== C 补完目标重提：服务端不吞动作、委托可继续推进 ===')
{
	const g = scene()
	give(g, '17828', '苏联')
	place(g, 'jp_a1', '日本', 'army', '中亚')
	I.grant_supply(g, 'jp_a1', g.turn)
	I.refresh(g)
	play17535(g, '苏联')
	const cid = (g.hands['苏联'] || []).find(x => faceOf(x) === '17828')
	/* 候选在委托态正常时取（nation=苏联），避免把"查询挂了"混进被测点 */
	const q0 = R.query(g, 'Allies', 'event_targets', { card: cid, nation: '苏联' })
	const sp = q0 && q0.candidates && q0.candidates[0] && q0.candidates[0].id
	ok('C0 需补目标的候选已下发', sp != null, J(q0).slice(0, 200))

	/* 第一次打出（不带 space）-> pending，重建 delegate */
	R.action(g, 'Allies', 'resolve_us_lend_lease_play', { card: cid, nation: '苏联' })
	I.refresh(g)

	/* 补完目标重提：修复前被 exports.action 的 faction_of_nation(null) 门禁拒绝 */
	let l0 = (g.log || []).length
	R.action(g, 'Allies', 'resolve_us_lend_lease_play',
		{ card: cid, nation: '苏联', space: sp, spaces: [sp] })
	I.refresh(g)
	const l = logSince(g, l0)
	snap(g, 'C1 补完目标重提后')
	console.log('  [C] log = ' + l.slice(0, 320))
	console.log('  [C] pending_event_step = ' + J(g.pending_event_step) + '  event_budget = ' + J(g.event_budget))

	ok('★C1 重提未被阵营门禁拒绝（无「另一阵营暂不能提交」）',
		!/另一阵营暂不能提交/.test(l), l.slice(0, 260))
	ok('★C2 重提后委托仍记得被委托国（delegate.nation=苏联）',
		!!(g.delegate && g.delegate.nation === '苏联'), J(g.delegate))
}

/* ================= D：对照 —— 即时结算卡 / 已验证路径不被误伤 ================= */
console.log('\n=== D 对照：即时结算卡（17800 建设陆军）仍走统一手动归还 ===')
{
	const g = scene()
	give(g, '17800', '苏联')
	I.refresh(g)
	play17535(g, '苏联')
	const c = (g.hands['苏联'] || []).find(x => faceOf(x) === '17800')
	let spot = null
	for (let s = 1; s < d.spaces.length; s++) {
		if (!d.spaces[s]) continue
		if (I.can_build_at(g, '苏联', s, 'army').ok && I.unit_slot_free(g, '苏联', 'army', s).ok) { spot = s; break }
	}
	ok('D0 有合法建设地区', spot != null)
	R.action(g, 'Allies', 'resolve_us_lend_lease_play', { card: c, nation: '苏联', space: spot })
	I.refresh(g)
	const v = R.view(g, 'Allies')
	ok('D1 即时结算卡：delegate.played=true', !!(g.delegate && g.delegate.played === true), J(g.delegate))
	ok('D2 即时结算卡：view.step=done', (v.us_lend_lease || {}).step === 'done', J(v.us_lend_lease))
	ok('D3 即时结算卡：finish_lend_lease 在册', (v.actions || {}).finish_lend_lease === 1)
	let l0 = (g.log || []).length
	R.action(g, 'Allies', 'finish_lend_lease', {})
	I.refresh(g)
	ok('D4 点「结束委托」后归还美国、delegate 清空',
		g.current_nation === '美国' && !g.delegate,
		'current=' + g.current_nation + ' dg=' + J(g.delegate) + ' log=' + logSince(g, l0).slice(0, 160))
}

console.log('\n' + (fail === 0 ? 'ALL PASS（' + pass + ' 项）' : 'FAIL ' + fail + ' / PASS ' + pass))
process.exitCode = fail ? 1 : 0
