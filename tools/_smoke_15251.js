/*
 * 喷气式战斗机(15251) 损耗记录 + 只读查看 冒烟自检（2026-10-18）
 * 覆盖：打出后初始化日志 / 主动+被动损耗均记录 / 非德国损耗不记录 /
 *       view 暴露 attrition_log / 离场后停止记录 / 重新打出重置日志。
 * 用法：node tools/_smoke_15251.js
 */
const path = require('path')
const MOD = path.resolve('server-official/public/quartermaster-sub-wars')
const rules = require(path.join(MOD, 'rules.js'))
const I = rules._internal

let pass = 0, fail = 0
function ok(label, cond, extra) {
	console.log((cond ? '  PASS  ' : '  FAIL  ') + label + (extra ? '  | ' + extra : ''))
	cond ? pass++ : fail++
}

let g = rules.setup(1)
g.current_nation = '德国'
g.active = 'Axis'
g.turn_phase = 'play'
g.play_done = {}

/* 发 15251 到德国手牌并打出 */
g.hands['德国'].push('15251#1')
console.log('=== 1. 打出 15251：初始化损耗日志 ===')
g = rules.action(g, 'Axis', 'play_card', { card: '15251#1' })
ok('15251 进桌面', (g.table['德国'] || []).indexOf('15251#1') >= 0)
ok('attrition_logs["15251"] 已初始化', !!(g.attrition_logs && g.attrition_logs['15251']))
ok('日志初始为空数组', !!(g.attrition_logs['15251'] && g.attrition_logs['15251'].cards.length === 0))

console.log('\n=== 2. 德国主动损耗被记录 ===')
const deckBefore = g.decks['德国'].length
const lostA = I.attrition_cards(g, '德国', 3)
ok('实际损耗张数 = 日志新增张数', g.attrition_logs['15251'].cards.length === lostA.length,
	'log=' + g.attrition_logs['15251'].cards.length + ' lost=' + lostA.length)
ok('日志内容均为刚损耗的牌', lostA.every(id => g.attrition_logs['15251'].cards.indexOf(id) >= 0))

console.log('\n=== 3. 德国被动损耗也被记录 ===')
const before3 = g.attrition_logs['15251'].cards.length
const lostP = I.attrition_passive(g, '德国', 2)
ok('被动损耗也记入日志', g.attrition_logs['15251'].cards.length === before3 + lostP.length,
	'log=' + g.attrition_logs['15251'].cards.length)

console.log('\n=== 4. 非德国损耗不记录 ===')
const before4 = g.attrition_logs['15251'].cards.length
I.attrition_cards(g, '英国', 2)
ok('英国损耗不进入 15251 日志', g.attrition_logs['15251'].cards.length === before4)

console.log('\n=== 5. view 暴露 attrition_log（供点击只读展示）===')
const v = rules.view(g, 'Axis')
const ts = (v.table_status || []).find(x => x.card === '15251#1')
ok('view.table_status 含 15251', !!ts)
ok('15251 带 attrition_log 字段', !!ts && Array.isArray(ts.attrition_log))
ok('attrition_log 与内部日志一致', !!ts && ts.attrition_log.length === g.attrition_logs['15251'].cards.length)
ok('attrition_log 元素含 name/img/text', !!ts && ts.attrition_log.every(c => 'name' in c && 'img' in c && 'text' in c))

console.log('\n=== 6. view 不修改游戏状态（只读隔离）===')
const snapshot = JSON.stringify(g.attrition_logs['15251'].cards)
rules.view(g, 'Axis')
rules.view(g, 'Allies')
ok('view 调用后日志内容不变', JSON.stringify(g.attrition_logs['15251'].cards) === snapshot)

console.log('\n=== 7. 15251 离场后停止记录（presence 守卫）===')
g.table['德国'] = g.table['德国'].filter(c => c !== '15251#1')
const before7 = g.attrition_logs['15251'].cards.length
I.attrition_cards(g, '德国', 2)
ok('离场后德国损耗不再记入', g.attrition_logs['15251'].cards.length === before7)

console.log('\n=== 8. 重新打出重置日志 ===')
g.hands['德国'].push('15251#2')
g.play_done = {}
g = rules.action(g, 'Axis', 'play_card', { card: '15251#2' })
ok('重新打出后日志重置为空', g.attrition_logs['15251'].cards.length === 0)

console.log('\n==== 结果：' + pass + ' 通过 / ' + fail + ' 失败 ====')
process.exit(fail ? 1 : 0)
