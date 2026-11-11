/*
 * 只读副本：在 game=19 的真实状态下，模拟客户端点击窗口两个按钮，
 * 看服务端能否真的结算（response_stack 非空时守卫是否放行）。
 * 不写回 db。用法：node tools/_probe_B35_game19_action.js [gid]
 */
const path = require('path')
const Database = require(path.join(__dirname, '..', 'server-official', 'node_modules', 'better-sqlite3'))
const MOD = path.join(__dirname, '..', 'server-official', 'public', 'quartermaster-sub-wars')
const R = require(path.join(MOD, 'rules.js'))
const db = new Database(path.join(__dirname, '..', 'server-official', 'db'), { readonly: true })
const gid = Number(process.argv[2] || 19)
const row = db.prepare('SELECT * FROM game_state WHERE game_id = ?').get(gid)
const base = JSON.parse(row.state || row.data || row.json)

function clone(x) { return JSON.parse(JSON.stringify(x)) }
function trial(name, action, arg) {
	const g = clone(base)
	const n0 = (g.log || []).length
	R.action(g, 'Allies', action, arg || {})
	console.log('\n=== ' + name + ' (' + action + ') ===')
	console.log('新增日志: ' + (g.log || []).slice(n0).join(' | '))
	console.log('pending_status_ask = ' + JSON.stringify(g.pending_status_ask))
	console.log('status_used = ' + JSON.stringify(g.status_used))
	console.log('handoff_stack = ' + JSON.stringify(g.handoff_stack))
	console.log('response_stack = ' + ((g.response_stack || []).length) +
		'  active = ' + g.active)
	console.log('17513 在手牌 = ' + (g.hands['美国'] || []).some(x => String(x).split('#')[0] === '17513') +
		'  在弃牌堆 = ' + (g.discard['美国'] || []).some(x => String(x).split('#')[0] === '17513'))
	console.log('block_reason = ' + JSON.stringify(R.view(g, 'Allies').block_reason))
}
trial('点「打出」', 'use_wartime_window')
trial('点「放弃」', 'skip_status_ask')
/* 对照：旧客户端会发的动作 */
trial('旧按钮「发动」', 'activate_status', { card: '17513#94' })
db.close()
