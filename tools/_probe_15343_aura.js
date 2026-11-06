/*
 * 只读：逐类光环在 15343《霍巴特滑稽坦克》在场时是否失效
 *   15343 口径：英国回合内，敌方（轴心）国家的状态卡无效
 * 每类：先在"无坦克"下确认光环确实生效，再放 15343（并把 current_nation 切到英国），看是否失效
 */
const path = require('path')
const ROOT = path.join(__dirname, '..')
const MOD = path.join(ROOT, 'server-official', 'public', 'quartermaster-sub-wars')
const R = require(path.join(MOD, 'rules.js'))
const I = R._internal
const d = I.data
const faceOf = x => String(x).split('#')[0]

const fact = n => (I.faction_of_nation(n) === 'allies' ? 'Allies' : 'Axis')
function base() {
	const g = R.setup(7)
	g.opening = null
	g.neutral = { '苏联': false, '美国': false }
	g.pending_battle = null; g.pending_econ = null
	g.armed_offers = []; g.response_queue = []; g.response_stack = []
	g.pending_status_react = null
	I.refresh(g)
	return g
}
function put(g, face, nation) {
	R.action(g, fact(nation), 'debug_add_card', { face, nation, dest: 'hand' })
	if (g.current_nation !== nation) R.action(g, fact(nation), 'debug_set_phase', { nation, phase: 'play' })
	I.refresh(g)
	const inst = (g.hands[nation] || []).find(x => faceOf(x) === face)
	if (inst) R.action(g, fact(nation), 'play_card', { card: inst })
	I.refresh(g)
	return (g.table[nation] || []).find(x => faceOf(x) === face) || null
}
function putTank(g) {
	R.action(g, 'Allies', 'debug_set_phase', { nation: '英国', phase: 'play' })
	I.refresh(g)
	const c = put(g, '15343', '英国')
	R.action(g, 'Allies', 'debug_set_phase', { nation: '英国', phase: 'play' })
	I.refresh(g)
	return c
}
const report = []

/* ① 15444 丘克群岛：port_as（港口光环） */
{
	const g = base()
	const c = put(g, '15444', '日本')
	const sp = Object.keys((g.status_aura && g.status_aura.port_as) || {})[0]
	let withAura = '?', noAura = '?'
	if (sp) {
		const sea = (d.spaces[Number(sp)].connections || []).find(x => d.spaces[x] && d.spaces[x].terrain === 'sea')
		withAura = !!(I.can_build_at(g, '日本', sea, 'navy') || {}).ok
		putTank(g)
		noAura = !!(I.can_build_at(g, '日本', sea, 'navy') || {}).ok
		report.push({ 卡: '15444 丘克群岛（港口 port_as）', 上桌: !!c, 光环生效: withAura, 坦克在场_仍生效: noAura, 是否被压制: withAura && !noAura })
	}
}

/* ② 8601 远东共和国：space_immune（该地日本陆军总是补给/免移除） */
{
	const g = base()
	const c = put(g, '8601', '日本')
	const sp = Object.keys((g.status_aura && g.status_aura.space_immune) || {})[0]
	let before = '?', after = '?'
	if (sp) {
		const nat = g.status_aura.space_immune[sp]
		before = !!I.supply_aura_covers(g, nat, 'army', Number(sp))
		putTank(g)
		after = !!I.supply_aura_covers(g, nat, 'army', Number(sp))
		report.push({ 卡: '8601 远东共和国（地区免疫 space_immune）', 上桌: !!c, 光环生效: before, 坦克在场_仍生效: after, 是否被压制: before && !after })
	}
}

/* ③ 15254 战争海军：海峡强制轴心（已走 status_card_effective 的对照组） */
{
	const g = base()
	/* 15254 无 trigger，要靠"建设海军后"等窗口；这里直接看配置写入的字段值是否含 card_id */
	const cfg = (I.STATUS_EFFECTS || {})['15254'] || {}
	report.push({
		卡: '15254 战争海军（海峡强制 axis_only_seas）',
		上桌: '需窗口（无 trigger）',
		光环生效: '见字段',
		坦克在场_仍生效: '—',
		是否被压制: '代码已走 status_card_effective（对照组）',
	})
}

/* ④ 17744 土耳其开放海峡：pair_adjacency（成对邻接） */
{
	const cfg = (I.STATUS_EFFECTS || {})['17744'] || {}
	const og = cfg.ongoing || {}
	report.push({
		卡: '17744 土耳其开放海峡（pair_adjacency）',
		上桌: '需窗口',
		光环生效: JSON.stringify(og.pairs || og.pair || null).slice(0, 60),
		坦克在场_仍生效: '—',
		是否被压制: '读取处未走 status_card_effective（待确认影响面）',
	})
}

/* ⑤ 标记类：6601 大德意志帝国 / 15443 前进基地 / 17742 拉丁世界 */
for (const id of ['6601', '15443', '17742']) {
	const cfg = (I.STATUS_EFFECTS || {})[id] || {}
	const og = cfg.ongoing || {}
	report.push({
		卡: id + '（' + (og.kind || '?') + ' 计分标记类）',
		上桌: '需窗口',
		光环生效: 'markers=' + (og.markers != null ? og.markers : '?'),
		坦克在场_仍生效: '—',
		是否被压制: '标记循环走 status_active（已覆盖，见 L5850/5895）',
	})
}

console.log('=== 15343 对敌方光环的压制覆盖 ===')
for (const r of report) console.log(JSON.stringify(r))
