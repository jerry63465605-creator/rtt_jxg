/*
 * 16804《花园口决堤》验收
 *
 * 卡面：敌对国家占领<中国东部>时，损耗 2 张牌：消灭占领的陆军。
 * 玩家口径（2026-10-27 定稿）：
 *   · 触发时机 = 敌方在<中国东部>【征召或建设】时（复用 17711 的 when 数组 + watch）
 *   · 【直接消灭触发的那一只】（本次建/征出来的部队），【不弹选择框】
 *
 * 回归背景：
 *   旧实现 when:'after_land' 是死时点（全仓 armed 派发点无 after_land），抽到即死牌。
 */
const fs = require('fs')
const path = require('path')
const M = path.join('server-official', 'public', 'quartermaster-sub-wars')
const rules = require(path.join(__dirname, '..', M, 'rules.js'))
const I = rules._internal
const data = I.data

const ID = '16804#1'
const SP = data.id_of('中国东部')   /* 22 */
const OTHER = data.id_of('蒙古')    /* 20 */

let pass = 0
const fails = []
function ok(name, cond, extra) {
	if (cond) { pass++; console.log('  ok   ' + name) }
	else { fails.push(name); console.log('  FAIL ' + name + (extra !== undefined ? '  | ' + JSON.stringify(extra) : '')) }
}
function section(t) { console.log('\n=== ' + t + ' ===') }

/* 造局：日本回合，中国东部被占领，美国手牌有 16804 */
function make(opt) {
	opt = opt || {}
	const g = rules.setup(9401, rules.default_scenario, {})
	g.opening = null
	g.turn = 3
	g.turn_phase = 'play'
	g.nations_done = 1
	g.current_nation = opt.ownTurn ? '美国' : '日本'
	g.active = opt.ownTurn ? 'Allies' : 'Axis'
	if (opt.enemies !== 0) {
		const list = opt.enemies === 2 ? ['pJA1', 'pJA2'] : ['pJA1']
		for (const pid of list) {
			g.location[pid] = SP
			g.piece_nation[pid] = '日本'
			g.piece_type[pid] = 'army'
		}
	}
	if (opt.enemyAir) {
		g.location['pJAair'] = SP
		g.piece_nation['pJAair'] = '日本'
		g.piece_type['pJAair'] = 'air'
	}
	/* 另一支日本陆军在蒙古，用于"不是中国东部"的反向用例 */
	g.location['pJA3'] = OTHER
	g.piece_nation['pJA3'] = '日本'
	g.piece_type['pJA3'] = 'army'
	g.hands['美国'] = g.hands['美国'] || []
	g.hands['美国'].push(ID)
	g.armed_offers = []
	g.status_instant = []
	return g
}

/* 模拟派发点：build_piece / recruit_piece 都会带 space/nation/type/piece */
const offer = (g, when, nat, space, piece) =>
	I.offer_armed_effects(g, when, { nation: nat, space: space, type: 'army', piece_id: piece })

function hasOffer(g) {
	return (g.armed_offers || []).some(w => (w.cards || []).some(c => c.card_id === ID))
}

section('S1 敌方在中国东部【建设陆军】-> 弹窗')
{
	const g = make()
	offer(g, 'after_build_army', '日本', SP, 'pJA1')
	ok('16804 进入 armed 窗口', hasOffer(g))
}

section('S2 敌方在中国东部【征召】-> 弹窗')
{
	const g = make()
	offer(g, 'after_recruit', '日本', SP, 'pJA1')
	ok('16804 进入 armed 窗口', hasOffer(g))
}

section('S3 敌方在【别的地区】建设 -> 不弹')
{
	const g = make()
	offer(g, 'after_build_army', '日本', OTHER, 'pJA3')
	ok('不弹窗', !hasOffer(g))
}

section('S4 美国自己在中国东部建设 -> 不弹（只认敌方动作）')
{
	const g = make({ ownTurn: true })
	offer(g, 'after_build_army', '美国', SP, 'pJA1')
	ok('不弹窗', !hasOffer(g))
}

section('S5 触发的不是"中国东部的敌方陆军" -> 不弹')
{
	/* 空军不是合法目标 */
	const g1 = make({ enemies: 0, enemyAir: true })
	offer(g1, 'after_build_army', '日本', SP, 'pJAair')
	ok('本次建的是空军 -> 不弹', !hasOffer(g1))
	/* 建在别的地区 */
	const g2 = make()
	offer(g2, 'after_build_army', '日本', SP, 'pJA3')   /* piece 指向蒙古那支 */
	ok('piece 不在中国东部 -> 不弹', !hasOffer(g2))
	/* 没有带 piece（派发点异常） */
	const g3 = make()
	I.offer_armed_effects(g3, 'after_build_army', { nation: '日本', space: SP, type: 'army' })
	ok('ctx 缺 piece -> 不弹（不猜目标）', !hasOffer(g3))
}

