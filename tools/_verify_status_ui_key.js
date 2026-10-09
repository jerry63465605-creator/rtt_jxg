/*
 * 验证 R40 根因已消除：STATUS_UI 按【基础 id】建表，
 * 但运行时 cardId 是【实例 id】（"15341#3"），必须能查到配置。
 *
 * 此处复刻 play.js 的 status_ui_of() 逻辑做断言，
 * 并直接从 play.js 源码确认两处调用点都已改为 status_ui_of。
 *
 * 用法（从仓库根）：node tools/_verify_status_ui_key.js
 */
const fs = require('fs')
const path = require('path')
const MOD = path.join(__dirname, '..', 'server-official', 'public', 'quartermaster-sub-wars')

let pass = 0, fail = 0
function ok(label, cond, extra) {
	console.log((cond ? '  PASS  ' : '  FAIL  ') + label + (extra ? '  | ' + extra : ''))
	cond ? pass++ : fail++
}

/* 取 play.js 里的 STATUS_UI 表做真实断言 */
const src = fs.readFileSync(path.join(MOD, 'play.js'), 'utf8')
const m = src.match(/const STATUS_UI = \{([\s\S]*?)\n\}/)
ok('取到 STATUS_UI 定义', !!m)
const STATUS_UI = {}
if (m) {
	for (const line of m[1].split('\n')) {
		const mm = line.match(/'(\d+)'\s*:\s*\{(.*)\}/)
		if (!mm) continue
		const obj = {}
		if (/build:\s*true/.test(mm[2])) obj.build = true
		if (/auto:\s*true/.test(mm[2])) obj.auto = true
		const r = mm[2].match(/recruit:\s*'([^']+)'/)
		if (r) obj.recruit = r[1]
		const dsc = mm[2].match(/discard:\s*(\d+)/)
		if (dsc) obj.discard = Number(dsc[1])
		STATUS_UI[mm[1]] = obj
	}
}

/* 复刻 play.js 的 status_ui_of */
function status_ui_of(id) {
	return STATUS_UI[id] || STATUS_UI[String(id == null ? '' : id).split('#')[0]] || {}
}

console.log('=== 实例 id 必须能查到配置（R40 根因）===')
ok('15341#3 -> build=true', status_ui_of('15341#3').build === true,
	JSON.stringify(status_ui_of('15341#3')))
ok('15341#3 -> recruit=澳大利亚', status_ui_of('15341#3').recruit === '澳大利亚')
ok('15342#7 -> build=true, recruit=印度',
	status_ui_of('15342#7').build === true && status_ui_of('15342#7').recruit === '印度',
	JSON.stringify(status_ui_of('15342#7')))
ok('基础 id 15341 仍可用', status_ui_of('15341').build === true)
ok('15340#1 -> auto=true', status_ui_of('15340#1').auto === true)
ok('未知卡 -> 空对象', Object.keys(status_ui_of('99999#1')).length === 0)

console.log('\n=== 源码：渲染与点击两处都已改用 status_ui_of ===')
const renderOk = /const ui = status_ui_of\(c\.card\)/.test(src)
const clickOk = /const ui = status_ui_of\(cardId\)/.test(src)
ok('update_table_status 用 status_ui_of(c.card)', renderOk)
ok('on_click_table_status 用 status_ui_of(cardId)', clickOk)
ok('不再有裸的 STATUS_UI[c.card]', !/STATUS_UI\[c\.card\]/.test(src))
ok('不再有裸的 STATUS_UI[cardId]', !/STATUS_UI\[cardId\]/.test(src))

console.log('\n=== 源码：build 分支不再要求 c.ready ===')
const buildBranch = src.match(/if \(ui\.build\) \{\s*\n\s*\/\*[\s\S]*?if \(building\) \{/)
ok('渲染分支只看 building（不要求 c.ready）', !!buildBranch,
	buildBranch ? '' : '未匹配到 if (building) 分支')

console.log('\n通过 ' + pass + ' / 失败 ' + fail)
process.exit(fail ? 1 : 0)
