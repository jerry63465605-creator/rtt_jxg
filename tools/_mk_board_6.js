/* 第四步：accept 两方 → 检查 game_state → 连 WS 看握手 */
const BASE = 'http://localhost:8091'
const USER = 'yz1968', PASS = 'jerry63465605'
const GID = 11, TITLE = 'quartermaster-sub-wars'
;(async () => {
	const jar = new Map()
	const save = res => { for (const c of (res.headers.getSetCookie ? res.headers.getSetCookie() : [])) { const kv = c.split(';')[0]; const i = kv.indexOf('='); jar.set(kv.slice(0, i), kv.slice(i + 1)) } }
	const cookie = () => [...jar.entries()].map(([k, v]) => k + '=' + v).join('; ')
	let r = await fetch(BASE + '/login', { method: 'POST', body: new URLSearchParams({ username: USER, password: PASS }), redirect: 'manual', headers: { 'Content-Type': 'application/x-www-form-urlencoded' } })
	save(r)
	for (const role of ['Axis', 'Allies']) {
		r = await fetch(BASE + '/api/accept/' + GID + '/' + role, { method: 'POST', headers: { cookie: cookie() } })
		console.log('accept', role, '->', r.status, (await r.text()).slice(0, 80))
	}
	const Database = require('c:/Users/24968/Desktop/rtt/server-official/node_modules/better-sqlite3')
	const db = new Database('c:/Users/24968/Desktop/rtt/server-official/db', { readonly: true })
	const st = db.prepare('select game_id, length(state) as n from game_state where game_id=?').get(GID)
	console.log('game_state =', JSON.stringify(st))
	db.close()

	const WebSocket = require('c:/Users/24968/Desktop/rtt/server-official/node_modules/ws')
	const url = `ws://localhost:8091/play-socket?title=${TITLE}&game=${GID}&role=Axis&seen=0&hash=0`
	const ws = new WebSocket(url, { headers: { cookie: cookie() } })
	let n = 0
	ws.on('open', () => console.log('WS OPEN'))
	ws.on('close', (c, reason) => console.log('WS CLOSE', c, String(reason)))
	ws.on('message', m => { n++; if (n <= 4) console.log('MSG[' + n + '] ' + String(m).slice(0, 160)) })
	setTimeout(() => { console.log('消息数 =', n); try { ws.close() } catch (e) {} process.exit(0) }, 3000)
})()
