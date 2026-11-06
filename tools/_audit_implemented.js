/*
 * 牌库实装审计：按 国家 × 卡类型 × 牌库(deck) 统计"已实装 / 未实装"
 *
 * "已实装"三层判据（依次回退，尽量不误判）：
 *   ① 注册表命中：EFFECT→ECHO_EFFECTS｜EVENT→EVENT_EFFECTS｜RESPONSE→RESPONSE_EFFECTS
 *                   STATUS→STATUS_EFFECTS｜ECON→ECON_CARDS
 *   ② CMD_IMPL（命令式实现登记表，供预览页显示"已接入（命令式）"）
 *   ③ 代码级引用：rules.js 里【非注释行】出现过该 id（被动修正 / play_card 特例 / 独立 action）
 *   BASIC → 引擎通用（建设/发起陆战/…），视为已实装
 *   PRELUDE / ARMAMENT → 已知未实装（前奏卡 / 武备卡）
 *
 * 用法：node tools/_audit_implemented.js
 */
const fs = require('fs')
const path = require('path')
const ROOT = path.join(__dirname, '..')
const MOD = path.join(ROOT, 'server-official', 'public', 'quartermaster-sub-wars')
const cards = require(path.join(MOD, 'cards.js'))
const R = require(path.join(MOD, 'rules.js'))
const I = R._internal
const arr = Array.isArray(cards) ? cards : Object.values(cards)[0]
const raw = fs.readFileSync(path.join(MOD, 'rules.js'), 'utf8')
const lines = raw.split('\n')

/* ECON_CARDS：未导出，从源码块里取 key */
const econIds = new Set()
{
	const i = raw.indexOf('const ECON_CARDS = {')
	if (i >= 0) for (const m of raw.slice(i, i + 20000).matchAll(/'(\d{4,5})'\s*:/g)) econIds.add(m[1])
}
const reg = {
	EFFECT: new Set(Object.keys(I.ECHO_EFFECTS || {})),
	EVENT: new Set(Object.keys(I.EVENT_EFFECTS || {})),
	RESPONSE: new Set(Object.keys(I.RESPONSE_EFFECTS || {})),
	STATUS: new Set(Object.keys(I.STATUS_EFFECTS || {})),
	ECON: econIds,
}
const cmd = new Set(Object.keys(I.CMD_IMPL || {}))

/* 代码级引用：排除注释行（* 开头 / // 开头） */
const codeRef = new Map()
for (const ln of lines) {
	const t = ln.trim()
	if (t.startsWith('*') || t.startsWith('//') || t.startsWith('/*')) continue
	for (const m of ln.matchAll(/\b(1\d{4})\b/g)) codeRef.set(m[1], (codeRef.get(m[1]) || 0) + 1)
}

function how(c) {
	const t = String(c.type).toUpperCase()
	const id = String(c.id)
	if (t === 'BASIC') return 'basic'
	if (t === 'PRELUDE' || t === 'ARMAMENT') return null
	if (reg[t] && reg[t].has(id)) return 'registry'
	if (cmd.has(id)) return 'cmd'
	if (codeRef.get(id)) return 'code'
	return null
}
const done = c => !!how(c)

const NATIONS = ['英国', '德国', '日本', '苏联', '意大利', '美国']
const TYPES = ['BASIC', 'EFFECT', 'EVENT', 'ECON', 'RESPONSE', 'STATUS', 'PRELUDE', 'ARMAMENT']

const stat = {}
for (const n of NATIONS) stat[n] = { total: 0, ok: 0, miss: [], byType: {}, byHow: { registry: 0, cmd: 0, code: 0, basic: 0 } }
for (const c of arr) {
	const n = c.nation || '?'
	stat[n] = stat[n] || { total: 0, ok: 0, miss: [], byType: {}, byHow: { registry: 0, cmd: 0, code: 0, basic: 0 } }
	const t = String(c.type).toUpperCase()
	const b = stat[n]
	b.total++
	b.byType[t] = b.byType[t] || { total: 0, ok: 0 }
	b.byType[t].total++
	const h = how(c)
	if (h) { b.ok++; b.byType[t].ok++; b.byHow[h]++ }
	else b.miss.push({ id: c.id, name: c.name, type: t, deck: c.deck })
}

console.log('=== ① 逐国总览（共 ' + arr.length + ' 张）===')
console.log('国家     总数  已实装  未实装   覆盖率   其中(注册表/命令式/代码级/基础)')
for (const n of NATIONS) {
	const b = stat[n]
	console.log(n.padEnd(7, ' ') + String(b.total).padStart(4) + String(b.ok).padStart(7) +
		String(b.miss.length).padStart(7) + '   ' + String(Math.round(b.ok / b.total * 100) + '%').padStart(5) +
		'   ' + [b.byHow.registry, b.byHow.cmd, b.byHow.code, b.byHow.basic].join(' / '))
}

console.log('\n=== ② 国家 × 类型（已实装/总数）===')
console.log('国家        ' + TYPES.map(t => t.padStart(11, ' ')).join(''))
for (const n of NATIONS) {
	const b = stat[n]
	console.log(n.padEnd(8, ' ') + TYPES.map(t => (b.byType[t] ? (b.byType[t].ok + '/' + b.byType[t].total) : '-').padStart(11, ' ')).join(''))
}

console.log('\n=== ③ 未实装清单（按国家）===')
for (const n of NATIONS) {
	const b = stat[n]
	if (!b.miss.length) { console.log(n + '：无（全部实装）'); continue }
	const core = b.miss.filter(m => m.type !== 'PRELUDE' && m.type !== 'ARMAMENT')
	const pre = b.miss.filter(m => m.type === 'PRELUDE' || m.type === 'ARMAMENT')
	console.log(n + '：共 ' + b.miss.length + ' 张（前奏/武备 ' + pre.length + '，其它 ' + core.length + '）')
	for (const m of core) console.log('    ✗ ' + m.id + ' ' + m.name + '  [' + m.type + ' / ' + m.deck + ']')
	if (pre.length) {
		const byType = {}
		for (const m of pre) byType[m.type] = (byType[m.type] || 0) + 1
		console.log('    前奏/武备：' + Object.keys(byType).map(k => k + ' ' + byType[k]).join('、') +
			'（' + pre.slice(0, 3).map(m => m.name).join('、') + '…）')
	}
}

console.log('\n=== ④ SUPP 牌库专项（deck=SUPP，' + arr.filter(c => c.deck === 'SUPP').length + ' 张）===')
const supp = arr.filter(c => c.deck === 'SUPP')
for (const c of supp) console.log('  ' + (done(c) ? '✓' : '✗') + ' ' + c.id + ' ' + c.name +
	'  [' + c.type + ']  ' + c.nation + '  (' + (how(c) || '未实装') + ')')
console.log('SUPP 合计：已实装 ' + supp.filter(done).length + ' / ' + supp.length)

console.log('\n=== ⑤ 各牌库覆盖率 ===')
for (const dk of ['CORE', 'SUPP', 'PRELUDE', 'ARMAMENT']) {
	const list = arr.filter(c => c.deck === dk)
	const ok = list.filter(done).length
	console.log(dk.padEnd(9) + ' ' + String(ok + '/' + list.length).padStart(9) +
		'   ' + Math.round(ok / list.length * 100) + '%')
}

console.log('\n=== ⑥ 只靠"代码级引用"判定的卡（未进注册表/命令式表，建议人工确认）===')
const codeOnly = arr.filter(c => how(c) === 'code')
console.log('共 ' + codeOnly.length + ' 张：' + codeOnly.map(c => c.id + c.name).join('、'))
