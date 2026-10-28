/*
 * 17532《战区移动》重实现回归（pending_theater 分步状态机，参照 15228 高速公路）
 *
 * 覆盖：
 *   A. 先海军：remove → build_navy → build_army → 收尾（卡进弃牌堆、状态清空）
 *   B. 先陆军：顺序相反
 *   C. 候选与执行同源（每个候选逐个 dry-run）
 *   D. 非法选择：停在本步、不清状态、可改选
 *   E. 门禁：非本方阵营 / 挂起期间 play_card 被拒
 *
 * 用法：node tools/_smoke_17532_theater.js
 */
const path = require('path')
const MOD = path.join(__dirname, '..', 'server-official', 'public', 'quartermaster-sub-wars')
const rules = require(path.join(MOD, 'rules.js'))
const I = rules._internal
const d = require(path.join(MOD, 'data.js')).data

let fails = 0
function ok(label, cond, extra) {
	console.log((cond ? '  PASS  ' : '  FAIL  ') + label + (extra !== undefined ? '  | ' + extra : ''))
	if (!cond) fails++
}

function fresh() {
	const g = rules.setup(1)
/* 【2026-10-28】清掉开局自带的 17555（INITIAL_STATUS）：本脚本不测大萧条交互，避免被代价前置的弃牌挂起打断 
 * （17555 的交互由 _smoke_17555_depression.js 覆盖）。 */
g.table['美国'] = []
	g.opening = null
	g.turn = 2
	g.turn_phase = 'play'
	g.current_nation = '美国'
	g.active = 'Allies'
	I.ensure_markers(g)
	g.hands['美国'] = (g.hands['美国'] || []).concat(['17532#1'])
	return g
}
function put(g, nation, type, space) {
	const id = I.new_piece_id(g)
	g.location[id] = space
	g.piece_nation[id] = nation
	g.piece_type[id] = type
	return id
}
function firstLandSea() {
	let land = null, sea = null
	for (let i = 1; i < d.spaces.length; i++) {
		const sp = d.spaces[i]
		if (!sp) continue
		if (sp.terrain === 'land' && land == null) land = i
		if (sp.terrain === 'sea' && sea == null) sea = i
	}
	return { land, sea }
}
function tg(g) {
	return rules.query(g, 'Allies', 'theater_targets', {})
}

/* ================= F. 打牌前的 choice 询问（客户端"选顺序"框来源） ================= */
console.log('=== F. 先选建设顺序 ===')
{
	const { land, sea } = firstLandSea()
	const g = fresh()
	put(g, '美国', 'army', land)
	put(g, '美国', 'navy', sea)

	const q0 = rules.query(g, 'Allies', 'event_targets', { card: '17532#1' })
	ok('未选顺序时 need=choice（客户端弹「先海/先陆」框）', q0 && q0.need === 'choice', q0 && q0.need)
	ok('choice 选项标签已下发（options[].label）',
		!!(q0 && q0.options && q0.options.length === 2 &&
			/海军/.test(q0.options[0].label) && /陆军/.test(q0.options[1].label)),
		q0 && JSON.stringify((q0.options || []).map(o => o.label)))

	const q1 = rules.query(g, 'Allies', 'event_targets', { card: '17532#1', choice: 0 })
	ok('选完顺序后 need=null（可直接打出）', q1 && q1.need === null, q1 && q1.need)
}

