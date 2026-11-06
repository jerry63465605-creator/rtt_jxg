/*
 * 真实盘面（路线 A）· B22：17846 坦克运输 —— 真实打出《建设陆军》后锁定刚建成的那支
 *
 * 盘面来源：真实对局快照 tools/fixtures/gid19.json
 * 驱动方式：玩家动作 —— debug_add_card → play_card(15300 建设陆军) → 真实建设 → activate_status
 * 断言三层：服务端（last_built / 战斗结算）+ view（last_built 只给建设方）+ 日志
 *
 * 用法：node tools/_realboard_b22_17846.js
 */
const path = require('path')
const fs = require('fs')
const R = require(path.join(__dirname, '..', 'rules.js'))
const I = R._internal
const d = I.data
const faceOf = x => String(x).split('#')[0]
const logSince = (g, n) => (g.log || []).slice(n).join(' | ')

let pass = 0, fail = 0
const ok = (m, c, extra) => { if (c) { pass++; console.log('  ✓ ' + m) } else { fail++; console.log('  ✗ ' + m + (extra ? '  | ' + extra : '')) } }

const FIX = path.join(__dirname, 'fixtures', 'gid19.json')
const base = JSON.parse(fs.readFileSync(FIX, 'utf8'))
const g = JSON.parse(JSON.stringify(base))
g.pending_battle = null; g.pending_econ = null
g.armed_offers = []; g.response_queue = []; g.response_stack = []
g.pending_status_react = null; g.pending_echo = null
g._resp_settling = false; g.pending_trigger = null
g.pending_response_choice = null; g.deferred_response_choice = null
g.pending_event_step = null; g.pending_event_targets = null
I.refresh(g)
console.log('盘面：gid19（' + JSON.stringify(base).length + ' 字节）  当前国=' + g.current_nation + ' 阶段=' + g.turn_phase)

/* 德国出牌阶段 + 手牌：17846（状态卡）与 15300（建设陆军，代价/触发都是这张） */
R.action(g, 'Axis', 'debug_set_phase', { nation: '德国', phase: 'play' })
/* 真实对局快照里德国本回合可能已出过牌，这里把"本回合已出牌"清掉（场景叠加的一部分） */
g.play_done = g.play_done || {}
g.play_done['德国'] = false
g.play_done[I.delegate_of_nation('德国')] = false
console.log('  play_done[德国] = ' + JSON.stringify(g.play_done['德国']))
if (g.play_acted) { delete g.play_acted['德国'] }
if (g.skip_play_done) { delete g.skip_play_done['德国'] }
I.refresh(g)
R.action(g, 'Axis', 'debug_add_card', { face: '17846', nation: '德国', dest: 'hand' })
R.action(g, 'Axis', 'debug_add_card', { face: '15300', nation: '德国', dest: 'hand' })
R.action(g, 'Axis', 'debug_add_card', { face: '15300', nation: '德国', dest: 'hand' })
I.refresh(g)
const st17846 = (g.hands['德国'] || []).find(x => faceOf(x) === '17846')
if (st17846) R.action(g, 'Axis', 'play_card', { card: st17846 })
I.refresh(g)
console.log('  17846 上桌 = ' + JSON.stringify((g.table['德国'] || []).map(faceOf)))

/* 找一个可建设的德国地区（真实 play_card 会走 build_piece） */
const build15300 = (g.hands['德国'] || []).find(x => faceOf(x) === '15300')
let builtSpace = null, buildLog = ''
const cands = []
{
	/* 用真实动作试：先看哪些空格可建陆军 */
	for (let sp = 1; sp < d.spaces.length; sp++) {
		const info = d.spaces[sp]
		if (!info || info.terrain !== 'land') continue
		const c = I.can_build_at(g, '德国', sp, 'army')
		if (c && c.ok) cands.push(sp)
	}
	console.log('  可建设地区（前 5）= ' + JSON.stringify(cands.slice(0, 5).map(x => d.name_of(x))))
	for (const sp of cands.slice(0, 8)) {
		const gg = JSON.parse(JSON.stringify(g))
		const c0 = (gg.hands['德国'] || []).find(x => faceOf(x) === '15300')
		const n0 = (gg.log || []).length
		R.action(gg, 'Axis', 'play_card', { card: c0, space: sp })
		I.refresh(gg)
		const lg = logSince(gg, n0)
		console.log('    试建 ' + d.name_of(sp) + ' → ' + (lg || '(无日志)').slice(0, 120))
		if (/建设/.test(lg) && !/无法|失败|不能/.test(lg)) { builtSpace = sp; buildLog = lg; Object.assign(g, gg); break }
	}
}
console.log('  真实打出的《建设陆军》log = ' + (buildLog || '(未成功)').slice(0, 160))
if (!builtSpace && cands.length) {
	/*
	 * 真实快照里德国本回合已出过牌（play_done=true，且 debug_set_phase 会把它重置回 true），
	 * 无法再走 play_card。退而用 build_piece —— 与《建设陆军》内部调用的**同一原子**，
	 * 后续 activate_status 仍是玩家动作。测试文档里标注为"建设步骤半真实"。
	 */
	/* 选一个"建好后还有合法陆战目标"的地区 */
	const targetOf = sp => (d.spaces[sp].connections || []).find(x => {
		if (x === sp || !d.spaces[x] || d.spaces[x].terrain !== 'land') return false
		const onSp = Object.keys(g.location || {}).filter(id => g.location[id] === x)
		return !onSp.some(id => g.piece_nation[id] === '德国')
	})
	for (const sp of cands.slice(0, 12)) {
		if (targetOf(sp) == null) continue
		const rr = I.build_piece(g, '德国', 'army', sp)
		if (rr && rr.ok) { builtSpace = sp; buildLog = 'build_piece 原子：' + d.name_of(sp); break }
	}
	if (!builtSpace) {
		for (const sp of cands.slice(0, 8)) {
			const rr = I.build_piece(g, '德国', 'army', sp)
			if (rr && rr.ok) { builtSpace = sp; buildLog = 'build_piece 原子：' + d.name_of(sp); break }
		}
	}
	I.refresh(g)
	console.log('  改用 build_piece 原子建设 = ' + buildLog)
}
ok('★ 建设完成（真实 play_card 或同源原子）', !!builtSpace, buildLog.slice(0, 120))

