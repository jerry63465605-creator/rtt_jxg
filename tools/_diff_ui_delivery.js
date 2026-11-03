/*
 * 对比「外部交付的 UI」与仓库基线（5b79eb0），列出：
 *  ① 新增/删除的函数
 *  ② 新增的 DOM id / 选择器
 *  ③ 新增的 CSS 类
 * 目的：找出"多余的 UI"（重复实现）与可能导致卡死的新增逻辑。
 *
 * 用法：node tools/_diff_ui_delivery.js
 */
const { execSync } = require('child_process')
const fs = require('fs')
const path = require('path')

const ROOT = path.join(__dirname, '..')
const BASE_COMMIT = '5b79eb0'
const MOD = 'server-official/public/quartermaster-sub-wars'
const sh = c => execSync(c, { cwd: ROOT, maxBuffer: 1 << 28 }).toString()

const norm = s => s.replace(/\r\n/g, '\n')
const base = norm(sh('git show ' + BASE_COMMIT + ':' + MOD + '/play.js'))
const now = norm(fs.readFileSync(path.join(ROOT, MOD, 'play.js'), 'utf8'))
const baseCss = norm(sh('git show ' + BASE_COMMIT + ':' + MOD + '/play.css'))
const nowCss = norm(fs.readFileSync(path.join(ROOT, MOD, 'play.css'), 'utf8'))
const baseHtml = norm(sh('git show ' + BASE_COMMIT + ':' + MOD + '/play.html'))
const nowHtml = norm(fs.readFileSync(path.join(ROOT, MOD, 'play.html'), 'utf8'))

const fnSet = s => new Set([...s.matchAll(/^function ([A-Za-z0-9_]+)\(/gm)].map(m => m[1]))
const idSet = s => new Set([...s.matchAll(/id="([A-Za-z0-9_-]+)"/g)].map(m => m[1]))
const clsSet = s => new Set([...s.matchAll(/class="([^"]+)"/g)].flatMap(m => m[1].split(/\s+/)).filter(Boolean))

const diff = (a, b, label) => {
	const onlyB = [...b].filter(x => !a.has(x)).sort()
	const onlyA = [...a].filter(x => !b.has(x)).sort()
	console.log('\n=== ' + label + ' ===')
	console.log('  新增(' + onlyB.length + '): ' + JSON.stringify(onlyB.slice(0, 40)))
	console.log('  删除(' + onlyA.length + '): ' + JSON.stringify(onlyA.slice(0, 40)))
	return { onlyB, onlyA }
}

console.log('基线: ' + BASE_COMMIT + '   当前: 工作区')
diff(fnSet(base), fnSet(now), 'play.js 顶层函数')
diff(idSet(baseHtml), idSet(nowHtml), 'play.html 的 id')
diff(clsSet(baseHtml), clsSet(nowHtml), 'play.html 的 class')

/* 行数/体积 */
const loc = s => s.split('\n').length
console.log('\n=== 规模 ===')
console.log('  play.js   ' + loc(base) + ' -> ' + loc(now) + ' 行')
console.log('  play.css  ' + loc(baseCss) + ' -> ' + loc(nowCss) + ' 行')
console.log('  play.html ' + loc(baseHtml) + ' -> ' + loc(nowHtml) + ' 行')

/* 新增 CSS 里可疑的"全屏/遮罩/多面板"规则 */
console.log('\n=== 新增 CSS 中 position:fixed / inset:0 / z-index 的规则（可能的遮罩层）===')
const blocks = []
nowCss.replace(/([^{}]+)\{([^{}]*)\}/g, (_, sel, body) => {
	if (!/position:\s*fixed|inset:\s*0|z-index/.test(body)) return
	const key = sel.replace(/\s+/g, ' ').trim()
	if (baseCss.indexOf(key) < 0) blocks.push(key)
})
console.log('  ' + (blocks.length ? blocks.slice(0, 20).join(' | ') : '（无新增）'))