/* ================= A. 先海军 ================= */
console.log('=== A. 先海军（choice 0）===')
{
	const { land, sea } = firstLandSea()
	const g = fresh()
	const army = put(g, '美国', 'army', land)
	const navy = put(g, '美国', 'navy', sea)

	rules.action(g, 'Allies', 'play_card', { card: '17532#1', choice: 0 })
	const pa = g.pending_theater
	ok('打出后建立 pending_theater', !!pa, pa && pa.stage)
	ok('stage=remove（先移除）', pa && pa.stage === 'remove', pa && pa.stage)
	ok('order=先海军', pa && pa.order.join(',') === 'navy,army', pa && pa.order.join(','))

	const v = rules.view(g, 'Allies')
	ok('view.pending_theater 下发', !!v.pending_theater, v.pending_theater && v.pending_theater.label)
	ok('view.pending_theater.step/total', v.pending_theater && v.pending_theater.step === 1 && v.pending_theater.total === 3,
		v.pending_theater && (v.pending_theater.step + '/' + v.pending_theater.total))
	ok('view.pending_theater.can_act=true', v.pending_theater && v.pending_theater.can_act === true)

	const t1 = tg(g)
	ok('第 1 步 need=piece', t1 && t1.need === 'piece', t1 && t1.need)
	const ids1 = ((t1 && t1.candidates) || []).map(c => String(c.id))
	ok('候选含我方陆军/海军', ids1.indexOf(String(army)) >= 0 && ids1.indexOf(String(navy)) >= 0, ids1.join(','))

	/* 移除海军 */
	rules.action(g, 'Allies', 'resolve_theater', { piece: navy })
	ok('移除后 stage=build_navy', g.pending_theater && g.pending_theater.stage === 'build_navy',
		g.pending_theater && g.pending_theater.stage)
	ok('海军已离场', g.location[navy] == null)

	const t2 = tg(g)
	ok('第 2 步 need=space', t2 && t2.need === 'space', t2 && t2.need)
	const seaCands = ((t2 && t2.candidates) || []).map(c => Number(c.id))
	ok('海军建设候选非空', seaCands.length > 0, seaCands.length)
	/* 候选与执行同源：逐个 can_build_at */
	const badSea = seaCands.filter(sp => !I.can_build_at(g, '美国', sp, 'navy').ok)
	ok('所有海军候选都通过 can_build_at（同源）', badSea.length === 0, badSea.join(','))

	if (seaCands.length) {
		rules.action(g, 'Allies', 'resolve_theater', { space: seaCands[0] })
		ok('建海军后 stage=build_army', g.pending_theater && g.pending_theater.stage === 'build_army',
			g.pending_theater && g.pending_theater.stage)
		const builtNavy = Object.keys(g.location).filter(id =>
			g.location[id] === seaCands[0] && g.piece_nation[id] === '美国' && g.piece_type[id] === 'navy')
		ok('海军确实建成', builtNavy.length > 0, d.name_of(seaCands[0]))

		const t3 = tg(g)
		const landCands = ((t3 && t3.candidates) || []).map(c => Number(c.id))
		ok('第 3 步 need=space（陆军）', t3 && t3.need === 'space' && landCands.length > 0, landCands.length)
		if (landCands.length) {
			rules.action(g, 'Allies', 'resolve_theater', { space: landCands[0] })
			ok('完成后 pending_theater 清空', !g.pending_theater)
			ok('卡已进美国弃牌堆', (g.discard['美国'] || []).indexOf('17532#1') >= 0)
			ok('play_done 已置位', !!(g.play_done && g.play_done['美国']))
			const builtArmy = Object.keys(g.location).filter(id =>
				g.location[id] === landCands[0] && g.piece_nation[id] === '美国' && g.piece_type[id] === 'army')
			ok('陆军确实建成', builtArmy.length > 0, d.name_of(landCands[0]))
		}
	}
}

