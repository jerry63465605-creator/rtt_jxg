/* 打印 /create/quartermaster-sub-wars 的表单字段 */
const BASE = 'http://localhost:8091'
const USER = 'yz1968', PASS = 'jerry63465605'
;(async () => {
	const jar = new Map()
	const save = res => { for (const c of (res.headers.getSetCookie ? res.headers.getSetCookie() : [])) { const kv = c.split(';')[0]; const i = kv.indexOf('='); jar.set(kv.slice(0, i), kv.slice(i + 1)) } }
	const cookie = () => [...jar.entries()].map(([k, v]) => k + '=' + v).join('; ')

	let r = await fetch(BASE + '/login', { method: 'POST', body: new URLSearchParams({ username: USER, password: PASS }), redirect: 'manual', headers: { 'Content-Type': 'application/x-www-form-urlencoded' } })
	save(r)

	r = await fetch(BASE + '/create/quartermaster-sub-wars', { headers: { cookie: cookie() } })
	const html = await r.text()
	console.log('status =', r.status, 'len =', html.length)
	const i = html.indexOf('<form')
	console.log('--- form 片段 ---')
	console.log(html.slice(i, i + 900).replace(/\s+/g, ' '))
})()
