/*
 * 真实测试（rtt-realboard-test §7 范式 B）：15355《特种空勤团突袭机场》
 *
 * 卡面：出牌阶段开始时，弃置 2 张手牌：消灭 1 支【相邻英国空军的敌方国家空军】。
 *
 * 本组专门覆盖用户要求的两点：
 *   ① **多支英国空军**（西欧 + 不列颠，两支都在补给中）
 *   ② **多个目标**（德国空军@德国、意大利空军@意大利，都与<西欧>相邻 -> 2 个候选，且来自不同国家）
 *
 * 合法盘面依据（实测）：
 *   - 英国陆军在<西欧>/<不列颠>均处于补给状态；空军需同格本国陆/海军载体（air_host_check）
 *   - <西欧> 相邻 = 波罗的海 / 意大利 / 北海 / 德国 / 地中海（get_connections，同盟视角）
 *   - 德国空军@德国、意大利空军@意大利 都能通过载体+补给校验
 *
 * 断言：
 *   A. 进入出牌阶段即出现 play_start 窗口，候选卡含 15355
 *   B. 弃 2 张代价后停在 need:'piece'，候选恰好是 2 支敌方空军（带国家名，可分国）
 *   C. 选德国空军 -> 它被消灭，意大利空军仍在，两支英国空军都在
 *   D. 选意大利空军 -> 对称结果（另一支被消灭）
 *   E. 代价照付（手牌 -2、进弃牌堆）、15355 进弃牌堆、无残留挂起
 *
 * 用法：node tools/_real_test_15355_sas_airfield.js
 */
const path = require('path')
const MOD = path.join(__dirname, '..', 'server-official', 'public', 'quartermaster-sub-wars')
const R = require(path.join(MOD, 'rules.js'))
const I = R._internal
const d = I.data
const faceOf = x => String(x).split('#')[0]
const logSince = (g, n) => (g.log || []).slice(n).join(' | ')
const airsOf = (g, nat) => Object.keys(g.location)
	.filter(p => g.piece_nation[p] === nat && g.piece_type[p] === 'air')
	.map(p => ({ p, sp: g.location[p], name: d.name_of(g.location[p]) }))

let pass = 0, fail = 0
const ok = (m, c, extra) => {
	if (c) { pass++; console.log('  ✓ ' + m) }
	else { fail++; console.log('  ✗ ' + m + (extra ? '  | ' + extra : '')) }
}

/* 布阵：两支英国空军（西欧 / 不列颠）+ 德国空军@德国 + 意大利空军@意大利 + 15355 + 2 张代价牌 */
function setup() {
	const g = R.setup(7)
	g.opening = null
	I.refresh(g)
	/* 先进"资源阶段"布阵，再切到出牌阶段 —— 否则 play_start 窗口会在布阵前就派发 */
	R.action(g, 'Allies', 'debug_set_phase', { nation: '英国', phase: 'resource' })
	R.action(g, 'Allies', 'debug_place', { piece: 'uk_army_w', nation: '英国', type: 'army', space: d.id_of('西欧') })
	R.action(g, 'Allies', 'debug_place', { piece: 'uk_air_w', nation: '英国', type: 'air', space: d.id_of('西欧') })
	R.action(g, 'Allies', 'debug_place', { piece: 'uk_air_h', nation: '英国', type: 'air', space: d.id_of('不列颠') })
	R.action(g, 'Axis', 'debug_place', { piece: 'de_air_home', nation: '德国', type: 'air', space: d.id_of('德国') })
	R.action(g, 'Axis', 'debug_place', { piece: 'it_air_home', nation: '意大利', type: 'air', space: d.id_of('意大利') })
	R.action(g, 'Allies', 'debug_add_card', { face: '15355', nation: '英国', dest: 'hand' })
	R.action(g, 'Allies', 'debug_add_card', { face: '15300', nation: '英国', dest: 'hand' })
	R.action(g, 'Allies', 'debug_add_card', { face: '15301', nation: '英国', dest: 'hand' })
	I.refresh(g)
	/* 进入出牌阶段 -> 派发 play_start 武装窗口 */
	R.action(g, 'Allies', 'debug_set_phase', { nation: '英国', phase: 'play' })
	I.refresh(g)
	return g
}

