/*
 * B27：SUPP（增援）37 张正式入池
 *
 * A ★★ 六国「牌堆+手牌+桌面」包含本国全部 SUPP 卡（逐张断言，共 37 张）
 * B ★★ 每国总张数 = CORE（含 BASIC 复制）+ SUPP
 * C ★★ 整副牌抽空后 37 种 SUPP 全部能被摸到
 * D ★  BASIC 复制张数按 BASIC_CARD_COUNTS 不变
 * E ★  PRELUDE / ARMAMENT 仍不入池（不越界）
 * F ★  抽到的 SUPP 卡能正常打出
 * G  静态守卫 2 条
 *
 * 用法：node tools/_real_test_supp_in_deck.js
 */
const path = require('path')
const fs = require('fs')
const ROOT = path.join(__dirname, '..')
const MOD = path.join(ROOT, 'server-official', 'public', 'quartermaster-sub-wars')
const R = require(path.join(MOD, 'rules.js'))
const I = R._internal
const cards = require(path.join(MOD, 'cards.js'))
const arr = Array.isArray(cards.CARDS) ? cards.CARDS : Object.values(cards)[0]
const faceOf = x => String(x).split('#')[0]
const byId = {}
for (const c of arr) byId[String(c.id)] = c
const logSince = (g, n) => (g.log || []).slice(n).join(' | ')

let pass = 0, fail = 0
const ok = (m, c, extra) => { if (c) { pass++; console.log('  ✓ ' + m) } else { fail++; console.log('  ✗ ' + m + (extra ? '  | ' + extra : '')) } }

const NATIONS = ['英国', '德国', '日本', '苏联', '意大利', '美国']

/* BASIC_CARD_COUNTS 未导出，从源码解析 */
function basicCounts() {
	const src = fs.readFileSync(path.join(MOD, 'rules.js'), 'utf8')
	const i = src.indexOf('const BASIC_CARD_COUNTS')
	const seg = src.slice(i, i + 1200)
	const out = {}
	for (const m of seg.matchAll(/'([^']+)':\s*\{([^}]*)\}/g)) {
		const n = m[1], body = m[2]
		if (!/建设陆军|发起陆战/.test(body)) continue
		const o = {}
		for (const p of body.matchAll(/'([^']+)':\s*(\d+)/g)) o[p[1]] = Number(p[2])
		out[n] = o
	}
	return out
}
const BC = basicCounts()

const poolOf = (g, n) => new Set([
	...(g.decks[n] || []), ...(g.hands[n] || []), ...((g.table || {})[n] || []),
].map(faceOf))
const allOf = (g, n) => [
	...(g.decks[n] || []), ...(g.hands[n] || []), ...((g.table || {})[n] || []),
]

console.log('=== A. 各国 SUPP 是否全部入池 ===')
const g = R.setup(20261107)
let suppTotal = 0, suppIn = 0
const missing = []
for (const n of NATIONS) {
	const supp = arr.filter(c => c.nation === n && c.deck === 'SUPP')
	const pool = poolOf(g, n)
	const miss = supp.filter(c => !pool.has(String(c.id)))
	suppTotal += supp.length
	suppIn += supp.length - miss.length
	console.log('  ' + n + '：SUPP ' + supp.length + ' 张，入池 ' + (supp.length - miss.length))
	if (miss.length) missing.push(n + '：' + miss.map(c => c.id + c.name).join('、'))
}
ok('★★ 37 张 SUPP 全部入池', suppIn === suppTotal && suppTotal === 37, missing.join(' | ') || (suppIn + '/' + suppTotal))

console.log('\n=== B. 每国总张数 = CORE + SUPP ===')
{
	let allOk = true
	for (const n of NATIONS) {
		const counts = BC[n] || {}
		let expect = 0
		for (const c of arr.filter(x => x.nation === n)) {
			if (c.deck !== 'CORE' && c.deck !== 'SUPP') continue
			expect += (c.type === 'BASIC' ? (counts[c.name] || 1) : 1)
		}
		const got = allOf(g, n).length
		console.log('  ' + n + '：期望 ' + expect + ' / 实际 ' + got +
			'（CORE 基础 ' + Object.keys(counts).length + ' 种基本卡）')
		if (got !== expect) allOk = false
	}
	ok('★★ 六国张数与 CORE+SUPP 计算一致', allOk)
}

console.log('\n=== C. 整副牌抽空：37 种 SUPP 全能摸到 ===')
{
	const g2 = R.setup(20261107)
	const seen = new Set()
	for (const n of NATIONS) for (const x of allOf(g2, n)) seen.add(faceOf(x))
	const suppSeen = [...seen].filter(f => (byId[f] || {}).deck === 'SUPP')
	console.log('  出现的 SUPP 牌面 ' + suppSeen.length + ' 种')
	ok('★★ 37 种 SUPP 全在牌池里', suppSeen.length === 37, suppSeen.length)
}

console.log('\n=== D. BASIC 复制张数未变 ===')
{
	let allOk = true
	for (const n of NATIONS) {
		const counts = BC[n] || {}
		const all = allOf(g, n).map(faceOf)
		for (const b of arr.filter(c => c.nation === n && c.type === 'BASIC')) {
			const want = counts[b.name] || 1
			const got = all.filter(x => x === String(b.id)).length
			if (got !== want) { allOk = false; console.log('  ✗ ' + n + ' ' + b.name + '：期望 ' + want + ' 实际 ' + got) }
		}
	}
	ok('★ 基本卡张数与 BASIC_CARD_COUNTS 完全一致', allOk)
}

console.log('\n=== E. PRELUDE / ARMAMENT 仍不入池 ===')
{
	const leaked = []
	for (const n of NATIONS) for (const f of poolOf(g, n)) {
		const dk = (byId[f] || {}).deck
		if (dk === 'PRELUDE' || dk === 'ARMAMENT') leaked.push(n + ':' + f)
	}
	ok('★ 前奏/武备没有误入池', leaked.length === 0, leaked.slice(0, 5).join(','))
}

console.log('\n=== F. 抽到的 SUPP 卡能正常打出 ===')
{
	const g3 = R.setup(20261107)
	R.action(g3, 'Axis', 'debug_set_phase', { nation: '德国', phase: 'play' })
	R.action(g3, 'Axis', 'debug_add_card', { face: '14503', nation: '德国', dest: 'hand' })
	I.refresh(g3)
	const inst = (g3.hands['德国'] || []).find(x => faceOf(x) === '14503')
	const n0 = (g3.log || []).length
	if (inst) R.action(g3, 'Axis', 'play_card', { card: inst })
	I.refresh(g3)
	const lg = logSince(g3, n0)
	console.log('  log = ' + (lg || '(无)').slice(0, 160))
	ok('★ 无"手中没有这张牌"', !/手中没有这张牌/.test(lg), lg.slice(0, 120))
	ok('★ 打出后有正常日志', /提尔比茨/.test(lg), lg.slice(0, 120))
}

console.log('\n=== G. 静态守卫 ===')
{
	const src = fs.readFileSync(path.join(MOD, 'rules.js'), 'utf8')
	ok("入池判定允许 CORE 与 SUPP", /c\.deck !== 'CORE' && c\.deck !== 'SUPP'/.test(src))
	ok('不再是一律排除非 CORE 的旧写法', !/if \(c\.deck !== 'CORE'\) continue/.test(src))
}

console.log('\n' + (fail === 0 ? 'ALL PASS（' + pass + ' 项）' : fail + ' FAIL / ' + pass + ' 项'))
process.exitCode = fail ? 1 : 0
