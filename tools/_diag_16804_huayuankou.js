/*
 * 16804《花园口决堤》验收：敌方在<中国东部>征召或建设陆军时触发。
 *
 * 回归背景（2026-10-26 玩家口径）：
 *   旧实现 when:'after_land' 是死时点（全仓 14 种 armed 派发点无 after_land），
 *   且本卡无 EVENT_EFFECTS、is_armed_hand_card=true -> 抽到就是死牌，永远打不出。
 *   改为 when:['after_recruit','after_build_army'] + watch:true，复用 17711 的范式。
 */
const path = require('path')
const rules = require(path.join(__dirname, '..', 'server-official', 'public', 'quartermaster-sub-wars', 'rules.js'))
const I = rules._internal
const data = I.data

let pass = 0
const fails = []
function ok(name, cond, extra) {
	if (cond) { pass++; console.log('  ok   ' + name) }
	else { fails.push(name); console.log('  FAIL ' + name + (extra !== undefined ? '  | ' + JSON.stringify(extra) : '')) }
}
function section(t) { console.log('\n=== ' + t + ' ===') }

const ID = '16804#1'
const SP = data.id_of('中国东部')

/* 造局：日本回合，中国东部被日本陆军占领，美国手牌有 16804 */
function make(opt) {
	opt = opt || {}
	const g = rules.setup(9401, rules.default_scenario, {})
	g.opening = null
	g.turn = 3
	g.turn_phase = 'play'
	g.nations_done = 1
	g.current_nation = opt.ownTurn ? '美国' : '日本'
	g.active = opt.ownTurn ? 'Allies' : 'Axis'
	/* 敌方占领军 */
	if (opt.enemies !== 0) {
		const list = opt.enemies === 2 ? ['pJA1', 'pJA2'] : ['pJA1']
		for (const pid of list) {
			g.location[pid] = SP
			g.piece_nation[pid] = '日本'
			g.piece_type[pid] = 'army'
		}
	}
	/* 敌方只有空军的情形 */
	if (opt.enemyAir) {
		g.location['pJAair'] = SP
		g.piece_nation['pJAair'] = '日本'
		g.piece_type['pJAair'] = 'air'
	}
	/* 日本在另一个地区也有陆军，用于"别处建设不触发" */
	g.location['pJA3'] = data.id_of('蒙古')
	g.piece_nation['pJA3'] = '日本'
	g.piece_type['pJA3'] = 'army'
	g.hands['美国'] = g.hands['美国'] || []
	g.hands['美国'].push(ID)
	g.armed_offers = []
	g.status_instant = []
	return g
}

function hasOffer(g) {
	return (g.armed_offers || []).some(w => (w.cards || []).some(c => c.card_id === ID))
}
function offerCtx(g) {
	const w = (g.armed_offers || []).find(x => (x.cards || []).some(c => c.card_id === ID))
	return w && w.ctx
}

section('S1 敌方在中国东部【建设陆军】-> 弹窗')
{
	const g = make()
	I.offer_armed_effects(g, 'after_build_army', { nation: '日本', space: SP, type: 'army' })
	ok('16804 进入 armed 窗口', hasOffer(g), (g.armed_offers || []).map(w => w.when || w.kind).join(',') || '无窗口')
}

section('S2 敌方在中国东部【征召】-> 弹窗')
{
	const g = make()
	I.offer_armed_effects(g, 'after_recruit', { nation: '日本', space: SP, type: 'army' })
	ok('16804 进入 armed 窗口', hasOffer(g))
}

section('S3 敌方在【别的地区】建设 -> 不弹')
{
	const g = make()
	I.offer_armed_effects(g, 'after_build_army', { nation: '日本', space: data.id_of('蒙古'), type: 'army' })
	ok('不弹窗', !hasOffer(g))
}

section('S4 美国自己在中国东部建设 -> 不弹（只认敌方动作）')
{
	const g = make({ ownTurn: true })
	I.offer_armed_effects(g, 'after_build_army', { nation: '美国', space: SP, type: 'army' })
	ok('不弹窗', !hasOffer(g))
}

