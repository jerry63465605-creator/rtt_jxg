/*
 * B34 真实测试：17837《KV-2 重型坦克》+ 17853《一步也不许后退!》全部拒绝后不再反复询问。
 *
 * A 正常路径：连续拒绝 → 两次询问后战斗正常结算
 * B ★★ 玩家报障：连续拒绝 8 次不再交替重挂（改回旧代码必红）
 * C 边界：只装一张 / 无暗置卡
 * D 对照：发动分支仍生效；另一场独立战斗可重新询问；guard_done 语义未变
 * E 静态守卫：所有重放点统一走 battle_replay_opt，三条守卫仍在
 *
 * 用法：node tools/_real_test_B34_kv2_step_back_refuse.js
 */
const path = require('path')
const fs = require('fs')
const ROOT = path.join(__dirname, '..')
const MOD = path.join(ROOT, 'server-official', 'public', 'quartermaster-sub-wars')
const R = require(path.join(MOD, 'rules.js'))
const I = R._internal
const d = I.data

let pass = 0, fail = 0
const ok = (m, c, extra) => {
	if (c) { pass++; console.log('  ✓ ' + m) }
	else { fail++; console.log('  ✗ ' + m + (extra !== undefined ? '  | ' + extra : '')) }
}
const EAST = () => d.id_of('东欧'), ROSS = () => d.id_of('罗斯')
const stageOf = g => (g.pending_battle && g.pending_battle.stage) || null
const faces = g => (g.table_responses || []).map(x => String(x.card_id).split('#')[0])

/* 摆初始局面：德国陆军@东欧、苏联陆军@罗斯，暗置指定响应卡 */
function board(darkFaces) {
	const g = R.setup(7)
	g.opening = null
	g.neutral = { '苏联': false, '美国': false }
	I.refresh(g)
	R.action(g, 'Axis', 'debug_place', { piece: 'de_army_b34', nation: '德国', type: 'army', space: EAST() })
	R.action(g, 'Allies', 'debug_place', { piece: 'su_army_b34', nation: '苏联', type: 'army', space: ROSS() })
	R.action(g, 'Allies', 'debug_set_phase', { nation: '苏联', phase: 'play' })
	I.refresh(g)
	for (const p of ['de_army_b34', 'su_army_b34'])
		if (g.location[p] != null) I.grant_supply(g, p, g.turn)
	g.table_responses = (darkFaces || []).map((f, i) =>
		({ card_id: f + '#' + (i + 1), owner_nation: '苏联', owner_side: 'allies' }))
	I.refresh(g)
	return g
}

function attack(g, victim) {
	return I.do_battle(g, '德国', ROSS(), victim || 'su_army_b34', 'land', { from: 'de_army_b34' })
}

/* 全部拒绝：kv2_trigger=false / step_back=false / guard=null / declined=true */
function refuse(g) {
	return R.action(g, 'Allies', 'resolve_battle', {
		kv2_trigger: false, step_back: false, guard: null, declined: true,
	})
}

console.log('=== A. 正常路径：两张都拒绝 → 战斗正常结算 ===')
{
	const g = board(['17837', '17853'])
	const activeBefore = g.active
	attack(g)
	ok('首挂 kv2_ask', stageOf(g) === 'kv2_ask', stageOf(g))
	refuse(g)
	ok('第二次询问 su_step_back', stageOf(g) === 'su_step_back', stageOf(g))
	refuse(g)
	ok('★★ 两次拒绝后无挂起', stageOf(g) === null, stageOf(g))
	ok('★ 被攻击陆军被移除', g.location['su_army_b34'] == null, JSON.stringify(g.location['su_army_b34']))
	ok('拒绝不消耗暗置响应卡', faces(g).join(',') === '17837,17853', faces(g).join(','))
	ok('操作权归还到战斗前的一方（battle_reconcile_active）', g.active === activeBefore,
		'before=' + activeBefore + ' now=' + g.active)
}

