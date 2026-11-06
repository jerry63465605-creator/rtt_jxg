/*
 * 只读排查：15343《霍巴特滑稽坦克》对【敌方状态卡】的压制覆盖面
 *   ① 静态：哪些路径走统一判据 status_active / status_card_effective，哪些没走
 *   ② 实测：光环类（strait_force_axis / port_as / space_immune / supply_immune）在 15343 面前是否真的失效
 */
const path = require('path')
const ROOT = path.join(__dirname, '..')
const MOD = path.join(ROOT, 'server-official', 'public', 'quartermaster-sub-wars')
const R = require(path.join(MOD, 'rules.js'))
const I = R._internal
const d = I.data
const faceOf = x => String(x).split('#')[0]

let pass = 0, fail = 0
const ok = (m, c, extra) => { if (c) { pass++; console.log('  ✓ ' + m) } else { fail++; console.log('  ✗ ' + m + (extra ? '  | ' + extra : '')) } }

/* ---------- ① 静态：列出轴心国带 ongoing 的状态卡 ---------- */
console.log('=== 轴心国「持续光环类」状态卡清单 ===')
const S = I.STATUS_EFFECTS || {}
for (const id of Object.keys(S)) {
	const cfg = S[id] || {}
	if (!cfg.ongoing) continue
	const card = (I.inst_card ? I.inst_card(id) : null) || (I.card_by_id ? I.card_by_id(id) : null)
	const nation = (I.status_config_of ? (I.status_config_of(id) || {}).actor : null) || (card && card.nation) || '?'
	if (!['德国', '日本', '意大利'].includes(nation)) continue
	const kinds = typeof cfg.ongoing === 'object' ? Object.keys(cfg.ongoing).filter(k => k !== 'desc') : [String(cfg.ongoing)]
	console.log('  ' + id + ' [' + nation + '] kinds=' + JSON.stringify(kinds) + (card ? ' 《' + card.name + '》' : ''))
}

/* ---------- ② 实测：15343 在场时，敌方光环是否失效 ---------- */
function base() {
	const g = R.setup(7)
	g.opening = null
	g.neutral = { '苏联': false, '美国': false }
	g.pending_battle = null
	g.pending_econ = null
	g.armed_offers = []
	g.response_queue = []
	g.response_stack = []
	g.pending_status_react = null
	I.refresh(g)
	return g
}
function putStatus(g, face, nation) {
	R.action(g, factionOf(nation), 'debug_add_card', { face, nation, dest: 'hand' })
	I.refresh(g)
	const inst = (g.hands[nation] || []).find(x => faceOf(x) === face)
	if (!inst) return null
	const needTurn = g.current_nation !== nation
	if (needTurn) R.action(g, factionOf(nation), 'debug_set_phase', { nation, phase: 'play' })
	I.refresh(g)
	R.action(g, factionOf(nation), 'play_card', { card: inst })
	I.refresh(g)
	return (g.table[nation] || []).find(x => faceOf(x) === face) || null
}
function factionOf(n) { return I.faction_of_nation(n) === 'allies' ? 'Allies' : 'Axis' }
function put15343(g) {
	/* 英国（Allies）桌面放 15343，并让 current_nation = 英国（该卡的生效窗口） */
	R.action(g, 'Allies', 'debug_set_phase', { nation: '英国', phase: 'play' })
	I.refresh(g)
	const c = putStatus(g, '15343', '英国')
	R.action(g, 'Allies', 'debug_set_phase', { nation: '英国', phase: 'play' })
	I.refresh(g)
	return c
}

