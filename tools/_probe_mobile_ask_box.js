/* 只读：ask_box 在 DOM 里的父级，以及窄屏媒体查询是否把它（或其父级）隐藏 */
const fs = require('fs')
const path = require('path')
const MOD = path.join(__dirname, '..', 'server-official', 'public', 'quartermaster-sub-wars')
const html = fs.readFileSync(path.join(MOD, 'play.html'), 'utf8').replace(/\r\n/g, '\n').split('\n')
const css = fs.readFileSync(path.join(MOD, 'play.css'), 'utf8').replace(/\r\n/g, '\n').split('\n')

/* ① ask_box 的祖先链 */
const idx = html.findIndex(l => l.indexOf('id="ask_box"') >= 0)
console.log('=== play.html：ask_box 在第 ' + (idx + 1) + ' 行，祖先如下 ===')
let depth = 0
for (let i = idx; i >= 0 && i > idx - 80; i--) {
	const l = html[i]
	const opens = (l.match(/<(aside|div|section)\b[^>]*>/g) || [])
	const closes = (l.match(/<\/(aside|div|section)>/g) || [])
	if (opens.length || closes.length) {
		if (i !== idx) {
			const tag = opens.length ? opens[opens.length - 1] : closes[0]
			console.log('  L' + (i + 1) + '  ' + tag.trim().slice(0, 90))
			if (/<\/aside>|<\/section>/.test(closes.join(''))) break
		}
	}
	if (i < idx && /<aside\b/.test(l)) { console.log('  ↑ 已在 <aside> 标签处停止'); break }
}

/* ② 所有提到 ask_box 的 CSS 块 */
console.log('\n=== play.css：含 #ask_box 的选择器 ===')
css.forEach((l, i) => { if (/#ask_box/.test(l) && /^#|^\s*#|,/.test(l)) console.log('  L' + (i + 1) + ': ' + l.trim().slice(0, 110)) })

/* ③ 每个 @media 块里是否隐藏 aside / ask_box */
console.log('\n=== @media 块内与 aside / ask_box / display:none 有关的规则 ===')
let inMedia = false, mediaHead = '', depth2 = 0
css.forEach((l, i) => {
	if (/@media/.test(l)) { inMedia = true; mediaHead = l.trim(); depth2 = 0 }
	if (inMedia) {
		if (l.indexOf('{') >= 0) depth2 += (l.match(/\{/g) || []).length
		if (l.indexOf('}') >= 0) depth2 -= (l.match(/\}/g) || []).length
		if (/aside|ask_box|display:\s*none|visibility:\s*hidden|transform:|position:/.test(l))
			console.log('  [' + mediaHead + '] L' + (i + 1) + ': ' + l.trim().slice(0, 100))
		if (depth2 <= 0 && /\}/.test(l)) inMedia = false
	}
})

/* ④ 侧栏（aside）在窄屏是否被整体挪走/隐藏 */
console.log('\n=== 窄屏下 aside 的布局规则（2400 行附近）===')
for (let i = 2395; i < 2445 && i < css.length; i++) {
	if (/aside|max-width|display|width|grid|position/.test(css[i])) console.log('  L' + (i + 1) + ': ' + css[i].trim().slice(0, 110))
}
