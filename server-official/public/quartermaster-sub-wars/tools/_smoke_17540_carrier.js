/*
 * 回归：17540《航空母舰》/ 15339《英国皇家海军》的「发起海战后」发动时点
 *
 * 玩家口径（2026-10-23）：
 *   1A —— 只有【本国发起】海战才能发动（英国发起 → 美国 17540 不可用）
 *   2A —— 时点 = 【立刻】（与 15253《闪电战》after_land 对齐，下一个独立动作即关窗）
 *
 * 修复前的三个错误行为（本测试逐条锁死）：
 *   ① 整回合任意时刻可点（靠 last_battle 判定，持久整回合）
 *   ② 同阵营任一国发起即放行（阵营判定替代国别判定）
 *   ③ 之后又打一场陆战 → last_battle 被覆盖 → 窗口反而消失
 *
 * 用法：node tools/_smoke_17540_carrier.js
 */
const path = require('path')
const MOD = path.resolve(__dirname, '..')
const rules = require(path.join(MOD, 'rules.js'))
const I = rules._internal

let fail = 0
function ok(label, cond, extra) {
	console.log((cond ? '  PASS  ' : '  FAIL  ') + label + (extra ? '  | ' + extra : ''))
	if (!cond) fail++
}

const BAY = I.data.id_of('北海')
const PAC = I.data.id_of('中太平洋')

function base(currentNation) {
	const g = rules.setup(21, rules.default_scenario, {})
	g.table = g.table || {}
	g.current_nation = currentNation || '美国'
	g.active = 'Axis'
	g.turn_phase = 'play'
	g.status_used = {}
	g.status_instant = []
	g.log.length = 0
	return g
}

const T17540 = I.status_config_of('17540').trigger
const T15339 = I.status_config_of('15339').trigger

/* ============================================================ */
console.log('=== A. 武装：美国发起海战时，status_instant 里应出现 17540（带 by/space） ===')
{
	const g = base()
	g.table['美国'] = ['17540']
	I.arm_after_battle_status(g, '美国', 'sea', BAY, {})
	const e = (g.status_instant || []).find(x => x.card_id === '17540')
	ok('17540 已武装', !!e, JSON.stringify(e))
	ok('window = after_naval', e && e.window === 'after_naval', e && e.window)
	ok('space = 海战地区', e && Number(e.space) === Number(BAY), e && String(e.space))
	ok('by = 发起国（美国）', e && e.by === '美国', e && e.by)
}

console.log('\n=== B. 立刻发动：刚打完海战 ready=true ===')
{
	const g = base()
	g.table['美国'] = ['17540']
	I.arm_after_battle_status(g, '美国', 'sea', BAY, {})
	const r = I.status_window_ready(g, '美国', '17540', T17540)
	ok('ready = true', r.ok, r.reason || '')
	ok('带回 space（供建海军用）', Number(r.space) === Number(BAY), String(r.space))
}

console.log('\n=== C. 窗口关闭：做了独立动作后不可再发动（2A） ===')
{
	const g = base()
	g.table['美国'] = ['17540']
	I.arm_after_battle_status(g, '美国', 'sea', BAY, {})
	/* 窗口本来靠 exports.action 顶部清空 —— 这里等价模拟"下一个独立动作" */
	g.status_instant = []
	const r = I.status_window_ready(g, '美国', '17540', T17540)
	ok('ready = false', !r.ok, r.reason || '')
	ok('提示"仅能在发起海战后立刻"', /立刻/.test(r.reason || ''), r.reason || '')
}

console.log('\n=== D. 国别（1A）：英国发起海战，美国 17540 不可发动 ===')
{
	const g = base()
	g.table['美国'] = ['17540']
	I.arm_after_battle_status(g, '英国', 'sea', BAY, {})
	const e = (g.status_instant || []).find(x => x.card_id === '17540')
	ok('窗口仍被武装（同阵营）', !!e, JSON.stringify(e))
	ok('by 记录的是英国', e && e.by === '英国', e && e.by)
	const r = I.status_window_ready(g, '美国', '17540', T17540)
	ok('美国 ready = false', !r.ok, r.reason || '')
	ok('原因指明由英国发起', /英国/.test(r.reason || ''), r.reason || '')
}

console.log('\n=== E. 陆战不武装海战窗口（窗口不会被"打错仗"打开） ===')
{
	const g = base()
	g.table['美国'] = ['17540']
	I.arm_after_battle_status(g, '美国', 'land', I.data.id_of('东欧'), {})
	const r = I.status_window_ready(g, '美国', '17540', T17540)
	ok('打完陆战后 ready = false', !r.ok, r.reason || '')
}

console.log('\n=== F. last_battle 被覆盖后，窗口仍靠 status_instant（不会误开/误关） ===')
{
	const g = base()
	g.table['美国'] = ['17540']
	I.arm_after_battle_status(g, '美国', 'sea', BAY, {})
	/* 之后又打了一场陆战：last_battle 指向陆战 */
	g.last_battle = { turn: g.turn, kind: 'land', attacker: '美国', space: I.data.id_of('东欧') }
	const r = I.status_window_ready(g, '美国', '17540', T17540)
	ok('海战窗口仍在（不再依赖 last_battle）', r.ok, r.reason || '')
	ok('space 仍是原海战地区', Number(r.space) === Number(BAY), String(r.space))
}

console.log('\n=== G. 15339 英国皇家海军：同样受"本国发起"约束 ===')
{
	/* 状态卡还有一条通用约束「只能在持有国的回合发动」，故 current_nation 设为英国 */
	const g = base('英国')
	g.table['英国'] = ['15339']
	I.arm_after_battle_status(g, '英国', 'sea', BAY, {})
	const r1 = I.status_window_ready(g, '英国', '15339', T15339)
	ok('英国自己发起 -> ready = true', r1.ok, r1.reason || '')

	const g2 = base('英国')
	g2.table['英国'] = ['15339']
	I.arm_after_battle_status(g2, '美国', 'sea', BAY, {})
	const r2 = I.status_window_ready(g2, '英国', '15339', T15339)
	ok('美国发起 -> 英国 ready = false', !r2.ok, r2.reason || '')
	ok('原因指明由美国发起', /美国/.test(r2.reason || ''), r2.reason || '')
}

console.log('\n=== H. 战斗地区取值：ctxSpace 优先于 last_battle（改动 4） ===')
{
	const g = base()
	/* 让 last_battle 指向别处，再用 ctxSpace 传真实海战地区 */
	g.last_battle = { turn: g.turn, kind: 'sea', attacker: '英国', space: PAC }
	g.table['英国'] = ['15339']
	/* 15339 效果=发起海战；本地区无英国海军时返回 ok:false 并给出 reason，
	   我们只验证"它按 ctxSpace 去查，而不是按 last_battle(PAC)" */
	const r = I.run_status_effect(g, '英国', '15339', T15339, {}, BAY)
	ok('按 ctxSpace(北海) 处理，而非 last_battle(中太平洋)',
		!/中太平洋/.test(r.reason || ''), (r.reason || '') + ' | ' + JSON.stringify(r).slice(0, 120))
}

console.log('\n=== I. 德国 auto_fire 保留（无德国 after_naval 卡时空转不报错） ===')
{
	const g = base('德国')
	I.arm_after_battle_status(g, '德国', 'sea', BAY, {})
	ok('无异常日志', !(g.log || []).some(l => /auto_fire after_naval 错误|arm after_naval 错误/.test(l)),
		(g.log || []).slice(-2).join(' / '))
}

console.log('\n' + (fail ? 'FAIL / ' + fail : 'ALL PASS'))
process.exit(fail ? 1 : 0)