console.log('\n=== 布阵合法性自检（skill §8.2 V14~V20）===')
const g0 = setup()
{
	const sup = I.compute_supply(g0)
	const ukAirs = airsOf(g0, '英国')
	ok('两支英国空军就位（西欧/不列颠）', ukAirs.length === 2, JSON.stringify(ukAirs))
	ok('两支英国空军都在补给中',
		ukAirs.every(a => sup.in_supply[a.p]), JSON.stringify(ukAirs.map(a => [a.name, !!sup.in_supply[a.p]])))
	ok('德国空军@德国、意大利空军@意大利',
		airsOf(g0, '德国').length === 1 && airsOf(g0, '意大利').length === 1)
	ok('两支敌方空军都与<西欧>相邻（合并在候选里）',
		I.get_connections(g0, d.id_of('西欧'), 'allies').indexOf(d.id_of('德国')) >= 0 &&
		I.get_connections(g0, d.id_of('西欧'), 'allies').indexOf(d.id_of('意大利')) >= 0)
	const sasEff = (I.ECHO_EFFECTS || {})['15355'] || {}
	ok('服务端 ready() 通过（存在合法敌方空军）',
		!!(sasEff.armed && sasEff.armed.ready && sasEff.armed.ready(g0, {})),
		JSON.stringify(sasEff.armed && sasEff.armed.when))
}

console.log('\n=== A. play_start 窗口出现（含 15355）===')
{
	const v = R.view(g0, 'Allies')
	const ao = v.armed_offer
	console.log('  armed_offer=' + JSON.stringify(ao && {
		when: ao.when, cards: (ao.cards || []).map(c => c.name), cost: ao.cards && ao.cards[0] && ao.cards[0].cost,
	}))
	ok('★ 窗口 when=play_start', !!(ao && ao.when === 'play_start'), JSON.stringify(ao && ao.when))
	ok('★ 候选卡含《特种空勤团突袭机场》',
		!!(ao && (ao.cards || []).some(c => faceOf(c.card) === '15355')),
		JSON.stringify(ao && (ao.cards || []).map(c => faceOf(c.card))))
	ok('卡面代价可读（弃 2 张）',
		!!(ao && ao.cards[0] && ao.cards[0].cost && ao.cards[0].cost.discard === 2),
		JSON.stringify(ao && ao.cards[0] && ao.cards[0].cost))
}

/* 打出 -> 付代价 -> 停在 need:'piece' */
function playToPiece(g) {
	const sas = (g.hands['英国'] || []).find(x => faceOf(x) === '15355')
	const pay = (g.hands['英国'] || []).filter(x => faceOf(x) !== '15355').slice(0, 2)
	const n0 = (g.log || []).length
	/* 武装卡的"弃 N 张手牌"代价读 arg.drop（不是 discard/cards），见 use_armed_offer 的 _discNeed0 */
	R.action(g, 'Allies', 'use_armed_offer', { card: sas, drop: pay })
	return { sas, pay, log: logSince(g, n0) }
}

console.log('\n=== B. 弃 2 张后停在 need:piece（多目标）===')
const gB = setup()
{
	const hand0 = (gB.hands['英国'] || []).length
	const { sas, pay, log } = playToPiece(gB)
	console.log('  log: ' + log)
	/*
	 * 本卡的 armed 结构是"先 run、成功后付代价"：停在 need:'piece' 时【尚未付】，
	 * 代价在最终结算那次才扣（与 15405/15406 等一致）。这里按实际口径断言"未提前扣"。
	 */
	ok('★ 停在选择阶段时未提前扣代价（手牌不变）',
		(gB.hands['英国'] || []).length === hand0,
		hand0 + ' -> ' + (gB.hands['英国'] || []).length)
	ok('代价牌仍在手牌（未被偷偷弃掉）',
		pay.every(x => (gB.hands['英国'] || []).indexOf(x) >= 0), JSON.stringify(pay))
	const ao = (gB.armed_offers || []).find(w => w.when === 'play_start')
	const pend = ao && ao.pending
	console.log('  pending=' + JSON.stringify(pend && {
		need: pend.need, cands: (pend.candidates || []).map(c => c.name),
	}))
	ok('★ 停在 need:piece（等待玩家选目标）', !!(pend && pend.need === 'piece'),
		JSON.stringify(pend && pend.need))
	ok('★ 候选恰好 2 支敌方空军', !!(pend && (pend.candidates || []).length === 2),
		JSON.stringify(pend && (pend.candidates || []).length))
	ok('★ 候选带国家名（多国可分）',
		!!(pend && (pend.candidates || []).every(c => /德国|意大利/.test(c.name || ''))),
		JSON.stringify(pend && (pend.candidates || []).map(c => c.name)))
	const v = R.view(gB, 'Allies')
	ok('view 也把候选下发给客户端',
		!!(v.armed_offer && v.armed_offer.pending &&
			(v.armed_offer.pending.candidates || []).length === 2),
		JSON.stringify(v.armed_offer && v.armed_offer.pending && v.armed_offer.pending.candidates.length))
}

