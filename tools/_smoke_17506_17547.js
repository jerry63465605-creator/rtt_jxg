/*
 * 【2026-10-25】17506《沉睡的巨人》× 17547《人工港》窗口共存回归。
 *
 * 背景：同一次【建设海军】会同时点亮两个窗口，但走的是两套载体：
 *   17506（EFFECT，手牌）-> game.armed_offers
 *   17547（STATUS，桌面）-> game.status_instant
 * 旧实现在 build_actions 的 armed 分支【提前 return 排他白名单】，
 * activate_status 不在册 -> 客户端点了静默无反应 -> 玩家被迫必须先打 17506。
 *
 * 修复两处：
 *   ① armed 分支叠加 register_status_actions（与 event_budget 分支同源）；
 *   ② activate_status 加入 clear_armed_offer_for_side 的豁免（同್ 一事件窗口互不误清）。
 *
 * 验收目标：两个窗口【任意顺序】都能结算，且处理完无残留挂起。
 *
 * 用法：node tools/_smoke_17506_17547.js
 */
const path = require('path')
const MOD = path.join(__dirname, '..', 'server-official', 'public', 'quartermaster-sub-wars')
const rules = require(path.join(MOD, 'rules.js'))
const I = rules._internal
const data = I.data

let pass = 0, fail = 0
function ok(name, cond, extra) {
	if (cond) { pass++; console.log('  ✓ ' + name) }
	else { fail++; console.log('  ✗ ' + name + (extra ? '  ' + extra : '')) }
}

const FACEDOWN = '17547#1'   /* 桌面状态卡实例 */
const ARMED = '17506#1'      /* armed 窗口候选实例 */

/*
 * 摆好"美国刚建设海军"的那一刻：
 *   · 桌面持 17547 -> arm_status_instant 武装 after_build_navy 窗口；
 *   · armed_offers 里有 17506 的窗口。
 */
function scene() {
	const g = rules.setup(1)
	g.opening = null
	g.current_nation = '美国'
	g.turn_phase = 'play'
	g.table['美国'] = [FACEDOWN]
	/* 真实场景里 17506 在【手牌】里（EFFECT），并留几张牌作"损耗 1 张"的代价 */
	g.hands['美国'] = [ARMED, '15310#1', '15311#1']
	const pac = data.id_of('太平洋')
	I.arm_status_instant(g, 'after_build_navy', '美国', pac)
	g.armed_offers = [{
		kind: 'special', nation: '美国', when: 'after_build_navy',
		cards: [{
			card_id: ARMED, nation: '美国', name: '沉睡的巨人',
			desc: '损耗1张牌：在相邻地区建设1支部队', cost: 1,
		}],
		ctx: { space: pac },
	}]
	return g
}

console.log('\n[1] 两个窗口同时成立：动作表里两者都必须在册')
{
	const g = scene()
	ok('17547 的 status_instant 已武装',
		(g.status_instant || []).some(e => e.card_id === FACEDOWN),
		JSON.stringify(g.status_instant))
	ok('17506 的 armed 窗口已建立',
		(g.armed_offers || []).length === 1)

	const v = rules.view(g, 'Allies')
	console.log('    actions =', JSON.stringify(v.actions))
	ok('use_armed_offer 在册', !!v.actions['use_armed_offer'])
	ok('skip_armed_offer 在册', !!v.actions['skip_armed_offer'])
	ok('activate_status 在册（本次修复点）', !!v.actions['activate_status'])
	ok('activate_status:17547#1 在册（客户端按带后缀键渲染）',
		!!v.actions['activate_status:' + FACEDOWN])
}

console.log('\n[2] 顺序 A：先点人工港（17547），17506 窗口不能被误清')
{
	const g = scene()
	const before = (g.armed_offers || []).length
	const l0 = g.log.length
	rules.action(g, 'Allies', 'activate_status', { card: FACEDOWN })
	const log = g.log.slice(l0).join(' | ')
	console.log('    日志 =', log)
	ok('点了状态卡之后 armed 窗口仍在（本次修复点）',
		(g.armed_offers || []).length === before,
		'armed=' + (g.armed_offers || []).length)
	ok('17506 随后仍可打出', !!(rules.view(g, 'Allies').actions['use_armed_offer']))
}

console.log('\n[3] 顺序 B：先打 17506，17547 的 status_instant 不能被清')
{
	const g = scene()
	const l0 = g.log.length
	rules.action(g, 'Allies', 'use_armed_offer', { card: ARMED })
	console.log('    日志 =', g.log.slice(l0).join(' | '))
	ok('17547 的 status_instant 仍在',
		(g.status_instant || []).some(e => e.card_id === FACEDOWN),
		JSON.stringify(g.status_instant))
	const v = rules.view(g, 'Allies')
	ok('17547 仍可点击', !!v.actions['activate_status'])
}

console.log('\n[4] 放弃增强窗口后，状态卡窗口不受影响')
{
	const g = scene()
	const l0 = g.log.length
	rules.action(g, 'Allies', 'skip_armed_offer', {})
	console.log('    日志 =', g.log.slice(l0).join(' | '))
	ok('skip 后 armed 已清空', (g.armed_offers || []).length === 0)
	ok('skip 后 17547 status_instant 仍在',
		(g.status_instant || []).some(e => e.card_id === FACEDOWN))
}

console.log('\n[5] 做无关动作 -> 两个窗口按"错过即失效"正常关闭（不永久亮着）')
{
	const g = scene()
	rules.action(g, 'Allies', 'skip_armed_offer', {})
	rules.action(g, 'Allies', 'activate_status', { card: FACEDOWN })
	rules.action(g, 'Allies', 'next_phase', {})
	ok('推进阶段后 status_instant 已清空',
		(g.status_instant || []).length === 0,
		JSON.stringify(g.status_instant))
	ok('armed 也已清空', (g.armed_offers || []).length === 0)
}

console.log('\n结果: ' + pass + ' 通过, ' + fail + ' 失败')
process.exit(fail ? 1 : 0)
