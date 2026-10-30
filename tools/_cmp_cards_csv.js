"use strict"
/*
 * cards.js 与各国 CSV 的逐字段比对（复用 tools/gen_module_cards.js 的解析逻辑）。
 *
 * 用途：卡牌数据的【权威源】目前是 cards.js（见 rules.js 的实现反查结论），
 *       out/*_cards.csv 是早期 OCR 产物且已漂移 —— 直接跑生成器会把 CSV 里
 *       缺失的卡【删掉】。改卡面前先跑本脚本确认两边差异，避免误生成。
 * 用法：node tools/_cmp_cards_csv.js
 * 退出码：0 = 无差异（可安全重新生成）；非 0 = 存在差异
 */
const fs = require('fs')
const path = require('path')
const ROOT = path.join(__dirname, '..')

const SOURCES = [
	{ file: path.join(ROOT, 'out', 'uk_cards.csv'), nation: '英国' },
	{ file: path.join(ROOT, 'out', 'de_cards.csv'), nation: '德国' },
	{ file: path.join(ROOT, 'out', 'ja_cards.csv'), nation: '日本' },
	{ file: path.join(ROOT, 'out', 'su_cards.csv'), nation: '苏联' },
	{ file: path.join(ROOT, 'out', 'it_cards.csv'), nation: '意大利' },
	{ file: path.join(ROOT, 'out', 'us_cards.csv'), nation: '美国' },
]

function parseCardsCsv(file, nation) {
	const raw = fs.readFileSync(file, 'utf8').replace(/^\uFEFF/, '')
	const lines = raw.split(/\r?\n/).filter(l => l.trim())
	const out = []
	for (let i = 1; i < lines.length; i++) {
		const line = lines[i]
		const parts = line.split(',')
		if (parts.length < 10) continue
		const read = parts[parts.length - 1].trim()
		const img = parts[parts.length - 2].trim()
		const effect = parts.slice(8, parts.length - 2).join(',').trim()
		const deck = parts[0].trim()
		const card_id = parseInt(parts[1], 10)
		const name = parts[5].trim()
		const type = parts[6].trim()
		const opsRaw = parts[7].trim()
		if (!card_id || !name) continue
		out.push({
			id: card_id, deck, name, type,
			ops: opsRaw === '' ? null : parseInt(opsRaw, 10),
			text: effect, img: img.replace(/^.*\//, ''), nation,
		})
	}
	return out
}

const csv = SOURCES.flatMap(s => parseCardsCsv(s.file, s.nation))
const js = require(path.join(ROOT, 'server-official/public/quartermaster-sub-wars/cards.js'))
const CARDS = js.CARDS || js

console.log('CSV 共 ' + csv.length + ' 张 | cards.js 共 ' + CARDS.length + ' 张')
console.log('')

const csvById = new Map(csv.map(c => [c.id, c]))
const jsById = new Map(CARDS.map(c => [c.id, c]))

const onlyJs = CARDS.filter(c => !csvById.has(c.id)).sort((a, b) => a.id - b.id)
const onlyCsv = csv.filter(c => !jsById.has(c.id)).sort((a, b) => a.id - b.id)

console.log('=== A. 只在 cards.js（CSV 缺失，重新生成会丢）共 ' + onlyJs.length + ' 张 ===')
const byNation = {}
for (const c of onlyJs) (byNation[c.nation] = byNation[c.nation] || []).push(c)
for (const n in byNation) {
	console.log('  [' + n + '] ' + byNation[n].length + ' 张: ' +
		byNation[n].map(c => c.id + ' ' + c.name).join('、'))
}

console.log('')
console.log('=== B. 只在 CSV（cards.js 缺失）共 ' + onlyCsv.length + ' 张 ===')
const byNation2 = {}
for (const c of onlyCsv) (byNation2[c.nation] = byNation2[c.nation] || []).push(c)
for (const n in byNation2) {
	console.log('  [' + n + '] ' + byNation2[n].length + ' 张: ' +
		byNation2[n].map(c => c.id + ' ' + c.name).join('、'))
}

console.log('')
console.log('=== C. 两边都有但字段不同 共 ' + 0 + ' 张（下面逐项列出） ===')
const diffs = []
for (const c of csv) {
	const j = jsById.get(c.id)
	if (!j) continue
	const d = []
	if ((j.name || '') !== (c.name || '')) d.push('name: CSV「' + c.name + '」 vs JS「' + j.name + '」')
	if ((j.type || '') !== (c.type || '')) d.push('type: CSV「' + c.type + '」 vs JS「' + j.type + '」')
	if ((j.deck || '') !== (c.deck || '')) d.push('deck: CSV「' + c.deck + '」 vs JS「' + j.deck + '」')
	if ((j.nation || '') !== (c.nation || '')) d.push('nation: CSV「' + c.nation + '」 vs JS「' + j.nation + '」')
	if (String(j.ops == null ? '' : j.ops) !== String(c.ops == null ? '' : c.ops))
		d.push('ops: CSV「' + c.ops + '」 vs JS「' + j.ops + '」')
	if ((j.text || '') !== (c.text || '')) d.push('text')
	if ((j.img || '') !== (c.img || '')) d.push('img: CSV「' + c.img + '」 vs JS「' + j.img + '」')
	if (d.length) diffs.push({ id: c.id, name: c.name, nation: c.nation, d })
}
console.log('  合计 ' + diffs.length + ' 张')
for (const x of diffs) {
	console.log('  - ' + x.id + ' 《' + x.name + '》[' + x.nation + ']: ' + x.d.join(' ; '))
	if (x.d.includes('text')) {
		const c = csvById.get(x.id), j = jsById.get(x.id)
		console.log('      CSV text: ' + c.text)
		console.log('      JS  text: ' + j.text)
	}
}

const drift = onlyJs.length + onlyCsv.length + diffs.length
console.log('')
console.log('=== 结论 ===')
console.log(drift === 0
	? '  两边完全一致，可安全运行 tools/gen_module_cards.js 重新生成。'
	: '  存在差异 ' + drift + ' 处（缺卡 ' + (onlyJs.length + onlyCsv.length) +
		' 张 / 字段分歧 ' + diffs.length + ' 张）。\n' +
		'  ⚠ 此时直接重新生成会【丢掉】CSV 中缺失的 ' + onlyJs.length + ' 张卡。\n' +
		'  权威卡面数据以 cards.js 为准（rules.js 的实现与之一致）；\n' +
		'  若要改卡面，建议先把缺失/分歧的条目补回 CSV 再统一重新生成。')
process.exit(drift === 0 ? 0 : 1)