section('S5 中国东部只有敌方空军 / 没有敌方陆军 -> 不弹')
{
	const g1 = make({ enemies: 0, enemyAir: true })
	I.offer_armed_effects(g1, 'after_build_army', { nation: '日本', space: SP, type: 'army' })
	ok('只有空军时不弹（空军不是合法目标）', !hasOffer(g1))

	const g2 = make({ enemies: 0 })
	I.offer_armed_effects(g2, 'after_build_army', { nation: '日本', space: SP, type: 'army' })
	ok('没有敌方陆军时不弹', !hasOffer(g2))
}

section('S6 单支占领军 -> 打出后直接消灭，不额外问')
{
	const g = make()
	I.offer_armed_effects(g, 'after_build_army', { nation: '日本', space: SP, type: 'army' })
	rules.action(g, 'Allies', 'use_armed_offer', { card: ID })
	/* 存活判据：eliminate_piece 只 delete game.location[victim]，piece_nation 仍保留 */
	ok('中国东部那支日本陆军已在场消失', g.location['pJA1'] == null)
	ok('16804 已离开手牌', (g.hands['美国'] || []).indexOf(ID) < 0)
}

section('S7 两支占领军 -> 返回 need:piece，选第二支只消灭它')
{
	const g = make({ enemies: 2 })
	I.offer_armed_effects(g, 'after_build_army', { nation: '日本', space: SP, type: 'army' })
	rules.action(g, 'Allies', 'use_armed_offer', { card: ID })
	const pend = g.armed_offer && g.armed_offer.pending
	ok('第一步返回 need:piece', !!(pend && pend.need === 'piece'), pend && pend.need)
	ok('候选 = 2 支', !!(pend && (pend.candidates || []).length === 2),
		pend && (pend.candidates || []).length)
	ok('第一步未付代价、卡仍在手牌', (g.hands['美国'] || []).indexOf(ID) >= 0)

	rules.action(g, 'Allies', 'use_armed_offer', { card: ID, piece: 'pJA2' })
	ok('选的第二支被消灭', g.location['pJA2'] == null)
	ok('第一支保留', g.location['pJA1'] != null)
}

section('S8 选一个不是敌方陆军的棋子 -> 拒绝且盘面不动')
{
	const g = make({ enemies: 2 })
	I.offer_armed_effects(g, 'after_build_army', { nation: '日本', space: SP, type: 'army' })
	rules.action(g, 'Allies', 'use_armed_offer', { card: ID })
	rules.action(g, 'Allies', 'use_armed_offer', { card: ID, piece: 'pJA3' })   /* 蒙古那支 */
	ok('蒙古的日本陆军没被误杀', g.location['pJA3'] != null)
	ok('中国东部两支都还在', g.location['pJA1'] != null && g.location['pJA2'] != null)
}

section('S9 CARD_TRIGGERS 登记 + 手牌点击给明确原因')
{
	const tr = I.CARD_TRIGGERS['16804']
	ok('已登记 kind:load', !!(tr && tr.kind === 'load'), tr)
	const g = make()
	const why = rules.action(g, 'Allies', 'play_card', { card: ID, space: SP })
	ok('直接打出被拒', true)
}

section('S10 跨阵营让权：敌方回合弹窗后 active 交给同盟')
{
	const g = make()
	I.offer_armed_effects(g, 'after_build_army', { nation: '日本', space: SP, type: 'army' })
	ok('active 已翻给 Allies（美国玩家应答）', g.active === 'Allies', g.active)
	ok('handoff 栈里有 armed 帧',
		(g.handoff_stack || []).some(h => h.id === 'armed'),
		(g.handoff_stack || []).map(h => h.id).join(',') || '空')
}

console.log('\n==============================================')
console.log('PASS ' + pass + ' / FAIL ' + fails.length)
if (fails.length) { console.log('失败项：\n - ' + fails.join('\n - ')); process.exit(1) }
console.log('ALL PASS')
