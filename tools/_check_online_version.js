/*
 * 对比「线上 /pre/quartermaster-sub-wars」与本地最新：版本串 + 关键功能标记
 * 用法：node tools/_check_online_version.js
 */
const fs = require('fs')
const path = require('path')
const os = require('os')

const T = os.tmpdir()
const BASE = 'https://test.genie-rttcn.top/pre/quartermaster-sub-wars'
const MOD = path.join(__dirname, '..', 'server-official', 'public', 'quartermaster-sub-wars')

/* 线上文件由外部 curl 下载到 %TEMP%\on_*，这里统一读 */
const FILES = [
	{ key: 'play.html', online: path.join(T, 'on_play.html'), local: path.join(MOD, 'play.html') },
	{ key: 'play.css', online: path.join(T, 'on_play.css'), local: path.join(MOD, 'play.css') },
	{ key: 'play.js', online: path.join(T, 'on_play.js'), local: path.join(MOD, 'play.js') },
	{ key: 'rules.js', online: path.join(T, 'on_rules.js'), local: path.join(MOD, 'rules.js') },
]

const read = p => { try { return fs.readFileSync(p, 'utf8') } catch (e) { return null } }

console.log('=== 文件大小 ===')
for (const f of FILES) {
	const on = read(f.online), lo = read(f.local)
	if (!on) { console.log('  ' + f.key + '：线上未下载'); continue }
	console.log('  ' + f.key.padEnd(10) + ' 线上 ' + String(on.length).padStart(8) +
		'  本地 ' + String(lo ? lo.length : 0).padStart(8) +
		(on === lo ? '   ✅ 完全一致' : '   ⚠ 不同'))
}

const onHtml = read(FILES[0].online) || ''
const loHtml = read(FILES[0].local) || ''
const onCss = read(FILES[1].online) || ''
const loCss = read(FILES[1].local) || ''
const onJs = read(FILES[2].online) || ''
const loJs = read(FILES[2].local) || ''
const onRules = read(FILES[3].online) || ''
const loRules = read(FILES[3].local) || ''

const ver = s => [...new Set([...String(s).matchAll(/\?v=([0-9a-z]+)/g)].map(m => m[1]))]
console.log('\n=== 版本串 ===')
console.log('  线上: ' + JSON.stringify(ver(onHtml)))
console.log('  本地: ' + JSON.stringify(ver(loHtml)))

const CHECKS = [
	{ name: '【UI】调试面板「手牌视角」入口', file: 'html', pat: /debug_view_panel/ },
	{ name: '【UI】询问框保留换行 (.ask_text pre-line)', file: 'css', pat: /\.ask_text[\s\S]{0,120}pre-line/ },
	{ name: '【UI】可点高亮改静态（无 pickable-pulse 动画）', file: 'css', pat: /pickable-pulse[^}]*animation/, negate: true },
	{ name: '【UI】断补红框改静态（无 supply_warn 动画）', file: 'css', pat: /supply_warn[^}]*animation/, negate: true },
	{ name: '【UI】事件卡 need 通道（客户端 update_pending_echo_box 里 echo_need）', file: 'js', pat: /echo_need/ },
	{ name: '【UI】云雾：战斗面板"原地移除"单按钮', file: 'js', pat: /air_no_retreat/ },
	{ name: '【UI】大清洗弹窗加 my_nation 闸', file: 'js', pat: /view\.my_nation === '苏联'/ },
	{ name: '【规则】15315 连带消灭同国空军', file: 'rules', pat: /随陆军一起被消灭的空军/ },
	{ name: '【规则】大清洗 view 字段阵营过滤', file: 'rules', pat: /su_17817_pending && faction_of_nation/ },
	{ name: '【规则】义勇军让权优先于战斗预算', file: 'rules', pat: /必须回答】的让权/ },
	{ name: '【规则】雷达声明式 ready', file: 'rules', pat: /只有【美国海军】被移除的那一刻才武装/ },
]

const pick = { html: [onHtml, loHtml], css: [onCss, loCss], js: [onJs, loJs], rules: [onRules, loRules] }
console.log('\n=== 关键功能是否已上线 ===')
for (const c of CHECKS) {
	const [on, lo] = pick[c.file]
	const hit = c.pat.test(on)
	const has = c.negate ? !hit : hit
	const localHas = (() => { const h = c.pat.test(lo); return c.negate ? !h : h })()
	console.log('  ' + (has ? '✅ 有' : '❌ 无') + '  ' + c.name +
		(localHas !== has ? '   （本地：' + (localHas ? '有' : '无') + '）' : ''))
}

console.log('\n提示：线上 play.html 请用 npm 之外的 curl 无查询串下载（带 ?x=1 会被网关 404）')
console.log('  curl -s ' + BASE + '/play.html -o "%TEMP%\\on_play.html"')