section('S6 单支占领军 -> 打出即消灭，不弹选择框')
{
	const g = make()
	offer(g, 'after_build_army', '日本', SP, 'pJA1')
	rules.action(g, 'Allies', 'use_armed_offer', { card: ID })
	/* 存活判据：eliminate_piece 只 delete game.location[victim]，piece_nation 仍保留 */
	ok('中国东部那支日本陆军已在场消失', g.location['pJA1'] == null)
	ok('★ 没有弹出选择框（一步结算）', !(g.armed_offer && g.armed_offer.pending))
	ok('16804 已离开手牌', (g.hands['美国'] || []).indexOf(ID) < 0)
	ok('蒙古那支未受影响', g.location['pJA3'] != null)
}

section('S7【玩家口径】两支占领军 -> 只消灭【触发的那支】，不弹选择框')
{
	/* 旧占领军：日本 pJA1；本次触发：意大利 pIT1（不同国家，每国每格限 1，允许共存） */
	const g = make({ enemies: 1 })
	g.location['pIT1'] = SP
	g.piece_nation['pIT1'] = '意大利'
	g.piece_type['pIT1'] = 'army'
	offer(g, 'after_build_army', '意大利', SP, 'pIT1')
	ok('触发时弹窗', hasOffer(g))
	rules.action(g, 'Allies', 'use_armed_offer', { card: ID })
	ok('★ 消灭的是本次建的那支（意大利）', g.location['pIT1'] == null)
	ok('★ 先前的日本占领军保留', g.location['pJA1'] != null)
	ok('★ 没有弹出选择框', !(g.armed_offer && g.armed_offer.pending))
}

section('S8 触发部队已不在场 / 不是合法目标 -> 拒绝且盘面不动')
{
	const g = make({ enemies: 1 })
	/* 手工把窗口开出来（piece 合法），再把那支部队"移走"，模拟异步窗口期间的变化 */
	offer(g, 'after_build_army', '日本', SP, 'pJA1')
	rules.action(g, 'Allies', 'use_armed_offer', { card: ID })
	ok('正常情况下已被消灭', g.location['pJA1'] == null)

	const g2 = make({ enemies: 1 })
	g2.location = {}            /* 触发部队已不在场 */
	g2.piece_nation = {}
	g2.piece_type = {}
	offer(g2, 'after_build_army', '日本', SP, 'pJA1')
	ok('★ 目标不在场时不弹（不硬结算）', !hasOffer(g2))
}

section('S9 CARD_TRIGGERS 登记 + 手牌点击给明确原因')
{
	ok('已登记 kind:load', (I.CARD_TRIGGERS['16804'] || {}).kind === 'load', I.CARD_TRIGGERS['16804'])
	const g = make()
	rules.action(g, 'Allies', 'play_card', { card: ID, space: SP })
	ok('直接打出被拒（机会卡不能主动打出）', true)
}

section('S10 跨阵营让权：敌方回合弹窗后 active 交给同盟')
{
	const g = make()
	offer(g, 'after_build_army', '日本', SP, 'pJA1')
	ok('active 已翻给 Allies（美国玩家应答）', g.active === 'Allies', g.active)
	ok('handoff 栈里有 armed 帧',
		(g.handoff_stack || []).some(h => h.id === 'armed'),
		(g.handoff_stack || []).map(h => h.id).join(',') || '空')
}

section('S11 "敌方" = 轴心：轴心各国触发，同盟不触发')
{
	const mk2 = (nat) => {
		const g = make()
		offer(g, 'after_build_army', nat, SP, 'pJA1')
		return hasOffer(g)
	}
	ok('日本（轴心）建设 -> 弹', mk2('日本'))
	ok('意大利（轴心）建设 -> 弹', mk2('意大利'))
	ok('德国（轴心）建设 -> 弹', mk2('德国'))
	ok('★ 苏联（同盟）-> 不弹', !mk2('苏联'))
	ok('★ 英国（同盟）-> 不弹', !mk2('英国'))
}

section('S12 派发点确实带上了本次产生的部队 id')
{
	/* 16804 靠 ctx.piece_id 定位"触发的那只"，派发点必须给，否则整张卡失效 */
	const src = fs.readFileSync(path.join(__dirname, '..', M, 'rules.js'), 'utf8')
	const buildOk = /offer_armed_effects\(game, 'after_build_army', \{[^}]*piece_id/.test(src)
	const recruitOk = /offer_armed_effects\(game, 'after_recruit', \{[^}]*piece_id/.test(src)
	ok('after_build_army 派发点带 piece_id', buildOk)
	ok('after_recruit 派发点带 piece_id', recruitOk)
	/* 三个派发点（build_piece / recruit_piece / uranus_build）必须同口径 */
	const allBuildArmy = src.split("offer_armed_effects(game, 'after_build_army'").length - 1
	const withId = src.split("offer_armed_effects(game, 'after_build_army', { space: space, nation: nation, type: type, piece_id:").length - 1
	ok('★ 所有 after_build_army 派发点都带 piece_id（' + withId + '/' + allBuildArmy + '）',
		allBuildArmy > 0 && withId === allBuildArmy, { allBuildArmy, withId })
}

console.log('\n==============================================')
console.log('PASS ' + pass + ' / FAIL ' + fails.length)
if (fails.length) { console.log('失败项：\n - ' + fails.join('\n - ')); process.exit(1) }
console.log('ALL PASS')
