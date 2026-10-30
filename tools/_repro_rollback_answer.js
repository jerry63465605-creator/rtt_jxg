/*
 * 【排查】回退（时间回溯）功能：接受方是否能看到 同意/拒绝。
 *
 * 现象：上个版本正常，新包里"接受回退的一方看不到同意或者拒绝"。
 *
 * 用法：node tools/_repro_rollback_answer.js
 */
const path = require('path')
const MOD = path.join(__dirname, '..', 'server-official', 'public', 'quartermaster-sub-wars')
const rules = require(path.join(MOD, 'rules.js'))
const I = rules._internal

function dump(tag, g) {
	const vA = rules.view(g, 'Axis')
	const vB = rules.view(g, 'Allies')
	console.log('\n---- ' + tag + ' ----')
	console.log('  active =', g.active, '  current_nation =', g.current_nation)
	console.log('  rollback 点数 =', (g.rollback || []).length)
	console.log('  rollback_proposal =', g.rollback_proposal
		? { by_side: g.rollback_proposal.by_side, n: g.rollback_proposal.n } : null)
	console.log('  [Axis]   propose=%s cancel=%s accept=%s reject=%s',
		!!vA.actions['propose_rollback'], !!vA.actions['cancel_rollback'],
		!!vA.actions['accept_rollback'], !!vA.actions['reject_rollback'])
	console.log('  [Allies] propose=%s cancel=%s accept=%s reject=%s',
		!!vB.actions['propose_rollback'], !!vB.actions['cancel_rollback'],
		!!vB.actions['accept_rollback'], !!vB.actions['reject_rollback'])
}

/* 开局 + 走几步产生回退点 */
const g = rules.setup(1)
g.opening = null
console.log('view.rollback_points 字段 =', JSON.stringify(
	(rules.view(g, 'Axis').rollback_points || []).length))
dump('初始', g)

/* 走几个动作（每个动作边界会 push 回退点） */
for (let i = 0; i < 3; i++) {
	const l0 = g.log.length
	rules.action(g, 'Axis', 'next_phase', {})
	console.log('\n  动作' + (i + 1) + ' 日志 =', g.log.slice(l0).join(' | ').slice(0, 120))
}
dump('走了 3 步之后', g)

/* 轴心提议回退 */
const l1 = g.log.length
rules.action(g, 'Axis', 'propose_rollback', {})
console.log('\n  提议日志 =', g.log.slice(l1).join(' | '))
dump('轴心提议回退之后', g)

/* 同盟（接受方）尝试同意 */
if (g.rollback_proposal) {
	const l2 = g.log.length
	rules.action(g, 'Allies', 'accept_rollback', {})
	console.log('\n  同盟同意日志 =', g.log.slice(l2).join(' | '))
	dump('同盟回应之后', g)
} else {
	console.log('\n  !! rollback_proposal 未建立 -> 接受方自然看不到按钮')
}
