/*
 * 15353《保持冷静》拦截「非主动发动」德国状态卡 —— 真实链路测试
 *
 *  A 15250 被攻击：先挂起询问，攻击方**还没**被扣牌（证明"结算前询问"）
 *  B 发动 15353 -> 15250 本回合压制、攻击方 0 损耗、挂起清空
 *  C 同回合再被攻击 -> 不再询问、不再损耗
 *  D 下一国家回合 -> 恢复询问
 *  E 15249 经济战反应：同样先挂起；不发动则照常结算
 *  F 15244 计分自动：先询问；发动 15353 后分数不变
 *
 * 用法：node tools/_real_test_15353_status_intercept.js
 */
const path = require('path')
const ROOT = path.join(__dirname, '..')
const MOD = path.join(ROOT, 'server-official', 'public', 'quartermaster-sub-wars')
const R = require(path.join(MOD, 'rules.js'))
const I = R._internal
const d = I.data

let pass = 0, fail = 0
const ok = (m, c, extra) => { if (c) { pass++; console.log('  ✓ ' + m) } else { fail++; console.log('  ✗ ' + m + (extra ? '  | ' + extra : '')) } }
const logSince = (g, n) => (g.log || []).slice(n).join(' | ')
const deck = (g, n) => (g.decks[n] || []).length
const faceOf = x => String(x).split('#')[0]
const offs = g => (g.armed_offers || []).filter(w => w.when === 'enemy_status_effect')
const offCard = (g, face) => {
	for (const w of offs(g)) for (const c of (w.cards || [])) if (faceOf(c.card_id) === face) return c.card_id
	return null
}
const axisScore = g => (g.score && g.score.axis) || 0
const ukPay = g => (g.hands['英国'] || []).filter(x => faceOf(x) !== '15353').slice(0, 1)

/* 把 15353 给英国、把指定状态卡打到德国桌面 */
function setup(faces) {
	const g = R.setup(7)
	g.opening = null
	g.neutral = { '苏联': false, '美国': false }
	I.refresh(g)
	R.action(g, 'Allies', 'debug_add_card', { face: '15353', nation: '英国', dest: 'hand' })
	for (const f of faces) R.action(g, 'Axis', 'debug_add_card', { face: f, nation: '德国', dest: 'hand' })
	I.refresh(g)
	for (const f of faces) {
		R.action(g, 'Axis', 'debug_set_phase', { nation: '德国', phase: 'play' })
		const c = (g.hands['德国'] || []).find(x => faceOf(x) === f)
		if (c) {
			const n0 = (g.log || []).length
			R.action(g, 'Axis', 'play_card', { card: c })
			const lg = logSince(g, n0)
			if (!(g.table['德国'] || []).some(x => faceOf(x) === f))
				console.log('  [setup] ' + f + ' 未上桌：' + lg.slice(0, 120))
		}
	}
	I.refresh(g)
	return g
}

/* 苏联攻击德国本土（真实 do_battle，15250 的触发源） */
function attack(g) {
	const deSp = d.id_of('德国'), suSp = d.id_of('东欧')
	R.action(g, 'Axis', 'debug_place', { piece: 'de_t', nation: '德国', type: 'army', space: deSp })
	R.action(g, 'Allies', 'debug_place', { piece: 'su_t', nation: '苏联', type: 'army', space: suSp })
	I.refresh(g)
	I.grant_supply(g, 'de_t', g.turn)
	I.grant_supply(g, 'su_t', g.turn)
	R.action(g, 'Allies', 'debug_set_phase', { nation: '苏联', phase: 'play' })
	const n0 = (g.log || []).length
	const r = I.do_battle(g, '苏联', deSp, 'de_t', 'land', { from: 'su_t' })
	return { log: logSince(g, n0) + (r && r.ok === false ? ' 【拒绝】' + r.reason : ''), space: deSp }
}

