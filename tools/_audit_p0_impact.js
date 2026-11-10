/*
 * P0 影响面：列出所有可能受"统一兜底（finish_acts / freeze_reason）"影响的卡
 *
 * 输出三类：
 *   A. 产生 armed 窗口的卡（受益方：这些窗口以前可能点不动）
 *   B. 制造排他挂起的卡/机制（宿主方：冻结语义不变，但交互面变了）
 *   C. 交叉矩阵：时点 × 可否与挂起重叠（判定"高/中/低"影响）
 */
const path = require('path')
const ROOT = path.join(__dirname, '..')
const MOD = path.join(ROOT, 'server-official', 'public', 'quartermaster-sub-wars')
const R = require(path.join(MOD, 'rules.js'))
const I = R._internal
const cards = require(path.join(MOD, 'cards.js')).CARDS
const byId = {}
for (const c of cards) byId[String(c.id)] = c

const echo = I.ECHO_EFFECTS || {}
const nameOf = id => (byId[String(id)] || {}).name || (echo[id] || {}).name || '?'
const nationOf = id => (byId[String(id)] || {}).nation || (echo[id] || {}).actor || '?'

/* 时点分类：哪些时点天然会落在"对手回合/对手动作中途" */
const OPP_MOMENT = new Set([
	'piece_removed', 'after_build_army', 'after_build_navy', 'after_recruit', 'after_deploy_air',
	'after_battle', 'attacked', 'piece_attacked', 'econ_used', 'econ_target',
	'enemy_echo_played', 'enemy_status_effect', 'nation_turn_start',
])
const PHASE_EDGE = new Set(['play_start', 'draw_phase_end', 'scoring_north', 'after_land', 'turn_start'])

const rows = []
for (const id of Object.keys(echo)) {
	const cfg = echo[id] || {}
	const ar = cfg.armed
	if (!ar) continue
	const when = Array.isArray(ar.when) ? ar.when.join('|') : String(ar.when || '')
	const ws = Array.isArray(ar.when) ? ar.when : [ar.when]
	const cls = ws.some(w => OPP_MOMENT.has(w)) ? '高' : (ws.some(w => PHASE_EDGE.has(w)) ? '中' : '低')
	rows.push({
		id, name: nameOf(id), nation: nationOf(id),
		type: String((byId[String(id)] || {}).type || '').toUpperCase(),
		when, actor: ar.actor || '', watch: !!ar.watch,
		cost: ar.cost ? Object.keys(ar.cost).filter(k => ar.cost[k]).join('+') : '',
		need: typeof ar.run === 'function' && /need:/.test(ar.run.toString()) ? '多步(need)' : '单步',
		cls,
	})
}
rows.sort((a, b) => (a.cls === b.cls ? a.nation.localeCompare(b.nation) : a.cls.localeCompare(b.cls)))

console.log('=== A. armed 窗口卡（共 ' + rows.length + ' 张）===')
console.log('影响等级：高=时点天然落在对手回合/对手动作中途；中=阶段边界；低=其它\n')
for (const r of rows) {
	console.log([r.cls, r.id, '《' + r.name + '》', r.nation, r.type, 'when=' + r.when,
		'r.actor=' + (r.actor || '-'), r.watch ? 'watch' : 'self', 'cost=' + (r.cost || '无'), r.need].join('  '))
}

/* B. 制造排他挂起的卡/机制 */
console.log('\n=== B. 排他挂起宿主（这些卡会让别人"中途不能动"）===')
const HOSTS = [
	['pending_echo（事件多步选地区/选牌）', 'EVENT_EFFECTS 里带 steps 且需要 space/choice 的卡'],
	['pending_script（多步脚本卡）', 'SCRIPT_CARDS 注册的卡'],
	['pending_status_play（苏联选状态卡）', '17851 天王星相关 / su_status_*'],
	['pending_theater（战区移动）', '17532《战区移动》'],
	['pending_autobahn（高速公路/西伯利亚大铁路）', '15228 高速公路 / 17529 委托建设'],
	['pending_econ（经济战链式让权）', '15314 等 ECON 链'],
	['pending_red（红色管弦乐队）', '17805《红色管弦乐队》'],
	['pending_uranus（天王星行动）', '17851《天王星行动》'],
	['pending_armed_delegate / delegate 系', '17861《八月风暴》 / 17703 铁卫团 / 卡佩里尼'],
]
for (const [k, v] of HOSTS) console.log('  · ' + k + '　←　' + v)

/* 统计 */
const cnt = { 高: 0, 中: 0, 低: 0 }
for (const r of rows) cnt[r.cls]++
console.log('\n=== 汇总 ===')
console.log('  armed 窗口卡 ' + rows.length + ' 张：高 ' + cnt.高 + ' / 中 ' + cnt.中 + ' / 低 ' + cnt.低)
console.log('  其中带代价的 ' + rows.filter(r => r.cost).length + ' 张，多步(need) ' + rows.filter(r => r.need !== '单步').length + ' 张')
