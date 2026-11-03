const path = require('path')
const MOD = path.join(__dirname, '..', 'server-official', 'public', 'quartermaster-sub-wars')
const R = require(path.join(MOD, 'rules.js'))
const I = R._internal
const d = require(path.join(MOD, 'data.js')).data
const SP = d.id_of

let pass = 0, fail = 0
function ok(c, n, x) { if (c) { pass++ } else { fail++; console.log('  FAIL', n, x != null ? JSON.stringify(x) : '') } }

function fresh() {
	const g = R.setup(1)
	g.location = {}; g.piece_nation = {}; g.piece_type = {}; g.piece_seq = 0
	g.markers = {}
	return g
}
function place(g, nation, type, spaceName, id) {
	const pid = id || ('T' + (++g.piece_seq))
	const sp = SP(spaceName)
	if (sp == null) throw new Error('unknown space ' + spaceName)
	g.location[pid] = sp; g.piece_nation[pid] = nation; g.piece_type[pid] = type
	return pid
}
function echoOf(id) {
	return (I.ECHO_EFFECTS && I.ECHO_EFFECTS[id]) || (I.EVENT_EFFECTS && I.EVENT_EFFECTS[id]) || null
}

// ============ 17751 俄罗斯解放军（意大利状态卡，★） ============
console.log('--- 17751 俄罗斯解放军 ---')
{
	ok(I.is_starred_card && I.is_starred_card('17751#1'), '已登记为★星卡')
	const st = I.STATUS_EFFECTS && I.STATUS_EFFECTS['17751']
	ok(!!st, '有状态卡配置')
	if (st && st.auto) {
		ok(st.auto.phase === 'scoring', 'auto.phase = scoring', st.auto.phase)
		ok(st.auto.trigger_nation === '苏联', 'trigger_nation = 苏联', st.auto.trigger_nation)

		/* 乌克兰未被苏联控制 -> -1（失分） */
		let g = fresh()
		const v1 = st.auto.run(g)
		ok(v1 === -1, '乌克兰未被苏联控制 -> -1', v1)

		/* 乌克兰被苏联控制 -> 0 */
		let g2 = fresh()
		place(g2, '苏联', 'army', '乌克兰', 'SU1')
		const v2 = st.auto.run(g2)
		ok(v2 === 0, '乌克兰被苏联控制 -> 0', v2)
	}
	/* ★ -> 意大利国家技能 trigger=star_resolved 应已配置 */
	const skill = I.NATIONAL_SKILL && I.NATIONAL_SKILL['意大利']
	ok(!!skill && skill.trigger === 'star_resolved', '意大利国家技能 trigger=star_resolved', skill)
}

// ============ 15350 奇袭塔兰托 ============
console.log('--- 15350 奇袭塔兰托 ---')
{
	const e = echoOf('15350')
	ok(!!e, '有效果配置')
	if (e) {
		ok(e.name === '奇袭塔兰托', 'name', e.name)
		ok(!!(e.cost && e.cost.discard === 2), 'cost.discard = 2', e.cost)
		const st = (e.steps || [])[0]
		ok(st && st.op === 'eliminate', 'op = eliminate', st && st.op)
		ok(st && st.type === 'navy', 'type = navy', st && st.type)
		ok(st && (st.spaces || []).map(Number).indexOf(SP('地中海')) >= 0,
			'地区限定<地中海>', st && st.spaces)
		/* cond：地中海相邻有无英国飞机 */
		let g = fresh()
		ok(e.cond(g).ok === false, '无英国飞机时 cond 不满足', e.cond(g))
		const med = SP('地中海')
		const nbrs = (d.spaces[med].connections || []).map(Number)
		let placed = null
		for (const n of nbrs) { place(g, '英国', 'air', d.name_of(n), 'UKAIR'); placed = n; break }
		ok(e.cond(g).ok === true, '有英国飞机时 cond 满足（放于 ' + d.name_of(placed) + '）', e.cond(g))
	}
	const trig = (I.CARD_TRIGGERS || {})['15350']
	ok(trig && trig.kind === 'self' && trig.phase === 'scoring', 'CARD_TRIGGERS self/scoring', trig)
}

// ============ 15355 特种空勤团突袭机场 ============
console.log('--- 15355 特种空勤团突袭机场 ---')
{
	const e = echoOf('15355')
	ok(!!e, '有效果配置')
	if (e && e.armed) {
		ok(e.armed.when === 'play_start', 'armed.when = play_start', e.armed.when)
		ok(!!(e.armed.cost && e.armed.cost.discard === 2), 'cost.discard = 2', e.armed.cost)

		let g = fresh()
		/* 英国空军（补给中） + 相邻敌方空军 */
		const ukAir = place(g, '英国', 'air', '不列颠', 'UKA1')
		const nbrs = (d.spaces[SP('不列颠')].connections || []).map(Number)
		let enemySp = null
		for (const n of nbrs) { if (d.spaces[n]) { enemySp = n; break } }
		const enemyAir = place(g, '德国', 'air', d.name_of(enemySp), 'GEA1')
		I.grant_supply(g, ukAir, g.turn || 1)
		I.compute_supply(g)

		const cands = I.uk_sas_air_targets ? I.uk_sas_air_targets(g) : e.armed.run(g, {}, {}) && null
		ok(e.armed.ready(g) === true, 'ready = true（有相邻敌机）')

		/* 第一次调用缺 arg.piece -> 应返回 need:'piece' */
		const need = e.armed.run(g, {}, {})
		ok(need && need.need === 'piece', '缺参数时返回 need:piece', need && need.need)
		ok(need && (need.candidates || []).indexOf(String(enemyAir)) >= 0,
			'候选含该敌机', need && need.candidates)

		/* 传入 piece -> seize_air 消灭 */
		const r = e.armed.run(g, {}, { piece: String(enemyAir) })
		ok(r && r.ok, '执行返回 ok', r)
		ok(g.location[enemyAir] == null, '敌方空军已被消灭')
		ok(g.location[ukAir] != null, '己方发起空军留原地（seize_air 语义）')

		/* 无候选时 skip 不崩 */
		let g2 = fresh()
		const skip = e.armed.run(g2, {}, {})
		ok(skip && skip.skip === true, '无候选时 skip', skip)
	} else {
		ok(false, '15355 缺少 armed 配置')
	}
	const trig = (I.CARD_TRIGGERS || {})['15355']
	ok(trig && trig.kind === 'load', 'CARD_TRIGGERS load', trig)
}

console.log('\nPASS=' + pass + '  FAIL=' + fail)
process.exit(fail ? 1 : 0)
