/*
 * 源码基线：禁止手写棋子计数回潮
 * 【2026-10-23 D7】
 *
 * 历史教训：15218 / 15219 / 15220 / 15223 四个 bug 同一形态 ——
 *   手写 pieces_on(...).filter(p => piece_type[p] === 'army')
 *   漏掉国别/阵营条件，于是"数到别国部队"，效果多算。
 *
 * 本测试把口径冻结成三条硬线：
 *   ① 循环累加类（for 里手写计数）必须 = 0
 *   ② 只按兵种过滤、无 nation/faction 的高危形态必须 = 0
 *   ③ 筛选类（pieces_on(...).some/filter/every）只允许保留已评估的 5 处
 *      —— 新增即报红，逼你用 has_pieces / count_pieces / list_pieces
 *
 * 用法：node tools/_smoke_count_baseline.js
 */
const fs = require('fs')
const path = require('path')

const RULES = path.resolve(__dirname, '../rules.js')
const lines = fs.readFileSync(RULES, 'utf8').split('\n')

/* 已评估保留、不得新增的筛选类白名单（行内容指纹，避免行号漂移） */
const FILTER_ALLOW = [
	'.some(p => faction_of_nation(game.piece_nation[p]) !== fac)',      // 4557 战斗目标"有敌方"（阵营反义，无原语）
	'ps.every(p => game.piece_nation[p] === \'德国\')',                  // 4919 17745 维希法国（every 语义）
	'.some(p => faction_of_nation(game.piece_nation[p]) !== faction_of_nation(\'苏联\'))', // 11191 17900 八月风暴（阵营反义）
	'occupants.filter(p => game.piece_nation[p] === nation)',           // 20523 计分（occupants 由调用方给定，改变来源有风险）
	'.filter(p => game.location[p] != null && game.piece_nation[p] === nation && !before.in_supply[p])', // 24646 补给结算前全图扫描
]

let fail = 0
function ok(label, cond, extra) {
	console.log((cond ? '  PASS  ' : '  FAIL  ') + label + (extra ? '  | ' + extra : ''))
	if (!cond) fail++
}

const is_comment = (ln) => /^\s*(\*|\/\/|\/\*)/.test(ln)

let loopCount = 0
let risky = 0
const filters = []
const riskyList = []

for (let i = 0; i < lines.length; i++) {
	const ln = lines[i]
	if (is_comment(ln)) continue

	/* ② 高危：pieces_on + 只按兵种，无国别/阵营 */
	if (/pieces_on\s*\(/.test(ln) && /piece_type\s*\[/.test(ln) &&
		!/piece_nation\s*\[|faction_of_nation/.test(ln)) {
		risky++
		riskyList.push((i + 1) + ': ' + ln.trim())
	}

	if (!/piece_nation\s*\[[^\]]+\]/.test(ln)) continue
	if (!/[!=]==?\s*['"\w]/.test(ln)) continue

	const isFilter = /\.(filter|some|find|every)\s*\(/.test(ln)
	const isLoopCount = /for\s*\(/.test(ln) && /\+\+|count|n\+\+|push\(/.test(ln)
	if (isFilter) filters.push({ line: i + 1, text: ln.trim() })
	else if (isLoopCount) loopCount++
}

/* ---------------- 断言 ---------------- */
console.log('=== ① 循环内手写计数必须为 0 ===')
ok('for 循环里手写计数 = 0', loopCount === 0, 'found=' + loopCount)

console.log('\n=== ② 高危形态（只数兵种、不数国别）必须为 0 ===')
ok('漏国别过滤 = 0', risky === 0, riskyList.length ? riskyList.join(' ; ') : 'ok')

console.log('\n=== ③ 筛选类只允许白名单内的 ' + FILTER_ALLOW.length + ' 处 ===')
const extra = filters.filter(f => !FILTER_ALLOW.some(a => f.text.indexOf(a) >= 0))
ok('无新增筛选类手写', extra.length === 0,
	extra.length ? extra.map(x => x.line + ': ' + x.text).join(' ; ') : 'count=' + filters.length)
ok('白名单条目仍存在（防止白名单过期失效）',
	FILTER_ALLOW.length === filters.length,
	'allow=' + FILTER_ALLOW.length + ' actual=' + filters.length)

console.log('\n=== ④ 原语使用量（只降不升的对照） ===')
let lp = 0, cp = 0, hp = 0
for (const ln of lines) {
	if (is_comment(ln)) continue
	lp += (ln.match(/\blist_pieces\s*\(/g) || []).length
	cp += (ln.match(/\bcount_pieces\s*\(/g) || []).length
	hp += (ln.match(/\bhas_pieces\s*\(/g) || []).length
}
console.log('  list_pieces=' + lp + '  count_pieces=' + cp + '  has_pieces=' + hp +
	'  合计=' + (lp + cp + hp))
/*
 * 基线 80（D7 收尾时实测 86，不含注释行）。
 * 只允许随原语迁移继续上升；一旦掉到 80 以下，说明有人把手写计数加回来了。
 */
ok('原语调用数 >= 80（退化说明有人把手写又加回来了）', lp + cp + hp >= 80,
	String(lp + cp + hp))

console.log('\n' + (fail ? 'FAIL / ' + fail : 'ALL PASS'))
process.exit(fail ? 1 : 0)
