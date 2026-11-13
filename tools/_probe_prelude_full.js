/*
 * 【P1】前奏/军备卡词条穷举（只读探针，与编译层同源）
 *
 * 扫全部 125 张 PRELUDE/ARMAMENT 卡面文本，用 prelude_compiler.parse_text 解析
 * （不再自己实现括号栈，避免与编译层漂移），产出：
 *   · 方括号词条 / 动作片段 归一去重表
 *   · 已登记模式 / 切分噪声 / 待补模式 三段（P2 逐卡编译的依据）
 *   · 四类 carrier 粗分 + 逐卡明细
 * 结果落 out/prelude_tokens.txt。不修改任何产品代码。
 * 用法：node tools/_probe_prelude_full.js
 */
const path = require('path')
const fs = require('fs')
const ROOT = path.join(__dirname, '..')
const MOD = path.join(ROOT, 'server-official', 'public', 'quartermaster-sub-wars')
const cards = require(path.join(MOD, 'cards.js'))
const P = require(path.join(MOD, 'prelude_compiler.js'))

const all = cards.CARDS.filter(c =>
	c.deck === 'PRELUDE' || c.deck === 'ARMAMENT' ||
	c.type === 'PRELUDE' || c.type === 'ARMAMENT')

const add = (map, k) => map.set(k, (map.get(k) || 0) + 1)
const sorted = map => [...map.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
const ruleOf = raw => P.PRELUDE_TOKENS.find(r => r.re.test(raw)) || null

const tok = new Map(), act = new Map()
const registered = new Map(), noise = new Map(), pending = new Map()
const pendingSample = new Map()
const byCard = []
/* 【P2】按段统计：段数分布 / A/B/C 三类 / 一次性 vs 持续生效 */
const segCount = new Map(), segKind = new Map(), segMode = new Map()
let rawTotal = 0, rawHit = 0, rawNoise = 0

for (const c of all) {
	const text = c.text || ''
	const tokens = P.parse_text(text)
	for (const t of tokens) {
		add(t.bracket ? tok : act, P.normalize(t.raw))
		rawTotal++
		const rule = ruleOf(t.raw)
		if (rule) {
			rawHit++
			add(registered, rule.id + ' [' + (t.bracket ? '词条' : '动作') + ']')
		} else if (P.is_noise(t.raw)) {
			rawNoise++
			add(noise, P.normalize(t.raw))
		} else {
			const nk = P.normalize(t.raw)
			add(pending, nk)
			if (!pendingSample.has(nk)) pendingSample.set(nk, t.raw)
		}
	}
	/* 段数与 A/B/C 分类直接取编译层结果，不再自己按 tags 粗猜 */
	const span = tokens.length ? Math.max(...tokens.map(t => t.seg || 0)) + 1 : 0
	add(segCount, span)
	const probe = {
		id: 90000, nation: c.nation, deck: c.deck || 'PRELUDE',
		type: c.type || 'PRELUDE', name: c.name, text,
	}
	const ir = P.compile(probe)
	for (const s of (ir.config.segments || [])) {
		add(segKind, s.kind)
		add(segMode, s.effectMode)
	}
	byCard.push({ id: c.id, name: c.name, carrier: ir.carrier,
		segments: (ir.config.segments || []).length, deck: c.deck, type: c.type })
}

const realTotal = rawTotal - rawNoise
const lines = []
lines.push('# 前奏/军备卡词条穷举（P1 只读探针，解析与 prelude_compiler 同源）')
lines.push('# 卡总数 ' + all.length + '（deck=PRELUDE ' + all.filter(c => c.deck === 'PRELUDE').length +
	' / deck=ARMAMENT ' + all.filter(c => c.deck === 'ARMAMENT').length + '）')
lines.push('# 归一化：国家名→{nation}、<地区>、数字→N')
lines.push('# 覆盖率：真实片段 ' + rawHit + '/' + realTotal +
	'（排除噪声 ' + rawNoise + '）' + '；待补 ' + pending.size + ' 类')
lines.push('')
lines.push('=== 方括号词条（归一后 ' + tok.size + ' 类）===')
for (const [k, n] of sorted(tok)) lines.push(String(n).padStart(4) + '  ' + k)
lines.push('')
lines.push('=== 动作片段（归一后 ' + act.size + ' 类）===')
for (const [k, n] of sorted(act)) lines.push(String(n).padStart(4) + '  ' + k)
lines.push('')
lines.push('=== 已登记模式（按 rule.id 聚合 ' + registered.size + ' 项）===')
for (const [k, n] of sorted(registered)) lines.push(String(n).padStart(4) + '  ' + k)
lines.push('')
lines.push('=== 切分噪声（已登记 NOISE_PATTERNS，' + noise.size + ' 类 / ' + rawNoise + ' 次）===')
for (const [k, n] of sorted(noise)) lines.push(String(n).padStart(4) + '  ' + k)
lines.push('')
lines.push('=== 待补模式（' + pending.size + ' 类，P2 逐卡编译时补）===')
for (const [k, n] of sorted(pending))
	lines.push(String(n).padStart(4) + '  ' + k + '    // 例: ' + pendingSample.get(k))
lines.push('')
lines.push('=== 按段统计（P2 口径：A mandatory / B optional / C opponentOptOut）===')
lines.push('# 每卡段数分布')
for (const [k, n] of sorted(segCount)) lines.push(String(n).padStart(4) + '  ' + k + ' 段')
lines.push('# 段类别')
for (const [k, n] of sorted(segKind)) lines.push(String(n).padStart(4) + '  ' + k)
lines.push('# 段生效方式（once 一次性 / ongoing 持续，6601 范式）')
for (const [k, n] of sorted(segMode)) lines.push(String(n).padStart(4) + '  ' + k)
lines.push('')
lines.push('=== carrier 粗分（与编译层同源）===')
const cc = new Map()
for (const b of byCard) add(cc, b.carrier)
for (const [k, n] of sorted(cc)) lines.push(String(n).padStart(4) + '  ' + k)
lines.push('')
lines.push('=== 逐卡明细（carrier / 段数）===')
for (const b of byCard)
	lines.push([b.id, b.carrier, b.segments, b.deck, b.type, b.name].join('\t'))

const outFile = path.join(ROOT, 'out', 'prelude_tokens.txt')
fs.writeFileSync(outFile, lines.join('\r\n') + '\r\n', 'utf8')
console.log('卡总数 ' + all.length + '；方括号词条 ' + tok.size + ' 类；动作片段 ' + act.size + ' 类')
console.log('覆盖率：真实片段 ' + rawHit + '/' + realTotal +
	' = ' + (realTotal ? (rawHit / realTotal * 100).toFixed(1) : '0') +
	'%；噪声 ' + rawNoise + '；待补 ' + pending.size + ' 类')
console.log('段类别: ' + [...segKind.entries()].map(([k, n]) => k + '=' + n).join('  ') +
	'；生效方式: ' + [...segMode.entries()].map(([k, n]) => k + '=' + n).join('  '))
console.log('段数分布: ' + [...segCount.entries()].sort((a, b) => a[0] - b[0])
	.map(([k, n]) => k + '段=' + n + '卡').join('  '))
console.log('carrier: ' + [...cc.entries()].map(([k, n]) => k + '=' + n).join('  '))
console.log('已写出 ' + outFile)
if (pending.size) {
	console.log('\n=== 待补模式 ===')
	for (const [k, n] of sorted(pending)) console.log(String(n).padStart(4) + '  ' + k + '   // ' + pendingSample.get(k))
}
