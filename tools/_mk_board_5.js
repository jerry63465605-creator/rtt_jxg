/* 第三步：加入两个角色 → 连 WS（打印 close 原因与消息） */
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
		r = await fetch(BASE + '/api/join/' + GID + '/' + role, { method: 'POST', headers: { cookie: cookie() } })
		console.log('join', role, '->', r.status)
	}
	const WebSocket = require('c:/Users/24968/Desktop/rtt/server-official/node_modules/ws')
	const url = `ws://localhost:8091/play-socket?title=${TITLE}&game=${GID}&role=Axis&seen=0&hash=0`
	const ws = new WebSocket(url, { headers: { cookie: cookie() } })
	let n = 0
	ws.on('open', () => console.log('WS OPEN'))
	ws.on('close', (c, reason) => console.log('WS CLOSE', c, String(reason)))
	ws.on('error', e => console.log('WS ERR', e.message))
	ws.on('message', m => { n++; if (n <= 5) console.log('MSG[' + n + '] ' + String(m).slice(0, 200)) })
	setTimeout(() => { console.log('共收到', n, '条'); try { ws.close() } catch (e) {} process.exit(0) }, 3000)
})()
