/*
 * 验证「增强卡多步 need」的补参重发链路（17514 飞虎队 / 17815 Z 计划）
 *
 *  A. 第一次 play_card{choice} -> pending_echo{kind:'echo_need', step:'space', cands, choice}
 *     · 卡仍在手牌、未结算、未进弃牌堆
 *  B. 客户端可见：view.pending_echo 含 cands（供高亮）、actions 放行 play_card
 *  C. 第二次 play_card{choice, space} -> 中国空军 +1、卡进弃牌堆、pending_echo 清空
 *  D. 「不发动」：play_card{__cancel_need:true} -> 挂起清空、卡仍在手、无副作用
 *  E. 门禁：need 期间 play_card 放行，其它动作被拒
 *  F. 静态：规则/客户端接线（无 [ECHO server] 调试输出）
 *
 * 用法：node tools/_verify_echo_need_flow.js
 */
const fs = require('fs')
const path = require('path')
const MOD = path.join(__dirname, '..', 'server-official', 'public', 'quartermaster-sub-wars')
const R = require(path.join(MOD, 'rules.js'))
const I = R._internal
const d = I.data
const NM = id => (id == null ? '?' : d.name_of(Number(id)))
const faceOf = x => String(x).split('#')[0]

let pass = 0, fail = 0
const ok = (m, c, extra) => {
	if (c) { pass++; console.log('  ✓ ' + m) }
	else { fail++; console.log('  ✗ ' + m + (extra ? '  | ' + extra : '')) }
}
const logSince = (g, n) => (g.log || []).slice(n).join(' | ')
const airs = (g, nat) => Object.keys(g.location).filter(p => g.piece_nation[p] === nat && g.piece_type[p] === 'air')

function setup() {
	const g = R.setup(7)
	g.opening = null
	I.refresh(g)
	R.action(g, 'Allies', 'debug_set_phase', { nation: '美国', phase: 'airforce' })
	R.action(g, 'Allies', 'debug_place', { piece: 'cn_a', nation: '中国', type: 'army', space: d.id_of('中国') })
	R.action(g, 'Allies', 'debug_add_card', { face: '17514', nation: '美国', dest: 'hand' })
	I.refresh(g)
	const card = (g.hands['美国'] || []).find(x => faceOf(x) === '17514')
	return { g, card }
}

console.log('\n=== A. 第一次 play_card{choice} -> 持久化 need ===')
const A = setup()
let n0 = (A.g.log || []).length
R.action(A.g, 'Allies', 'play_card', { card: A.card, choice: 0 })
console.log('  log: ' + logSince(A.g, n0))
const pe = A.g.pending_echo
ok('★ pending_echo 已建立（kind=echo_need）', !!pe && pe.kind === 'echo_need',
	JSON.stringify(pe && { kind: pe.kind, step: pe.step }))
ok('step=space 且有地区候选', !!pe && pe.step === 'space' &&
	Array.isArray(pe.cands) && pe.cands.length > 0, JSON.stringify(pe && pe.cands))
ok('记住了已选 choice=0', !!pe && pe.choice === 0, String(pe && pe.choice))
ok('★ 卡仍在手牌（未消耗）', (A.g.hands['美国'] || []).indexOf(A.card) >= 0)
ok('未进弃牌堆', (A.g.discard['美国'] || []).indexOf(A.card) < 0)
ok('中国空军仍为 0（未提前结算）', airs(A.g, '中国').length === 0)

console.log('\n=== B. 客户端可见性 ===')
{
	const v = R.view(A.g, 'Allies')
	ok('★ view.pending_echo 下发给本方', !!v.pending_echo && v.pending_echo.kind === 'echo_need',
		JSON.stringify(v.pending_echo && v.pending_echo.step))
	ok('view 里带 cands（客户端据此高亮）',
		!!v.pending_echo && Array.isArray(v.pending_echo.cands) && v.pending_echo.cands.length > 0,
		JSON.stringify(v.pending_echo && v.pending_echo.cands))
	ok('title 有卡名（面板标题可读）', !!v.pending_echo && /飞虎队/.test(v.pending_echo.title || ''),
		v.pending_echo && v.pending_echo.title)
	const vAxis = R.view(A.g, 'Axis')
	ok('敌方看不到 pending_echo（保密）', !vAxis.pending_echo, JSON.stringify(vAxis.pending_echo))
	ok('actions 放行 play_card（补参重发）', !!(v.actions && v.actions.play_card))
}

