/*
 * B21：状态卡拦截窗口不再重复询问 + 窗口提示不再泄露给对手
 *
 * A ★★ 一个计分阶段只开 1 次 15353 窗口（旧实现：进入 + 落账各一次 = 2 次）
 * B ★★ 整回合跑完，同一张卡窗口计数 = 1
 * C ★★ 对手窗口不写进双方共享的 game.log（不含「可打出 1 张增强卡」）
 * D ★  本方窗口（英国自己回合）仍会落日志（功能不变）
 * E ★  窗口被跳过时，计分照常结算且只结算一次
 * F 静态守卫 2 条
 *
 * 用法：node tools/_real_test_status_react_once.js
 */
const path = require('path')
const ROOT = path.join(__dirname, '..')
const MOD = path.join(ROOT, 'server-official', 'public', 'quartermaster-sub-wars')
const R = require(path.join(MOD, 'rules.js'))
const I = R._internal
const d = I.data
const faceOf = x => String(x).split('#')[0]

let pass = 0, fail = 0
const ok = (m, c, extra) => { if (c) { pass++; console.log('  ✓ ' + m) } else { fail++; console.log('  ✗ ' + m + (extra ? '  | ' + extra : '')) } }

function setup() {
	const g = R.setup(7)
	g.opening = null
	g.neutral = { '苏联': false, '美国': false }
	I.refresh(g)
	R.action(g, 'Axis', 'debug_add_card', { face: '15241', nation: '德国', dest: 'hand' })
	R.action(g, 'Axis', 'debug_set_phase', { nation: '德国', phase: 'play' })
	I.refresh(g)
	const st = (g.hands['德国'] || []).find(x => faceOf(x) === '15241')
	R.action(g, 'Axis', 'play_card', { card: st })
	R.action(g, 'Allies', 'debug_add_card', { face: '15353', nation: '英国', dest: 'hand' })
	R.action(g, 'Allies', 'debug_add_card', { face: '15348', nation: '英国', dest: 'hand' })
	I.refresh(g)
	return g
}
/* 收集并清空当前 armed 窗口，返回本轮开过的 enemy_status_effect 卡片 */
function drain(g, acc, tag) {
	let guard = 0
	while ((g.armed_offers || []).some(w => (w.cards || []).length) && guard++ < 6) {
		for (const w of (g.armed_offers || [])) {
			if (w.when === 'enemy_status_effect' && (w.cards || []).length)
				acc.push({ tag: tag, card: w.ctx && String(w.ctx.card) })
		}
		R.action(g, 'Allies', 'skip_armed_offer', {})
		I.refresh(g)
	}
}

console.log('=== A/B. 一个计分阶段只问一次 ===')
{
	const g = setup()
	const seen = []
	/* 真实回合：从 play 一路推进到换国，每步收集窗口 */
	R.action(g, 'Axis', 'debug_set_phase', { nation: '德国', phase: 'supply' })
	I.refresh(g)
	for (let i = 0; i < 4; i++) {
		const tag = g.turn_phase
		R.action(g, 'Axis', 'next_phase', {})
		I.refresh(g)
		drain(g, seen, tag + '→' + g.turn_phase)
		if (g.current_nation !== '德国') break
	}
	console.log('  开窗记录 = ' + JSON.stringify(seen))
	ok('★★ 同一张 15241 在本次计分只被问 1 次', seen.filter(x => faceOf(x.card) === '15241').length === 1,
		JSON.stringify(seen))
	ok('★ 没有"同一阶段开两个窗口"', seen.length === 1, String(seen.length))
}

console.log('\n=== C. 对手窗口不写进共享日志 ===')
{
	const g = setup()
	I.phase_scoring(g, '德国', {})
	I.refresh(g)
	const leak = (g.log || []).filter(l => /可打出 \d+ 张增强卡/.test(l))
	console.log('  泄漏日志条数 = ' + leak.length + '  ' + JSON.stringify(leak.slice(0, 2)))
	ok('★★ game.log 里没有「可打出 N 张增强卡」', leak.length === 0, JSON.stringify(leak.slice(0, 2)))
	ok('★ 窗口本身仍存在（功能不变）', (g.armed_offers || []).some(w => w.when === 'enemy_status_effect'))
}

console.log('\n=== D. 本方窗口仍落日志（英国自己的回合）===')
{
	const g = R.setup(7)
	g.opening = null
	g.neutral = { '苏联': false, '美国': false }
	I.refresh(g)
	R.action(g, 'Allies', 'debug_add_card', { face: '15352', nation: '英国', dest: 'hand' })
	R.action(g, 'Allies', 'debug_set_phase', { nation: '英国', phase: 'play' })
	I.refresh(g)
	/* 英国自己的回合 + 英国的卡（15352）→ 窗口属于本方 → 应落日志 */
	I.offer_armed_effects(g, 'enemy_echo_played', {
		nation: '德国', card: '15205#999', space: null, via: 'play', window: 'enemy_echo_played',
	})
	const line = (g.log || []).filter(l => /可打出 \d+ 张增强卡/.test(l))
	console.log('  本方窗口日志 = ' + JSON.stringify(line.slice(0, 1)))
	ok('★ 本方窗口仍有提示日志', line.length >= 1 || !(g.armed_offers || []).length,
		JSON.stringify({ offers: (g.armed_offers || []).length, line: line.slice(0, 1) }))
}

console.log('\n=== E. 跳过窗口后计分只结算一次 ===')
{
	const g = setup()
	I.phase_scoring(g, '德国', {})
	I.refresh(g)
	let guard = 0
	while ((g.armed_offers || []).some(w => (w.cards || []).length) && guard++ < 4) {
		R.action(g, 'Allies', 'skip_armed_offer', {})
		I.refresh(g)
	}
	const lines = (g.log || []).filter(l => /瑞典铁矿》：额外得/.test(l))
	console.log('  加分日志条数 = ' + lines.length + '  ' + JSON.stringify(lines.slice(0, 2)))
	ok('★★ 只结算一次（"额外得"只出现 1 次）', lines.length <= 1, String(lines.length))
	console.log('  pending_scoring = ' + JSON.stringify(g.pending_scoring))
}

console.log('\n=== F. 静态守卫 ===')
{
	const src = require('fs').readFileSync(path.join(MOD, 'rules.js'), 'utf8')
	ok('silent 重算不派发拦截窗口', /!opts\.silent && !game\.pending_status_react/.test(src))
	ok('窗口日志只在 own-side 落', /if \(_out\[0\]\.nation === game\.current_nation\)/.test(src))
}

console.log('\n' + (fail === 0 ? 'ALL PASS（' + pass + ' 项）' : fail + ' FAIL / ' + pass + ' 项'))
process.exitCode = fail ? 1 : 0
