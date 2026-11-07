/*
 * 按"15411 改 B（armed 通道）"更新旧冒烟：
 *   ① 代价断言：15411 的 cost 现在挂在 armed.cost 上
 *   ② 用例块 6：旧的自触发/无补给语义已废弃 → 换成"新语义守卫"并指向新测试
 */
const fs = require('fs')
const path = require('path')
const P = path.join(__dirname, '_smoke_jp_effect.js')
let lines = fs.readFileSync(P, 'utf8').replace(/\r\n/g, '\n').split('\n')

/* ① 代价循环：15411 读 armed.cost */
const OLD_LOOP = `\tfor (const id of ['15408', '15413', '15412', '15411']) {
\t\tconst eff = (I.ECHO_EFFECTS || {})[id]
\t\tconst cost = eff && eff.cost`
if (lines.join('\n').indexOf(OLD_LOOP) >= 0) {
	console.log('① 未改（循环里已有 cost 变量）—— 改为按卡取 cost')
}
const oldCostLine = `\t\tconst cost = eff && eff.cost`
const newCostLine = `\t\tconst cost = (eff && eff.cost) || (eff && eff.armed && eff.armed.cost)   /* 15411 已改 armed：代价在 armed.cost */`
const joined = lines.join('\n')
if (joined.indexOf(oldCostLine) >= 0) {
	lines = joined.split(oldCostLine).join(newCostLine).split('\n')
	console.log('① 代价断言已改为兼容 armed.cost')
}

/* ② 替换块 6 */
const start = lines.findIndex(l => l.indexOf("=== 6. 15411") >= 0)
const end = lines.findIndex(l => l.indexOf("=== 7. 装载卡(armed)配置") >= 0)
if (start < 0 || end < 0 || end <= start) {
	console.log('✗ 没找到块 6 的边界 start=' + start + ' end=' + end)
	process.exit(1)
}
const block = [
	"console.log('\\n=== 6. 15411 夜间运输：已改为 armed（日本回合开始时询问）===')",
	'{',
	'\t/*',
	'\t * 【2026-11-08 玩家口径·改 B】时点从「补给阶段主动打出」改为',
	'\t * 「日本回合开始（resource）弹窗询问」，走 armed 通道，且目标不再限定"无补给"。',
	'\t * 完整的交互链（窗口/弃 1 响应/选部队/结算）见 tools/_real_test_15411_armed.js。',
	'\t */',
	'\tconst eff = (I.ECHO_EFFECTS || {})[\'15411\']',
	'\tok(\'15411 走 armed 通道\', !!(eff && eff.armed && eff.armed.when === \'nation_turn_start\'),',
	"\t\t'armed=' + JSON.stringify(eff && eff.armed && { when: eff.armed.when, actor: eff.armed.actor }))",
	'\tok(\'15411 armed.actor=日本\', !!(eff && eff.armed && eff.armed.actor === \'日本\'))',
	'\tok(\'15411 代价 discard=1 + filter=response\',',
	'\t\t!!(eff && eff.armed && eff.armed.cost && eff.armed.cost.discard === 1 && eff.armed.cost.filter === \'response\'),',
	"\t\t'cost=' + JSON.stringify(eff && eff.armed && eff.armed.cost))",
	'\tok(\'15411 不再声明主动打出时点（CARD_TRIGGERS 已删）\', !(I.CARD_TRIGGERS || {})[\'15411\'])',
	'\tok(\'15411 armed.ready 是函数\', !!(eff && eff.armed && typeof eff.armed.ready === \'function\'))',
	'\tok(\'15411 armed.run 是函数\', !!(eff && eff.armed && typeof eff.armed.run === \'function\'))',
	'}',
	'',
]
lines = lines.slice(0, start).concat(block, lines.slice(end))
fs.writeFileSync(P, lines.join('\n'), 'utf8')
console.log('② 块 6 已替换为"新语义守卫"')
