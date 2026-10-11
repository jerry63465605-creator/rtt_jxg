/* 状态卡「建设预算」冒烟自检（2026-10-10）
 * 覆盖：17552/17547/17550/17843(征召)/15248
 * 规则（玩家）：建/征召在"同格(已满)"必须静默失败，绝不自动兜底选相邻；
 *             多地区必须玩家手动点选相邻合法空格。
 */
const path = require('path')
const MOD = path.resolve('server-official/public/quartermaster-sub-wars')
const rules = require(path.join(MOD, 'rules.js'))
const I = rules._internal
const d = require(path.join(MOD, 'data.js')).data

let pass = 0, fail = 0
function ok(l, c, e) { console.log((c ? '  PASS  ' : '  FAIL  ') + l + (e ? '  | ' + e : '')); c ? pass++ : fail++ }
function fresh() { const g = rules.setup(1); g.current_nation = '美国'; g.active = 'Allies'; g.turn_phase = 'play'; return g }
function countArmy(g, n) { return Object.keys(g.location).filter(p => g.piece_nation[p] === n && g.piece_type[p] === 'army').length }
function countNavy(g, n) { return Object.keys(g.location).filter(p => g.piece_nation[p] === n && g.piece_type[p] === 'navy').length }

let _id = 0
function putInSupply(g, nation, type, space) {
	const id = 'tmp' + (_id++)
	g.location[id] = space; g.piece_nation[id] = nation; g.piece_type[id] = type
	if (I.refresh) I.refresh(g)
	return id
}
function ensureHomeArmy(g, nation) {
	const home = I.home_base_of(nation)
	const has = Object.keys(g.location).some(p => g.piece_nation[p] === nation && g.piece_type[p] === 'army' && g.location[p] === home)
	if (!has) putInSupply(g, nation, 'army', home)
	return home
}
function emptyNeighbor(g, base, wantSea) {
	for (const c of I.get_connections(g, base)) {
		const sp = d.spaces[c]; if (!sp) continue
		if (wantSea !== (sp.terrain === 'sea')) continue
		if (Object.values(g.location).indexOf(c) < 0) return c
	}
	return null
}
function emptyLandNeighbor(g, sea) {
	for (const c of I.get_connections(g, sea)) {
		const sp = d.spaces[c]; if (!sp) continue
		if (sp.terrain === 'sea') continue
		if (Object.values(g.location).indexOf(c) < 0) return c
	}
	return null
}

function testCard(id, nation, type) {
	console.log('\n=== ' + id + ' (' + nation + ', ' + type + ') ===')
	const g = fresh()
	const home = I.home_base_of(nation)
	ensureHomeArmy(g, nation) // home 有本国陆军（补给源）
	let base
	if (type === 'navy') {
		base = emptyNeighbor(g, home, true) // 找一处空海域作为"刚建好的海军"
		if (base == null) { ok(id + ' 跳过(无相邻空海域)', true); return }
		putInSupply(g, nation, 'navy', base)
	} else {
		base = home // 刚建好的陆军就在 home（ensureHomeArmy 放的）
	}
	const tr = I.STATUS_EFFECTS[id].trigger
	if (typeof tr.run !== 'function') { ok(id + ' 无 run', false); return }

	// A. 无 space -> 拒绝（请选择建设地区）
	let r = I.run_status_effect(g, nation, id, tr, {}, base)
	ok('A 无 space -> 拒绝(请选择建设地区)', !r.ok && /建设地区/.test(r.reason || ''), r.reason)

	// B. 同格(已占) -> 失败（不兜底）
	r = I.run_status_effect(g, nation, id, tr, { space: base }, base)
	ok('B 同格(已占) -> 失败(不兜底)', !r.ok, r.reason)

	// C. 相邻合法空地 -> 成功建设/征召（候选可能多个，逐个尝试）
	// 海军还需满足 cond2：候选海域须邻接一处友方陆地（在跑之前放置一支本国陆军补上）。
	const cands = []
	for (const c of I.get_connections(g, base)) {
		const sp = d.spaces[c]; if (!sp) continue
		if ((type === 'navy') !== (sp.terrain === 'sea')) continue
		if (Object.values(g.location).indexOf(c) >= 0) continue
		if (type === 'navy' && emptyLandNeighbor(g, c) == null) continue // 无陆地邻接 -> cond2 无法满足
		cands.push(c)
	}
	if (cands.length === 0) { ok(id + ' 无相邻空地可测', true); return }
	let builtNb = null, before = 0
	for (const nb of cands) {
		// 海军：在候选海域的陆地邻格放一支本国陆军以满足 cond2
		let land = null
		if (type === 'navy') {
			land = emptyLandNeighbor(g, nb)
			if (land != null) putInSupply(g, nation, 'army', land)
		}
		before = (type === 'navy') ? countNavy(g, nation) : countArmy(g, nation)
		const rr = I.run_status_effect(g, nation, id, tr, { space: nb }, base)
		if (rr.ok) { builtNb = nb; break }
		if (type === 'navy') console.log('    [navy diag] nb=' + d.name_of(nb) + ' reason=' + (rr.reason || ''))
		if (land != null) delete g.location[Object.keys(g.location).find(p => g.location[p] === land && g.piece_nation[p] === nation && g.piece_type[p] === 'army')]
	}
	ok('C 相邻空地 -> 成功', builtNb != null, builtNb != null ? ('在' + d.name_of(builtNb)) : '所有候选均被拒')
	if (builtNb != null) {
		const after = (type === 'navy') ? countNavy(g, nation) : countArmy(g, nation)
		ok('C 对应兵种 +1', after === before + 1, 'before=' + before + ' after=' + after)
	}
}

testCard('17552', '美国', 'army')
testCard('17547', '美国', 'army')
testCard('17550', '美国', 'navy')
testCard('17843', '苏联', 'army') // 征召
testCard('15248', '德国', 'army')

console.log('\n==== 结果：' + pass + ' 通过 / ' + fail + ' 失败 ====')
process.exit(fail ? 1 : 0)
