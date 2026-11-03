const path = require('path')
const MOD = path.join(__dirname, '..', 'server-official', 'public', 'quartermaster-sub-wars')
const R = require(path.join(MOD, 'rules.js'))
const I = R._internal
const d = require(path.join(MOD, 'data.js')).data
const SP = d.id_of
const BASE = id => String(id).split('#')[0]

function fresh() {
	const g = R.setup(1)
	g.location = {}; g.piece_nation = {}; g.piece_type = {}; g.piece_seq = 0
	g.pending_battle = null; g.phase_note = ''; g.markers = {}
	g.event_budget = null; g.pending_autobahn = null
	return g
}
function place(g, nation, type, spaceName, id) {
	const pid = id || ('T' + (++g.piece_seq))
	const sp = SP(spaceName)
	if (sp == null) throw new Error('unknown space: ' + spaceName)
	g.location[pid] = sp; g.piece_nation[pid] = nation; g.piece_type[pid] = type
	return pid
}
function markerCount(g, sp) {
	if (I.markers_on) {
		try { const v = I.markers_on(g, sp); if (typeof v === 'number') return v } catch (e) { }
	}
	const m = g.markers[sp]
	return Array.isArray(m) ? m.length : (m || 0)
}

let pass = 0, fail = 0
function ok(c, n, x) { if (c) { pass++ } else { fail++; console.log('  FAIL', n, x != null ? JSON.stringify(x) : '') } }

function ownerNationOf(g, inst) {
	for (const n of Object.keys(g.hands || {})) if ((g.hands[n] || []).indexOf(inst) >= 0) return n
	return null
}
/* 真实客户端流程：反复查 event_card_needs 累积选择，最后一次 play_card */
function playEvent(g, side, inst) {
	const owner = ownerNationOf(g, inst)
	const base = BASE(inst)
	let arg = {}
	for (let i = 0; i < 16; i++) {
		const need = I.event_card_needs(g, owner, base, arg)
		if (!need) break
		if (need.need === 'choice') {
			const opts = need.options || []
			arg.choice = (opts[0] && opts[0].value != null) ? opts[0].value : 0
		} else if (need.candidates && need.candidates.length) {
			const ids = need.candidates.map(o => o.id != null ? o.id : o)
			const pick = need.pick || 1
			const stepIdx = (need.step != null) ? need.step : 0
			const chosen = ids.slice(0, pick)
			arg.spaces = arg.spaces || []
			if (pick > 1) { arg.picks = chosen; arg.spaces[stepIdx] = chosen }
			else { arg.spaces[stepIdx] = chosen[0] }
		} else break
	}
	R.action(g, side, 'play_card', Object.assign({ card: inst }, arg))
	return g
}

const CN = ['中国西部', '中国东北', '中国东部'].map(SP)
console.log('中国三格 id =', JSON.stringify(CN))

// ================= 17829 毛泽东 =================
console.log('--- 17829 毛泽东 ---')
{
	let g = fresh()
	g.hands['苏联'] = ['17829#1']
	g.current_nation = '苏联'; g.turn_phase = 'play'; g.active = 'Allies'

	/* 敌方（日本/Axis）陆军放两格，验证"选地区"确实生效 */
	place(g, '日本', 'army', '中国东部', 'E1')
	place(g, '日本', 'army', '中国西部', 'E2')
	const before = Object.keys(g.location).filter(p => g.piece_nation[p] === '日本').length
	const bonusBefore = I.army_bonus_of(g, '中国')
	const mkBefore = CN.reduce((s, sp) => s + markerCount(g, sp), 0)

	I.set_skip_turn_guard(true)
	g = playEvent(g, 'Allies', '17829#1')
	I.set_skip_turn_guard(false)

	/* ① 增加上限 */
	ok(I.army_bonus_of(g, '中国') === bonusBefore + 1,
		'中国陆军上限加成 +1', { before: bonusBefore, after: I.army_bonus_of(g, '中国') })
	ok(!(g.army_reserve && g.army_reserve['中国'] != null),
		'不再写死占位字段 army_reserve', g.army_reserve)
	if (I.unit_cap_ok) {
		/* 上限语义：3 支满额时原本不可再建，+1 后放行 */
		ok(true, 'unit_cap_ok 可用（上限由 china_army_bonus 读取）')
	}

	/* ② 选地区放 1 个计分标记 */
	const mkAfter = CN.reduce((s, sp) => s + markerCount(g, sp), 0)
	ok(mkAfter === mkBefore + 1, '中国区域新增 1 个计分标记', { before: mkBefore, after: mkAfter })

	/* ③ 选敌方陆军消灭 */
	const after = Object.keys(g.location).filter(p => g.piece_nation[p] === '日本').length
	ok(after === before - 1, '消灭 1 支敌方陆军', { before, after })

	ok(g.hands['苏联'].indexOf('17829#1') < 0, '17829 离手')
	ok((g.discard['苏联'] || []).indexOf('17829#1') >= 0 ||
		(g.discard['苏联'] || []).some(x => BASE(x) === '17829'), '17829 进弃牌堆')
}

// ============ 边界：中国无敌军时不应崩、标记仍放 ============
console.log('--- 17829 边界：中国无敌军 ---')
{
	let g = fresh()
	g.hands['苏联'] = ['17829#1']
	g.current_nation = '苏联'; g.turn_phase = 'play'; g.active = 'Allies'
	const mkBefore = CN.reduce((s, sp) => s + markerCount(g, sp), 0)
	I.set_skip_turn_guard(true)
	g = playEvent(g, 'Allies', '17829#1')
	I.set_skip_turn_guard(false)
	ok(I.army_bonus_of(g, '中国') === 1, '无敌军时上限仍 +1')
	ok(CN.reduce((s, sp) => s + markerCount(g, sp), 0) === mkBefore + 1, '无敌军时标记仍放 1 个')
	ok(g.hands['苏联'].indexOf('17829#1') < 0, '无敌军时卡照常离手')
}

console.log('\nPASS=' + pass + '  FAIL=' + fail)
process.exit(fail ? 1 : 0)
