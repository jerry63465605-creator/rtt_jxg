/*
 * 只读探针：16703《罗马尼亚铁卫团》让权 × 意大利国家技能窗口的时序
 *
 * 玩家口径：「当前 16703 的让权，希望参考 17721，保证不会让意大利国家技能和让权冲突」
 *
 * 不改任何产品代码。用 _board_lib.new_board 建真实盘面，真实 R.action 打出 16703，
 * 观察：
 *   Q1 打出瞬间是否【同时】存在 national_skill_offer 与 delegate[german_draw]？
 *   Q2 两条收尾路径（德国点手牌 italy_german_draw / 点放弃 event_delegate_decline）
 *      各自归还后，技能窗口是否还在？current_nation / active 是否正确？
 *   Q3 对照 17721：它打出后是否【不】开窗、归还后才补开？
 *
 * 用法：node tools/_probe_16703_skill_handoff.js
 */
const L = require('./_board_lib')
const { R, I, d, faceOf, new_board, give, clear_pending } = L

const J = x => JSON.stringify(x)
const offer = g => g.national_skill_offer
	? ('OPEN(' + g.national_skill_offer.nation + ')') : 'null'
const acts = (g, side) => Object.keys(R.view(g, side).actions || {})
const logSince = (g, n) => (g.log || []).slice(n).join(' | ')

function dump(g, tag) {
	console.log('\n--- ' + tag + ' ---')
	console.log('  current_nation=' + g.current_nation + '  active=' + g.active)
	console.log('  delegate=' + J(g.delegate && { mode: g.delegate.mode, delegate: g.delegate.delegate,
		return_nation: g.delegate.return_nation, return_active: g.delegate.return_active }))
	console.log('  national_skill_offer=' + offer(g))
	console.log('  pending_17721_skill=' + J(!!g.pending_17721_skill) +
		'  national_skill_deferred=' + J(g.national_skill_deferred || null))
	console.log('  extra_play=' + J(g.extra_play && { source: g.extra_play.source, nation: g.extra_play.nation }))
	console.log('  view(Axis).national_skill=' + J(R.view(g, 'Axis').national_skill
		? { usable: R.view(g, 'Axis').national_skill.usable, source: R.view(g, 'Axis').national_skill.source_name } : null))
	console.log('  view(Axis).delegate=' + J(R.view(g, 'Axis').delegate && R.view(g, 'Axis').delegate.mode))
	console.log('  acts(Axis) 技能键 = [' + acts(g, 'Axis').filter(k => /national_skill/.test(k)).join(',') + ']')
	console.log('  acts(Axis) 委托键 = [' + acts(g, 'Axis').filter(k => /italy_german_draw|delegate_decline/.test(k)).join(',') + ']')
	console.log('  acts(Axis) 全量 = ' + J(acts(g, 'Axis').slice(0, 16)))
}

/**
 * 16703 是【分步卡】（step1 recruit → step2 run 建 delegate），
 * 真实打出后停在 step1，必须用 event_step_next 真实推进到 step2，
 * 绝不能手写 g.delegate（rtt-card-bug-repro 铁律）。
 */
function drive16703ToDelegate(g, maxStep = 6) {
	for (let i = 0; i < maxStep; i++) {
		if (g.delegate && g.delegate.mode === 'german_draw') return true
		const a = acts(g, 'Axis')
		if (a.indexOf('event_step_next') >= 0) {
			R.action(g, 'Axis', 'event_step_next', {})
			continue
		}
		break
	}
	return !!(g.delegate && g.delegate.mode === 'german_draw')
}

/** 真实建盘：意大利出牌阶段，手里有 16703（必要时 debug_add_card） */
function scene(card) {
	const g = new_board(20261108, { nation: '意大利', phase: 'play' })
	clear_pending(g)
	g.current_nation = '意大利'
	g.active = 'Axis'
	/* 巴尔干要能征召陆军：给它一个补给点，避免 16703 的 recruit step 失败 */
	const BALKAN = d.id_of('巴尔干')
	if (BALKAN != null) I.set_supply_point(g, BALKAN, 'axis', true)
	I.refresh(g)
	R.action(g, 'Axis', 'debug_add_card', { face: card, nation: '意大利', dest: 'hand' })
	I.refresh(g)
	const cid = (g.hands['意大利'] || []).find(x => faceOf(x) === String(card))
	/* 确保国家技能可用（一回合一次未用过） */
	delete (g.national_skill_used || {})['意大利']
	return { g, cid }
}

