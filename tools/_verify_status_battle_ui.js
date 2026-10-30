/*
 * 回归守卫：所有 effect.kind==='battle' 的状态卡，客户端 STATUS_UI 必须登记 battle 路由。
 *
 * 背景（2026-10-29 玩家截图）：
 *   日志「《耀武》请先选择发起战斗的单位与地区（未支付代价）」
 *   == 点了【发动】没反应。
 *   根因：服务端 2026-10-28 加的 battle 参数预检要求 activate_status 带 from
 *   （rules.js:29867），而客户端 play.js 的 STATUS_UI 手写表没登记 '17746'，
 *   于是走通用确认框、不带 from -> 被预检拒掉。
 *
 * 本脚本把"服务端要 from"与"客户端会不会让玩家选 from"两件事绑在一起校验：
 *   ① rules.js 里凡是 trigger.effect.kind==='battle' 的状态卡；
 *   ② play.js 的 STATUS_UI 必须有该卡条目，且带 battle（=走 start_status_battle 两步流程）；
 *   ③ 服务端那句预检文案仍在（防止守卫被悄悄删掉后又回到"扣了代价没效果"）。
 *
 * 用法：node tools/_verify_status_battle_ui.js
 */
const fs = require('fs')
const path = require('path')
const MOD = path.join(__dirname, '..', 'server-official', 'public', 'quartermaster-sub-wars')
const rules = require(path.join(MOD, 'rules.js'))
const I = rules._internal

let pass = 0, fail = 0
function ok(m, cond, extra) {
	if (cond) { pass++; console.log('  ✓ ' + m + (extra ? '  ' + extra : '')) }
	else { fail++; console.log('  ✗ ' + m + (extra ? '  ' + extra : '')) }
}

/* ---------- ① 服务端：battle 型状态卡清单 ---------- */
const SE = I.STATUS_EFFECTS || {}
const battleCards = Object.keys(SE).filter(k => {
	const t = SE[k] && SE[k].trigger
	return !!(t && t.effect && t.effect.kind === 'battle')
})
console.log('\n=== 服务端 battle 型状态卡（effect.kind==="battle"）===')
console.log('  ' + (battleCards.length ? battleCards.join(', ') : '（无）'))
ok('至少识别到 17746', battleCards.indexOf('17746') >= 0, battleCards.join(','))

/* ---------- ③ 服务端预检文案仍在 ---------- */
const rulesSrc = fs.readFileSync(path.join(MOD, 'rules.js'), 'utf8')
ok('服务端 battle 参数预检仍在（未支付代价）',
	/请先选择发起战斗的单位与地区（未支付代价）/.test(rulesSrc))

/* ---------- ② 客户端 STATUS_UI 覆盖 ---------- */
const playSrc = fs.readFileSync(path.join(MOD, 'play.js'), 'utf8')
const lines = playSrc.split('\n')
const startIdx = lines.findIndex(l => /^const STATUS_UI = \{/.test(l))
ok('找到客户端 STATUS_UI 表', startIdx >= 0, 'line ' + (startIdx + 1))

const uiMap = {}
if (startIdx >= 0) {
	let end = startIdx + 1
	while (end < lines.length && lines[end] !== '}') end++
	const body = lines.slice(startIdx + 1, end)
	let cur = null
	for (const raw of body) {
		const l = raw.trim()
		const m = l.match(/^'(\d{5})':\s*\{(.*)$/)
		if (m) {
			cur = m[1]
			uiMap[cur] = (uiMap[cur] || '') + l
		} else if (cur && l.indexOf('/*') < 0 && l.indexOf('*') !== 0) {
			uiMap[cur] += ' ' + l
		}
	}
	console.log('\n=== 客户端 STATUS_UI 覆盖检查 ===')
	for (const face of battleCards) {
		const entry = uiMap[face]
		const hasBattle = !!(entry && /\bbattle\s*:/.test(entry))
		ok(face + ' 在 STATUS_UI 中登记了 battle 路由' + (entry ? '' : '（条目缺失）'),
			hasBattle, entry ? entry.slice(0, 90) : 'MISSING')
	}
}

/* ---------- 反向：登记了 battle 但服务端不是 battle 型（提示表不一致） ---------- */
console.log('\n=== 反向一致性（仅提示，不判失败）===')
for (const face of Object.keys(uiMap)) {
	if (!/\bbattle\s*:/.test(uiMap[face])) continue
	if (battleCards.indexOf(face) < 0)
		console.log('  · ' + face + ' 客户端按 battle 流程走，但服务端 trigger.effect 不是 battle —— 请人工确认')
}

console.log('\n==== 结果：' + pass + ' 通过 / ' + fail + ' 失败 ====')
process.exit(fail ? 1 : 0)