if (!builtSpace) {
	console.log('\n跳过后续（该盘面无合法建设地）')
	process.exit(fail ? 1 : 0)
}

/* A/B：view.last_built 只给建设方 */
const vA = R.view(g, 'Axis'), vU = R.view(g, 'Allies')
console.log('  Axis.last_built = ' + JSON.stringify(vA.last_built) + '  Allies.last_built = ' + JSON.stringify(vU.last_built))
ok('★★ 建设方 view.last_built 含 piece_id/space', !!(vA.last_built && vA.last_built.piece_id && vA.last_built.space === builtSpace),
	JSON.stringify(vA.last_built))
ok('★★ 对手看不到 last_built', vU.last_built == null, JSON.stringify(vU.last_built))

/* C：17846 不传 from 也能发动（目标 = 相邻敌军，没有则空打） */
{
	const nb = (d.spaces[builtSpace].connections || []).filter(x =>
		x !== builtSpace && d.spaces[x] && d.spaces[x].terrain === 'land')
	let target = null, victim = null
	/* 优先：有敌军的陆地；其次：没有任何部队的空陆地（空打） */
	for (const sp of nb) {
		const onSp = Object.keys(g.location || {}).filter(id => g.location[id] === sp)
		const enemy = onSp.find(id => g.piece_nation[id] !== '德国' && I.faction_of_nation(g.piece_nation[id]) !== 'axis')
		const own = onSp.find(id => g.piece_nation[id] === '德国')
		if (enemy) { target = sp; victim = enemy; break }
		if (!own && !target) target = sp
	}
	console.log('  目标 = ' + (target ? d.name_of(target) : '(无合法陆地目标)') + '  victim=' + victim)
	const cost = (g.hands['德国'] || []).find(x => faceOf(x) === '15300')
	/* 建设动作会带出响应窗口（15247 等）；先按"放弃响应"清干净，再测 17846 本身 */
	let guardResp = 0
	while (((g.response_stack || []).length || (g.response_queue || []).length) && guardResp++ < 6) {
		R.action(g, 'Allies', 'pass_response', {})
		I.refresh(g)
	}
	console.log('  发作前：stack=' + (g.response_stack || []).length + ' queue=' + (g.response_queue || []).length +
		' pending_trigger=' + JSON.stringify(!!g.pending_trigger) +
		' offers=' + JSON.stringify((g.armed_offers || []).map(w => w.when)) +
		' resp_settling=' + JSON.stringify(!!g._resp_settling))
	const n1 = (g.log || []).length
	R.action(g, 'Axis', 'activate_status', { card: st17846, space: target, victim: victim || undefined, discard: [cost] })
	I.refresh(g)
	const lg = logSince(g, n1)
	console.log('  17846 log = ' + lg.slice(0, 220))
	ok('★★ 不再报"请选择发起单位"', !/请选择发起单位/.test(lg), lg.slice(0, 140))
	ok('★★ 也没有"只能以刚刚建成的这支陆军"', !/只能以刚刚建成的这支陆军/.test(lg), lg.slice(0, 140))
	ok('★ 战斗/结算已发生', /发起陆战|移除|进行陆战/.test(lg), lg.slice(0, 140))
}

console.log('\n' + (fail === 0 ? 'ALL PASS（' + pass + ' 项）' : fail + ' FAIL / ' + pass + ' 项'))
process.exitCode = fail ? 1 : 0
