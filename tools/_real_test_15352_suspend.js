/*
 * B19：增强卡拦截窗口（15352 布莱切利园）必须【强挂起】
 *
 * A 窗口开在英方（Allies 视角可见 / Axis 不可见）
 * B ★★ 窗口存在时德国 next_phase 被拒（「等待【英国】决定是否发动…」）
 * C ★★ 德国 play_card 同样被拒
 * D 英国「不发动」→ 德国恢复推进（无死锁）
 * E ★ 15353 的状态卡拦截窗口同样强挂起（同一判据）
 * F ★ 本方自有窗口（after_build_army）不阻塞（"错过即失效"不变）
 * G 静态守卫
 *
 * 用法：node tools/_real_test_15352_suspend.js
 */
const path = require('path')
const ROOT = path.join(__dirname, '..')
const MOD = path.join(ROOT, 'server-official', 'public', 'quartermaster-sub-wars')
const R = require(path.join(MOD, 'rules.js'))
const I = R._internal
const d = I.data
const faceOf = x => String(x).split('#')[0]
const logSince = (g, n) => (g.log || []).slice(n).join(' | ')

let pass = 0, fail = 0
const ok = (m, c, extra) => { if (c) { pass++; console.log('  ✓ ' + m) } else { fail++; console.log('  ✗ ' + m + (extra ? '  | ' + extra : '')) } }

function fresh(germanCards) {
	const g = R.setup(7)
	g.opening = null
	g.neutral = { '苏联': false, '美国': false }
	I.refresh(g)
	/* 英国手里：15352 + 一张可弃的牌 */
	R.action(g, 'Allies', 'debug_add_card', { face: '15352', nation: '英国', dest: 'hand' })
	R.action(g, 'Allies', 'debug_add_card', { face: '15348', nation: '英国', dest: 'hand' })
	for (const f of (germanCards || [])) R.action(g, 'Axis', 'debug_add_card', { face: f, nation: '德国', dest: 'hand' })
	R.action(g, 'Axis', 'debug_set_phase', { nation: '德国', phase: 'play' })
	I.refresh(g)
	return g
}

console.log('=== A/B/C. 15352 窗口 + 德国被拦住 ===')
{
	const g = fresh()
	/* 与 resume_echo_queue 同参数派发（真实派发点 rules.js:15053） */
	I.offer_armed_effects(g, 'enemy_echo_played', {
		nation: '德国', card: '15205#999', space: null, via: 'play', window: 'enemy_echo_played',
	})
	const offers = (g.armed_offers || []).map(w => ({ when: w.when, cards: (w.cards || []).map(c => faceOf(c.card_id)) }))
	console.log('  offers = ' + JSON.stringify(offers))
	ok('★★ 拦截窗口已开出（15352 在候选里）',
		!!(g.armed_offers || []).some(w => w.when === 'enemy_echo_played' && (w.cards || []).some(c => faceOf(c.card_id) === '15352')),
		JSON.stringify(offers))

	/* 可见性：按持有方下发 */
	const va = R.view(g, 'Allies'), vx = R.view(g, 'Axis')
	console.log('  Allies.armed_offer = ' + JSON.stringify(va.armed_offer && va.armed_offer.when) +
		'   Axis.armed_offer = ' + JSON.stringify(vx.armed_offer && vx.armed_offer.when))
	ok('★ 只有英方视角看得到该窗口', !!va.armed_offer && !vx.armed_offer)

	const n1 = (g.log || []).length
	R.action(g, 'Axis', 'next_phase', {})
	const lg1 = logSince(g, n1)
	console.log('  德国 next_phase → ' + (lg1 || '(无日志，动作生效)'))
	ok('★★ 窗口存在时德国 next_phase 被拒', /等待【英国】决定是否发动/.test(lg1), lg1.slice(0, 120))
	ok('★ 仍停在出牌阶段', g.turn_phase === 'play', g.turn_phase)

	const deCard = (g.hands['德国'] || [])[0]
	const n2 = (g.log || []).length
	R.action(g, 'Axis', 'play_card', { card: deCard })
	const lg2 = logSince(g, n2)
	console.log('  德国 play_card → ' + (lg2 || '(无日志，动作生效)'))
	ok('★★ 窗口存在时德国 play_card 也被拒', /等待【英国】决定是否发动/.test(lg2), lg2.slice(0, 120))

	/* D 英国不发动 → 德国恢复推进 */
	R.action(g, 'Allies', 'skip_armed_offer', {})
	const n3 = (g.log || []).length
	R.action(g, 'Axis', 'next_phase', {})
	const lg3 = logSince(g, n3)
	console.log('  跳过窗口后 next_phase → ' + lg3.slice(0, 140))
	ok('★★ 表态后德国恢复推进（无死锁）', /空军阶段/.test(lg3) || g.turn_phase !== 'play', g.turn_phase)
}