console.log('=== A. 15250 被攻击：先挂起，未扣牌 ===')
let gA = null, cardA = null
{
	const g = setup(['15250']); gA = g
	console.log('  桌面 = ' + JSON.stringify((g.table['德国'] || [])))
	const ukDeck0 = deck(g, '英国')
	const bt = attack(g)
	console.log('  battle: ' + bt.log.slice(0, 200))
	console.log('  pending_status_react = ' + JSON.stringify(g.pending_status_react && {
		mode: g.pending_status_react.mode, items: g.pending_status_react.items.length,
	}))
	console.log('  窗口 = ' + JSON.stringify(offs(g).map(w => (w.cards || []).map(c => c.card_id))))
	ok('★★ 挂起了拦截询问', !!g.pending_status_react && g.pending_status_react.items.length >= 1,
		JSON.stringify(g.pending_status_react && g.pending_status_react.items.length))
	ok('★★ 英国收到 15353 窗口', !!offCard(g, '15353'), JSON.stringify(offs(g).map(w => (w.cards || []).map(c => c.card_id))))
	console.log('  英国牌库 ' + ukDeck0 + ' -> ' + deck(g, '英国'))
	ok('★★ 询问期间攻击方【还没】被扣牌', deck(g, '英国') === ukDeck0, deck(g, '英国') + ' vs ' + ukDeck0)
	cardA = offCard(g, '15353')
}

console.log('\n=== B. 发动 15353 -> 15250 压制、0 损耗 ===')
{
	const g = gA
	const ukDeck0 = deck(g, '英国')
	const n0 = (g.log || []).length
	R.action(g, 'Allies', 'use_armed_offer', { card: cardA, drop: ukPay(g) })
	console.log('  log: ' + logSince(g, n0).slice(0, 240))
	const sup = (g.status_suppressed_this_turn || {})
	console.log('  suppressed = ' + JSON.stringify(sup) + '  牌库 ' + ukDeck0 + '->' + deck(g, '英国'))
	ok('★★ 15250 被标记本回合压制', Object.keys(sup).some(k => faceOf(k) === '15250'), JSON.stringify(sup))
	ok('★★ 攻击方没被 15250 扣牌', ukDeck0 - deck(g, '英国') === 0, (ukDeck0 - deck(g, '英国')) + ' 张')
	ok('★ 挂起已清空', !g.pending_status_react, JSON.stringify(g.pending_status_react))
	ok('★ 15353 对非主动类不写 status_used', !Object.keys(g.status_used || {}).some(k => faceOf(k) === '15250'),
		JSON.stringify(g.status_used))
}

console.log('\n=== C. 同回合再被攻击 -> 不再询问/不再损耗 ===')
{
	const g = gA
	const ukDeck0 = deck(g, '英国')
	attack(g)
	ok('★★ 不再开窗（已被压制）', !offCard(g, '15353'), JSON.stringify(offs(g).map(w => (w.cards || []).map(c => c.card_id))))
	ok('★★ 同回合不再扣攻击方的牌', deck(g, '英国') === ukDeck0, deck(g, '英国') + ' vs ' + ukDeck0)
}

console.log('\n=== D. 下一国家回合 -> 恢复询问 ===')
{
	const g = gA
	g.turn_owner = '意大利'
	g.turn += 1
	/* 清掉上一场战斗留下的单位，保证新一回合能重新布阵 */
	for (const p of ['de_t', 'su_t']) if (g.location[p] != null) delete g.location[p]
	/* B 段已把 15353 用掉（进弃牌堆），新回合给英国补一张，才能验证"恢复询问" */
	if (!(g.hands['英国'] || []).some(x => faceOf(x) === '15353'))
		R.action(g, 'Allies', 'debug_add_card', { face: '15353', nation: '英国', dest: 'hand' })
	I.refresh(g)
	const bt2 = attack(g)
	console.log('  battle: ' + bt2.log.slice(0, 200))
	console.log('  suppress 键 = ' + JSON.stringify(g.status_suppressed_this_turn) + '  freq=' + (g.turn + ':' + g.turn_owner))
	console.log('  pending = ' + JSON.stringify(g.pending_status_react && g.pending_status_react.items.length))
	ok('★ 新回合重新开窗', !!offCard(g, '15353'), JSON.stringify(offs(g).map(w => (w.cards || []).map(c => c.card_id))))
}

