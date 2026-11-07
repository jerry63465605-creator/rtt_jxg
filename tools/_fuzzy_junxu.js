/*
 * 对"仅军需官有"的卡做模糊匹配：判断到底是【真新卡】还是【OCR/名称差异】
 * 判据：同国家内做编辑距离 + 子串包含，取最相似的我方卡名
 */
const fs = require('fs')
const path = require('path')
const ROOT = path.join(__dirname, '..')
const MOD = path.join(ROOT, 'server-official', 'public', 'quartermaster-sub-wars')
const X = path.join(ROOT, 'tmp', 'junxu_xlsx')
const unesc = s => s.replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"')
	.replace(/&apos;/g, "'").replace(/&amp;/g, '&')

const ss = fs.readFileSync(path.join(X, 'xl', 'sharedStrings.xml'), 'utf8')
const shared = [...ss.matchAll(/<si>([\s\S]*?)<\/si>/g)].map(m =>
	unesc([...m[1].matchAll(/<t[^>]*>([\s\S]*?)<\/t>/g)].map(t => t[1]).join('')))

function rows(file) {
	const xml = fs.readFileSync(file, 'utf8')
	return [...xml.matchAll(/<row[^>]*>([\s\S]*?)<\/row>/g)].map(rm => {
		const o = {}
		for (const cm of rm[1].matchAll(/<c r="([A-Z]+)\d+"([^>]*)>([\s\S]*?)<\/c>/g)) {
			const v = (cm[3].match(/<v>([\s\S]*?)<\/v>/) || [])[1]
			const inline = (cm[3].match(/<is>[\s\S]*?<t[^>]*>([\s\S]*?)<\/t>/) || [])[1]
			o[cm[1]] = /t="s"/.test(cm[2]) && v != null ? shared[Number(v)] : (inline != null ? unesc(inline) : (v != null ? unesc(v) : ''))
		}
		return o
	})
}

const junxu = rows(path.join(X, 'xl', 'worksheets', 'sheet1.xml')).slice(1)
	.filter(r => (r.B || '').trim())
	.map(r => ({ name: (r.B || '').trim(), nation: (r.C || '').trim(), type: (r.D || '').trim(), qty: Number(r.H || 0), text: (r.F || '').trim() }))

const cards = require(path.join(MOD, 'cards.js'))
const arr = Array.isArray(cards.CARDS) ? cards.CARDS : Object.values(cards)[0]
const TYPE_ZH = { BASIC: '基本', EVENT: '事件', STATUS: '状态', EFFECT: '增强', ECON: '经济战', PRELUDE: '历史', ARMAMENT: '军备', RESPONSE: '响应' }
const ours = arr.map(c => ({ id: String(c.id), name: c.name, nation: c.nation, type: TYPE_ZH[String(c.type).toUpperCase()] || c.type }))

const NORM = s => String(s || '').replace(/[★☆*＊\s·・:：!！?",，。()（）\[\]【】\-—]/g, '')
const oursKey = new Set(ours.map(o => NORM(o.nation) + '|' + NORM(o.name)))
const onlyJunxu = junxu.filter(o => !oursKey.has(NORM(o.nation) + '|' + NORM(o.name)))

function lev(a, b) {
	const m = a.length, n = b.length
	const dp = Array.from({ length: m + 1 }, (_, i) => [i, ...Array(n).fill(0)])
	for (let j = 0; j <= n; j++) dp[0][j] = j
	for (let i = 1; i <= m; i++) for (let j = 1; j <= n; j++)
		dp[i][j] = Math.min(dp[i - 1][j] + 1, dp[i][j - 1] + 1,
			dp[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1))
	return dp[m][n]
}
function best(name, nation) {
	const pool = ours.filter(o => o.nation === nation)
	let bp = null, bd = 1e9
	for (const o of pool) {
		const a = NORM(name), b = NORM(o.name)
		let d = lev(a, b)
		if (b.indexOf(a) >= 0 || a.indexOf(b) >= 0) d = Math.min(d, 1)   /* 子串 = 极可能同名变体 */
		if (d < bd) { bd = d; bp = o }
	}
	return { card: bp, dist: bd }
}

const ORDER = ['状态', '增强', '响应', '事件', '历史', '军备', '经济战', '基本']
onlyJunxu.sort((x, y) => ORDER.indexOf(x.type) - ORDER.indexOf(y.type))
console.log('=== 仅军需官有的 ' + onlyJunxu.length + ' 种：逐条判定 ===')
let realNew = 0
for (const o of onlyJunxu) {
	const { card, dist } = best(o.name, o.nation)
	const verdict = !card ? '无同国卡' : (dist <= 1 ? '★ 名称/OCR 变体' : (dist <= 3 ? '? 疑似变体' : '真新卡'))
	if (verdict === '真新卡') realNew++
	console.log(('[' + o.type + '] ' + o.nation + ' · ' + o.name).padEnd(34, ' ') +
		' → ' + (card ? card.name + '(' + card.id + ', d=' + dist + ')' : '—').padEnd(30, ' ') + '  ' + verdict)
}
console.log('\n判定为"真新卡"的数量 = ' + realNew)
