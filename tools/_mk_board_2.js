/* 第二步：看 /join/11 页面如何选角色（打印表单与链接） */
const BASE = 'http://localhost:8091'
const USER = 'yz1968', PASS = 'jerry63465605'
;(async () => {
	const jar = new Map()
	const save = res => { for (const c of (res.headers.getSetCookie ? res.headers.getSetCookie() : [])) { const kv = c.split(';')[0]; const i = kv.indexOf('='); jar.set(kv.slice(0, i), kv.slice(i + 1)) } }
	const cookie = () => [...jar.entries()].map(([k, v]) => k + '=' + v).join('; ')
	let r = await fetch(BASE + '/login', { method: 'POST', body: new URLSearchParams({ username: USER, password: PASS }), redirect: 'manual', headers: { 'Content-Type': 'application/x-www-form-urlencoded' } })
	save(r)
	r = await fetch(BASE + '/join/11', { headers: { cookie: cookie() } })
	const html = await r.text()
	console.log('join status', r.status, 'len', html.length)
	const forms = [...html.matchAll(/<form[^>]*>/g)].map(m => m[0])
	console.log('forms =', JSON.stringify(forms))
	const inputs = [...html.matchAll(/<(input|button|select)[^>]*>/g)].map(m => m[0]).slice(0, 12)
	console.log('inputs =', JSON.stringify(inputs, null, 0))
	const links = [...html.matchAll(/href="([^"]+)"/g)].map(m => m[1]).filter(x => /join|play/.test(x))
	console.log('links =', JSON.stringify([...new Set(links)].slice(0, 8)))
})()