console.log('\n=== B. ★★ 玩家报障：连续拒绝 8 次不再交替重挂 ===')
{
	const g = board(['17837', '17853'])
	attack(g)
	const seq = []
	for (let i = 0; i < 8; i++) {
		const st = stageOf(g)
		if (!st) break
		seq.push(st)
		refuse(g)
	}
	console.log('  stage 序列: ' + seq.join(' -> '))
	ok('★★ 最多两次询问（kv2_ask + su_step_back）', seq.length <= 2, JSON.stringify(seq))
	ok('★★ 无窗口被重复询问', new Set(seq).size === seq.length, JSON.stringify(seq))
	ok('★★ 最终 pending_battle 清空', g.pending_battle == null, stageOf(g))
	ok('★★ 两张暗置卡仍留桌面（未消耗、未丢失）', faces(g).join(',') === '17837,17853', faces(g).join(','))
	ok('battle_asked 记账完整落盘', !!(g.battle_asked && g.battle_asked.kv2 && g.battle_asked.su_step_back),
		JSON.stringify(g.battle_asked))
}

console.log('\n=== C. 边界：只装一张 / 无暗置卡 ===')
{
	const g1 = board(['17837'])
	attack(g1)
	ok('只有 17837 → 首挂 kv2_ask', stageOf(g1) === 'kv2_ask', stageOf(g1))
	refuse(g1)
	ok('只有 17837 → 一次拒绝即结算', stageOf(g1) === null, stageOf(g1))

	const g2 = board(['17853'])
	attack(g2)
	ok('只有 17853 → 首挂 su_step_back', stageOf(g2) === 'su_step_back', stageOf(g2))
	refuse(g2)
	ok('只有 17853 → 一次拒绝即结算', stageOf(g2) === null, stageOf(g2))

	const g3 = board([])
	const r3 = attack(g3)
	ok('无暗置卡 → 不产生询问', stageOf(g3) === null && r3.ok !== false, stageOf(g3))
}

console.log('\n=== D. 对照：发动分支 / 独立新战斗 / 不误伤 ===')
{
	/* D1 KV-2 发动 protect：卡消耗、陆军不被移除 */
	const g = board(['17837'])
	attack(g)
	R.action(g, 'Allies', 'resolve_battle', { kv2_trigger: true })
	ok('发动后切 stage=kv2（等攻击方选择）', stageOf(g) === 'kv2', stageOf(g))
	R.action(g, 'Axis', 'resolve_battle', { kv2: 'protect' })
	ok('发动 protect → 陆军未被移除', g.location['su_army_b34'] != null, JSON.stringify(g.location['su_army_b34']))
	ok('发动后暗置卡被消耗', faces(g).length === 0, faces(g).join(','))
	ok('发动后无挂起残留', stageOf(g) === null, stageOf(g))
}
{
	/* D2 另一场独立战斗重新允许询问（新战斗清空记账） */
	const g = board(['17837', '17853'])
	attack(g)
	refuse(g); refuse(g)
	ok('第一场已结算', stageOf(g) === null && g.location['su_army_b34'] == null)
	R.action(g, 'Allies', 'debug_place', { piece: 'su_army_b34_2', nation: '苏联', type: 'army', space: ROSS() })
	I.refresh(g)
	if (g.location['su_army_b34_2'] != null) I.grant_supply(g, 'su_army_b34_2', g.turn)
	I.refresh(g)
	attack(g, 'su_army_b34_2')
	ok('★★ 新的一场战斗重新询问 kv2_ask（记账按场清空）', stageOf(g) === 'kv2_ask', stageOf(g))
	refuse(g); refuse(g)
	ok('新战斗再拒绝两次后也正常结算', stageOf(g) === null, stageOf(g))
}

console.log('\n=== E. 静态守卫：重放点统一、守卫未被删 ===')
{
	const src = fs.readFileSync(path.join(MOD, 'rules.js'), 'utf8')
	const replayCalls = (src.match(/battle_replay_opt\(/g) || []).length
	ok('battle_replay_opt 定义 + 7 处重放调用', replayCalls >= 8, replayCalls)
	ok('无裸写的 kv2_done: true 重放参数', !/kv2_done:\s*true/.test(src))
	ok('无裸写的 su_step_back_done: true 重放参数', !/su_step_back_done:\s*true/.test(src))
	ok('三条独立守卫仍在', /!opt\.guard_done && !opt\.kv2_done/.test(src) &&
		/!opt\.guard_done && !opt\.su_step_back_done/.test(src) && /if \(!opt\.guard_done\)/.test(src))
	ok('新战斗清空 battle_asked', /game\.battle_asked = null/.test(src))
}

console.log('\n' + (fail === 0 ? 'ALL PASS（' + pass + ' 项）' : 'FAIL ' + fail + ' 项 / PASS ' + pass + ' 项'))
process.exitCode = fail ? 1 : 0
