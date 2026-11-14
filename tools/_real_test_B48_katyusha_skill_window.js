/*
 * 【本体 #10 / B48】★国家技能窗口不得清掉同一时点的 after_land 状态窗口。
 *
 * 复现链路（真实 R.setup / I.do_battle / R.action）：
 *   苏联陆战德国陆军 -> 德军被移除 -> 17842《喀秋莎》after_land 武装进 status_instant
 *   -> 意大利暗置 17734《罗马尼亚增援》（★响应）触发并结算
 *   -> 意大利国家技能窗（national_skill_offer）打开
 *   -> 玩家点「发动技能 / 跳过技能」把 status_instant 清空 -> 喀秋莎 ready true 变 false
 *
 * 修法：hasSuspended 补 !!game.national_skill_offer（与 event_budget /
 * pending_event_step / us_theater_delegate 同款补漏）。
 * 用法：node tools/_real_test_B48_katyusha_skill_window.js
 */
const path = require('path')
const fs = require('fs')
const MOD = path.join(__dirname, '..', 'server-official', 'public', 'quartermaster-sub-wars')
const R = require(path.join(MOD, 'rules.js'))
const I = R._internal
const D = require(path.join(MOD, 'data.js')).data
const J = x => JSON.stringify(x)

const A = D.id_of('中国东北')
const B = D.id_of('中国东部')
let pass = 0, fail = 0
const ok = (m, c, extra) => {
	if (c) { pass++; console.log('  ✓ ' + m) }
	else { fail++; console.log('  ✗ ' + m + (extra !== undefined ? '  | ' + extra : '')) }
}

/* 摆局面：苏联参战 + 陆军在 A + 桌面喀秋莎；德国补给陆军在 B；意桌暗置 17734 */
function seed() {
	const g = R.setup(20261112, 'Standard')
	let q = 0
	while (g.opening && q++ < 12) {
		const n = g.current_nation
		R.action(g, g.active, 'opening_discard', { cards: (g.hands[n] || []).slice(0, 3) })
	}
	g.location = {}; g.piece_nation = {}; g.piece_type = {}
	g.current_nation = '苏联'
	g.active = 'Allies'
	g.turn_phase = 'play'
	try { I.end_neutral(g, '苏联', 'B48 测试') } catch (e) {}
	g.location.su = A
	g.piece_nation.su = '苏联'
	g.piece_type.su = 'army'
	g.table['苏联'] = ['17842#k1']
	g.location.de = B
	g.piece_nation.de = '德国'
	g.piece_type.de = 'army'
	I.grant_supply(g, 'su', g.turn || 1)
	I.grant_supply(g, 'de', g.turn || 1)
	I.compute_supply(g)
	g.table_responses = [{
		card_id: '17734#r1', card_face: '17734',
		owner_side: 'axis', name: '罗马尼亚增援',
	}]
	g.hands['苏联'] = ['17800#h1', '17800#h2']
	g.hands['意大利'] = ['17749#i1']
	return g
}
const katyushaReady = g => {
	const row = (R.view(g, 'Allies').table_status || [])
		.find(x => String(x.card) === '17842#k1')
	return row ? row.ready : null
}
const hasAfterLand = g => (g.status_instant || [])
	.some(e => String(e.card_id) === '17842#k1' && e.window === 'after_land')
const openSkill = g => {
	g.national_skill_used = g.national_skill_used || {}
	delete g.national_skill_used['意大利']
	g.national_skill_offer = {
		nation: '意大利', trigger: 'star_resolved',
		source: '意大利国家技能', source_name: '意大利国家技能',
		cost: { points: 2 }, grant: { filter: 'status_response' },
	}
}

console.log('=== A. 陆战 + 17734：喀秋莎武装，响应未决时置灰 ===')
let g = seed()
const rb = I.do_battle(g, '苏联', B, 'de', 'land')
ok('★★ 陆战成功移除德军', rb.ok === true && !g.location.de, J(rb))
ok('★★ 喀秋莎 after_land 已武装进 status_instant',
	hasAfterLand(g) && katyushaReady(g) === false, J(g.status_instant))
ok('★ 响应窗口未决期间 ready=false（合理，玩家须先答 17734）',
	katyushaReady(g) === false &&
	(R.view(g, 'Allies').table_status || []).some(x =>
		String(x.card) === '17842#k1' && /挂起/.test(x.ready_reason || '')))
