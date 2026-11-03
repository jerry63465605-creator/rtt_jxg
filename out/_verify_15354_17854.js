const path = require('path')
const MOD = path.join(__dirname, '..', 'server-official', 'public', 'quartermaster-sub-wars')
const R = require(path.join(MOD, 'rules.js'))
const I = R._internal
const d = require(path.join(MOD, 'data.js')).data
const SP = d.id_of
const BASE = id => String(id).split('#')[0]

let pass = 0, fail = 0
function ok(c, n, x) { if (c) { pass++ } else { fail++; console.log('  FAIL', n, x != null ? JSON.stringify(x) : '') } }

function fresh() {
	const g = R.setup(1)
	g.location = {}; g.piece_nation = {}; g.piece_type = {}; g.piece_seq = 0
	g.markers = {}; g.event_budget = null; g.pending_autobahn = null
	return g
}
function markerCount(g, sp) {
	if (I.markers_on) {
		try { const v = I.markers_on(g, sp); if (typeof v === 'number') return v } catch (e) { }
	}
	const m = g.markers[sp]
	return Array.isArray(m) ? m.length : (m || 0)
}
function effOf(id) {
	/* 这两张走 ECHO 通道（增强卡 EFFECT），不是 EVENT_EFFECTS */
	if (I.ECHO_EFFECTS && I.ECHO_EFFECTS[id]) return I.ECHO_EFFECTS[id]
	if (I.EVENT_EFFECTS && I.EVENT_EFFECTS[id]) return I.EVENT_EFFECTS[id]
	if (I.event_effect_of) { const e = I.event_effect_of(id); if (e) return e }
	if (I.card_effect_of) { const e = I.card_effect_of(id); if (e) return e }
	return null
}

// ============ 15354 加拿大进入动员 ============
console.log('--- 15354 加拿大进入动员（配置） ---')
{
	const e = effOf('15354')
	ok(!!e, '15354 有效果配置')
	if (e) {
		ok(e.name === '加拿大进入动员', 'name 正确', e.name)
		ok(!!(e.cost && e.cost.discard === 2), 'cost.discard = 2', e.cost)
		const st = e.steps || []
		ok(st.length === 2, '两步（陆军 + 海军）', st.length)
		if (st.length === 2) {
			ok(st[0].op === 'recruit' && st[0].type === 'army', '第1步 征召陆军', st[0])
			ok(st[1].op === 'recruit' && st[1].type === 'navy', '第2步 征召海军', st[1])
			const s0 = (st[0].spaces || []).map(Number)
			const s1 = (st[1].spaces || []).map(Number)
			ok(s0.length === 1 && s0[0] === SP('加拿大'), '陆军限<加拿大>', s0)
			ok(s1.length === 1 && s1[0] === SP('北大西洋'), '海军限<北大西洋>', s1)
			/* 地形必须匹配：加拿大=land 陆军、北大西洋=sea 海军 */
			ok(d.spaces[s0[0]] && d.spaces[s0[0]].terrain === 'land', '加拿大是陆地')
			ok(d.spaces[s1[0]] && d.spaces[s1[0]].terrain === 'sea', '北大西洋是海域')
		}
	}
	const trig = (I.CARD_TRIGGERS || {})['15354']
	ok(trig && trig.kind === 'self' && trig.phase === 'scoring',
		'CARD_TRIGGERS 注册 self/scoring', trig)
}

console.log('--- 15354 实跑（计分阶段自触发，弃2张） ---')
{
	let g = fresh()
	g.hands['英国'] = ['15354#1', '15301#1', '15302#1', '15303#1']
	g.current_nation = '英国'; g.turn_phase = 'scoring'; g.active = 'Allies'
	const discBefore = (g.discard['英国'] || []).length
	I.set_skip_turn_guard(true)
	R.action(g, 'Allies', 'play_card', { card: '15354#1' })
	I.set_skip_turn_guard(false)
	ok(g.hands['英国'].indexOf('15354#1') < 0, '15354 离手', g.hands['英国'])
	const discAfter = (g.discard['英国'] || []).length
	ok(discAfter >= discBefore + 2, '弃置 2 张手牌', { discBefore, discAfter })
	ok((g.log || []).some(l => String(l).indexOf('加拿大进入动员') >= 0),
		'日志有本卡结算痕迹', (g.log || []).slice(-3))
}

// ============ 17854 共青城 ============
console.log('--- 17854 共青城（建设陆军后 +1 计分标记） ---')
{
	const e = effOf('17854')
	ok(!!e, '17854 有效果配置')
	if (e && e.armed) {
		ok(e.armed.when === 'after_build_army', 'armed.when = after_build_army', e.armed.when)
		ok(!e.armed.cost, '无代价（卡面未写）', e.armed.cost)
		/* 直接跑 armed.run：验证"建设地区 +1 标记" */
		let g = fresh()
		const sp = SP('莫斯科')
		if (sp != null) {
			const before = markerCount(g, sp)
			const r = e.armed.run(g, { space: sp })
			ok(r && r.ok, 'run 返回 ok', r)
			ok(markerCount(g, sp) === before + 1,
				'建设地区 +1 个计分标记', { before, after: markerCount(g, sp) })
			const r2 = e.armed.run(g, { space: null })
			ok(r2 && r2.skip === true, '无地区时 skip（不崩）', r2)
		} else {
			ok(false, '未知地区 莫斯科')
		}
	} else {
		ok(false, '17854 缺少 armed 配置', e && Object.keys(e))
	}
	const trig = (I.CARD_TRIGGERS || {})['17854']
	ok(trig && trig.kind === 'load', 'CARD_TRIGGERS 注册 load', trig)
}

console.log('\nPASS=' + pass + '  FAIL=' + fail)
process.exit(fail ? 1 : 0)