/* A. 海峡强制轴心（15254 战争海军，德国） */
console.log('\n=== A. 海峡强制轴心 15254《战争海军》（德国，敌方）===')
{
	const g = base()
	const c = putStatus(g, '15254', '德国')
	console.log('  15254 上桌 = ' + !!c + '  strait_force_axis = ' + JSON.stringify(g.status_aura && g.status_aura.strait_force_axis))
	const sid = d.straits && d.straits[0] ? d.straits[0].id : null
	const sname = d.straits && d.straits[0] ? d.straits[0].name : '?'
	console.log('  海峡 = ' + sname + ' 控制者(无坦 克) = ' + I.strait_controller(g, sid))
	/* 放德国部队到该海峡陆地，看是否被强制为轴心 */
	const landNb = (d.spaces[sid].connections || [])[0]
	R.action(g, 'Axis', 'debug_place', { piece: 'de_s', nation: '德国', type: 'army', space: landNb })
	I.refresh(g)
	const before = I.strait_controller(g, sid)
	put15343(g)   /* 现在 current_nation=英国，15343 在桌面 */
	const after = I.strait_controller(g, sid)
	console.log('  有坦克：控制者 = ' + after + '（无坦克时 = ' + before + '）')
	ok('★★ 15343 在场时，15254 的"海峡强制轴心"失效（走 status_card_effective）',
		after !== 'axis' || before !== 'axis', before + ' → ' + after)
}

/* B. 港口光环（15444 丘克群岛，日本） */
console.log('\n=== B. 港口光环 15444《丘克群岛》（日本，敌方）===')
{
	const g = base()
	const c = putStatus(g, '15444', '日本')
	console.log('  15444 上桌 = ' + !!c + '  port_as = ' + JSON.stringify(g.status_aura && g.status_aura.port_as))
	const sp = Object.keys((g.status_aura && g.status_aura.port_as) || {})[0]
	console.log('  port_as 记录 = ' + (sp ? d.name_of(Number(sp)) : '(无)'))
	if (sp) {
		const spaceId = Number(sp)
		/* 找一个相邻海域，试建日本海军（光环生效时应当成功） */
		const nbs = (d.spaces[spaceId].connections || []).filter(x => d.spaces[x] && d.spaces[x].terrain === 'sea')
		const sea = nbs[0]
		const withAura = I.can_build_at(g, '日本', sea, 'navy')
		put15343(g)
		const noAura = I.can_build_at(g, '日本', sea, 'navy')
		console.log('  在 ' + (sea ? d.name_of(sea) : '?') + ' 建海军：无坦克=' + JSON.stringify(withAura && withAura.ok) +
			'  有坦克=' + JSON.stringify(noAura && noAura.ok))
		ok('★★ 15343 在场时，15444 的"视为日本港口"失效',
			!(withAura && withAura.ok) || !(noAura && noAura.ok),
			JSON.stringify({ withAura: withAura && withAura.ok, noAura: noAura && noAura.ok }))
	}
}

/* C. 地区免疫（space_immune，若有轴心卡写它） */
console.log('\n=== C. 地区免疫 space_immune（轴心卡）===')
{
	const g = base()
	const found = []
	for (const id of Object.keys(S)) {
		const cfg = S[id] || {}
		const og = cfg.ongoing || {}
		if (og.space_immune) found.push(id)
	}
	console.log('  写 space_immune 的卡 = ' + JSON.stringify(found))
	if (found.length) {
		const g2 = base()
		const c = putStatus(g2, found[0], (S[found[0]] || {}).actor || '德国')
		console.log('  ' + found[0] + ' 上桌 = ' + !!c + '  space_immune = ' + JSON.stringify(g2.status_aura && g2.status_aura.space_immune))
		const sp = Object.keys((g2.status_aura && g2.status_aura.space_immune) || {})[0]
		if (sp) {
			const beforeImm = !!I.supply_aura_covers(g2, g2.status_aura.space_immune[sp], 'army', Number(sp))
			put15343(g2)
			const afterImm = !!I.supply_aura_covers(g2, g2.status_aura.space_immune[sp], 'army', Number(sp))
			console.log('  该地区免疫补给：无坦克=' + beforeImm + '  有坦克=' + afterImm)
			ok('★★ 15343 在场时，space_immune 失效', !beforeImm || !afterImm, beforeImm + ' → ' + afterImm)
		}
	}
}

console.log('\n' + (fail === 0 ? 'ALL PASS（' + pass + ' 项）' : fail + ' FAIL / ' + pass + ' 项（= 压制缺口）'))
process.exitCode = 0
