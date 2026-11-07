/* 对比军需官 v0.4 的几张"疑似新卡"与我方候选卡的卡面文本，判断是改名还是真新增 */
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
	.map(r => ({ name: (r.B || '').trim(), nation: (r.C || '').trim(), type: (r.D || '').trim(), cond: (r.E || '').trim(), text: (r.F || '').trim() }))

const cards = require(path.join(MOD, 'cards.js')).CARDS
const ours = (nation, name) => cards.filter(c => c.nation === nation && String(c.name).indexOf(name) >= 0)

const TARGET = ['专员辖区', '大英帝国殖民地', '殖民地建设', '云量', '敌后游击战', '西北方面军']
for (const t of TARGET) {
	const j = junxu.find(x => x.name === t)
	console.log('\n================ ' + (j ? j.nation + ' · ' + j.name + ' [' + j.type + ']' : t) + ' ================')
	if (j) {
		console.log('条件：' + (j.cond || '—'))
		console.log('效果：' + (j.text || '—'))
	}
	/* 我方候选：同国 + 关键片段 */
	const kws = t === '专员辖区' ? ['丰富的资源', '资源']
		: t === '大英帝国殖民地' ? ['殖民']
			: t === '殖民地建设' ? ['殖民']
				: t === '云量' ? ['云雾']
					: t === '敌后游击战' ? ['敌后']
						: ['方面军']
	for (const k of kws) {
		for (const c of ours(j ? j.nation : '', k)) {
			console.log('  我方 ' + c.id + '《' + c.name + '》[' + String(c.type).toUpperCase() + ']')
			console.log('      条件：' + String(c.trigger_text || c.cond_text || '—').slice(0, 80))
			console.log('      效果：' + String(c.text || '').replace(/\s+/g, ' ').slice(0, 200))
		}
	}
}
