/*
 * 【2026-10-28】事件卡「建设/征召后开出的增强窗口」必须挂起等待 —— 自动 pauseArmed 验收
 *
 * 玩家实机报（game 30）：打 15231《进攻美国》建完海军，**没有增强打出时点**。
 *
 * 根因两层：
 *   ① 15231 的 build step 没配 pauseArmed（全仓 40+ 个 build/recruit 步骤只有 3 处配了）
 *      -> 事件卡直接进入 pending_event_step（分步停机）
 *   ② pending_event_step 状态下 build_actions / view.actions **不放行**
 *      use_armed_offer / skip_armed_offer
 *      -> 窗口在服务端已生成、view.armed_offer 也下发了，客户端却没有任何可发动作；
 *         玩家点「下一步」还会把 armed_offers 一并清掉。
 *
 * 改法：把「挂起等待」从【配置开关】改为【自动】——
 *   · build 分支：按 st.type 选窗口名（navy/air/army），存在即挂 pending_event_armed
 *   · recruit 分支：存在 after_recruit 即挂
 *   st.pauseArmed 字段保留兼容（写不写都一样）。
 */
const path = require('path')
const fs = require('fs')
const M = path.join('server-official', 'public', 'quartermaster-sub-wars')
const rules = require(path.join(__dirname, '..', M, 'rules.js'))
const I = rules._internal
const d = I.data

let pass = 0
const fails = []
function ok(name, cond, extra) {
	if (cond) { pass++; console.log('  ok   ' + name) }
	else { fails.push(name); console.log('  FAIL ' + name + (extra !== undefined ? '  | ' + JSON.stringify(extra) : '')) }
}
function section(t) { console.log('\n=== ' + t + ' ===') }

const NA = d.id_of('北大西洋'), AZ = d.id_of('亚速尔'), NH = d.id_of('北海'), WE = d.id_of('西欧')

function mk(nation, hand) {
	const g = rules.setup(20261028, rules.default_scenario, {})
	g.opening = null
	I.set_skip_turn_guard(true)
	g.current_nation = nation
	g.active = faction(nation)
	g.turn = 2; g.turn_phase = 'play'; g.nations_done = 0
	g.score = { axis: 0, allies: 0 }; g.log = []
	g.modifiers = []; g.armed_offers = []
	for (const k of Object.keys(g.table || {})) g.table[k] = []
	g.hands[nation] = (hand || []).slice()
	/* 德国：亚速尔德军（B）+ 15207 免 A，让北大西洋可建海军 */
	if (nation === '德国') {
		g.location['de_az'] = AZ; g.piece_nation['de_az'] = '德国'; g.piece_type['de_az'] = 'army'
		g.modifiers.push({ key: 'all_german_supplied', nation: '德国', untilTurn: 2, source: '15207' })
		/* 北海放英舰 -> 15210 的 ready=true */
		g.location['uk_nh'] = NH; g.piece_nation['uk_nh'] = '英国'; g.piece_type['uk_nh'] = 'navy'
	}
	I.refresh(g)
	return g
}
function faction(nation) {
	return (nation === '德国' || nation === '意大利' || nation === '日本') ? 'axis' : 'allies'
}
const NAME_OF_ROLE = { axis: 'Axis', allies: 'Allies' }
const whenOf = g => (g.armed_offers || []).map(w => w.when)

/* ---------------- S1 15231 建海军 -> 自动挂 pending_event_armed ---------------- */
section('S1 15231《进攻美国》建海军：armed 窗口存在时【挂起等待】，不进入分步停机')
let g1
{
	g1 = mk('德国', ['15231#1', '15210#1', '15208#1', '15200#1'])
	ok('造局：15210 ready=true（北海有英舰）', I.ECHO_EFFECTS['15210'].armed.ready(g1, { space: NA }) === true)
	rules.action(g1, 'axis', 'play_card', { card: '15231#1' })
	ok('★ 海军已建出', I.pieces_on(g1, NA).some(p => g1.piece_nation[p] === '德国' && g1.piece_type[p] === 'navy'))
	ok('★ 出现 after_build_navy 窗口', whenOf(g1).indexOf('after_build_navy') >= 0, whenOf(g1))
	ok('★ 挂的是 pending_event_armed（等增强结算）', !!g1.pending_event_armed, g1.pending_event_armed)
	ok('★ 没有进入 pending_event_step（否则窗口会失效）', !g1.pending_event_step, g1.pending_event_step)
	const v = rules.view(g1, 'Axis')
	ok('★ view.actions 放行 use_armed_offer', !!v.actions.use_armed_offer, v.actions.use_armed_offer)
	ok('★ view.actions 放行 skip_armed_offer', !!v.actions.skip_armed_offer)
	ok('★ view.armed_offer 下发了窗口（含两张卡）',
		!!(v.armed_offer && v.armed_offer.cards && v.armed_offer.cards.length === 2),
		v.armed_offer && (v.armed_offer.cards || []).map(c => c.card))
	ok('pending_event_armed 记录了续跑位置（resumeStep=1）',
		g1.pending_event_armed && g1.pending_event_armed.resumeStep === 1, g1.pending_event_armed)
}

