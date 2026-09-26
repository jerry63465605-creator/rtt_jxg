/*
 * 对比两个存档里 deck key "153" 的定义（FaceURL / NumWidth / NumHeight / DeckIDs），
 * 并弄清 cards_review.csv 的 row/col 是怎么算的：
 *   - 若 index = DeckIDs 位置（pos），15338 -> pos 57 -> r5c7
 *   - 若 index = CardID % 100，        15338 -> 38      -> r3c8
 *   - 模块/CSV 实测 15338 = r4c3（用户已验图正确）
 * 把两条链都对一遍，找出真实映射规则。
 */
const fs = require('fs')

const FILES = [
	['A:2261258890', 'C:/Users/24968/Documents/My Games/Tabletop Simulator/Mods/Workshop/2261258890.json'],
	['B:3763225217', 'C:/Users/24968/Documents/My Games/Tabletop Simulator/Mods/Workshop/3763225217.json'],
]

for (const [tag, f] of FILES) {
	console.log('\n================ ' + tag + ' ================')
	let root
	try { root = JSON.parse(fs.readFileSync(f, 'utf8')) } catch (e) { console.log('parse fail: ' + e.message); continue }

	function walk(o, p, cb) {
		if (!o || typeof o !== 'object') return
		cb(o, p)
		if (Array.isArray(o)) o.forEach((v, i) => walk(v, p + '[' + i + ']', cb))
		else for (const k of Object.keys(o)) walk(o[k], p + '.' + k, cb)
	}

	walk(root, '', (o, p) => {
		if (o && o.CustomDeck && o.CustomDeck['153']) {
			const cd = o.CustomDeck['153']
			console.log('Deck @ ' + p)
			console.log('  Name/NIck : ' + (o.Name || '') + ' / ' + (o.Nickname || ''))
			console.log('  Grid      : ' + cd.NumWidth + 'x' + cd.NumHeight)
			console.log('  FaceURL   : ' + String(cd.FaceURL).slice(0, 140))
			console.log('  DeckIDs len: ' + (o.DeckIDs || []).length)
			/* DeckIDs 位置索引：打印 15300-15352 每个 CardID 首次出现的位置 */
			const seen = {}
			;(o.DeckIDs || []).forEach((id, i) => {
				if (id >= 15300 && id < 15400 && seen[id] === undefined) seen[id] = i
			})
			for (const id of Object.keys(seen).map(Number).sort((a, b) => a - b)) {
				const pos = seen[id]
				console.log(`    CardID ${id}: firstPos=${pos} -> pos-map r${Math.floor(pos / cd.NumWidth)}c${pos % cd.NumWidth}` +
					` | id-map r${Math.floor((id - 15300) / cd.NumWidth)}c${(id - 15300) % cd.NumWidth}` +
					` | mod100-map r${Math.floor((id % 100) / cd.NumWidth)}c${(id % 100) % cd.NumWidth}`)
			}
		}
	})
}
console.log('\nDONE')
