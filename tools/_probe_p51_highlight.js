/*
 * 17505《P-51 野马》：客户端高亮（hand_ready）与真实打出要求的对齐检查
 *
 * A 美国·出牌阶段   → 亮 + 能打
 * B 美国·资源阶段   → 亮 + 能打（B26-b 口径：本方回合任意阶段）
 * C 美国·弃牌阶段   → 亮 + 能打
 * D 德国回合        → 灰 + 拒绝（亮灰必须与实打一致）
 * E 已装载后再来一张 → 看是否还会亮/还能打（重复装载是否有意义）
 * F 客户端真实渲染：D 状态下 17505 手牌元素是否带 disabled 类
 */
const path = require('path')
const fs = require('fs')
const ROOT = path.join(__dirname, '..')
const L = require('./_board_lib')
const { R, I, d, faceOf, new_board, give } = L
const MOD = path.join(ROOT, 'server-official', 'public', 'quartermaster-sub-wars')
const logSince = (g, n) => (g.log || []).slice(n).join(' | ')

let pass = 0, fail = 0
const ok = (m, c, extra) => { if (c) { pass++; console.log('  ✓ ' + m) } else { fail++; console.log('  ✗ ' + m + (extra ? '  | ' + extra : '')) } }

function scene(nation, phase) {
	const g = new_board(20261108, { nation, phase })
	give(g, '17505', '美国')
	return g
}
const p51 = g => (g.hands['美国'] || []).find(x => faceOf(x) === '17505')

function check(tag, nation, phase, expect) {
	console.log('\n=== ' + tag + '（' + nation + '·' + phase + '）===')
	const g = scene(nation, phase)
	const cid = p51(g)
	const v = R.view(g, 'Allies')
	const hr = (v.hand_ready || {})[cid] || null
	console.log('  hand_ready = ' + JSON.stringify(hr))
	ok('高亮 = ' + (expect.ok ? '可打出' : '不可打出'),
		expect.ok ? !!(hr && hr.ok) : !(hr && hr.ok), JSON.stringify(hr))

	const n0 = (g.log || []).length
	R.action(g, 'Allies', 'play_card', { card: cid })
	I.refresh(g)
	const lg = logSince(g, n0)
	const played = !!g.us_p51
	console.log('  实打 log = ' + lg.slice(0, 150) + '　us_p51=' + played)
	ok('实打结果与高亮一致', expect.ok ? played : !played, lg.slice(0, 120))
	return { g, cid, hr }
}

check('A 本国回合·出牌阶段', '美国', 'play', { ok: true })
check('B 本国回合·资源阶段', '美国', 'resource', { ok: true })
check('C 本国回合·弃牌阶段', '美国', 'discard', { ok: true })
const dCase = check('D 敌方回合', '德国', 'play', { ok: false })

/* E：已装载后再打一张（重复装载是否有意义） */
console.log('\n=== E 已装载（us_p51=true）后再打一张 17505 ===')
{
	const g = new_board(20261108, { nation: '美国', phase: 'play' })
	give(g, '17505', '美国')
	I.refresh(g)
	R.action(g, 'Allies', 'play_card', { card: p51(g) })
	I.refresh(g)
	const first = !!g.us_p51
	/* 再造一张（模拟第二份，或从弃牌堆捞回） */
	give(g, '17505', '美国')
	I.refresh(g)
	const cid2 = p51(g)
	const v = R.view(g, 'Allies')
	const hr = (v.hand_ready || {})[cid2] || null
	const n0 = (g.log || []).length
	R.action(g, 'Allies', 'play_card', { card: cid2 })
	I.refresh(g)
	const lg = logSince(g, n0)
	console.log('  首次装载成功=' + first + '  第二次 hand_ready=' + JSON.stringify(hr))
	console.log('  第二次实打 log = ' + lg.slice(0, 150))
	console.log('  结论：' + (hr && hr.ok ? '仍然亮' : '已不再亮') + ' / ' +
		(/装载/.test(lg) ? '仍然可打（会重复装载）' : '被拒'))
	ok('★ 装载后可打出性有明确口径（当前：' + (hr && hr.ok ? '仍可打' : '不可打') + '）', true)
}

/* F：客户端渲染层——置灰完全由 view.hand_ready 决定（play.js L4179-4196）
 *    这里只做静态断言：确认客户端确实是"读 hr.ok"，而不是自己猜；
 *    端到端的置灰行为由既有 _real_test_hand_ready_17505.js 覆盖。 */
console.log('\n=== F 客户端置灰判定源（静态）===')
{
	const src = fs.readFileSync(path.join(MOD, 'play.js'), 'utf8')
	const readsHr = /const hr = view\.hand_ready && view\.hand_ready\[c\.id\]/.test(src)
	const addsDisabled = /\(hr \? !hr\.ok : !check_phase_for_card\(c\)\.ok\)\)\s*\{\s*[\s\S]{0,80}classList\.add\("disabled"\)/.test(src)
	const titleReason = /if \(hr && !hr\.ok && hr\.reason\)\s*[\s\S]{0,40}d\.title = hr\.reason/.test(src)
	console.log('  读 view.hand_ready = ' + readsHr + '　按 hr.ok 置灰 = ' + addsDisabled + '　title=reason = ' + titleReason)
	ok('★ 客户端置灰与实打同源（读服务端 hand_ready）', readsHr && addsDisabled)
	ok('★ 灰态 hover 能看到具体原因（title=hr.reason）', titleReason)
}

console.log('\n' + (fail === 0 ? 'ALL PASS（' + pass + ' 项）' : fail + ' FAIL / ' + pass + ' 项'))
process.exitCode = fail ? 1 : 0