/* ================= A. 16703 打出瞬间 ================= */
console.log('=== A. 真实打出 16703 ===')
{
	const { g, cid } = scene('16703')
	console.log('  16703 实例 = ' + cid)
	const n0 = (g.log || []).length
	R.action(g, 'Axis', 'play_card', { card: cid })
	console.log('  打出 log = ' + logSince(g, n0).slice(0, 400))
	dump(g, 'A0 16703 打出后（停在第 1 步）')
	const reached = drive16703ToDelegate(g)
	console.log('  真实推进分步机到 delegate = ' + reached)
	console.log('  推进 log = ' + logSince(g, n0).slice(0, 500))
	dump(g, 'A1 16703 第 2 步完成（delegate 真实建立）')
	console.log('  ★ Q1 两窗口是否共存 = ' +
		(!!g.national_skill_offer && !!(g.delegate && g.delegate.mode === 'german_draw')))
}

/* ================= B. 16703 两条收尾路径 ================= */
console.log('\n=== B. 16703 收尾：德国点手牌（italy_german_draw）===')
{
	const { g, cid } = scene('16703')
	R.action(g, 'Axis', 'play_card', { card: cid })
	drive16703ToDelegate(g)
	dump(g, 'B0 收尾前（真实 delegate）')
	const n0 = (g.log || []).length
	R.action(g, 'Axis', 'italy_german_draw', { card_id: null })
	console.log('  收尾 log = ' + logSince(g, n0).slice(0, 260))
	dump(g, 'B1 真实弃牌放弃后')
	console.log('  ★ Q2a 归还后技能窗口 = ' + offer(g))
}

console.log('\n=== C. 16703 收尾：德国点「放弃」按钮（event_delegate_decline）===')
{
	const { g, cid } = scene('16703')
	R.action(g, 'Axis', 'play_card', { card: cid })
	drive16703ToDelegate(g)
	const n0 = (g.log || []).length
	R.action(g, 'Axis', 'event_delegate_decline', {})
	console.log('  收尾 log = ' + logSince(g, n0).slice(0, 300))
	dump(g, 'C1 放弃按钮后')
	console.log('  ★ Q2b 归还后技能窗口 = ' + offer(g))
}

/* ================= D. 对照 17721 ================= */
console.log('\n=== D. 对照：真实打出 17721 ===')
{
	const { g, cid } = scene('17721')
	/* 17721 链式：意大利还须真实打出 1 张[响应卡] 才会把控制权翻给德国 */
	R.action(g, 'Axis', 'debug_add_card', { face: '17730', nation: '意大利', dest: 'hand' })
	R.action(g, 'Axis', 'debug_add_card', { face: '15338', nation: '德国', dest: 'hand' })
	I.refresh(g)
	const resp = (g.hands['意大利'] || []).find(x => faceOf(x) === '17730')
	console.log('  17721 实例 = ' + cid + '  意大利响应牌 = ' + resp)
	const n0 = (g.log || []).length
	R.action(g, 'Axis', 'play_card', { card: cid })
	console.log('  打出 log = ' + logSince(g, n0).slice(0, 300))
	dump(g, 'D0 17721 打出后（尚未翻控制权）')
	console.log('  ★ Q3a 打出后不立即开窗 = ' + (!g.national_skill_offer))
	const n1 = (g.log || []).length
	R.action(g, 'Axis', 'play_card', { card: resp })
	console.log('  打响应牌 log = ' + logSince(g, n1).slice(0, 260))
	dump(g, 'D1 意大利打出响应牌后（delegate 建立）')
	console.log('  ★ Q3b 让权期间仍不开窗 = ' + (!g.national_skill_offer))
	const n2 = (g.log || []).length
	R.action(g, 'Axis', 'event_delegate_decline', {})
	console.log('  归还 log = ' + logSince(g, n2).slice(0, 240))
	dump(g, 'D2 17721 德国放弃归还后')
	console.log('  ★ Q3c 归还后补开技能窗口 = ' + offer(g))
}

console.log('\n=== 结论 ===')
console.log('  Q1 看 A1：true = 16703 打出瞬间【技能窗口与让权并存】（玩家要避免的冲突）')
console.log('  Q2 看 B1/C1：两条收尾路径是否一致、技能窗口是否被误清')
console.log('  Q3 看 D1/D2：17721 的「打出不开窗 → 归还后补开」参考范式')