console.log('\n=== C. 选德国空军 ===')
{
	const g = setup()
	const hand0 = (g.hands['英国'] || []).length
	const { sas, pay } = playToPiece(g)
	const n0 = (g.log || []).length
	R.action(g, 'Allies', 'use_armed_offer', { card: sas, piece: 'de_air_home' })
	console.log('  log: ' + logSince(g, n0))
	ok('★ 英国弃置 2 张代价', pay.every(x => (g.discard['英国'] || []).indexOf(x) >= 0),
		JSON.stringify(pay))
	ok('手牌 = 原 -3（15355 结算 + 代价 2 张）',
		(g.hands['英国'] || []).length === hand0 - 3,
		hand0 + ' -> ' + (g.hands['英国'] || []).length)
	ok('★ 德国空军被消灭', !('de_air_home' in g.location) || g.location['de_air_home'] == null)
	ok('意大利空军仍在', g.location['it_air_home'] != null)
	ok('两支英国空军都在', g.location['uk_air_w'] != null && g.location['uk_air_h'] != null,
		JSON.stringify({ w: g.location['uk_air_w'], h: g.location['uk_air_h'] }))
	ok('15355 进弃牌堆', (g.discard['英国'] || []).indexOf(sas) >= 0, JSON.stringify(g.discard['英国']))
	ok('无残留（pending_armed_use/armed_offers）',
		!g.pending_armed_use && !(g.armed_offers || []).length,
		JSON.stringify({ pu: !!g.pending_armed_use, ao: (g.armed_offers || []).length }))
}

console.log('\n=== D. 选意大利空军（对称）===')
{
	const g = setup()
	const { sas } = playToPiece(g)
	const n0 = (g.log || []).length
	R.action(g, 'Allies', 'use_armed_offer', { card: sas, piece: 'it_air_home' })
	console.log('  log: ' + logSince(g, n0))
	ok('★ 意大利空军被消灭', g.location['it_air_home'] == null)
	ok('德国空军仍在', g.location['de_air_home'] != null)
	ok('15355 进弃牌堆', (g.discard['英国'] || []).indexOf(sas) >= 0)
	ok('无残留', !g.pending_armed_use && !(g.armed_offers || []).length)
}

console.log('\n=== E. 非法目标（不在候选内）被明确拒绝 ===')
{
	const g = setup()
	const hand0 = (g.hands['英国'] || []).length
	const { sas, pay } = playToPiece(g)
	const n0 = (g.log || []).length
	/* 用一支英国自己的空军当目标：不在候选（同阵营），应被拒 */
	R.action(g, 'Allies', 'use_armed_offer', { card: sas, piece: 'uk_air_h' })
	const lg = logSince(g, n0)
	console.log('  log: ' + lg)
	ok('★ 日志明确写"未发动：所选单位不在候选内"', /未发动：所选单位不在候选内/.test(lg), lg)
	ok('英国空军未被自己消灭', g.location['uk_air_h'] != null)
	ok('两支敌方空军都还在',
		g.location['de_air_home'] != null && g.location['it_air_home'] != null)
	ok('★ 失败时【不付代价】：代价牌仍在手牌',
		pay.every(x => (g.hands['英国'] || []).indexOf(x) >= 0), JSON.stringify(pay))
	ok('★ 失败时卡未被消耗（15355 仍在手牌）',
		(g.hands['英国'] || []).indexOf(sas) >= 0, JSON.stringify((g.hands['英国'] || []).map(faceOf)))
	ok('无残留挂起', !g.pending_armed_use && !(g.armed_offers || []).length,
		JSON.stringify({ pu: !!g.pending_armed_use, ao: (g.armed_offers || []).length }))
}

console.log('\n' + (fail === 0 ? 'ALL PASS（' + pass + ' 项）' : fail + ' FAIL / ' + pass + ' 项'))
process.exitCode = fail ? 1 : 0
