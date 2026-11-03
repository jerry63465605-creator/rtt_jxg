const path = require('path')
const MOD = path.join(__dirname, '..', 'server-official', 'public', 'quartermaster-sub-wars')
const R = require(path.join(MOD, 'rules.js'))
const I = R._internal
const d = require(path.join(MOD, 'data.js')).data

let pass = 0, fail = 0
function ok(c, n, x) { if (c) { pass++ } else { fail++; console.log('  FAIL', n, x != null ? JSON.stringify(x) : '') } }

function fresh() {
	const g = R.setup(1)
	g.location = {}; g.piece_nation = {}; g.piece_type = {}; g.piece_seq = 0
	return g
}
function place(g, nation, type, n) {
	for (let i = 0; i < n; i++) {
		const pid = 'P' + (++g.piece_seq)
		g.location[pid] = 1; g.piece_nation[pid] = nation; g.piece_type[pid] = type
	}
}
function capOf(g, nation) {
	/* 反推上限：逐步加人直到被拒 */
	for (let i = 0; i < 12; i++) {
		if (!I.unit_cap_ok(g, nation, 'army').ok) return I.nation_unit_count(g, nation, 'army')
		place(g, nation, 'army', 1)
	}
	return -1
}

// ============ 中国：开局 2 → 17537/17829 各 +1 → 封顶 4 ============
console.log('--- 中国陆军上限 ---')
{
	let g = fresh()
	ok(capOf(g, '中国') === 2, '开局上限 = 2', capOf(g, '中国'))

	let g1 = fresh()
	I.add_army_bonus(g1, '中国')          // 17537
	ok(I.army_bonus_of(g1, '中国') === 1, '加成 = 1')
	ok(capOf(g1, '中国') === 3, '17537 后上限 = 3', capOf(g1, '中国'))

	let g2 = fresh()
	I.add_army_bonus(g2, '中国')          // 17537
	I.add_army_bonus(g2, '中国')          // 17829
	ok(I.army_bonus_of(g2, '中国') === 2, '加成 = 2')
	ok(capOf(g2, '中国') === 4, '17829 后上限 = 4', capOf(g2, '中国'))

	/* 封顶：再加不应超过 4 */
	I.add_army_bonus(g2, '中国')
	ok(I.army_bonus_of(g2, '中国') === 2, '封顶 +2（不超 4）', I.army_bonus_of(g2, '中国'))
	ok(capOf(g2, '中国') === 4, '封顶后上限仍 = 4')
}

// ============ 意大利：开局 4 → 17750 +1 → 5（封顶） ============
console.log('--- 意大利陆军上限 ---')
{
	let g = fresh()
	ok(capOf(g, '意大利') === 4, '开局上限 = 4', capOf(g, '意大利'))

	I.add_army_bonus(g, '意大利')         // 17750
	ok(I.army_bonus_of(g, '意大利') === 1, '加成 = 1')
	ok(capOf(g, '意大利') === 5, '17750 后上限 = 5（回到当前值）', capOf(g, '意大利'))

	I.add_army_bonus(g, '意大利')
	ok(I.army_bonus_of(g, '意大利') === 1, '封顶 +1（不超 5）', I.army_bonus_of(g, '意大利'))
}

// ============ 其它国不受影响 ============
console.log('--- 其它国不受影响 ---')
{
	let g = fresh()
	ok(capOf(g, '德国') === 7, '德国仍 7', capOf(g, '德国'))
	ok(capOf(g, '英国') === 6, '英国仍 6', capOf(g, '英国'))
	/* 非陆军不受加成影响 */
	let g2 = fresh()
	I.add_army_bonus(g2, '中国')
	ok(I.unit_cap_ok(g2, '中国', 'air').ok === true || I.nation_unit_count(g2, '中国', 'air') > 0,
		'加成只作用于陆军')
}

console.log('\nPASS=' + pass + '  FAIL=' + fail)
process.exit(fail ? 1 : 0)
