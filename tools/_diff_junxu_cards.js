/* 军需官卡表 v0.4 vs 本仓库 cards.js：按「国家+卡名」对比 */
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
	.map(r => ({ name: (r.B || '').trim(), nation: (r.C || '').trim(), type: (r.D || '').trim(), qty: Number(r.H || 0) }))

const cards = require(path.join(MOD, 'cards.js'))
const arr = Array.isArray(cards.CARDS) ? cards.CARDS : Object.values(cards)[0]
const TYPE_ZH = { BASIC: '基本', EVENT: '事件', STATUS: '状态', EFFECT: '增强', ECON: '经济战', PRELUDE: '历史', ARMAMENT: '军备', RESPONSE: '响应' }
const ours = arr.map(c => ({ id: String(c.id), name: c.name, nation: c.nation, type: TYPE_ZH[String(c.type).toUpperCase()] || c.type, deck: c.deck }))

const NORM = s => String(s || '').replace(/[★☆*＊\s·・:：!！?",，。()（）\[\]【】\-—]/g, '')
const key = o => NORM(o.nation) + '|' + NORM(o.name)
const oursKey = new Set(ours.map(key))
const junxuKey = new Set(junxu.map(key))

const onlyJunxu = junxu.filter(o => !oursKey.has(key(o)))
const onlyOurs = ours.filter(o => !junxuKey.has(key(o)))

console.log('=== 规模对比 ===')
console.log('军需官卡表 v0.4：' + junxu.length + ' 种（' + junxu.reduce((a, b) => a + (b.qty || 0), 0) + ' 张）')
console.log('本仓库 cards.js：' + ours.length + ' 种')
console.log('按「国家+卡名」精确匹配：共同 ' + (junxu.length - onlyJunxu.length) + ' 种；'
	+ '仅军需官有 ' + onlyJunxu.length + ' 种；仅我方有 ' + onlyOurs.length + ' 种')

const byType = {}
for (const o of onlyJunxu) byType[o.type] = (byType[o.type] || 0) + 1
console.log('\n仅军需官有的，按类型：' + JSON.stringify(byType))

for (const t of Object.keys(byType)) {
	console.log('\n--- ' + t + '（' + byType[t] + '）---')
	for (const o of onlyJunxu.filter(x => x.type === t))
		console.log('  ' + o.nation + ' · ' + o.name + '（×' + (o.qty || 0) + '）')
}

const byTypeOurs = {}
for (const o of onlyOurs) byTypeOurs[o.type] = (byTypeOurs[o.type] || 0) + 1
console.log('\n仅我方有的，按类型：' + JSON.stringify(byTypeOurs))
for (const t of Object.keys(byTypeOurs)) {
	console.log('\n--- 仅我方 ' + t + '（' + byTypeOurs[t] + '）---')
	console.log('  ' + onlyOurs.filter(x => x.type === t).map(x => x.nation + '·' + x.name).join('、'))
}
