/*
 * B26 补充：17505 / 17513 的【客户端高亮（可打出时点）】是否与实际可打出同源
 *
 * 客户端置灰只看 view.hand_ready[c.id]（服务端 check_phase_for_card 的结果）。
 * 本探针逐状态对比：hand_ready.ok  vs  真实 play_card 是否成功。
 */
const path = require('path')
const ROOT = path.join(__dirname, '..')
const MOD = path.join(ROOT, 'server-official', 'public', 'quartermaster-sub-wars')
const R = require(path.join(MOD, 'rules.js'))
const I = R._internal
const d = I.data
const cards = require(path.join(MOD, 'cards.js'))
const byId = {}
for (const c of cards.CARDS) byId[String(c.id)] = c
const faceOf = x => String(x).split('#')[0]
const logSince = (g, n) => (g.log || []).slice(n).join(' | ')

let pass = 0, fail = 0
const ok = (m, c, extra) => { if (c) { pass++; console.log('  ✓ ' + m) } else { fail++; console.log('  ✗ ' + m + (extra ? '  | ' + extra : '')) } }

const base = () => {
	const g = R.setup(20261107)
	g.pending_battle = null; g.pending_econ = null
	g.armed_offers = []; g.response_queue = []; g.response_stack = []
	g.pending_status_react = null
	R.action(g, 'Allies', 'debug_set_phase', { nation: '美国', phase: 'play' })
	I.refresh(g)
	return g
}
const hr = (g, inst) => {
	const v = R.view(g, 'Allies')
	const h = (v.hand_ready || {})[inst]
	return h ? { ok: h.ok, reason: h.reason } : '（无条目）'
}
const tryPlay = (g, inst) => {
	const n0 = (g.log || []).length
	R.action(g, 'Allies', 'play_card', { card: inst })
	I.refresh(g)
	const lg = logSince(g, n0)
	return { ok: !/无法打出|手中没有/.test(lg), log: lg }
}

console.log('=== ① 17505 P-51 野马（美国出牌阶段）===')
{
	const g = base()
	R.action(g, 'Allies', 'debug_add_card', { face: '17505', nation: '美国', dest: 'hand' })
	I.refresh(g)
	const inst = (g.hands['美国'] || []).find(x => faceOf(x) === '17505')
	console.log('  实例 = ' + inst)
	const h = hr(g, inst)
	console.log('  view.hand_ready = ' + JSON.stringify(h))
	const r = tryPlay(g, inst)
	console.log('  真实 play_card → ' + (r.ok ? '成功' : '被拒') + '  us_p51=' + JSON.stringify(!!g.us_p51))
	console.log('    log = ' + (r.log || '(无)').slice(0, 140))
	ok('★ 高亮与实际一致（都为可打 或 都为不可打）',
		(h !== '（无条目）' && h.ok === r.ok), 'hand_ready.ok=' + (h && h.ok) + ' 实打=' + r.ok)
}

console.log('\n=== ② 17513 战时生产委员会：无已发动状态卡 ===')
{
	const g = base()
	R.action(g, 'Allies', 'debug_add_card', { face: '17513', nation: '美国', dest: 'hand' })
	I.refresh(g)
	const inst = (g.hands['美国'] || []).find(x => faceOf(x) === '17513')
	const h = hr(g, inst)
	console.log('  view.hand_ready = ' + JSON.stringify(h))
	const r = tryPlay(g, inst)
	console.log('  真实 play_card → ' + (r.ok ? '成功' : '被拒') + '  log=' + (r.log || '').slice(0, 120))
	ok('★ 无已发动状态卡：高亮=不可打，且实打被拒', h && h.ok === false && r.ok === false,
		'hand_ready.ok=' + (h && h.ok) + ' 实打=' + r.ok)
}

console.log('\n=== ③ 17513：有已发动状态卡 ===')
{
	const g = base()
	R.action(g, 'Allies', 'debug_add_card', { face: '17555', nation: '美国', dest: 'hand' })
	R.action(g, 'Allies', 'debug_add_card', { face: '17513', nation: '美国', dest: 'hand' })
	I.refresh(g)
	const st = (g.hands['美国'] || []).find(x => faceOf(x) === '17555')
	if (st) R.action(g, 'Allies', 'play_card', { card: st })
	I.refresh(g)
	const ts = (g.table['美国'] || []).filter(x => (byId[faceOf(x)] || {}).type === 'STATUS')
	g.status_used = g.status_used || {}
	if (ts[0]) g.status_used[ts[0]] = (I.freq_key ? I.freq_key(g) : '1:美国')
	I.refresh(g)
	const inst = (g.hands['美国'] || []).find(x => faceOf(x) === '17513')
	const h = hr(g, inst)
	console.log('  view.hand_ready = ' + JSON.stringify(h))
	const r = tryPlay(g, inst)
	console.log('  真实 play_card → ' + (r.ok ? '成功' : '被拒') + '  us_wartime=' + JSON.stringify(!!g.us_wartime))
	ok('★ 有已发动状态卡：高亮=可打，且实打成功', h && h.ok === true && r.ok === true,
		'hand_ready.ok=' + (h && h.ok) + ' 实打=' + r.ok)
}

console.log('\n=== ④ 17505：非本方回合（德国回合）===')
{
	const g = base()
	R.action(g, 'Allies', 'debug_add_card', { face: '17505', nation: '美国', dest: 'hand' })
	R.action(g, 'Axis', 'debug_set_phase', { nation: '德国', phase: 'play' })
	I.refresh(g)
	const inst = (g.hands['美国'] || []).find(x => faceOf(x) === '17505')
	const h = hr(g, inst)
	console.log('  current=' + g.current_nation + '  view.hand_ready = ' + JSON.stringify(h))
	const n0 = (g.log || []).length
	R.action(g, 'Allies', 'play_card', { card: inst })
	I.refresh(g)
	const lg = logSince(g, n0)
	console.log('  真实 play_card(美国，德国回合) → ' + lg.slice(0, 120) + '  us_p51=' + JSON.stringify(!!g.us_p51))
}

console.log('\n' + (fail === 0 ? 'ALL PASS（' + pass + ' 项）' : fail + ' FAIL / ' + pass + ' 项'))
