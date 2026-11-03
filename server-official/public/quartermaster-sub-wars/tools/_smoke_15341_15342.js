/*
 * 15341/15342 英国状态卡"仅英国建设陆军时可替换发动" 冒烟自检（2026-10-18）
 * 验证：两张卡只在 ① 英国执行建设陆军（game.current_nation==='英国'，含 17526 让权英国建设）
 * 时方可替换发动；非英国玩家、或英国玩家非建设陆军行为均不可发动。
 * 仅 15341/15342 两张受此限制（按基号精确限定，其它 build_army 卡不受影响）。
 * 用法：node tools/_smoke_15341_15342.js
 */
const path = require('path')
const MOD = path.resolve('server-official/public/quartermaster-sub-wars')
const rules = require(path.join(MOD, 'rules.js'))

let pass = 0, fail = 0
function ok(label, cond, extra) {
	console.log((cond ? '  PASS  ' : '  FAIL  ') + label + (extra ? '  | ' + extra : ''))
	cond ? pass++ : fail++
}
const GATED = ['15341#1', '15342#1']

const g = rules.setup(1)
g.table = g.table || {}
g.table['英国'] = g.table['英国'] || []
for (const c of GATED) if (g.table['英国'].indexOf(c) < 0) g.table['英国'].push(c)

console.log('=== 1. view.forgo_build 按 current_nation===英国 限制 15341/15342 ===')
g.current_nation = '英国'
let v1 = rules.view(g, 'Allies')
for (const c of GATED) {
	const s = (v1.table_status || []).find(x => x.card === c)
	ok('英国执行建设陆军时 ' + c + ' forgo_build===true', s && s.forgo_build === true)
}

g.current_nation = '美国'
let v2 = rules.view(g, 'Allies')
for (const c of GATED) {
	const s = (v2.table_status || []).find(x => x.card === c)
	ok('美国执行建设陆军时 ' + c + ' forgo_build===false（不可见/不可点）', s && s.forgo_build === false)
}

console.log('\n=== 2. 非英国玩家越权 from_status 被服务端拦截（权威兜底）===')
g.current_nation = '美国'
for (const c of GATED) {
	const before = g.log.length
	rules.action(g, 'Allies', 'activate_status', { card: c, from_status: true, build_card: '15300#1' })
	const rejected = g.log.slice(before).some(l => /只能在英国建设陆军时/.test(l))
	ok('美国越权 from_status ' + c + ' 被拦截', rejected, rejected ? '' : '未出现拦截日志')
}

console.log('\n=== 3. 英国执行建设陆军时 15341/15342 成功发动（含 17526 让权同款 current_nation）===')
g.current_nation = '英国'
g.hands['英国'] = g.hands['英国'] || []
if (g.hands['英国'].indexOf('15300#1') < 0) g.hands['英国'].push('15300#1')
for (const c of GATED) {
	const beforeF = g.log.length
	rules.action(g, 'Allies', 'activate_status', { card: c, from_status: true, build_card: '15300#1' })
	const fired = g.log.slice(beforeF).some(l => /澳大利亚|印度/.test(l))
	ok('英国建设陆军时 ' + c + ' 成功发动', fired, fired ? '' : '未出现发动日志')
}

console.log('\n==== 结果：' + pass + ' 通过 / ' + fail + ' 失败 ====')
process.exit(fail ? 1 : 0)
