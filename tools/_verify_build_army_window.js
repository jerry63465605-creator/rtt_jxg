/*
 * 验证 15341 澳大利亚劳管局 / 15342 印度宣布参战的触发窗口（玩家最终口径 2026-09-28）：
 *
 *   触发时机 = **打出《建设陆军》卡之后、正在选地块时**，用它【替换】本次建设。
 *   ① 不受阶段影响（别人回合触发的英国建设，英国也能替换）
 *   ② 不影响出牌（不额外占出牌名额）
 *   ③ 其余时间【不可点击/不可触发】（这是要修的 bug）
 *
 * 实现：build_army 是【事件驱动】窗口 -> status_window_ready 默认 false；
 *      真正的放行走 activate_status 的 from_status 专用通道。
 *
 * 用法（从仓库根）：node tools/_verify_build_army_window.js
 */
const path = require('path')
const MOD = path.join(__dirname, '..', 'server-official', 'public', 'quartermaster-sub-wars')
const rules = require(path.join(MOD, 'rules.js'))
const d = require(path.join(MOD, 'data.js')).data

let pass = 0, fail = 0
function ok(label, cond, extra) {
	console.log((cond ? '  PASS  ' : '  FAIL  ') + label + (extra ? '  | ' + extra : ''))
	cond ? pass++ : fail++
}
const SP_AUS = d.id_of('澳大利亚')
const ausArmies = (g) => Object.keys(g.location).filter(p =>
	g.piece_nation[p] === '英国' && g.piece_type[p] === 'army' && g.location[p] === SP_AUS).length

function fresh(phase) {
	const g = rules.setup(41)
	g.current_nation = '英国'
	g.active = 'Allies'
	g.turn_phase = phase || 'play'
	g.play_done = {}
	g.hands['英国'] = ['15341#1']
	g.table = { '英国': ['15341#1'] }
	return g
}
/* 注意：默认查 15341#1；查别的卡要显式传 id（否则会查错卡导致误判） */
const entry = (g, cid) => {
	const v = rules.view(g, 'Allies')
	return (v.table_status || []).find(x => x.card === (cid || '15341#1')) || {}
}

/* ---------- ① 其余时间：UI 不显示可点（要修的 bug） ---------- */
console.log('=== ① 非建设时刻：ready=false（UI 不显示可点）===')
for (const ph of ['play', 'resource', 'airforce', 'scoring']) {
	const g = fresh(ph)
	const e = entry(g)
	ok(ph + ' 阶段 ready=false', e.ready === false, 'reason=' + (e.ready_reason || ''))
}
let g = fresh('play')
ok('理由说明是"建设陆军时替换"', /建设陆军时/.test(entry(g).ready_reason || ''),
	'reason=' + (entry(g).ready_reason || ''))
/*
 * 白名单说明（2026-09-28 修正）：替换建设类卡现在【无条件登记发送权】
 * （activate_status=1），因为服务端无法感知"客户端正在选地块"；
 * 真正的执行权仍由 arg.from_status 把关（见下面 ⑤）。
 * 所以这里【不再】断言"白名单不含 activate_status"，
 * 改为断言"不带 from_status 会被拒"（那才是真正的安全边界）。
 */
ok('白名单含 activate_status（发送权，执行权另由 from_status 把关）',
	(rules.view(g, 'Allies').actions || {})['activate_status'] === 1)

/* ---------- ② from_status 通道：可替换（不受阶段影响） ---------- */
console.log('\n=== ② from_status 通道：不受阶段影响，可替换建设 ===')
const before = ausArmies(g)
g = rules.action(g, 'Allies', 'activate_status', { card: '15341#1', from_status: true })
ok('澳大利亚征召 1 支英国陆军', ausArmies(g) === before + 1,
	'before=' + before + ' after=' + ausArmies(g))

/* 在【别人回合 / 非出牌阶段】也应可用（玩家口径①） */
console.log('\n=== ③ 别人回合（德国回合、scoring 阶段）也能替换 ===')
let g2 = fresh('scoring')
g2.current_nation = '德国'
g2.active = 'Axis'
const b2 = ausArmies(g2)
g2 = rules.action(g2, 'Allies', 'activate_status', { card: '15341#1', from_status: true })
ok('别人回合仍可替换（不受阶段/回合限制）', ausArmies(g2) === b2 + 1,
	'before=' + b2 + ' after=' + ausArmies(g2))

/* ---------- ④ 不影响出牌：不额外占名额 ---------- */
console.log('\n=== ④ 不影响出牌：不占出牌名额 ===')
let g3 = fresh('play')
g3 = rules.action(g3, 'Allies', 'activate_status', { card: '15341#1', from_status: true })
ok('play_done 未被置位（名额由被替换的建设卡占）',
	!(g3.play_done || {})['英国'], 'play_done=' + JSON.stringify(g3.play_done || {}))

/* ---------- ⑤ 不带 from_status：仍被拒绝 ---------- */
console.log('\n=== ⑤ 不带 from_status 时仍拒绝（防止滥用）===')
let g4 = fresh('play')
const b4 = ausArmies(g4)
g4 = rules.action(g4, 'Allies', 'activate_status', { card: '15341#1' })
ok('未征召（被拒绝）', ausArmies(g4) === b4,
	'before=' + b4 + ' after=' + ausArmies(g4))
ok('日志给出拒绝理由',
	g4.log.some(l => /现在不能发动/.test(l)), g4.log.slice(-1)[0] || '')

/* ---------- ⑥ 15342 印度宣布参战 同样 ---------- */
console.log('\n=== ⑥ 15342 印度宣布参战（同窗口）===')
let g5 = fresh('play')
g5.hands['英国'] = ['15342#1']
g5.table = { '英国': ['15342#1'] }
const SP_IND = d.id_of('印度')
const indArmies = (gg) => Object.keys(gg.location).filter(p =>
	gg.piece_nation[p] === '英国' && gg.piece_type[p] === 'army' && gg.location[p] === SP_IND).length
const b5 = indArmies(g5)
ok('15342 就绪前 ready=false', entry(g5, '15342#1').ready === false,
	'reason=' + (entry(g5, '15342#1').ready_reason || ''))
g5 = rules.action(g5, 'Allies', 'activate_status', { card: '15342#1', from_status: true })
ok('印度征召 1 支', indArmies(g5) === b5 + 1, 'before=' + b5 + ' after=' + indArmies(g5))

console.log('\n通过 ' + pass + ' / 失败 ' + fail)
process.exit(fail ? 1 : 0)
