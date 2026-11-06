/* 第六步：打印全部 WS 消息（找 game_cookie 与 view 结构） */
const path = require('path')
const ROOT = path.join(__dirname, '..')
const GID = 11
const BASE = 'http://localhost:8091'
const USER = 'yz1968', PASS = 'jerry63465605'
;(async () => {
	const jar = new Map()
	const save = res => { for (const c of (res.headers.getSetCookie ? res.headers.getSetCookie() : [])) { const kv = c.split(';')[0]; const i = kv.indexOf('='); jar.set(kv.slice(0, i), kv.slice(i + 1)) } }
	const cookie = () => [...jar.entries()].map(([k, v]) => k + '=' + v).join('; ')
	let r = await fetch(BASE + '/login', { method: 'POST', body: new URLSearchParams({ username: USER, password: PASS }), redirect: 'manual', headers: { 'Content-Type': 'application/x-www-form-urlencoded' } })
	save(r)
	const WebSocket = require(path.join(ROOT, 'server-official', 'node_modules', 'ws'))
	const url = `ws://localhost:8091/play-socket?title=quartermaster-sub-wars&game=${GID}&role=Axis&seen=0&hash=0`
	const ws = new WebSocket(url, { headers: { cookie: cookie() } })
	let n = 0
	ws.on('message', m => {
		n++
		const s = String(m)
		const head = s.slice(0, 120)
		console.log('MSG[' + n + '] len=' + s.length + ' ' + head)
	})
	setTimeout(() => { console.log('消息数 =', n); try { ws.close() } catch (e) {} process.exit(0) }, 2500)
})()
