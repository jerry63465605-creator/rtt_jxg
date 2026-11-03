/*
 * 排查「UI 重复显示」：play.html 里带 class="hide" 的元素，是否在 play.css 里
 * 都有对应的 `display:none` 规则。
 *
 * 背景：本模块的 .hide 没有通用规则（play.css L1045 明确写了），
 *       每新增一个用 .hide 的元素都必须自己补 `#id.hide{display:none}`，
 *       否则「加了 hide 却照样显示」= 屏幕上多出一堆面板（看起来像 UI 重复）+ 挡住地图点不动。
 *
 * 用法：node tools/_audit_hide_css.js [目录]   （默认 tmp/ui_dup，即线上那份）
 */
const fs = require('fs')
const path = require('path')

const dir = process.argv[2] || path.join(__dirname, '..', 'tmp', 'ui_dup')
const html = fs.readFileSync(path.join(dir, 'play.html'), 'utf8').replace(/\r\n/g, '\n')
const css = fs.readFileSync(path.join(dir, 'play.css'), 'utf8').replace(/\r\n/g, '\n')

/* 找出所有 class 含 hide 的元素（含 id） */
const els = [...html.matchAll(/<([a-z0-9]+)([^>]*?)>/gi)]
	.map(m => ({ tag: m[1], attrs: m[2] }))
	.filter(o => /class="[^"]*\bhide\b/.test(o.attrs))
	.map(o => {
		const id = (o.attrs.match(/id="([^"]+)"/) || [])[1] || null
		const cls = (o.attrs.match(/class="([^"]+)"/) || [])[1] || ''
		return { tag: o.tag, id: id, cls: cls }
	})

/* 通用 .hide 规则是否存在 */
const genericHide = /(^|\n)\s*\.hide\s*\{[^}]*display\s*:\s*none/m.test(css)
/* 正确解析块：选择器可能跨行（如 #ask_box.hide,\n#resource_box.hide { ... }） */
const noComment = css.replace(/\/\*[\s\S]*?\*\//g, '')
const blocks = []
noComment.replace(/([^{}]+)\{([^{}]*)\}/g, (_, sel, body) => {
	if (/display\s*:\s*none/.test(body))
		blocks.push(sel.replace(/\s+/g, ' ').trim())
})
const hideRules = blocks

const covered = (id, cls) => {
	const classes = cls.split(/\s+/).filter(Boolean)
	const sels = hideRules.flatMap(r => r.split(',').map(s => s.replace(/\s+/g, ' ').trim()))
	/* ① #id.hide / #id */
	if (id && sels.some(s => s === '#' + id + '.hide' || s === '#' + id)) return true
	/* ② .someClass.hide（如 .modal.hide）/ .someClass */
	if (sels.some(s => {
		const m = s.match(/^\.([A-Za-z0-9_-]+)(\.hide)?$/)
		return m && classes.indexOf(m[1]) >= 0
	})) return true
	/* ③ 通用 .hide */
	if (genericHide || sels.indexOf('.hide') >= 0) return true
	return false
}

const missing = els.filter(e => !covered(e.id, e.cls))
console.log('play.html 里带 class="hide" 的元素 = ' + els.length)
console.log('play.css 是否有通用 .hide 规则 = ' + (genericHide ? '有' : '没有（本模块就是没有）'))
console.log('css 里 display:none 规则条数 = ' + hideRules.length)
console.log('\n=== 缺少 display:none 规则的 .hide 元素（会"加了 hide 却照样显示"）===')
if (!missing.length) console.log('  （无）')
for (const e of missing) console.log('  <' + e.tag + (e.id ? ' id="' + e.id + '"' : '') + ' class="' + e.cls + '">')

/* 额外：这些元素若是 position:fixed 的遮罩，会把地图盖住 -> 表现为"点不动/卡死" */
const fixedLike = missing.filter(e => /modal|box|panel|overlay/i.test((e.id || '') + ' ' + e.cls))
console.log('\n其中疑似全屏遮罩（会挡住地图 => 点不动）= ' + fixedLike.length)
for (const e of fixedLike) console.log('  #' + e.id)
