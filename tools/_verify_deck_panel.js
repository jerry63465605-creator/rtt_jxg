/*
 * 验证"各国牌库面板"的数据来源是否可用（2026-09-29）。
 *
 * 面板依赖 view 的三个字段：
 *   view.deck_counts     —— 各国牌库剩余
 *   view.discard_counts  —— 各国弃牌堆
 *   view.order_of_nations—— 显示顺序（德英日苏意美）
 *
 * 服务端【早已】按全部六国给出，本脚本确认它确实包含六国且为数字，
 * 并顺带验证损耗后数字会正确下降（面板能反映真实状态）。
 *
 * 用法（从仓库根）：node tools/_verify_deck_panel.js
 */
const path = require('path')
const MOD = path.join(__dirname, '..', 'server-official', 'public', 'quartermaster-sub-wars')
const rules = require(path.join(MOD, 'rules.js'))
const I = rules._internal || {}

let pass = 0, fail = 0
function ok(label, cond, extra) {
	console.log((cond ? '  PASS  ' : '  FAIL  ') + label + (extra ? '  | ' + extra : ''))
	cond ? pass++ : fail++
}

const ORDER = I.ORDER_OF_NATIONS
ok('ORDER_OF_NATIONS 含 6 国', ORDER && ORDER.length === 6,
	JSON.stringify(ORDER))

const g = rules.setup(81)
const v = rules.view(g, 'Allies')

console.log('\n=== view 三个字段 ===')
ok('view.order_of_nations 存在', Array.isArray(v.order_of_nations) &&
	v.order_of_nations.length === 6, JSON.stringify(v.order_of_nations))
ok('view.deck_counts 存在', !!v.deck_counts)
ok('view.discard_counts 存在', !!v.discard_counts)

console.log('\n=== 六国数据完整性 ===')
for (const n of ORDER) {
	const d = v.deck_counts[n]
	const c = v.discard_counts[n]
	ok(n + '：牌库=' + d + ' 弃牌=' + c + '（均为数字）',
		typeof d === 'number' && typeof c === 'number')
}
ok('六国牌库均 > 0（开局已发牌）',
	ORDER.every(n => (v.deck_counts[n] || 0) > 0),
	ORDER.map(n => n + ':' + v.deck_counts[n]).join(' '))

console.log('\n=== 损耗后数字会下降（面板反映真实状态）===')
const before = v.deck_counts['英国']
const lost = I.attrition_cards(g, '英国', 3)
const v2 = rules.view(g, 'Allies')
ok('损耗 3 张 -> 英国牌库 -3',
	v2.deck_counts['英国'] === before - 3 && lost.length === 3,
	'before=' + before + ' after=' + v2.deck_counts['英国'])
ok('弃牌堆 +3（牌进了弃牌堆，不是消失）',
	v2.discard_counts['英国'] === (v.discard_counts['英国'] || 0) + 3,
	'discard after=' + v2.discard_counts['英国'])

console.log('\n=== 牌库耗尽后显示 0（面板标红场景）===')
const many = (v2.deck_counts['英国'] || 0)
const lost2 = I.attrition_cards(g, '英国', many)
const v3 = rules.view(g, 'Allies')
ok('全部损耗后牌库为 0（面板应标红）',
	v3.deck_counts['英国'] === 0 && lost2.length === many,
	'deck=' + v3.deck_counts['英国'])

console.log('\n通过 ' + pass + ' / 失败 ' + fail)
process.exit(fail ? 1 : 0)
