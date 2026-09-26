/*
 * 8 张增强卡（EFFECT）核对：
 *   ① 图标签名（像素分析，可靠）
 *   ② 当前卡面文本 + 逻辑疑点分析（不依赖"看图"，只做规则矛盾检查）
 */
const path = require('path')
const fs = require('fs')
const MOD = path.join(__dirname, '..', 'server-official', 'public', 'quartermaster-sub-wars')
const C = require(path.join(MOD, 'cards.js'))
const d = require(path.join(MOD, 'data.js')).data

const arr = C.CARDS || []
const echoes = arr.filter(c => c.type === 'EFFECT')
	.sort((a, b) => String(a.id).localeCompare(String(b.id)))

/* ---- ① 图标签名 ---- */
const txt = fs.readFileSync(path.join(__dirname, '..', 'out', 'icons.txt'), 'utf8')
const grids = {}
let cur = null
for (const raw of txt.split(/\r?\n/)) {
	const m = /^==\s+(\S+\.png)\s+\(/.exec(raw)
	if (m) { cur = m[1]; grids[cur] = []; continue }
	if (cur && /^\s+[.#+\-]{6}$/.test(raw)) grids[cur].push(raw.trim())
	if (cur && grids[cur].length >= 8) cur = null
}
function sig(rows) {
	const r = rows.slice()
	while (r.length && /^\.+$/.test(r[0])) r.shift()
	while (r.length && /^\.+$/.test(r[r.length - 1])) r.pop()
	return r.join('/')
}

/* 已知签名库（依据 docs/card-icons.md + 54 张实测聚类） */
const KNOWN = {
	'...+../..+#+./.+###-/.-.#--/...#../...#..': '↑ 增强 ECHO',
	'...+../..+#+./.+###-/.--#--/...#../...#..': '↑ 增强 ECHO',
	'...+../...#../...#../...#../....../...#..': '! 事件 EVENT',
	'...+../...#../...#../...#../....../-+.#.+/+#+.##': '! 事件 EVENT',
	'..-+-./..#-#./..-.#./...#-./...+../...+../...-..': '? 响应 RESPONSE',
}

console.log('=== ① 图标（像素分析，可靠） ===')
for (const c of echoes) {
	const img = path.basename(c.img || '')
	const g = grids[img]
	const s = g ? sig(g) : '(缺)'
	const label = KNOWN[s] || (/^\.\.\+\.\.\/\.\.\+#\+\./.test(s) ? '↑? 疑似增强' : '未知')
	console.log('  ' + c.id + ' ' + c.name.padEnd(12) + ' img=' + img.padEnd(22) + ' -> ' + label)
	if (!KNOWN[s]) console.log('        sig=' + s)
}

/* ---- ② 文本 + 逻辑疑点 ---- */
console.log('\n=== ② 当前卡面文本（来自 cards.js，OCR 结果，可能有误） ===')

/*
 * 逻辑疑点检查：只做【规则层面的自洽性】分析，不声称"看到了图"。
 * 检查项：
 *   a) 地区名是否存在于地图
 *   b) 军种与地形是否矛盾（海军必须海域、陆军必须陆地）
 *   c) 是否出现重复/不通顺表述
 */
function checkText(c) {
	const t = c.text || ''
	const issues = []

	/* a) 卡面 <地区> 是否存在 */
	const places = [...t.matchAll(/<([^>]+)>/g)].map(m => m[1])
	for (const p of places) {
		if (d.id_of(p) == null) {
			/* 走别名表再查一次 */
			const R = require(path.join(MOD, 'rules.js'))
			if (R._internal.space_id_of(p) == null)
				issues.push('地区<' + p + '>在地图上不存在')
		}
	}

	/* b) 军种 vs 地形 */
	if (/建设|征召/.test(t) && /海军/.test(t)) {
		/* 海军需海域：若所有<地区>都是陆地 -> 矛盾 */
		const allLand = places.length > 0 && places.every(p => {
			const id = d.id_of(p)
			return id != null && d.spaces[id].terrain === 'land'
		})
		if (allLand) issues.push('海军只能建海域，但列出的地区全是陆地')
	}
	if (/建设|征召/.test(t) && /陆军/.test(t)) {
		const allSea = places.length > 0 && places.every(p => {
			const id = d.id_of(p)
			return id != null && d.spaces[id].terrain === 'sea'
		})
		if (allSea) issues.push('陆军只能建陆地，但列出的地区全是海域')
	}

	/* c) 明显不通顺：连续重复或缺少宾语 */
	if (/国家在<[^>]+>本国/.test(t)) issues.push('表述不通顺："国家在<X>本国..."疑为 OCR 错误')
	return issues
}

for (const c of echoes) {
	console.log('\n  [' + c.id + '] ' + c.name + '  (deck=' + c.deck + ', ops=' + c.ops + ')')
	console.log('      TEXT: ' + c.text)
	const iss = checkText(c)
	if (iss.length) {
		iss.forEach(x => console.log('      ⚠ 疑点: ' + x))
	} else {
		console.log('      （逻辑自检通过，但 OCR 文字本身可能有误，需你核对卡图）')
	}
}

/* ---- ③ 对照：RESPONSE 卡的表述（供参考格式） ---- */
console.log('\n=== ③ 参考：同类保护效果的表述（RESPONSE） ===')
arr.filter(c => c.type === 'RESPONSE').slice(0, 4).forEach(c => {
	console.log('  ' + c.id + ' ' + c.name + ': ' + c.text)
})
