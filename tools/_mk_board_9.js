/* 第七步：用 WS 发送 debug 动作，搭出 17811 测试盘面 */
const path = require('path')
const ROOT = path.join(__dirname, '..')
const MOD = path.join(ROOT, 'server-official', 'public', 'quartermaster-sub-wars')
const R = require(path.join(MOD, 'rules.js'))
const d = R._internal.data
const GID = process.argv[2] ? Number(process.argv[2]) : 11
const BASE = 'http://localhost:8091'
const USER = 'yz1968', PASS = 'jerry63465605'

const ID = n => d.id_of(n)
const acts = [
	['debug_set_phase', { nation: '德国', phase: 'play' }],
	['debug_place', { piece: 'su_m', nation: '苏联', type: 'army', space: ID('莫斯科') }],
	['debug_place', { piece: 'su_r', nation: '苏联', type: 'army', space: ID('罗斯') }],
	['debug_place', { piece: 'su_u', nation: '苏联', type: 'army', space: ID('乌克兰') }],
	['debug_place', { piece: 'su_e', nation: '苏联', type: 'army', space: ID('东欧') }],
	['debug_place', { piece: 'su_air', nation: '苏联', type: 'air', space: ID('东欧') }],
	['debug_place', { piece: 'de_army', nation: '德国', type: 'army', space: ID('德国') }],
	['debug_place', { piece: 'de_air', nation: '德国', type: 'air', space: ID('德国') }],
	['debug_add_card', { face: '17811', nation: '苏联', dest: 'hand' }],
]

;(async () => {
	const jar = new Map()
	const save = res => { for (const c of (res.headers.getSetCookie ? res.headers.getSetCookie() : [])) { const kv = c.split(';')[0]; const i = kv.indexOf('='); jar.set(kv.slice(0, i), kv.slice(i + 1)) } }
	const cookie = () => [...jar.entries()].map(([k, v]) => k + '=' + v).join('; ')
	let r = await fetch(BASE + '/login', { method: 'POST', body: new URLSearchParams({ username: USER, password: PASS }), redirect: 'manual', headers: { 'Content-Type': 'application/x-www-form-urlencoded' } })
	save(r)

	const WebSocket = require(path.join(ROOT, 'server-official', 'node_modules', 'ws'))
	const url = `ws://localhost:8091/play-socket?title=quartermaster-sub-wars&game=${GID}&role=Axis&seen=0&hash=0`
	const ws = new WebSocket(url, { headers: { cookie: cookie() } })
	let cookieVal = 0
	let last_log_n = 0
	const sleep = ms => new Promise(x => setTimeout(x, ms))

	ws.on('message', m => {
		const msg = JSON.parse(String(m))
		if (msg[0] === 'state') {
			const v = msg[1]
			if (typeof msg[2] === 'number') cookieVal = msg[2]
			const logs = (v.log || []).slice(last_log_n)
			last_log_n = (v.log || []).length
			if (logs.length) for (const l of logs) console.log('  · ' + l)
		}
	})

	ws.on('open', async () => {
		await sleep(600)
		console.log('cookie =', cookieVal)
		for (const [verb, arg] of acts) {
			ws.send(JSON.stringify(['action', [verb, arg, cookieVal]]))
			await sleep(320)
		}
		await sleep(600)
		console.log('=== 动作发送完毕 ===')
		try { ws.close() } catch (e) {}
		process.exit(0)
	})
	ws.on('close', (c, reason) => console.log('WS CLOSE', c, String(reason)))
	setTimeout(() => { console.log('超时退出'); process.exit(0) }, 20000)
})()
