/* 第八步：带错误回显地发送 debug 动作 */
const path = require('path')
const ROOT = path.join(__dirname, '..')
const MOD = path.join(ROOT, 'server-official', 'public', 'quartermaster-sub-wars')
const R = require(path.join(MOD, 'rules.js'))
const d = R._internal.data
const GID = process.argv[2] ? Number(process.argv[2]) : 11
const BASE = 'http://localhost:8091'
const USER = 'yz1968', PASS = 'jerry63465605'
const ID = n => d.id_of(n)

/* 先看调试权限表 */
{
	const Database = require(path.join(ROOT, 'server-official', 'node_modules', 'better-sqlite3'))
	const db = new Database(path.join(ROOT, 'server-official', 'db'), { readonly: true })
	try { console.log('user_may_debug =', JSON.stringify(db.prepare('select * from user_may_debug').all())) } catch (e) { console.log('may_debug 表读取失败', e.message) }
	db.close()
}

const acts = [
	['debug_set_phase', { nation: '德国', phase: 'play' }],
	['debug_place', { piece: 'su_e', nation: '苏联', type: 'army', space: ID('东欧') }],
	['debug_place', { piece: 'su_air', nation: '苏联', type: 'air', space: ID('东欧') }],
	['debug_add_card', { face: '17811', nation: '苏联', dest: 'hand' }],
]
;(async () => {
	const jar = new Map()
	const save = res => { for (const c of (res.headers.getSetCookie ? res.headers.getSetCookie() : [])) { const kv = c.split(';')[0]; const i = kv.indexOf('='); jar.set(kv.slice(0, i), kv.slice(i + 1)) } }
	const cookie = () => [...jar.entries()].map(([k, v]) => k + '=' + v).join('; ')
	let r = await fetch(BASE + '/login', { method: 'POST', body: new URLSearchParams({ username: USER, password: PASS }), redirect: 'manual', headers: { 'Content-Type': 'application/x-www-form-urlencoded' } })
	save(r)
	const WebSocket = require(path.join(ROOT, 'server-official', 'node_modules', 'ws'))
	const ws = new WebSocket(`ws://localhost:8091/play-socket?title=quartermaster-sub-wars&game=${GID}&role=Axis&seen=0&hash=0`, { headers: { cookie: cookie() } })
	let cookieVal = 0, logs = 0
	const sleep = ms => new Promise(x => setTimeout(x, ms))
	ws.on('message', m => {
		const msg = JSON.parse(String(m))
		if (msg[0] === 'state') {
			if (typeof msg[2] === 'number') cookieVal = msg[2]
			logs = (msg[1].log || []).length
			return
		}
		console.log('MSG ' + msg[0] + ': ' + JSON.stringify(msg[1]).slice(0, 200))
	})
	ws.on('open', async () => {
		await sleep(700)
		console.log('cookie =', cookieVal, ' logs =', logs)
		for (const [verb, arg] of acts) {
			ws.send(JSON.stringify(['action', [verb, arg, cookieVal]]))
			await sleep(400)
		}
		await sleep(800)
		try { ws.close() } catch (e) {}
		process.exit(0)
	})
	setTimeout(() => process.exit(0), 15000)
})()