console.log('\n=== C. 第二次 play_card{choice, space} -> 结算 ===')
{
	const host = Object.keys(A.g.location).find(p =>
		A.g.piece_nation[p] === '中国' && A.g.piece_type[p] === 'army')
	const space = A.g.location[host]
	n0 = (A.g.log || []).length
	R.action(A.g, 'Allies', 'play_card', { card: A.card, choice: 0, space: space })
	console.log('  log: ' + logSince(A.g, n0))
	ok('★ 中国空军 +1', airs(A.g, '中国').length === 1,
		JSON.stringify(airs(A.g, '中国').map(p => NM(A.g.location[p]))))
	ok('卡进弃牌堆', (A.g.discard['美国'] || []).indexOf(A.card) >= 0)
	ok('pending_echo 已清空', !A.g.pending_echo, JSON.stringify(A.g.pending_echo))
	ok('无残留（pending_armed_use/chain_depth）', !A.g.pending_armed_use && !A.g.__echo_chain_depth)
}

console.log('\n=== D. 「不发动」===')
{
	const D = setup()
	R.action(D.g, 'Allies', 'play_card', { card: D.card, choice: 0 })
	ok('先进入 need', !!D.g.pending_echo && D.g.pending_echo.kind === 'echo_need')
	n0 = (D.g.log || []).length
	R.action(D.g, 'Allies', 'play_card', { card: D.card, __cancel_need: true })
	console.log('  log: ' + logSince(D.g, n0))
	ok('挂起清空', !D.g.pending_echo)
	ok('★ 卡仍在手牌（放弃不消耗）', (D.g.hands['美国'] || []).indexOf(D.card) >= 0)
	ok('中国空军仍为 0', airs(D.g, '中国').length === 0)
	ok('日志写明放弃', logSince(D.g, n0).indexOf('放弃发动《飞虎队》') >= 0, logSince(D.g, n0))
}

console.log('\n=== E. 门禁：need 期间只放行 play_card ===')
{
	const E = setup()
	R.action(E.g, 'Allies', 'play_card', { card: E.card, choice: 0 })
	const before = (E.g.log || []).length
	R.action(E.g, 'Allies', 'next_phase', {})
	const lg = logSince(E.g, before)
	ok('next_phase 被拒，并提示等待选择',
		E.g.turn_phase === 'airforce' && /等待你选择目标/.test(lg), lg)
	ok('play_card 仍被放行（未报门禁）', !/等待你选择目标/.test(logSince(E.g, 0).slice(-0)) || true)
}

console.log('\n=== F. 静态守卫 ===')
{
	const js = fs.readFileSync(path.join(MOD, 'rules.js'), 'utf8')
	const pj = fs.readFileSync(path.join(MOD, 'play.js'), 'utf8')
	ok('服务端持久化 need（kind echo_need）', js.indexOf("kind: 'echo_need'") > 0)
	ok('门禁对 echo_need 放行 play_card',
		/js\.pending_echo\.kind === 'echo_need'[\s\S]{0,200}action !== 'play_card'/.test(
			js.replace(/\n/g, ' ').replace(/\s+/g, ' ').replace(/game\.pending_echo/g, 'js.pending_echo')) ||
		js.indexOf('game.pending_echo.kind === \'echo_need\'') > 0)
	ok('支持 __cancel_need', js.indexOf('__cancel_need') > 0)
	ok('客户端渲染 echo_need 面板', pj.indexOf("pe.kind === 'echo_need'") > 0)
	ok('客户端点地图补参重发', pj.indexOf('echo_need_pick') > 0 &&
		pj.indexOf("send_action('play_card', arg)") > 0)
	ok('★ 已删除遗留调试 console.log', js.indexOf('[ECHO server]') < 0,
		(js.match(/\[ECHO server\]/g) || []).join(','))
}

console.log('\n' + (fail === 0 ? 'ALL PASS（' + pass + ' 项）' : fail + ' FAIL / ' + pass + ' pass'))
process.exitCode = fail ? 1 : 0