console.log('\n=== E. 15249 经济战反应：先挂起；不发动则照常 ===')
{
	const g = setup(['15249', '15217'])
	console.log('  桌面 = ' + JSON.stringify((g.table['德国'] || [])))
	R.action(g, 'Axis', 'debug_set_phase', { nation: '德国', phase: 'play' })
	I.refresh(g)
	const ec = (g.hands['德国'] || []).find(x => faceOf(x) === '15217')
	const n0 = (g.log || []).length
	R.action(g, 'Axis', 'play_card', { card: ec, target: '苏联' })
	console.log('  econ log: ' + logSince(g, n0).slice(0, 220))
	const w = offCard(g, '15353')
	ok('★★ 经济战反应也先挂起询问', !!g.pending_status_react && !!w,
		JSON.stringify({ pending: !!g.pending_status_react, win: !!w }))
	if (w) {
		const s0 = axisScore(g)
		const n1 = (g.log || []).length
		R.action(g, 'Allies', 'skip_armed_offer', {})
		const lg = logSince(g, n1)
		console.log('  skip log: ' + lg.slice(0, 220))
		ok('★ 选「不发动」-> 15249 照常结算', /狼群战术/.test(lg), lg.slice(0, 140))
		ok('★ 分数加成生效', axisScore(g) > s0 || /经济战加成/.test(lg), axisScore(g) + ' vs ' + s0)
		ok('★ 挂起清空', !g.pending_status_react)
	}
}

console.log('\n=== F. 15244 计分自动：先询问；被拦后分数不变 ===')
{
	const g = setup(['15244'])
	for (const [pid, sp] of [['de_s1', '罗斯'], ['de_s2', '乌克兰'], ['de_s3', '中亚']])
		R.action(g, 'Axis', 'debug_place', { piece: pid, nation: '德国', type: 'army', space: d.id_of(sp) })
	I.refresh(g)
	const s0 = axisScore(g)
	const n0 = (g.log || []).length
	R.action(g, 'Axis', 'debug_set_phase', { nation: '德国', phase: 'scoring' })
	console.log('  scoring log: ' + logSince(g, n0).slice(0, 220))
	const w = offCard(g, '15353')
	ok('★★ 计分阶段入口先挂起询问', !!g.pending_status_react && !!w,
		JSON.stringify({ pending: !!g.pending_status_react, win: !!w }))
	if (w) {
		ok('★★ 询问期间还没加分', axisScore(g) === s0, axisScore(g) + ' vs ' + s0)
		const n1 = (g.log || []).length
		R.action(g, 'Allies', 'use_armed_offer', { card: w, drop: ukPay(g) })
		console.log('  intercept log: ' + logSince(g, n1).slice(0, 220))
		ok('★★ 15244 被压制后计分不增加', axisScore(g) === s0, axisScore(g) + ' vs ' + s0)
		ok('★ 挂起清空', !g.pending_status_react)
	}
}

console.log('\n=== G. 静态守卫 ===')
{
	const fs = require('fs')
	const src = fs.readFileSync(path.join(MOD, 'rules.js'), 'utf8')
	ok('status_on_attacked 改为 queue_status_react', /queue_status_react\(game, 'attacked'/.test(src))
	ok('经济战改为 status_econ_items + queue', /status_econ_items\(game/.test(src))
	ok('计分闸口 + 循环内跳过压制', /__afterIntercept/.test(src) && /status_suppressed_now\(game, cid\)\) continue/.test(src))
	ok('动作门禁：挂起期间只允许表态', /请先处理《保持冷静·继续前进》的拦截询问/.test(src))
	ok('15353 只对主动发动类写 status_used', /const _cfg53 = status_config_of\(cid\)/.test(src))
}

console.log('\n' + (fail === 0 ? 'ALL PASS（' + pass + ' 项）' : fail + ' FAIL / ' + pass + ' 项'))
process.exitCode = fail ? 1 : 0
