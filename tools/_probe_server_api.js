/* 探测服务器建局接口：登录 → /create 页面里的表单/链接 */
const BASE = 'http://localhost:8091'
const USER = 'yz1968', PASS = 'jerry63465605'

;(async () => {
	const jar = new Map()
	const setCookies = res => {
		const raw = res.headers.getSetCookie ? res.headers.getSetCookie() : []
		for (const c of raw) {
			const kv = c.split(';')[0]
			const i = kv.indexOf('=')
			jar.set(kv.slice(0, i), kv.slice(i + 1))
		}
	}
	const cookie = () => [...jar.entries()].map(([k, v]) => k + '=' + v).join('; ')

	/* 登录（ALTCHA=0 时无验证码） */
	const body = new URLSearchParams({ username: USER, password: PASS })
	let r = await fetch(BASE + '/login', {
		method: 'POST', body, redirect: 'manual',
		headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
	})
	setCookies(r)
	console.log('login status =', r.status, ' location =', r.headers.get('location'))
	console.log('cookies =', cookie())

	/* /create 索引 */
	r = await fetch(BASE + '/create', { headers: { cookie: cookie() } })
	const html = await r.text()
	console.log('/create status =', r.status, ' len =', html.length)
	const links = [...html.matchAll(/href="([^"]+)"/g)].map(m => m[1]).filter(x => /create|title/i.test(x))
	console.log('links =', JSON.stringify([...new Set(links)].slice(0, 10)))
	const forms = [...html.matchAll(/<form[^>]*action="([^"]*)"[^>]*>/g)].map(m => m[1])
	console.log('forms =', JSON.stringify(forms))
	/* 打印含 form 的片段，便于看字段 */
	const i = html.indexOf('<form')
	if (i >= 0) console.log('form snippet =', html.slice(i, i + 400).replace(/\s+/g, ' '))
})()
