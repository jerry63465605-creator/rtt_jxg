/*
 * 扫描所有卡面含【阶段名】的卡，列出类型与原文，用于确定阶段限制口径。
 *
 * 玩家 2026-09-28 口径：
 *   · 没有阶段特殊说明的卡 -> 只能在【出牌阶段】打出
 *   · 有阶段特殊说明的卡（如"计分阶段开始时…"）-> 【只能】在说明的阶段打出，
 *     不能在其他阶段（含出牌阶段）打出
 *
 * 难点：卡面提到阶段名有【两种语义】，必须先看清再定规则：
 *   ① 打出时机（"在XX阶段打出"）
 *   ② 效果结算时机（"XX阶段：获得N分"）—— 这种不该限制打出阶段
 *
 * 用法（从仓库根）：node tools/_scan_phase_notes.js [国家]
 */
const path = require('path')
const MOD = path.join(__dirname, '..', 'server-official', 'public', 'quartermaster-sub-wars')
const { CARDS } = require(path.join(MOD, 'cards.js'))

const onlyNation = process.argv[2] || null
const RE = /(资源再分配|出牌阶段|空军阶段|补给阶段|计分阶段|弃牌阶段|摸牌阶段)/g

const buckets = {}
for (const c of CARDS) {
	if (onlyNation && c.nation !== onlyNation) continue
	const txt = c.text || ''
	const hits = txt.match(RE)
	if (!hits) continue
	for (const h of hits) (buckets[h] = buckets[h] || []).push(c)
}

console.log('== 卡面含阶段名的卡（按阶段归并）==\n')
for (const k of Object.keys(buckets)) {
	const list = buckets[k]
	console.log('### 「' + k + '」 ' + list.length + ' 张')
	for (const c of list)
		console.log('  [' + c.nation + '/' + c.type + '] ' + c.id + ' 《' + c.name + '》\n      ' + c.text)
	console.log('')
}

/* 按类型汇总，便于判断"某类卡是否普遍带阶段说明" */
const byType = {}
for (const c of CARDS) {
	if (!(c.text || '').match(RE)) continue
	byType[c.type] = (byType[c.type] || 0) + 1
}
console.log('== 带阶段名的卡按类型统计 ==')
for (const t of Object.keys(byType)) console.log('  ' + t + ': ' + byType[t])
