/* 对比「线上最新」(tmp/online2) 与本地：修复是否已在他们那边、本地哪些补丁会丢 */
const fs = require('fs')
const path = require('path')
const MOD = path.join(__dirname, '..', 'server-official', 'public', 'quartermaster-sub-wars')
const ON = path.join(__dirname, '..', 'tmp', 'online2')
const norm = s => s.replace(/\r\n/g, '\n')
const rd = p => norm(fs.readFileSync(p, 'utf8'))

const onHtml = rd(path.join(ON, 'play.html'))
const onCss = rd(path.join(ON, 'play.css'))
const onJs = rd(path.join(ON, 'play.js'))
const loHtml = rd(path.join(MOD, 'play.html'))
const loCss = rd(path.join(MOD, 'play.css'))
const loJs = rd(path.join(MOD, 'play.js'))

console.log('=== 规模（归一化换行后字符数）===')
for (const [k, a, b] of [['play.html', onHtml, loHtml], ['play.css', onCss, loCss], ['play.js', onJs, loJs]])
	console.log('  ' + k.padEnd(10) + ' 线上 ' + String(a.length).padStart(7) + '  本地 ' + String(b.length).padStart(7) +
		(a === b ? '   完全一致' : '   不同'))

const checks = [
	['SITE_PREFIX 写死 /pre（线上现状）', onHtml, /window\.SITE_PREFIX\s*=\s*"\/pre"/],
	['SITE_PREFIX 自适应（我们的修）', onHtml, /location\.pathname.*match/],
	['图标 /pre/images（线上现状）', onHtml, /\/pre\/images\//],
	['#log_close 关闭键', onHtml, /id="log_close"/],
	['地图底图 map_lo.webp', onCss, /url\(map_lo\.webp\)/],
	['地图底图 map.webp', onCss, /url\(map\.webp\)/],
	['#budget_hud.hide', onCss, /#budget_hud\.hide/],
	['窄屏日志栏 top 让开顶栏', onCss, /top:\s*var\(--qm-header-h/],
	['log_open 窄屏强制关', onJs, /if \(narrow\) \{\s*\n\s*log_open = false/],
	['refit 收敛（log_layout_open）', onJs, /log_layout_open !== log_open/],
	['计分标记用 layout 尺寸', onJs, /layout\[data\.name_of\(space_id\)\]/],
	['计分标记中心坐标', onJs, /sp\.x \+ spW \/ 2/],
	['计分标记实测宽度', onJs, /elt\.offsetWidth \|\| 46/],
]
console.log('\n=== 线上最新版是否已包含这些修复 ===')
for (const [n, src, re] of checks) console.log('  ' + (re.test(src) ? '✅ 有' : '❌ 无') + '  ' + n)

console.log('\n=== 本地相比线上最新，多出来的东西（会被覆盖的自家补丁）===')
const extra = checks.filter(([, src, re]) => re.test(loHtml + loCss + loJs) && !re.test(onHtml + onCss + onJs))
console.log(extra.length ? extra.map(x => '  - ' + x[0]).join('\n') : '  （无）')
