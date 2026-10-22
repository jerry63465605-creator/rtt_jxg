/*
 * 回归：15356《地中海基地》+ 「skip_play 代价过早置位」（2026-10-23）
 *
 * 卡面：<地中海>的英国海军总是处于补给状态。
 *       跳过出牌阶段行动，弃置2张手牌：在<地中海>建设海军。
 *
 * 检查发现两个缺陷：
 *   ① 光环部分（always_supplied + type/space 作用域）【正确】：
 *      只对"地中海的英国海军"生效，别的海域 / 别的兵种不受影响，卡离场会回滚。
 *   ② 激活效果误配成 recruit（征召）—— 征召要求"该地没有本国部队"，于是
 *      地中海有陆军（正是能建海军的前提）时被拒、没陆军时反而能建，与卡面完全相反。
 *   ③ （更严重、影响 9 张状态卡）activate_status 把 cost.skip_play 的置位放在
 *      cost.discard / cost.attrition 校验【之前】：玩家不带弃牌点发动 ->
 *      出牌阶段被永久跳过 + 代价没付 + 效果没结算，且"本回合已跳过出牌阶段"
 *      让重试也被拒 —— 白丢整个出牌阶段。
 *
 * 本测试锁死：
 *   A. 光环作用域（地区 / 兵种 / 来源标注）
 *   B. 有港口时 -> 真的【建设】出海军，日志写"建设"
 *   C. 无港口时 -> status_window_ready 置灰，激活不付代价
 *   D. 不带 discard -> 不置 skip_play_done，可重试成功
 *   E. 其余 6 张 recruit 状态卡配置未被改动
 *
 * 用法：node tools/_smoke_15356_med_base.js
 */
const path = require('path')
const fs = require('fs')
const MOD = path.resolve(__dirname, '..')
const rules = require(path.join(MOD, 'rules.js'))
const I = rules._internal
const data = I.data

const MED = data.id_of('地中海')
const NAD = data.id_of('非洲北部')
const EAST_SEA = data.id_of('东海')

let fail = 0
const ok = (label, cond, extra) => {
	console.log((cond ? '  PASS  ' : '  FAIL  ') + label + (extra !== undefined ? '  | ' + extra : ''))
	if (!cond) fail++
}

/* withPort=true：非洲北部一支英国陆军 + 补给点 => 地中海满足"建设海军"条件 */
function base(withPort) {
	const g = rules.setup(901, rules.default_scenario, {})
	g.opening = null
	for (const p in g.location) delete g.location[p]
	g.table['英国'] = ['15356#1']
	g.hands['英国'] = ['15356#1'].concat((g.decks['英国'] || []).slice(0, 4))
	g.decks['英国'] = (g.decks['英国'] || []).slice(4)
	g.current_nation = '英国'
	g.active = 'Allies'
	g.turn_phase = 'play'
	g.log.length = 0
	if (withPort) {
		g.location['uk_a1'] = NAD
		g.piece_nation['uk_a1'] = '英国'
		g.piece_type['uk_a1'] = 'army'
		I.add_supply_point(g, NAD, '英国')
	}
	return g
}

console.log('=== A. 光环作用域 ===')
{
	const g = base(true)
	g.location['uk_n1'] = MED; g.piece_nation['uk_n1'] = '英国'; g.piece_type['uk_n1'] = 'navy'
	g.location['uk_n2'] = EAST_SEA; g.piece_nation['uk_n2'] = '英国'; g.piece_type['uk_n2'] = 'navy'
	I.apply_status_ongoing(g, '15356#1', '英国')
	const sup = I.compute_supply(g)
	ok('地中海英国海军 -> 在补给', !!sup.in_supply['uk_n1'], sup.sources && sup.sources['uk_n1'])
	ok('东海英国海军 -> 不在补给（地区限定）', !sup.in_supply['uk_n2'])
	ok('非洲北部英国陆军 -> 靠补给点而非本卡光环',
		sup.sources && sup.sources['uk_a1'] === 'base', sup.sources && sup.sources['uk_a1'])

	const aura = g.status_aura || {}
	ok('scope 记录 type=navy', aura.supply_immune_scope['英国'].type === 'navy')
	ok('scope 记录 space=地中海', Number(aura.supply_immune_scope['英国'].space) === MED)

	I.revert_status_ongoing(g, '15356#1', '英国')
	ok('revert 后 supply_immune 清空', !(g.status_aura.supply_immune || {})['英国'])
	ok('revert 后 scope 清空', !(g.status_aura.supply_immune_scope || {})['英国'])
}

