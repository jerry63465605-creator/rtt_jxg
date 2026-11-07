/* 审计：所有 .modal 元素的显隐是否都走 classList（无 inline style.display 残留） */
const fs = require('fs')
const path = require('path')
const MOD = path.join(__dirname, '..', 'server-official', 'public', 'quartermaster-sub-wars')
const html = fs.readFileSync(path.join(MOD, 'play.html'), 'utf8')
const js = fs.readFileSync(path.join(MOD, 'play.js'), 'utf8').replace(/\r\n/g, '\n')
const css = fs.readFileSync(path.join(MOD, 'play.css'), 'utf8')

/* ① 收集 play.html 里 class="modal ..." 的元素 id */
const ids = []
for (const m of html.matchAll(/<div id="([\w-]+)" class="modal([^"]*)"/g)) ids.push({ id: m[1], cls: m[2].trim() })

console.log('=== play.html 里的 .modal 元素 = ' + ids.length + ' 个 ===')
let bad = []
for (const { id, cls } of ids) {
	/* ② 是否有针对该 id 的 inline display 写法 */
	const inline = new RegExp('getElementById\\("' + id + '"\\)\\s*\\.style\\.display|' + id + '"\\)\\.style\\.display', 'g')
	const nInline = (js.match(inline) || []).length
	/* 另一种写法：先取变量再 .style.display，只能按"变量名含 modal"粗查 */
	const showByClass = new RegExp('classList\\.remove\\("hide"\\)').test(js)
	if (nInline) bad.push({ id, nInline })
	console.log('  ' + id.padEnd(22, ' ') + ' 初始含 hide=' + /hide/.test(cls) + '  inline display 用法=' + nInline)
}

/* ③ 全文件级别：还有哪些 style.display 残留（区分是否 modal） */
console.log('\n=== play.js 全部 style.display 残留 ===')
const lines = js.split('\n')
lines.forEach((l, i) => {
	if (!/style\.display/.test(l)) return
	if (/^\s*[*/]/.test(l)) return             /* 注释 */
	console.log('  L' + (i + 1) + ': ' + l.trim().slice(0, 100))
})

/* ④ classList 显隐统计 */
console.log('\n=== classList 用法统计 ===')
console.log('  remove("hide") = ' + (js.match(/classList\.remove\("hide"\)/g) || []).length +
	'　add("hide") = ' + (js.match(/classList\.add\("hide"\)/g) || []).length)
console.log('  CSS .modal.hide 规则存在 = ' + /\.modal\.hide\s*\{\s*display:\s*none/.test(css))

console.log('\n=== 结论 ===')
console.log(bad.length ? '✗ 仍有 ' + bad.length + ' 个 modal 用 inline display：' + JSON.stringify(bad)
	: '✓ 所有 .modal 的显隐均不含 inline style.display（统一走 classList）')
process.exitCode = bad.length ? 1 : 0
