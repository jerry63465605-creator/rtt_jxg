/*
 * 从 TTS Workshop 存档中定位 deck 15349（奇袭塔兰托）的真实卡面图。
 *
 * 背景：cards_review.csv 把 15349 的 face 指到了 sheet153 主图（错误关联，
 * 那张图上 r4c8 是 15343、r5c4 起全空白）。奇袭塔兰托的真图要从
 * TTS 存档 ObjectStates -> CustomDeck["15349"].FaceURL 里找。
 *
 * 输出：每个含 "15349" 的存档中，
 *   1) CustomDeck["15349"] 的 FaceURL/BackURL/NumWidth/NumHeight
 *   2) ContainedObjects 里 CardID 以 15349 开头的卡（Nickname / CardID）
 */
const fs = require('fs')
const path = require('path')

const DIRS = [
	'C:/Users/24968/Documents/My Games/Tabletop Simulator/Mods/Workshop',
]
const HITS = [
	'2261258890.json',
	'3763225217.json',
	'_______1.6____ by___.json _______1.6____ by___.json',
]

function walk(obj, fn, pathStr) {
	if (fn(obj, pathStr || '') === false) return
	if (Array.isArray(obj)) {
		obj.forEach((v, i) => walk(v, fn, (pathStr || '') + '[' + i + ']'))
	} else if (obj && typeof obj === 'object') {
		for (const k of Object.keys(obj)) walk(obj[k], fn, (pathStr || '') + '.' + k)
	}
}

for (const dir of DIRS) {
	for (const name of HITS) {
		const f = path.join(dir, name)
		if (!fs.existsSync(f)) { console.log('MISSING: ' + f); continue }
		const raw = fs.readFileSync(f, 'utf8')
		let root
		try { root = JSON.parse(raw) } catch (e) {
			console.log('PARSE FAIL: ' + name + ' -> ' + e.message)
			continue
		}
		console.log('\n==================================================')
		console.log('SAVE: ' + name)
		walk(root, (o, p) => {
			if (!o || typeof o !== 'object' || Array.isArray(o)) return true
			if (o.CustomDeck && o.CustomDeck['15349']) {
				const cd = o.CustomDeck['15349']
				console.log('  CustomDeck[15349] @ ' + p)
				console.log('    Name      : ' + (o.Name || ''))
				console.log('    Nickname  : ' + (o.Nickname || ''))
				console.log('    NumWidth  : ' + cd.NumWidth + '  NumHeight: ' + cd.NumHeight)
				console.log('    FaceURL   : ' + cd.FaceURL)
				console.log('    BackURL   : ' + cd.BackURL)
				console.log('    Type      : ' + (cd.Type || 0))
			}
			if (o.CardID !== undefined && String(o.CardID).startsWith('15349')) {
				console.log('  CARD CardID=' + o.CardID +
					'  Nickname="' + (o.Nickname || '') + '"' +
					'  Description="' + String(o.Description || '').slice(0, 80) + '"' +
					'  @ ' + p)
			}
			return true
		})
	}
}
console.log('\nDONE')