console.log('\n=== B. 有港口时激活 -> 建设出海军（卡面口径） ===')
{
	const g = base(true)
	const hand = g.hands['英国'].slice()
	const before = I.count_pieces(g, { space: MED, nation: '英国', types: ['navy'] })
	const r = rules.action(g, 'Allies', 'activate_status', { card: '15356#1', discard: hand.slice(0, 2) })
	const after = I.count_pieces(r, { space: MED, nation: '英国', types: ['navy'] })
	ok('手牌 -2（付代价）', (r.hands['英国'] || []).length === hand.length - 2, (r.hands['英国'] || []).length)
	ok('地中海英国海军 +1', after === before + 1, before + ' -> ' + after)
	ok('skip_play_done 已置位', (r.skip_play_done || {})['英国'] === r.turn)
	ok('日志写"建设海军"而非"征召"', /建设海军/.test((r.log || []).join('\n')),
		(r.log || []).slice(-2)[0])
}

console.log('\n=== C. 无港口时 -> 置灰，激活不付代价 ===')
{
	const g = base(false)
	const cfg = { window: 'play_start', effect: { kind: 'build', nation: '英国', type: 'navy', space: '地中海' } }
	const ready = I.status_window_ready(g, '英国', '15356#1', cfg)
	ok('ready = false', !ready.ok, ready.reason)

	const hand = g.hands['英国'].slice()
	const r = rules.action(g, 'Allies', 'activate_status', { card: '15356#1', discard: hand.slice(0, 2) })
	ok('手牌未变（代价没付）', (r.hands['英国'] || []).length === hand.length, (r.hands['英国'] || []).length)
	ok('skip_play_done 未置位', !(r.skip_play_done || {})['英国'])
	ok('海军未建出', I.count_pieces(r, { space: MED, nation: '英国', types: ['navy'] }) === 0)
}

console.log('\n=== D. 不带 discard 点发动 -> 不跳阶段，可重试 ===')
{
	const g = base(true)
	const r1 = rules.action(g, 'Allies', 'activate_status', { card: '15356#1' })
	ok('skip_play_done 未置位（不再白跳）', !(r1.skip_play_done || {})['英国'], JSON.stringify(r1.skip_play_done))
	ok('日志提示先选弃牌', /请先选择要弃置的 2 张手牌/.test((r1.log || []).join('\n')),
		(r1.log || []).slice(-1)[0])

	const hand = (r1.hands['英国'] || []).slice()
	const r2 = rules.action(r1, 'Allies', 'activate_status', { card: '15356#1', discard: hand.slice(0, 2) })
	ok('重试可发动（未卡死）', I.count_pieces(r2, { space: MED, nation: '英国', types: ['navy'] }) === 1,
		I.count_pieces(r2, { space: MED, nation: '英国', types: ['navy'] }))
	ok('重试后 skip_play_done 才置位', (r2.skip_play_done || {})['英国'] === r2.turn)
}

console.log('\n=== E. 其它状态卡未受影响 ===')
{
	const src = fs.readFileSync(path.join(MOD, 'rules.js'), 'utf8')
	const n = (src.match(/effect: \{ kind: 'recruit'/g) || []).length
	ok('recruit 配置块仍 6 处（15356 已改 build）', n === 6, n + ' 处')
	ok('15356 已是 kind:build', /effect: \{ kind: 'build', nation: '英国', type: 'navy', space: '地中海' \}/.test(src))

	/* 15242 人民冲锋队：cost.skip_play + discard_is（必须弃【发起陆战】） */
	const g = rules.setup(902, rules.default_scenario, {})
	g.opening = null
	g.table['德国'] = ['15242#1']
	g.hands['德国'] = (g.decks['德国'] || []).slice(0, 4)
	g.decks['德国'] = (g.decks['德国'] || []).slice(4)
	g.current_nation = '德国'
	g.active = 'Axis'
	g.turn_phase = 'play'
	g.log.length = 0
	const hand = g.hands['德国'].slice()
	const r = rules.action(g, 'Axis', 'activate_status', { card: '15242#1', discard: hand.slice(0, 1) })
	ok('15242 弃错牌 -> skip_play_done 未置位', !(r.skip_play_done || {})['德国'], JSON.stringify(r.skip_play_done))
	ok('15242 日志提示代价牌不对', /代价必须是指定的牌/.test((r.log || []).join('\n')), (r.log || []).slice(-1)[0])
}

console.log('\n----------------------------------------')
if (fail) {
	console.log('SOME ' + fail + ' FAILED')
	process.exit(1)
}
console.log('ALL PASS')
