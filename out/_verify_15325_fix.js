/*
 * 验证 15325《莱茵河与多瑙河》useNewPiece 修复（2026-10-07）：
 *   场景：法国先建设 1 支陆军（新单位，置于西欧），该陆军与敌(德国)相邻；
 *         同时在意大利放一支"无关的法国陆军"(frX)，它也与德国相邻且被授补给，
 *         因此在【修复前】它也会成为合法发起者 —— 即用户报的"任何法军都能发起"。
 *   期望：预算发动战斗时，发起者【只能】是刚建设的新陆军，frX 被排除。
 */
const path = require('path')
const MOD = path.join(__dirname, '..', 'server-official', 'public', 'quartermaster-sub-wars')
const R = require(MOD + '/rules.js')
const I = R._internal
const d = require(MOD + '/data.js').data
const SP = d.id_of

function fresh() {
	const g = R.setup(1)
	g.location = {}; g.piece_nation = {}; g.piece_type = {}; g.piece_seq = 0
	g.pending_battle = null; g.markers = I.init_markers()
	g.supply_override = {}; g.supply_granted = {}; g.ongoing = {}
	g.hands = {}; g.decks = {}; g.discard = {}
	for (const n of ['英国', '法国', '德国', '苏联', '意大利', '日本', '美国', '中国']) {
		g.hands[n] = []; g.decks[n] = []; g.discard[n] = []
	}
	return g
}
let seq = 0
function place(g, nation, type, space) {
	const pid = 'p' + (++seq)
	g.location[pid] = Number(space)
	g.piece_nation[pid] = nation
	g.piece_type[pid] = type
	return pid
}
let pass = 0, fail = 0
function ok(c, name, extra) {
	if (c) pass++
	else { fail++; console.log('  ✗ ' + name + (extra ? '  -> ' + extra : '')) }
}

const WEU = SP('西欧'), GER = SP('德国'), ITA = SP('意大利')

{ /* 邻接自检 */
	const g = fresh()
	ok(I.get_connections(g, WEU).indexOf(GER) >= 0, '西欧↔德国相邻')
	ok(I.get_connections(g, ITA).indexOf(GER) >= 0, '意大利↔德国相邻')
}

/* ===== 主局面 ===== */
{
	const g = fresh()
	g.active = 'Allies'; g.turn_phase = 'play'; g.play_done = {}; g.turn = 1
	g.hands['法国'] = ['15325#1']
	place(g, '德国', 'army', GER)                 // 敌：德国(44)，与西欧、意大利都相邻
	const frX = place(g, '法国', 'army', ITA)      // 无关法军：意大利(13)，也邻德国
	I.compute_supply(g)
	I.grant_supply(g, frX, g.turn)               // 确保 frX 处于补给 -> 修复前是合法发起者
	I.compute_supply(g)

	const r = I.resolve_event_card(g, '法国', '15325', { spaces: [WEU, null] })
	ok(r.ok === true, 'resolve_event_card 成功', JSON.stringify(r))
	ok(!!g.event_budget, '建立了战斗预算')
	ok(g.event_budget && g.event_budget.useNewPiece === true, '预算标记 useNewPiece')

	const newFr = Object.keys(g.location).filter(p =>
		g.piece_nation[p] === '法国' && g.piece_type[p] === 'army' && p !== frX)
	ok(newFr.length >= 1, '建设出了新法国陆军', 'newFr=' + JSON.stringify(newFr))
	const newId = newFr[0]
	ok(g.event_budget.newPiece === newId, '预算 newPiece = 新陆军 id')

	// A) 无限制时，frX 与 newId 都是合法发起者（证明 frX 在修复前确实会混入）
	const unrestricted = I.battle_initiators(g, '法国', GER).map(x => x.id)
	ok(unrestricted.indexOf(frX) >= 0 && unrestricted.indexOf(newId) >= 0,
		'修复前：frX 与 newId 都是德国格的合法发起者（旧 bug 来源）',
		'initiators=' + JSON.stringify(unrestricted))

	// B) 目标候选：德国应在其中（新陆军相邻）
	const targets = I.event_battle_targets(g, g.event_budget)
	ok(targets.indexOf(GER) >= 0, '德国是合法攻击目标', 'targets=' + JSON.stringify(targets))

	// C) 视图 initiators：德国格的发起者【只含 newId】，frX 被排除
	const view = R.view(g, 'Allies')
	const initsAtGER = (view.event_budget && view.event_budget.initiators && view.event_budget.initiators[GER]) || []
	ok(initsAtGER.length === 1 && initsAtGER[0].id === newId,
		'视图：德国格可发起单位仅新陆军（frX 被排除）',
		'initiators=' + JSON.stringify(initsAtGER.map(x => x.id)))

	// D) 用新陆军发起 -> 成功，敌被移除
	const rOk = R.action(g, '法国', 'event_battle', { target: GER, from: newId })
	ok(rOk === g, '用新陆军发起战斗：成功')
	ok(Object.keys(g.location).filter(p => g.piece_nation[p] === '德国').length === 0,
		'敌方陆军被移除（陆战结算）')

	console.log('  15325 useNewPiece 修复：通过 ' + pass + ' / 失败 ' + fail)
}
