/*
 * 【阶段 1】计分标记「迁移前/后」快照对比脚本。
 *
 * 阶段 1 是纯重构（6 条通道 -> 一套配置 + 单一执行器），核心约束是【行为等价】。
 * 本脚本对每张标记相关状态卡施加 ongoing，dump：
 *   · game.markers（标记数量 + owner + faction）
 *   · game.marker_only（地点级约束）
 *   · 若干典型驻军下的 score_breakdown
 *
 * 用法：node tools/_dump_marker_snapshot.js > tmp/snap_before.json
 */
const path = require('path')
const MOD = path.join(__dirname, '..', 'server-official', 'public', 'quartermaster-sub-wars')
const rules = require(path.join(MOD, 'rules.js'))
const I = rules._internal
const data = I.data

const CARDS = [
	['15345', '英国'], ['15347', '英国'], ['15443', '日本'],
	['17554', '美国'], ['17845', '苏联'], ['17840', '苏联'],
	['17901', '苏联'], ['6601', '德国'], ['17742', '意大利'],
]

function dumpMarkers(g) {
	const out = {}
	for (const k of Object.keys(g.markers || {})) {
		const list = (g.markers[k] || [])
		if (!list.length) continue
		out[data.name_of(Number(k))] = list.map(m => (m.owner || '-') + '/' + (m.faction || '-'))
	}
	return out
}
function dumpOnly(g) {
	const out = {}
	for (const k of Object.keys(g.marker_only || {}))
		out[data.name_of(Number(k))] = g.marker_only[k]
	return out
}
/* 在几个关键地区放驻军，看计分归属 */
function dumpScores(g) {
	const spots = [['乌克兰', '德国'], ['乌克兰', '苏联'], ['东欧', '英国'],
		['非洲南部', '法国'], ['中国西部', '中国'], ['马达加斯加', '日本']]
	const out = {}
	for (const [spName, nat] of spots) {
		const sp = data.id_of(spName)
		if (sp == null) continue
		const g2 = JSON.parse(JSON.stringify(g))
		g2.piece_nation['snap_p'] = nat
		g2.piece_type['snap_p'] = 'army'
		g2.location['snap_p'] = sp
		const bd = I.score_breakdown(g2, nat)
		const it = (bd.items || []).find(x => x.space === sp)
		out[spName + '<-' + nat] = it ? it.gained : 0
	}
	return out
}

const result = { base: null, cards: {} }
{
	const g0 = rules.setup(1)
	g0.opening = null
	I.ensure_marker_only(g0)
	result.base = { markers: dumpMarkers(g0), only: dumpOnly(g0) }
}
for (const [id, nation] of CARDS) {
	const g = rules.setup(1)
	g.opening = null
	I.ensure_marker_only(g)
	/*
	 * 6601《大德意志帝国》的前置是"西欧/德国/东欧 都被德国控制"，
	 * 不满足就不加标记 —— 这里摆好前置，否则快照测不到它的真实效果。
	 */
	if (id === '6601') {
		;['西欧', '德国', '东欧'].forEach((s, i) => {
			const sp = data.id_of(s)
			g.piece_nation['pre' + i] = '德国'
			g.piece_type['pre' + i] = 'army'
			g.location['pre' + i] = sp
		})
	}
	let applied = null
	try { applied = I.apply_status_ongoing(g, id, nation) } catch (e) { applied = 'ERR:' + e.message }
	result.cards[id] = {
		applied: applied,
		markers: dumpMarkers(g),
		only: dumpOnly(g),
		scores: dumpScores(g),
	}
}
const outPath = process.argv[2]
if (outPath) require('fs').writeFileSync(outPath, JSON.stringify(result, null, 1))
else console.log(JSON.stringify(result, null, 1))
