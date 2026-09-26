/*
 * 分国独立计分回归（2026-09-26）
 *
 * 玩家口径：
 *   · 法国大本营（西欧）被占 -> 不影响英国计分
 *   · 不列颠被占             -> 不影响法国计分
 *   · 法国/中国的分最终加到代表国（英国/美国）所属阵营
 *
 * 用法：node tools/_smoke_homebase.js
 */
const path = require('path')
const MOD = path.resolve('server-official/public/quartermaster-sub-wars')
const rules = require(path.join(MOD, 'rules.js'))
const I = rules._internal
const d = require(path.join(MOD, 'data.js')).data

let pass = 0, fail = 0
function ok(label, cond, extra) {
	console.log((cond ? '  PASS  ' : '  FAIL  ') + label + (extra ? '  | ' + extra : ''))
	cond ? pass++ : fail++
}

function put(g, id, nation, type, spaceName) {
	g.location[id] = d.id_of(spaceName)
	g.piece_nation[id] = nation
	g.piece_type[id] = type
}

/* 跑某个国家的计分阶段，返回 {results, total, scoreDelta} */
function score(g, nation) {
	const before = g.score[faction(nation)]
	I.phase_scoring(g, nation)
	const after = g.score[faction(nation)]
	const res = (g.last_scoring && g.last_scoring.results) || []
	return {
		results: res,
		total: g.last_scoring ? g.last_scoring.gross : 0,
		delta: after - before,
		of: n => (res.find(x => x.nation === n) || {}),
		note: g.phase_note || '',
	}
}
function faction(n) { return I.faction_of_nation ? I.faction_of_nation(n) : 'ALLIES' }

console.log('=== 分国独立计分 ===')
console.log('HOME_SPACE: 英国=' + I.HOME_SPACE['英国'] +
	' 法国=' + I.HOME_SPACE['法国'] +
	' 美国=' + I.HOME_SPACE['美国'] +
	' 中国=' + I.HOME_SPACE['中国'])
console.log('bloc(英国)=' + JSON.stringify(I.delegated_to('英国')) +
	'  bloc(美国)=' + JSON.stringify(I.delegated_to('美国')))

/* 放子：英国占澳大利亚(+2)、法国占印度(+2) */
function seed(g) {
	put(g, 'uk_oz', '英国', 'army', '澳大利亚')
	put(g, 'fr_in', '法国', 'army', '印度')
	return g
}

/* ① 基线：无人占大本营 -> 英法都计分 */
let g = seed(rules.setup(1))
let r = score(g, '英国')
ok('① 基线：英国计分（英+法都算）',
	r.of('英国').gained > 0 && r.of('法国').gained > 0,
	'英+' + r.of('英国').gained + ' 法+' + r.of('法国').gained + ' total=' + r.total)

/* ② 法国大本营（西欧）被占 -> 英国照常，法国跳过 */
g = seed(rules.setup(1))
put(g, 'ger_weu', '德国', 'army', '西欧')
r = score(g, '英国')
ok('② 法国大本营被占：英国【照常计分】', r.of('英国').gained > 0,
	'英+' + r.of('英国').gained)
ok('② 法国大本营被占：法国【跳过】', r.of('法国').skipped === true,
	'法 skipped=' + !!r.of('法国').skipped)
ok('② 阵营总分只含英国那份', r.total === r.of('英国').gained,
	'total=' + r.total)

/* ③ 不列颠被占 -> 英国跳过，法国【照常计分】（本次修复重点） */
g = seed(rules.setup(1))
put(g, 'ger_brit', '德国', 'army', '不列颠')
r = score(g, '英国')
ok('③ 不列颠被占：英国【跳过】', r.of('英国').skipped === true,
	'英 skipped=' + !!r.of('英国').skipped)
ok('③ 不列颠被占：法国【照常计分】（不被连带）', r.of('法国').gained > 0,
	'法+' + r.of('法国').gained)
ok('③ 阵营总分 = 法国那份', r.total === r.of('法国').gained,
	'total=' + r.total + ' delta=' + r.delta)

/* ④ 两处都被占 -> 英法都跳过，总分 0 */
g = seed(rules.setup(1))
put(g, 'ger_weu2', '德国', 'army', '西欧')
put(g, 'ger_brit2', '德国', 'army', '不列颠')
r = score(g, '英国')
ok('④ 两处都被占：英法都跳过、总分 0',
	r.of('英国').skipped && r.of('法国').skipped && r.total === 0,
	'note=' + r.note)

/* ⑤ 美国/中国 同款：中国大本营（中国东部）被占 -> 美国照常 */
g = rules.setup(1)
put(g, 'us_hi', '美国', 'army', '夏威夷')
put(g, 'cn_army', '中国', 'army', '中国东部')
put(g, 'jp_cn', '日本', 'army', '中国东部')
r = score(g, '美国')
ok('⑤ 中国大本营被占：美国【照常计分】', r.of('美国').gained > 0,
	'美+' + r.of('美国').gained + ' 中 skipped=' + !!r.of('中国').skipped)

/* ⑥ 不重复计分：英法同格时总分为 2 而不是 4 */
g = rules.setup(1)
put(g, 'uk_in2', '英国', 'army', '印度')
put(g, 'fr_in2', '法国', 'army', '印度')
r = score(g, '英国')
const sum = (r.of('英国').gained || 0) + (r.of('法国').gained || 0)
ok('⑥ 英法同格不重复（总分=2）', sum === 2,
	'英+' + r.of('英国').gained + ' 法+' + r.of('法国').gained + ' sum=' + sum)

console.log('\nPASS=' + pass + '  FAIL=' + fail)
process.exitCode = fail ? 1 : 0
