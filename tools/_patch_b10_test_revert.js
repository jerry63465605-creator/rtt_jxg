/* B10 旧测试适配部分回退：把 C/D/E（挂起+重新代受）替换为回退后的语义 */
const fs = require('fs')
const path = require('path')
const P = path.join(__dirname, '_real_test_b10_design_bureau.js')
const L = fs.readFileSync(P, 'utf8').split('\n')

const startIdx = L.findIndex(l => l.indexOf('=== C. 抵消成立') >= 0)
const endIdx = L.findIndex(l => l.indexOf('=== F. 苏联「不发动」') >= 0)
console.log('替换区间：', startIdx + 1, '..', endIdx)   /* startIdx 行是 console.log, 前面有一空行 */

const block = [
	"console.log('\\n=== C. 抵消成立 → victim【立即】被移除（B10 部分回退后的底层行为）===')",
	'{',
	"\tconst g = setup();",
	"\tconst n0 = (g.log || []).length",
	"\tI.do_battle(g, '德国', EAST(), 'su_e', 'land', { from: 'de_army', defend_air: 'su_air' })",
	"\tR.action(g, 'Axis', 'resolve_battle', { counter_air: 'de_air' })",
	"\tconsole.log('  log: ' + logSince(g, n0).slice(0, 300))",
	"\tok('★★ 抵消后不再挂起', !g.pending_battle, JSON.stringify(g.pending_battle && g.pending_battle.stage))",
	"\tok('★★ victim 立即被移除（核心战斗时序未改）', g.location['su_e'] == null, String(g.location['su_e']))",
	"\tok('★ 双方空军都阵亡', g.location['su_air'] == null && g.location['de_air'] == null)",
	"\tok('★★ 操作权归还 Axis', g.active === 'Axis' && !g.battle_return_active, g.active + '/' + g.battle_return_active)",
	'\t/*',
	'\t * 已知缺口（已登记待办）：抵消成立时，victim 的 piece_removed 派发会覆盖掉',
	'\t * 刚刚由"空军被移除"打开的 17811 窗口（同一 when、不同国家），',
	'\t * 表现为"掉了飞机但设计局没得打"。本次回退不处理，见',
	'\t * docs/todo-2026-10-29.md「17811：抵消路径窗口被 victim 派发覆盖」。',
	'\t */',
	'\tconst has = !!off17811(g)',
	"\tconsole.log('  17811 窗口（现状：被 victim 派发覆盖）= ' + has +",
	"\t\t'  offers=' + JSON.stringify((g.armed_offers || []).map(w => w.when)))",
	"\tok('（现状记录）抵消路径 17811 窗口被覆盖 —— 已登记待办', has === false, String(has))",
	'}',
	'',
].join('\n')

L.splice(startIdx - 1, endIdx - startIdx + 1, block)   /* 连前面空行一起替换 */
fs.writeFileSync(P, L.join('\n'), 'utf8')
console.log('已替换')