console.log('\n=== E. 15353 的状态卡拦截窗口同样强挂起 ===')
{
	const g = R.setup(7)
	g.opening = null
	g.neutral = { '苏联': false, '美国': false }
	I.refresh(g)
	R.action(g, 'Allies', 'debug_add_card', { face: '15353', nation: '英国', dest: 'hand' })
	R.action(g, 'Allies', 'debug_add_card', { face: '15348', nation: '英国', dest: 'hand' })
	R.action(g, 'Axis', 'debug_set_phase', { nation: '德国', phase: 'play' })
	I.refresh(g)
	I.offer_armed_effects(g, 'enemy_status_effect', {
		nation: '德国', card: '15241#77', arg: {}, window: 'enemy_status_effect',
	})
	console.log('  offers = ' + JSON.stringify((g.armed_offers || []).map(w => (w.cards || []).map(c => faceOf(c.card_id)))))
	const n = (g.log || []).length
	R.action(g, 'Axis', 'next_phase', {})
	const lg = logSince(g, n)
	console.log('  德国 next_phase → ' + (lg || '(无日志)'))
	ok('★★ 状态卡拦截窗口同样强挂起', /等待【英国】决定是否发动/.test(lg), lg.slice(0, 120))
}

console.log('\n=== F. 本方自有窗口不阻塞（回归）===')
{
	const g = R.setup(7)
	g.opening = null
	g.neutral = { '苏联': false, '美国': false }
	I.refresh(g)
	R.action(g, 'Axis', 'debug_add_card', { face: '15247', nation: '德国', dest: 'hand' })
	/* 真放一支德国陆军（15247 ready 需要"刚建成的地区"是合法地区） */
	R.action(g, 'Axis', 'debug_place', { piece: 'de_x', nation: '德国', type: 'army', space: d.id_of('德国') })
	R.action(g, 'Axis', 'debug_set_phase', { nation: '德国', phase: 'play' })
	I.refresh(g)
	I.offer_armed_effects(g, 'after_build_army', {
		nation: '德国', piece: 'de_x', piece_id: 'de_x', piece_nation: '德国', piece_type: 'army',
		space: d.id_of('德国'), reason: 'after_build_army',
	})
	/*
	 * 若引擎没为这张卡开窗（ready 不满足），就手工摆一个"本方窗口"的等价形状，
	 * 只为验证门禁判据：cards[0].nation = 德国（= 本方）→ 不应阻塞。
	 */
	if (!(g.armed_offers || []).some(w => w.when === 'after_build_army')) {
		g.armed_offers = [{ when: 'after_build_army', ctx: { nation: '德国' }, cards: [{ card_id: '15247#1', nation: '德国', name: '贵在行动' }] }]
	}
	console.log('  offers = ' + JSON.stringify((g.armed_offers || []).map(w => w.when)))
	const n = (g.log || []).length
	R.action(g, 'Axis', 'next_phase', {})
	const lg = logSince(g, n)
	console.log('  德国 next_phase → ' + lg.slice(0, 120))
	ok('★ 本方窗口不阻塞本回合推进（错过即失效）', !/等待【/.test(lg), lg.slice(0, 120))
}

console.log('\n=== G. 静态守卫 ===')
{
	const src = require('fs').readFileSync(path.join(MOD, 'rules.js'), 'utf8')
	ok('判据读卡片归属国', /const pn = c0\.nation \|\| ctx\.piece_nation \|\| ctx\.target_nation/.test(src))
	ok('不再要求 w.ctx 必须存在', !/if \(!\(w\.cards \|\| \[\]\)\.length \|\| !w\.ctx\) return false/.test(src))
	ok('enemy_echo_played 派发点仍在', /offer_armed_effects\(game, 'enemy_echo_played'/.test(src))
}

console.log('\n' + (fail === 0 ? 'ALL PASS（' + pass + ' 项）' : fail + ' FAIL / ' + pass + ' 项'))
process.exitCode = fail ? 1 : 0
