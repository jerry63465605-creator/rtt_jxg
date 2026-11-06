/* 只读：验证「敌方增强卡被拦截」窗口是否强挂起（15352 / 16700 走 enemy_echo_played） */
const path = require('path')
const ROOT = path.join(__dirname, '..')
const MOD = path.join(ROOT, 'server-official', 'public', 'quartermaster-sub-wars')
const R = require(path.join(MOD, 'rules.js'))
const I = R._internal
const faceOf = x => String(x).split('#')[0]
const logSince = (g, n) => (g.log || []).slice(n).join(' | ')

console.log('导出检查：',
	['offer_armed_effects', 'queue_status_react', 'step_status_react', 'notify_german_status_used']
		.map(k => k + '=' + typeof I[k]).join('  '))

const g = R.setup(7)
g.opening = null
g.neutral = { '苏联': false, '美国': false }
I.refresh(g)
R.action(g, 'Allies', 'debug_add_card', { face: '15352', nation: '英国', dest: 'hand' })
R.action(g, 'Axis', 'debug_set_phase', { nation: '德国', phase: 'play' })
I.refresh(g)

/* 模拟「德国打出一张增强卡」后的派发（与 resume_echo_queue 同参数） */
I.offer_armed_effects(g, 'enemy_echo_played', {
	nation: '德国', card: '15205#999', space: null, via: 'play', window: 'enemy_echo_played',
})
const offers = (g.armed_offers || []).map(w => ({
	when: w.when, n: (w.cards || []).length,
	cards: (w.cards || []).map(c => faceOf(c.card_id) + '@' + (c.nation || '?')),
	ctxNation: w.ctx && (w.ctx.nation || w.ctx.piece_nation || w.ctx.target_nation),
}))
console.log('offers = ' + JSON.stringify(offers))

const n = (g.log || []).length
R.action(g, 'Axis', 'next_phase', {})
const lg = logSince(g, n)
console.log('德国 next_phase → ' + (lg || '(无日志，动作生效)'))
console.log('★ 被强挂起 = ' + /等待【.+】决定是否发动/.test(lg) + '   phase=' + g.turn_phase)

/* 对照：B8 的 piece_removed 窗口（已知会挂起） */
const g2 = R.setup(7)
g2.opening = null
g2.neutral = { '苏联': false, '美国': false }
I.refresh(g2)
R.action(g2, 'Allies', 'debug_add_card', { face: '15311', nation: '法国', dest: 'hand' })
R.action(g2, 'Axis', 'debug_set_phase', { nation: '德国', phase: 'play' })
I.refresh(g2)
I.offer_armed_effects(g2, 'piece_removed', {
	nation: '德国', piece: 'fr_1', piece_id: 'fr_1', piece_nation: '法国', piece_type: 'army',
	space: 5, reason: 'piece_removed',
})
const n2 = (g2.log || []).length
R.action(g2, 'Axis', 'next_phase', {})
const lg2 = logSince(g2, n2)
console.log('对照 piece_removed：' + (lg2 || '(无日志)') + '  ★ 被挂起 = ' + /等待【.+】决定是否发动/.test(lg2))
