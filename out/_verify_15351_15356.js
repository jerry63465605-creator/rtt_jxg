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

// ============ 15351 敦刻尔克大撤退（二选一）============
console.log('--- 15351 敦刻尔克大撤退 ---')
{
	const e = echoOf('15351')
	ok(!!e, '有效果配置')
	if (e && e.armed) {
		ok(e.armed.when === 'piece_removed', 'armed.when = piece_removed', e.armed.when)
		ok(!!(e.armed.cost && e.armed.cost.discard === 2), 'cost.discard = 2', e.armed.cost)

		let g = fresh()
		/* 二选一：缺 choice 时应返回 need:'choice' + choiceOptions */
		const need = e.armed.run(g, { piece_nation: '英国', piece_type: 'army', space: SP('西欧') }, {})
		ok(need && need.need === 'choice', '缺参数返回 need:choice', need && need.need)
		const ids = (need && need.choiceOptions || []).map(o => o.id)
		ok(ids.indexOf('navy') >= 0 && ids.indexOf('army') >= 0,
			'两个分支 navy / army', ids)

		/* ready 过滤：非西欧 / 非陆海军 不应触发 */
		ok(e.armed.ready(g, { piece_nation: '德国', piece_type: 'army', space: SP('西欧') }) === false,
			'ready 拒绝非英/法单位')
		ok(e.armed.ready(g, { piece_nation: '英国', piece_type: 'navy', space: SP('西欧') }) === false,
			'ready 拒绝非陆军')
		ok(e.armed.ready(g, { piece_nation: '英国', piece_type: 'army', space: SP('东欧') }) === false,
			'ready 拒绝非<西欧>')
		ok(e.armed.ready(g, { piece_nation: '英国', piece_type: 'army', space: SP('西欧') }) === true,
			'ready 接受<西欧>的英国陆军')
	}
	const trig = (I.CARD_TRIGGERS || {})['15351']
	ok(trig && trig.kind === 'load', 'CARD_TRIGGERS load', trig)
}

// ============ 15356 地中海基地（状态卡）============
console.log('--- 15356 地中海基地 ---')
{
	const st = I.STATUS_EFFECTS && I.STATUS_EFFECTS['15356']
	ok(!!st, '有状态卡配置')
	if (st) {
		/* ① 持续光环：限定兵种/地区 */
		const og = st.ongoing || {}
		ok(og.kind === 'always_supplied', 'ongoing.kind = always_supplied', og.kind)
		ok(og.nation === '英国', '限定英国', og.nation)
		ok(og.type === 'navy', '限定海军', og.type)
		ok(og.space === '地中海', '限定<地中海>', og.space)

		/* ② 激活：跳过出牌阶段 + 弃 2 张 */
		const tr = st.trigger || {}
		ok(tr.window === 'play_start', 'trigger.window = play_start', tr.window)
		ok(!!(tr.cost && tr.cost.skip_play === true), 'cost.skip_play = true', tr.cost)
		ok(!!(tr.cost && tr.cost.discard === 2), 'cost.discard = 2', tr.cost)
		ok(!!(tr.effect && tr.effect.type === 'navy'), 'effect 建海军', tr.effect)
	}

	/* 光环作用域真的生效：地中海的英国海军补给，英国陆军/他处海军不受惠 */
	let g = fresh()
	/* 对照单位必须放在【远离补给】的地区，否则自然就在补给中，验证不出光环作用域 */
	const medNavy = place(g, '英国', 'navy', '地中海', 'UKN_MED')
	const otherNavy = place(g, '英国', 'navy', '南太平洋', 'UKN_FAR')
	const ukArmy = place(g, '英国', 'army', '中亚', 'UKA_FAR')
	I.apply_status_ongoing(g, '15356#1', '英国')
	I.compute_supply(g)
	const sup = I.compute_supply(g)
	ok(sup.in_supply[medNavy] === true, '<地中海>英国海军 -> 补给中')
	ok(!sup.in_supply[otherNavy], '北海英国海军 -> 不受光环（未自动补给）')
	ok(!sup.in_supply[ukArmy], '英国陆军 -> 不受光环')

	/* 卡离场后作用域应清掉 */
	I.revert_status_ongoing(g, '15356#1', '英国')
	ok(!((g.status_aura.supply_immune_scope || {})['英国']), '离场后作用域已清除')
}

console.log('\nPASS=' + pass + '  FAIL=' + fail)
process.exit(fail ? 1 : 0)
