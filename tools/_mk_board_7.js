/* 第五步：写入初始状态 → 连接 WS 看是否推 view */
const path = require('path')
const ROOT = path.join(__dirname, '..')
const MOD = path.join(ROOT, 'server-official', 'public', 'quartermaster-sub-wars')
const R = require(path.join(MOD, 'rules.js'))
const Database = require(path.join(ROOT, 'server-official', 'node_modules', 'better-sqlite3'))
const GID = 11

const db = new Database(path.join(ROOT, 'server-official', 'db'))
const existing = db.prepare('select game_id from game_state where game_id=?').get(GID)
if (!existing) {
	const g = R.setup(Math.floor(Math.random() * 1000000) + 1)
	db.prepare('insert into game_state (game_id, state) values (?,?)').run(GID, JSON.stringify(g))
	console.log('已写入初始状态')
} else console.log('状态已存在')
db.prepare("update games set status=1, mtime=current_timestamp where game_id=?").run(GID)
db.close()

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
	ws.on('open', () => console.log('WS OPEN'))
	ws.on('close', (c, reason) => console.log('WS CLOSE', c, String(reason)))
	ws.on('message', m => { n++; if (n <= 4) console.log('MSG[' + n + '] ' + String(m).slice(0, 200)) })
	setTimeout(() => { console.log('消息数 =', n); try { ws.close() } catch (e) {} process.exit(0) }, 3000)
})()
