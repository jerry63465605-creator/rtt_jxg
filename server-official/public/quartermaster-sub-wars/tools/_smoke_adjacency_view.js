"use strict"
/*
 * 邻接口径回归（D6，2026-10-23）
 *
 * 本作有两种邻接，语义不同：
 *   neighbors_of(game, space)        几何邻接（地图上挨着）
 *   neighbors_of(game, space, side)  阵营视角（叠海峡控制 + 卡牌改写的邻接）
 *
 * 规则依据（easy_rule 八、海峡）：海峡连接的两片海域，对控制方相邻、对另一方不相邻。
 * 因此"玩家能去哪儿/能在哪儿做事"必须用带 side 的版本。
 *
 * 本测试锁定：
 *   ① 两种口径确实不同（否则 D6 无意义）
 *   ② around 候选（"X 及相邻地区"类 9 张卡）已改用阵营视角
 *   ③ 差异格数量基线（局面外因变化时报警）
 */
const fs = require('fs')
const path = require('path')
const rules = require('../rules.js')
const I = rules._internal
const data = I.data
const nm = (id) => data.name_of(id)

let pass = 0, fail = 0
function ok(name, cond, detail) {
	if (cond) { pass++; console.log('  PASS  ' + name + (detail ? '  | ' + detail : '')) }
	else { fail++; console.log('  FAIL  ' + name + (detail ? '  | ' + detail : '')) }
}

const g = rules.setup(42, rules.default_scenario, {})
const diff = (a, b) => a.filter(x => b.indexOf(x) < 0)

console.log('\n=== A. 两种口径确实不同（规则依据：海峡）===')
{
	const eastPac = data.id_of('东太平洋')
	const geo = I.neighbors_of(g, eastPac)
	const allies = I.neighbors_of(g, eastPac, 'allies')
	const axis = I.neighbors_of(g, eastPac, 'axis')
	ok('几何邻接不含北大西洋', diff([data.id_of('北大西洋')], geo).length === 1,
		geo.map(nm).join('/'))
	ok('同盟视角【含】北大西洋（拉丁美洲海峡默认归同盟）',
		allies.indexOf(data.id_of('北大西洋')) >= 0, allies.map(nm).join('/'))
	ok('轴心视角【不含】北大西洋', axis.indexOf(data.id_of('北大西洋')) < 0,
		axis.map(nm).join('/'))
}
{
	const baltic = data.id_of('波罗的海')
	const geo = I.neighbors_of(g, baltic)
	ok('几何邻接不含北海', geo.indexOf(data.id_of('北海')) < 0, geo.map(nm).join('/'))
	ok('轴心视角【含】北海（北欧海峡默认归轴心）',
		I.neighbors_of(g, baltic, 'axis').indexOf(data.id_of('北海')) >= 0,
		I.neighbors_of(g, baltic, 'axis').map(nm).join('/'))
}

console.log('\n=== B. 差异格基线（初始局面）===')
{
	const set = new Set()
	for (const side of ['axis', 'allies']) {
		for (let i = 1; i < data.spaces.length; i++) {
			if (!data.spaces[i]) continue
			const geo = I.neighbors_of(g, i).slice().sort((a, b) => a - b)
			const conn = I.neighbors_of(g, i, side).slice().sort((a, b) => a - b)
			if (geo.join() !== conn.join()) set.add(i + side)
		}
	}
	ok('几何 vs 阵营 的差异（格×阵营）基线 = 9', set.size === 9,
		[...set].map(x => x.slice(0, -4) + '/' + x.slice(-4)).join(' '))
}

console.log('\n=== C. around 候选已改用阵营视角（源码断言）===')
{
	const SRC = fs.readFileSync(path.join(__dirname, '..', 'rules.js'), 'utf8')
	ok('around 分支调用 neighbors_of(..., faction_of_nation(effActor))',
		/for \(const nb of neighbors_of\(game, center, faction_of_nation\(effActor\)\)\)/.test(SRC))
	ok('around 分支不再直读 data.spaces[center].connections',
		!/data\.spaces\[center\]\.connections/.test(SRC))
	/* 9 张 around 卡的配置仍在（未误删） */
	const aroundCount = (SRC.match(/around:\s*'/g) || []).length
	ok('around 配置数量 ≥ 8', aroundCount >= 8, aroundCount + ' 处')
}

console.log('\n=== D. 带 side 与否的返回类型稳定 ===')
{
	const anyId = data.id_of('德国')
	ok('几何版本返回数组', Array.isArray(I.neighbors_of(g, anyId)))
	ok('阵营版本返回数组', Array.isArray(I.neighbors_of(g, anyId, 'axis')))
	ok('未知格位返回空数组或零长', (I.neighbors_of(g, 99999) || []).length === 0)
}

console.log('\n' + (fail === 0 ? 'ALL PASS (' + pass + ')' : fail + ' FAIL / ' + pass + ' PASS'))
process.exitCode = fail ? 1 : 0