/* ================= B. 先陆军 ================= */
console.log('\n=== B. 先陆军（choice 1）===')
{
	const { land, sea } = firstLandSea()
	const g = fresh()
	const army = put(g, '美国', 'army', land)
	const navy = put(g, '美国', 'navy', sea)
	rules.action(g, 'Allies', 'play_card', { card: '17532#1', choice: 1 })
	ok('order=先陆军', g.pending_theater && g.pending_theater.order.join(',') === 'army,navy',
		g.pending_theater && g.pending_theater.order.join(','))

	rules.action(g, 'Allies', 'resolve_theater', { piece: army })
	ok('移除陆军后 stage=build_army', g.pending_theater && g.pending_theater.stage === 'build_army',
		g.pending_theater && g.pending_theater.stage)
	const tA = tg(g)
	const landCands = ((tA && tA.candidates) || []).map(c => Number(c.id))
	if (landCands.length) {
		rules.action(g, 'Allies', 'resolve_theater', { space: landCands[0] })
		ok('建陆军后 stage=build_navy', g.pending_theater && g.pending_theater.stage === 'build_navy',
			g.pending_theater && g.pending_theater.stage)
		const tB = tg(g)
		const seaCands = ((tB && tB.candidates) || []).map(c => Number(c.id))
		if (seaCands.length) {
			rules.action(g, 'Allies', 'resolve_theater', { space: seaCands[0] })
			ok('反序链完成', !g.pending_theater)
		} else ok('反序链完成', false, '海军候选为空')
	} else ok('建陆军候选非空', false, '陆军候选为空')
}

/* ================= D. 非法选择停在本步 ================= */
console.log('\n=== D. 非法选择 ===')
{
	const { land, sea } = firstLandSea()
	const g = fresh()
	const army = put(g, '美国', 'army', land)
	const navy = put(g, '美国', 'navy', sea)
	rules.action(g, 'Allies', 'play_card', { card: '17532#1', choice: 0 })

	/* ① 移除敌方部队（不存在）→ 拒绝且状态不变 */
	rules.action(g, 'Allies', 'resolve_theater', { piece: 'p999' })
	ok('移除非法算子被拒，stage 不变', g.pending_theater && g.pending_theater.stage === 'remove')

	rules.action(g, 'Allies', 'resolve_theater', { piece: navy })
	const beforeStage = g.pending_theater.stage
	/* ② 建在已有我方部队的格子 → 拒绝且停在本步 */
	const occupied = Object.keys(g.location).find(id =>
		g.piece_nation[id] === '美国' && g.piece_type[id] === 'army')
	const occSpace = occupied ? g.location[occupied] : null
	if (occSpace != null) {
		const logBefore = g.log.length
		rules.action(g, 'Allies', 'resolve_theater', { space: occSpace })
		ok('建在已占格被拒，stage 仍为 ' + beforeStage,
			g.pending_theater && g.pending_theater.stage === beforeStage)
		const added = g.log.slice(logBefore).join(' ')
		ok('拒绝原因写进日志', /无法建设|建设失败/.test(added), added.slice(0, 60))
	} else ok('占位用例跳过', true)
}

/* ================= E. 门禁 ================= */
console.log('\n=== E. 门禁 ===')
{
	const { land, sea } = firstLandSea()
	const g = fresh()
	const army = put(g, '美国', 'army', land)
	const navy = put(g, '美国', 'navy', sea)
	rules.action(g, 'Allies', 'play_card', { card: '17532#1', choice: 0 })

	/* 非本方阵营：resolve_theater 被拒（状态不变） */
	rules.action(g, 'Axis', 'resolve_theater', { piece: navy })
	ok('轴心调 resolve_theater 被拒', g.pending_theater && g.pending_theater.stage === 'remove')

	/* 挂起期间 play_card 被拒（美国手牌还有别的牌也不能打） */
	g.hands['美国'] = (g.hands['美国'] || []).concat(['15250#1'])
	const before = (g.hands['美国'] || []).length
	rules.action(g, 'Allies', 'play_card', { card: '15250#1' })
	ok('挂起期间 play_card 被拒', (g.hands['美国'] || []).length === before,
		'hand=' + (g.hands['美国'] || []).length)

	/* actions 白名单 */
	const v = rules.view(g, 'Allies')
	ok('本方 actions 含 resolve_theater', !!(v.actions && v.actions.resolve_theater), JSON.stringify(v.actions))
	const vAxis = rules.view(g, 'Axis')
	ok('对方 actions 不含 resolve_theater', !(vAxis.actions && vAxis.actions.resolve_theater), JSON.stringify(vAxis.actions))
}

console.log('\n=== ' + (fails ? fails + ' 项失败' : '全部通过') + ' ===')
process.exit(fails ? 1 : 0)
