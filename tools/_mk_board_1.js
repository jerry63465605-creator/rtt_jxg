/* 第一步：登录 → 建局 → 连 WS 打印握手消息 */
const BASE = 'http://localhost:8091'
const USER = 'yz1968', PASS = 'jerry63465605'
const TITLE = 'quartermaster-sub-wars'

;(async () => {
	const jar = new Map()
	const save = res => { for (const c of (res.headers.getSetCookie ? res.headers.getSetCookie() : [])) { const kv = c.split(';')[0]; const i = kv.indexOf('='); jar.set(kv.slice(0, i), kv.slice(i + 1)) } }
	const cookie = () => [...jar.entries()].map(([k, v]) => k + '=' + v).join('; ')

	let r = await fetch(BASE + '/login', {
		method: 'POST', body: new URLSearchParams({ username: USER, password: PASS }),
		redirect: 'manual', headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
	})
	save(r)
	console.log('login', r.status, cookie())

	/* 建局 */
	r = await fetch(BASE + '/create/' + TITLE, {
		method: 'POST',
		body: new URLSearchParams({ scenario: 'Standard' }),
		redirect: 'manual',
		headers: { 'Content-Type': 'application/x-www-form-urlencoded', cookie: cookie() },
	})
	save(r)
	console.log('create', r.status, 'location =', r.headers.get('location'))
	const loc = r.headers.get('location') || ''
	const gid = (loc.match(/game=(\d+)/) || [])[1] || (loc.match(/\/(\d+)/) || [])[1]
	console.log('game id =', gid)

	/* 连 WS 看握手 */
	const WebSocket = require('c:/Users/24968/Desktop/rtt/server-official/node_modules/ws')
	const url = `ws://localhost:8091/play-socket?title=${TITLE}&game=${gid}&role=${encodeURIComponent('Axis')}&seen=0&hash=0`
	const ws = new WebSocket(url, { headers: { cookie: cookie() } })
	let n = 0
	ws.on('open', () => console.log('WS OPEN'))
	ws.on('message', m => {
		const s = String(m)
		n++
		if (n <= 6) console.log('MSG[' + n + '] ' + s.slice(0, 220))
	})
	ws.on('error', e => console.log('WS ERR', e.message))
	setTimeout(() => { console.log('共收到', n, '条'); ws.close(); process.exit(0) }, 4000)
})()