/* ---------------- S2 增强窗口结算完 -> 自动续跑 step2 ---------------- */
section('S2 增强窗口清空后：自动从 step2 续跑（建战斗预算）')
{
	/* 打掉 15210（损耗1张 + 亚速尔相邻海战） */
	const off = (g1.armed_offers || [])[0]
	ok('窗口里能找到 15210', !!(off && off.cards.some(c => c.card_id === '15210#1')))
	if (off) {
		const cid = off.cards.find(c => c.card_id === '15210#1').card_id
		rules.action(g1, 'axis', 'use_armed_offer', { card: cid })
		ok('15210 已离手', (g1.hands['德国'] || []).indexOf('15210#1') < 0, g1.hands['德国'])
	}
	/* 再 skip 掉剩下的（15208） */
	if ((g1.armed_offers || []).length) rules.action(g1, 'axis', 'skip_armed_offer', {})
	ok('★ 窗口已清空', (g1.armed_offers || []).length === 0, whenOf(g1))
	ok('★ 事件卡已续跑出战斗预算（step2）',
		!!g1.event_budget || !!g1.pending_event_step, { budget: g1.event_budget && g1.event_budget.remaining })
	ok('pending_event_armed 已清', !g1.pending_event_armed)
}

/* ---------------- S3 build army：也走 after_build_army 挂起（旧代码写死 navy） ---------------- */
section('S3 17524 巴顿建陆军：after_build_army 窗口同样挂起（旧代码写死 after_build_navy）')
{
	/*
	 * 用 17820《方面军》（苏联：莫斯科或相邻建陆军 -> 以此发起陆战，两步）
	 * + 17854《共青城》（苏联 armed.when = 'after_build_army'，无代价）。
	 * 旧代码写死 'after_build_navy'，这类 build army 的窗口会被完全跳过。
	 */
	const g = mk('苏联', ['17820#1', '17854#1', '15200#1'])
	const ar54 = I.ECHO_EFFECTS['17854'] && I.ECHO_EFFECTS['17854'].armed
	ok('17854 armed.when = after_build_army', ar54 && ar54.when === 'after_build_army', ar54 && ar54.when)
	const MOS = d.id_of('莫斯科')
	/* 清掉莫斯科开局那支苏军（每国每格限 1 支），否则建不出新单位 */
	for (const p of Object.keys(g.location)) {
		if (g.piece_nation[p] === '苏联' && g.piece_type[p] === 'army' && Number(g.location[p]) === MOS) {
			delete g.location[p]; delete g.piece_nation[p]; delete g.piece_type[p]
		}
	}
	I.refresh(g)
	console.log('  can_build_at(苏联, 莫斯科, army) = ' + JSON.stringify(I.can_build_at(g, '苏联', MOS, 'army')))
	rules.action(g, 'allies', 'play_card', { card: '17820#1' })
	const hasArmy = I.pieces_on(g, MOS).some(p => g.piece_nation[p] === '苏联' && g.piece_type[p] === 'army')
	console.log('  莫斯科苏军已建? ' + hasArmy + ' | armed whens = ' + JSON.stringify(whenOf(g)) +
		' | pending_event_armed = ' + JSON.stringify(!!g.pending_event_armed) +
		' | pending_event_step = ' + JSON.stringify(g.pending_event_step && g.pending_event_step.step))
	ok('★ 陆军已建出（造局前提）', hasArmy)
	ok('★ after_build_army 窗口出现', whenOf(g).indexOf('after_build_army') >= 0, whenOf(g))
	ok('★ 挂起等待（pending_event_armed）', !!g.pending_event_armed, g.pending_event_armed)
	ok('★ 未进入 pending_event_step（旧代码会进 -> 窗口失效）', !g.pending_event_step)
	const vv = rules.view(g, 'Allies')
	ok('★ view.actions 放行 use_armed_offer', !!vv.actions.use_armed_offer, vv.actions.use_armed_offer)
}

/* ---------------- S4 无增强窗口：照常分步停机（不回归） ---------------- */
section('S4 没有增强窗口时：照常进入 pending_event_step（不回归）')
{
	const g = mk('德国', ['15231#1', '15200#1'])   /* 手上没有 15208/15210 */
	rules.action(g, 'axis', 'play_card', { card: '15231#1' })
	ok('无 armed 窗口', (g.armed_offers || []).length === 0, whenOf(g))
	ok('★ 正常分步停机（等玩家点「下一步」）', !!g.pending_event_step && g.pending_event_step.step === 1,
		g.pending_event_step && g.pending_event_step.step)
	ok('没有 pending_event_armed', !g.pending_event_armed)
}

/* ---------------- S5 源码守卫 ---------------- */
section('S5 源码守卫')
{
	const src = fs.readFileSync(path.join(__dirname, '..', M, 'rules.js'), 'utf8')
	ok('★ recruit 分支不再用 st.pauseArmed 开关',
		!/if \(st\.pauseArmed && has_armed_window\(game, st\.as \|\| actor, 'after_recruit'\)\)/.test(src))
	ok('★ build 分支不再用 st.pauseArmed 开关',
		!/if \(st\.pauseArmed && has_armed_window\(game, st\.as \|\| actor, 'after_build_navy'\)\)/.test(src))
	ok('★ build 分支按 st.type 选窗口名（navy/air/army）',
		/const _armedWhen = \(st\.type === 'navy'\) \? 'after_build_navy'[\s\S]{0,120}after_deploy_air[\s\S]{0,80}'after_build_army'/.test(src))
	ok('两处仍是 has_armed_window 判定（没有被删成无条件挂起）',
		(src.match(/has_armed_window\(game, st\.as \|\| actor, _armedWhen\)/g) || []).length === 1 &&
		(src.match(/has_armed_window\(game, st\.as \|\| actor, 'after_recruit'\)/g) || []).length === 1)
	ok('15231 的 build step 带 pauseArmed（兼容保留，无副作用）',
		/op: 'build', type: 'navy', spaces: space_ids_of\(\['北大西洋'\]\), pauseArmed: true/.test(src))
}

console.log('\n' + (fails.length ? 'FAILED' : 'ALL PASS') + '  ' + pass + ' ok, ' + fails.length + ' fail')
if (fails.length) { console.log('失败项: ' + fails.join(' | ')); process.exit(1) }
