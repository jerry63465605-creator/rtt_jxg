/*
 * T3 修复验证：战斗挂起期间【非应答方】不得拿到通用动作表（按钮全亮）
 *
 *  A. 同盟发起、德国防守（等 Axis 表态）
 *     -> Axis actions 含 resolve_battle；Allies 只有 log；Allies.block_reason 指向等待
 *  B. 反向：德国发起、英国防守（等 Allies 表态）
 *     -> Allies 含 resolve_battle；Axis 只有 log
 *  C. view.pending_battle 仍只下发给等待方（保密不受影响）
 *  D. 回归：应答方表态后挂起解除，双方动作恢复
 *
 * 用法：node tools/_verify_battle_pending_actions.js
 */
const path = require('path')
const ROOT = path.join(__dirname, '..')
const MOD = path.join(ROOT, 'server-official', 'public', 'quartermaster-sub-wars')
const R = require(path.join(MOD, 'rules.js'))
const I = R._internal
const d = I.data

let pass = 0, fail = 0
const ok = (m, c, extra) => { if (c) { pass++; console.log('  ✓ ' + m) } else { fail++; console.log('  ✗ ' + m + (extra ? '  | ' + extra : '')) } }
const acts = v => Object.keys(v.actions || {})

function mkBase() {
	const g = R.setup(7)
	g.opening = null
	I.refresh(g)
	return g
}

/* A. 英国陆军@西欧 打 德国陆军@德国（德国有空军 -> 可代受 -> 挂起，等 Axis） */
console.log('=== A. 同盟发起、德国防守 ===')
let gA
{
	const g = mkBase()
	gA = g
	R.action(g, 'Allies', 'debug_place', { piece: 'uk1', nation: '英国', type: 'army', space: d.id_of('西欧') })
	R.action(g, 'Axis', 'debug_place', { piece: 'de1', nation: '德国', type: 'army', space: d.id_of('德国') })
	R.action(g, 'Axis', 'debug_place', { piece: 'de_air', nation: '德国', type: 'air', space: d.id_of('德国') })
	I.refresh(g)
	I.grant_supply(g, 'uk1', g.turn)
	I.refresh(g)
	const n0 = (g.log || []).length
	const r = I.do_battle(g, '英国', d.id_of('德国'), 'de1', 'land', { from: 'uk1' })
	console.log('  do_battle: ' + ((g.log || []).slice(n0).join(' | ') || '(无日志)') + (r && r.ok === false ? ' 【拒绝】' + r.reason : ''))
	console.log('  pending_battle = ' + JSON.stringify(g.pending_battle && { def: g.pending_battle.defender_nation, stage: g.pending_battle.stage }))
	ok('★ 战斗已挂起', !!g.pending_battle, String(!!g.pending_battle))
	ok('  等待方是德国（Axis）', g.pending_battle && g.pending_battle.defender_nation === '德国')

	const vX = R.view(g, 'Axis'), vA = R.view(g, 'Allies')
	console.log('  Axis   actions = ' + JSON.stringify(acts(vX)))
	console.log('  Allies actions = ' + JSON.stringify(acts(vA)))
	ok('★★ 应答方（Axis）拿到 resolve_battle', acts(vX).indexOf('resolve_battle') >= 0, JSON.stringify(acts(vX)))
	ok('★★ 非应答方（Allies）只剩 log（不再按钮全亮）',
		acts(vA).every(a => a === 'log' || a === 'use_armed_offer' || a === 'skip_armed_offer'), JSON.stringify(acts(vA)))
	ok('★ 非应答方被明确 block（block_reason 指向等待对方）',
		/pending_battle/.test(g.block_reason || ''), String(g.block_reason))
	ok('view.pending_battle 只给等待方', !!vX.pending_battle && !vA.pending_battle,
		JSON.stringify({ X: !!vX.pending_battle, A: !!vA.pending_battle }))
}

/* D. 应答方表态后恢复 */
console.log('\n=== D. 应答方表态后动作恢复 ===')
{
	const g = gA
	const n0 = (g.log || []).length
	/* 德国选择「不代受」 */
	R.action(g, 'Axis', 'resolve_battle', { declined: true })
	console.log('  resolve_battle: ' + ((g.log || []).slice(n0).join(' | ') || '(无日志)'))
	ok('★ 挂起已解除', !g.pending_battle, JSON.stringify(g.pending_battle && g.pending_battle.stage))
	const vA = R.view(g, 'Allies'), vX = R.view(g, 'Axis')
	ok('★ 同盟侧恢复出牌动作', acts(vA).indexOf('play_card') >= 0 || acts(vA).indexOf('next_phase') >= 0, JSON.stringify(acts(vA)))
	ok('★ 轴心侧也恢复', acts(vX).indexOf('play_card') >= 0 || acts(vX).indexOf('next_phase') >= 0, JSON.stringify(acts(vX)))
}

/* B. 反向：德国发起、英国防守 */
console.log('\n=== B. 反向（Axis 发起、Allies 防守）===')
{
	const g = mkBase()
	R.action(g, 'Axis', 'debug_place', { piece: 'de2', nation: '德国', type: 'army', space: d.id_of('德国') })
	R.action(g, 'Allies', 'debug_place', { piece: 'uk2', nation: '英国', type: 'army', space: d.id_of('西欧') })
	R.action(g, 'Allies', 'debug_place', { piece: 'uk_air', nation: '英国', type: 'air', space: d.id_of('西欧') })
	I.refresh(g)
	I.grant_supply(g, 'de2', g.turn)
	I.refresh(g)
	const n0 = (g.log || []).length
	I.do_battle(g, '德国', d.id_of('西欧'), 'uk2', 'land', { from: 'de2' })
	console.log('  do_battle: ' + ((g.log || []).slice(n0).join(' | ') || '(无日志)'))
	console.log('  pending_battle = ' + JSON.stringify(g.pending_battle && { def: g.pending_battle.defender_nation }))
	ok('★ 战斗已挂起（防守方=英国）', !!g.pending_battle && g.pending_battle.defender_nation === '英国')
	const vA = R.view(g, 'Allies'), vX = R.view(g, 'Axis')
	console.log('  Allies actions = ' + JSON.stringify(acts(vA)))
	console.log('  Axis   actions = ' + JSON.stringify(acts(vX)))
	ok('★★ 应答方（Allies）拿到 resolve_battle', acts(vA).indexOf('resolve_battle') >= 0, JSON.stringify(acts(vA)))
	ok('★★ 非应答方（Axis）只剩 log（或自身武装窗口）',
		acts(vX).every(a => a === 'log' || a === 'use_armed_offer' || a === 'skip_armed_offer'), JSON.stringify(acts(vX)))
}

console.log('\n' + (fail === 0 ? 'ALL PASS（' + pass + ' 项）' : fail + ' FAIL / ' + pass + ' 项'))
process.exitCode = fail ? 1 : 0
