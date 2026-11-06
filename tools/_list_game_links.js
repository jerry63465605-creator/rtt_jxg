/* 列出本地 8091 上的对局链接（供打开对局页） */
const base = 'http://localhost:8091'
;(async () => {
	try {
		const r = await fetch(base + '/games')
		const t = await r.text()
		const links = []
		const re = /href="([^"]+)"/g
		let m
		while ((m = re.exec(t))) {
			const href = m[1]
			if (/\/play\//.test(href) || /game/i.test(href)) links.push(href)
		}
		console.log('HTTP', r.status, 'len', t.length)
		console.log('links:', JSON.stringify([...new Set(links)].slice(0, 12), null, 0))
		if (!links.length) console.log(t.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').slice(0, 500))
	} catch (e) { console.log('ERR', e.message) }
})()
