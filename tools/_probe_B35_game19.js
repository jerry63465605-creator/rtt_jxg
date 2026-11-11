/*
 * 只读：dump 真实对局 game=19 的 B35 相关状态 + view('Allies') 判定。
 * 不改盘面、不发动作。用法：node tools/_probe_B35_game19.js [gid]
 */
const path = require('path')
const Database = require(path.join(__dirname, '..', 'server-official', 'node_modules', 'better-sqlite3'))
const MOD = path.join(__dirname, '..', 'server-official', 'public', 'quartermaster-sub-wars')
const R = require(path.join(MOD, 'rules.js'))
const I = R._internal
const dbPath = path.join(__dirname, '..', 'server-official', 'db')
const db = new Database(dbPath, { readonly: true })
const gid = Number(process.argv[2] || 19)
const J = x => JSON.stringify(x)

const rows = db.prepare('SELECT * FROM game_state WHERE game_id = ?').all(gid)
console.log('game=' + gid + '  game_state rows=' + rows.length)
for (const r of rows) {
	const raw = r.state || r.data || r.json
	if (!raw) { console.log('no state column'); continue }
	let g
	try { g = JSON.parse(raw) } catch (e) { console.log('parse err ' + e.message); continue }

	console.log('\n=== 局面 ===')
	console.log('turn=' + g.turn + ' phase=' + g.turn_phase +
		' current_nation=' + g.current_nation + ' active=' + g.active)
	console.log('pending_status_ask = ' + J(g.pending_status_ask || null))
	console.log('pending_battle=' + J(g.pending_battle && g.pending_battle.stage) +
		' pending_armed_delegate=' + J(g.pending_armed_delegate) +
		' us_wartime=' + J(g.us_wartime))
	console.log('response_queue=' + ((g.response_queue || []).length) +
		' response_stack=' + ((g.response_stack || []).length) +
		' armed_offers=' + J((g.armed_offers || []).map(w => w.when)))
	console.log('status_instant = ' + J((g.status_instant || []).map(e =>
		e.card_id + ':' + e.window + '@' + e.space)))
	console.log('status_used = ' + J(g.status_used))
	console.log('table[美国] = ' + J((g.table || {})['美国']))
	console.log('hands[美国] = ' + J(g.hands && g.hands['美国']))
	console.log('decks[美国] 张数 = ' + ((g.decks && g.decks['美国']) || []).length)
	console.log('handoff_stack = ' + J(g.handoff_stack))
	const fk = I.freq_key ? I.freq_key(g) : '(no freq_key export)'
	console.log('freq_key = ' + J(fk))

	console.log('\n=== view(Allies) ===')
	let v
	try { v = R.view(g, 'Allies') } catch (e) { console.log('view ERR ' + e.stack); continue }
	console.log('actions = ' + J(v.actions))
	console.log('block_reason = ' + J(v.block_reason))
	console.log('pending_status_ask = ' + J(v.pending_status_ask))
	console.log('waiting_for = ' + J(v.waiting_for))
	console.log('table_status = ' + J((v.table_status || []).map(s => ({
		card: s.card, name: s.name, nation: s.nation,
		ready: s.ready, used_this_turn: s.used_this_turn, reason: s.reason,
	}))))
	const hr = v.hand_ready || {}
	console.log('hand_ready 中含 17513 的项 = ' + J(Object.keys(hr)
		.filter(k => String(k).split('#')[0] === '17513').map(k => [k, hr[k]])))

	console.log('\n=== view(Axis) ===')
	const vx = R.view(g, 'Axis')
	console.log('actions = ' + J(vx.actions))
	console.log('block_reason = ' + J(vx.block_reason))

	console.log('\n=== 最近 12 条日志 ===')
	console.log((g.log || []).slice(-12).join('\n'))
}
db.close()
