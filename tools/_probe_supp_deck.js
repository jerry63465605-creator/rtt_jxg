/*
 * B27 前置探针：SUPP 入池前后的影响面（只读）
 *   ① 逐国 CORE / SUPP 张数（按 BASIC_CARD_COUNTS 复制后）
 *   ② 现有测试/代码里有没有写死牌堆张数
 *   ③ setup 后牌堆大小对照
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

const NATIONS = ['英国', '德国', '日本', '苏联', '意大利', '美国']
const g = R.setup(7)

console.log('=== ① 逐国 CORE / SUPP（含 BASIC 复制）===')
let totCore = 0, totSupp = 0
for (const n of NATIONS) {
	const mine = arr.filter(c => c.nation === n)
	const core = mine.filter(c => c.deck === 'CORE')
	const supp = mine.filter(c => c.deck === 'SUPP')
	/* CORE 里 BASIC 需按 BASIC_CARD_COUNTS 复制 */
	const counts = (I.BASIC_CARD_COUNTS && I.BASIC_CARD_COUNTS[n]) || {}
	let coreCards = 0
	for (const c of core) coreCards += (c.type === 'BASIC' ? (counts[c.name] || 1) : 1)
	totCore += coreCards; totSupp += supp.length
	const deckNow = (g.decks[n] || []).length
	const hand = (g.hands[n] || []).length
	console.log('  ' + n + '：CORE ' + core.length + ' 种 / ' + coreCards + ' 张｜SUPP ' + supp.length +
		' 张｜当前牌堆 ' + deckNow + ' + 手牌 ' + hand + ' = ' + (deckNow + hand))
}
console.log('  合计：CORE ' + totCore + ' 张，SUPP ' + totSupp + ' 张');
console.log('  → 入池后每国牌堆 +SUPP，六国总量 ' + (totCore + totSupp))

console.log('\n=== ② 测试里是否写死牌堆张数 ===')
const toolsDir = path.join(__dirname)
const hits = []
for (const f of fs.readdirSync(toolsDir)) {
	if (!f.endsWith('.js')) continue
	const s = fs.readFileSync(path.join(toolsDir, f), 'utf8')
	for (const m of s.matchAll(/(decks\[[^\]]+\][^\n]{0,40}length[^\n]{0,30}===?\s*(\d{2,3}))/g)) {
		hits.push(f + ': ' + m[1].slice(0, 70))
	}
	for (const m of s.matchAll(/(牌堆[^\n]{0,20}(===?|应为)\s*(\d{2,3}))/g)) {
		hits.push(f + ': ' + m[1].slice(0, 70))
	}
}
console.log(hits.length ? hits.slice(0, 12).join('\n') : '  （未发现写死牌堆张数的断言）')

console.log('\n=== ③ rules.js 里对 deck 字段的判定点 ===')
const src = fs.readFileSync(path.join(MOD, 'rules.js'), 'utf8').split('\n')
src.forEach((ln, i) => {
	if (/deck\s*[!=]==?\s*'CORE'|deck\s*[!=]==?\s*'SUPP'/.test(ln)) console.log('  L' + (i + 1) + ': ' + ln.trim().slice(0, 110))
})

console.log('\n=== ④ SUPP 里"能直接打出"的简单卡（用于真实抽牌验证）===')
for (const c of arr.filter(x => x.deck === 'SUPP')) {
	const cfg = (I.ECHO_EFFECTS || {})[String(c.id)] || (I.STATUS_EFFECTS || {})[String(c.id)] || (I.EVENT_EFFECTS || {})[String(c.id)]
	if (!cfg) continue
	console.log('  ' + c.id + ' ' + c.name + ' [' + c.type + '] armed=' +
		(cfg.armed ? cfg.armed.when : '-') + ' steps=' + (cfg.steps ? cfg.steps.map(s => s.op).join(',') : '-'))
}
