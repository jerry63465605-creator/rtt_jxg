/*
 * 用「对局快照 + 动作回放」在本地复现某段真实对局，用于排查线上顺序类问题。
 *
 * 用法：
 *   node tools/_replay_snap.js <game_id> <snap_id>
 *   node tools/_replay_snap.js 29 40        # 29 号对局、快照 40 之后的所有动作
 *   node tools/_replay_snap.js 29 40 --grep 奇袭
 *
 * 数据来源（只读）：
 *   server-official/db          —— SQLite（注意：db 是【文件】不是目录）
 *   game_snap(game_id, snap_id, replay_id, log_length, log_hash, state)
 *   game_replay(game_id, replay_id, role, action, arguments)
 *
 * ⚠ 两个坑：
 *   1) 快照里的 `state.log` 只存了【条数】（数字），回放前必须重置成数组，否则 g.log.push 崩。
 *   2) 回放的动作是【当时】的序列；若代码改动导致顺序变化，后半段动作可能因状态不匹配而报
 *      "所选目标不在合法候选内"之类 —— 那是夹具与旧顺序不对应，不代表新代码有问题。
 *      看的是【改动前后同一批动作产生的日志顺序差异】。
 */
const path = require('path')
const MOD = path.join(__dirname, '..', 'server-official', 'public', 'quartermaster-sub-wars')
const R = require(path.join(MOD, 'rules.js'))
const Database = require(path.join(__dirname, '..', 'server-official', 'node_modules', 'better-sqlite3'))

const gameId = Number(process.argv[2] || 0)
const snapId = Number(process.argv[3] || 0)
const grepIdx = process.argv.indexOf('--grep')
const grep = grepIdx > 0 ? process.argv[grepIdx + 1] : null

if (!gameId || !snapId) {
	console.log('用法: node tools/_replay_snap.js <game_id> <snap_id> [--grep 关键词]')
	process.exit(0)
}

const db = new Database(path.join(__dirname, '..', 'server-official', 'db'), { readonly: true, fileMustExist: true })
const snap = db.prepare('select replay_id, log_length, state from game_snap where game_id = ? and snap_id = ?')
	.get(gameId, snapId)
if (!snap) {
	console.log('找不到快照 game=' + gameId + ' snap=' + snapId)
	const list = db.prepare('select snap_id, replay_id, log_length from game_snap where game_id = ? order by snap_id desc limit 10')
		.all(gameId)
	console.log('可用（最近 10 个）:', JSON.stringify(list))
	process.exit(0)
}

const g = JSON.parse(snap.state)
/* 快照的 log 是条数，回放前重置 */
if (!Array.isArray(g.log)) g.log = []
console.log('game=' + gameId + ' snap=' + snapId + '（replay_id=' + snap.replay_id +
	'）开始回放，状态: turn=' + g.turn + ' phase=' + g.turn_phase + ' current_nation=' + g.current_nation)

const rows = db.prepare('select replay_id, role, action, arguments from game_replay where game_id = ? and replay_id > ? order by replay_id')
	.all(gameId, snap.replay_id)

for (const r of rows) {
	let arg = r.arguments
	try { arg = JSON.parse(arg) } catch (e) { /* 保持原样 */ }
	/* .setup 的 arguments 是数组，取第 3 项当 arg */
	if (Array.isArray(arg)) arg = arg[2] || {}
	if (r.action === '.setup') continue

	const before = g.log.length
	let err = null
	try {
		if (typeof R.action === 'function') R.action(g, r.role, r.action, arg)
	} catch (e) { err = e.message }
	const added = g.log.slice(before).filter(l => !grep || l.indexOf(grep) >= 0)
	const tag = r.replay_id + '. [' + r.role + '] ' + r.action
	if (err) console.log(tag + '  !! ' + err)
	for (const l of added) console.log(tag + '  | ' + l)
}

console.log('\n=== 回放结束时 ===')
console.log('response_stack =', JSON.stringify((g.response_stack || [])
	.map(f => ({ name: f.name, pending: !!f.pending, ncand: (f.candidates || []).length }))))
console.log('deferred_response_stack =', JSON.stringify((g.deferred_response_stack || []).map(f => f.name)))
console.log('pending_battle =', JSON.stringify(!!g.pending_battle))