R.action(g, 'Axis', 'trigger_response', {})
ok('★★ 17734 结算后喀秋莎变 ready、白名单下发 activate_status',
	katyushaReady(g) === true &&
	!!(R.view(g, 'Allies').actions || {})['activate_status:17842#k1'],
	J({ ready: katyushaReady(g), acts: Object.keys(R.view(g, 'Allies').actions || {}) }))

console.log('\n=== B. 意大利【发动】技能：不得清掉喀秋莎窗口 ===')
{
	openSkill(g)
	ok('★ 技能窗口已挂（use_national_skill 在白名单）',
		!!(R.view(g, 'Axis').actions || {}).use_national_skill)
	const before = hasAfterLand(g)
	const scoreBefore = (g.score && g.score.axis) || 0
	R.action(g, 'Axis', 'use_national_skill', { play: '17749#i1' })
	ok('★★ 发动技能后 status_instant 仍保留 17842 的 after_land 条目',
		before && hasAfterLand(g), J(g.status_instant))
	ok('★★ 发动技能后喀秋莎仍 ready、activate_status 仍下发',
		katyushaReady(g) === true &&
		!!(R.view(g, 'Allies').actions || {})['activate_status:17842#k1'],
		J({ ready: katyushaReady(g), si: g.status_instant }))
	ok('★ 技能确实生效（轴心 -2 分、额外打出已授权、窗口已关）',
		!g.national_skill_offer &&
		g.national_skill_used['意大利'] === g.turn &&
		((g.score && g.score.axis) || 0) === scoreBefore - 2 &&
		!!g.extra_play,
		J({ offer: g.national_skill_offer, score: g.score, extra: g.extra_play,
			used: g.national_skill_used }))
}

console.log('\n=== C. 意大利【跳过】技能：同样不得清 ===')
{
	const g2 = seed()
	I.do_battle(g2, '苏联', B, 'de', 'land')
	R.action(g2, 'Axis', 'trigger_response', {})
	openSkill(g2)
	R.action(g2, 'Axis', 'skip_national_skill', {})
	ok('★★ 跳过技能后 status_instant 仍保留 17842、ready 仍 true',
		hasAfterLand(g2) && katyushaReady(g2) === true &&
		!g2.national_skill_offer,
		J({ si: g2.status_instant, ready: katyushaReady(g2) }))
}

console.log('\n=== D. 技能结算后仍能正常发动喀秋莎 ===')
{
	const r = R.action(g, 'Allies', 'activate_status', { card: '17842#k1' })
	ok('★★ 点喀秋莎进入「弃 1 张手牌」待选态（不是被拒）',
		!!r && /请先选择要弃置的 1 张手牌/.test((g.log || []).slice(-3).join('|')),
		J((g.log || []).slice(-3)))
}

console.log('\n=== E. 真正的独立动作仍会关闭窗口（「立刻」语义不回归）===')
{
	/* 技能窗已关（B 组发动后 offer 清空），此时推进阶段应清空 status_instant */
	R.action(g, 'Allies', 'next_phase', {})
	ok('★★ 窗口关闭后推进阶段 -> status_instant 被清空',
		!hasAfterLand(g) && katyushaReady(g) === false, J(g.status_instant))
}

console.log('\n=== F. 静态守卫 ===')
{
	const src = fs.readFileSync(path.join(MOD, 'rules.js'), 'utf8')
	ok('★★ hasSuspended 已含 national_skill_offer',
		/!!game\.national_skill_offer/.test(src))
	ok('★ 该判定仍在 status_instant 清空之前（顺序未被打乱）', (() => {
		const iSus = src.indexOf('const hasSuspended =')
		const iClear = src.indexOf('game.status_instant = []', iSus)
		const iOffer = src.indexOf('!!game.national_skill_offer', iSus)
		return iSus > 0 && iOffer > iSus && iClear > iOffer
	})())
	ok('★ 客户端零改动 -> 版本串仍 20261114a',
		(fs.readFileSync(path.join(MOD, 'play.html'), 'utf8')
			.match(/\?v=([0-9a-z]+)/g) || []).map(s => s.slice(3))
			.every(v => v === '20261114a'))
}

console.log('\n' + (fail === 0 ? 'ALL PASS（' + pass + ' 项）' : 'FAIL ' + fail + ' 项 / PASS ' + pass + ' 项'))
process.exitCode = fail ? 1 : 0
