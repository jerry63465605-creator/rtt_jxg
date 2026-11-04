/* 对比 style.css 新旧两版里 body / :root / font-size 的关键声明（解释"本地字更大"） */
const { execSync } = require('child_process')
const fs = require('fs')
const path = require('path')
const ROOT = path.join(__dirname, '..')
const REL = 'server-official/public/style.css'

const norm = s => s.replace(/\r\n/g, '\n')
const now = norm(fs.readFileSync(path.join(ROOT, REL), 'utf8'))
const old = norm(execSync('git show HEAD:' + REL, { cwd: ROOT, maxBuffer: 1 << 26 }).toString())

const block = (s, sel) => {
	const m = s.match(new RegExp('(?:^|\\n)\\s*' + sel + '\\s*\\{([^}]*)\\}'))
	return m ? m[1].replace(/\s+/g, ' ').trim() : '(无该规则)'
}

for (const [label, css] of [['旧版（本地原样）', old], ['新版（线上）', now]]) {
	console.log('\n=== ' + label + ' ===')
	for (const sel of ['body', 'html', ':root']) {
		const b = block(css, sel)
		const keep = b.split(';').filter(x => /font|color|line-height|background/.test(x)).join('; ')
		console.log('  ' + sel.padEnd(6) + ' ' + (keep || b.slice(0, 160) || '(空)'))
	}
	const sizes = [...css.matchAll(/font-size\s*:\s*([^;}]+)/g)].map(m => m[1].trim())
	console.log('  font-size 声明数 = ' + sizes.length + '  前几个: ' + JSON.stringify(sizes.slice(0, 6)))
	console.log('  含 --font-normal = ' + /--font-normal/.test(css))
}
