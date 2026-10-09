/*
 * 验证：资源再分配阶段，桌面状态卡应【不可触发、灰显】（15345/15338）。
 *
 * 背景（2026-09-28）：玩家反馈"其他牌在资源再分配阶段能正确暗置，
 * 但 15345 塞内加尔步兵团 / 15338 反法西斯抵抗运动仍彩色显示为可点击"。
 *
 * 根因：play.js 的 update_table_status 调用了【不存在】的 escape_attr()
 * （正确函数名是 esc_attr），渲染时抛 ReferenceError ->
 * innerHTML 赋值中断 -> DOM 停留在上一次成功渲染时的旧状态（彩色可点）。
 * 本脚本验证【服务端给出的 ready 判定】本身是正确的（false），
 * 修好渲染后客户端就会正确灰显。
 *
 * 用法（从仓库根）：node tools/_verify_status_dim.js
 */
const path = require('path')
const MOD = path.join(__dirname, '..', 'server-official', 'public', 'quartermaster-sub-wars')
const rules = require(path.join(MOD, 'rules.js'))

let pass = 0, fail = 0
function ok(label, cond, extra) {
	console.log((cond ? '  PASS  ' : '  FAIL  ') + label + (extra ? '  | ' + extra : ''))
	cond ? pass++ : fail++
}

let g = rules.setup(1)
g.current_nation = '英国'
g.active = 'Allies'
g.play_done = {}

/* 出牌阶段打出两张状态卡 */
g.turn_phase = 'play'
g.hands['英国'].push('15345#1', '15338#1')
g = rules.action(g, 'Allies', 'play_card', { card: '15345#1' })
g.play_done = {}
g = rules.action(g, 'Allies', 'play_card', { card: '15338#1' })

const both = ['15345#1', '15338#1']
const inTable = (cid) => (g.table['英国'] || []).indexOf(cid) >= 0
ok('两张卡都在桌面', both.every(inTable))

/* --- 出牌阶段、且【本回合尚未打出牌】：应可触发（对照） ---
 * 注意：打出状态卡本身占出牌名额（A1①），且玩家 2026-09-28 明确
 * "跳过出牌必须在打出牌之前选择" —— 所以对照用例必须把 play_done 清掉
 * （模拟进入新回合、出牌名额未用），否则按新规则本就是 false。 */
g.turn_phase = 'play'
g.play_done = {}
delete g.skip_play_done
g.turn = (g.turn || 1) + 1
let v = rules.view(g, 'Allies')
const readyInPlay = {}
for (const cid of both)
	readyInPlay[cid] = ((v.table_status || []).find(x => x.card === cid) || {}).ready
ok('【对照】出牌阶段 ready=true（可触发）', both.every(c => readyInPlay[c] === true),
	JSON.stringify(readyInPlay))

/* --- 资源再分配阶段：应不可触发（灰显） --- */
g.turn_phase = 'resource'
v = rules.view(g, 'Allies')
const readyInRes = {}
for (const cid of both) {
	const e = (v.table_status || []).find(x => x.card === cid) || {}
	readyInRes[cid] = e.ready
	ok('资源阶段 ' + cid + ' ready=false（客户端应灰显）', e.ready === false,
		'reason=' + (e.ready_reason || ''))
}
ok('资源阶段 view.actions 不含 activate_status',
	!((v.actions || {})['activate_status']),
	'actual=' + (v.actions || {})['activate_status'])

/* --- 被 15343 压制时：ready 也应为 false（同源修复） --- */
g.turn_phase = 'play'
g.table['德国'] = g.table['德国'] || []
g.table['德国'].push('15343#9')
v = rules.view(g, 'Allies')
const e45 = (v.table_status || []).find(x => x.card === '15345#1') || {}
ok('被敌方 15343 压制时 ready=false（与 build_actions 同源）',
	e45.ready === false, 'reason=' + (e45.ready_reason || ''))

console.log('\n通过 ' + pass + ' / 失败 ' + fail)
process.exit(fail ? 1 : 0)
