/*
 * B1 真实测试：15228《高速公路》/17827《西伯利亚大铁路》—— 收回陆军时载体空军的去处
 *
 * 玩家口径：有【相邻】本国海军就撤离（不要求该海军补给）；没有就随陆军一起被消灭。
 * （同格不可能同时有陆军+海军，属非法布阵，不测。）
 *
 *  A 无相邻海军                 -> 空军被消灭
 *  B 相邻格有本国海军（未补给）  -> 空军撤离到该格，日志含"撤离"，且不要求补给
 *  C 相邻海军是【敌方】的        -> 不算，空军被消灭
 *  D 17827 苏联版同款            -> 行为一致（同一原子）
 *  E 静态守卫：railroad_recall 里处理 air
 *
 * 用法：node tools/_real_test_15228_air.js
 */
const fs = require('fs')
const path = require('path')
const ROOT = path.join(__dirname, '..')
const MOD = path.join(ROOT, 'server-official', 'public', 'quartermaster-sub-wars')
const R = require(path.join(MOD, 'rules.js'))
const I = R._internal
const d = I.data

let pass = 0, fail = 0
const ok = (m, c, extra) => { if (c) { pass++; console.log('  ✓ ' + m) } else { fail++; console.log('  ✗ ' + m + (extra ? '  | ' + extra : '')) } }
const logSince = (g, n) => (g.log || []).slice(n).join(' | ')

function setup(nation) {
	const g = R.setup(7)
	g.opening = null
	g.neutral = { '苏联': false, '美国': false, '德国': false }
	I.refresh(g)
	R.action(g, 'Axis', 'debug_set_phase', { nation: '德国', phase: 'play' })
	const face = nation === '苏联' ? '17827' : '15228'
	if (!(g.hands['德国'] || []).some(x => String(x).startsWith(face)))
		R.action(g, 'Axis', 'debug_add_card', { face, nation: '德国', dest: 'hand' })
	I.refresh(g)
	return g
}

/* 找陆军所在格的相邻海域（放海军用） */
function neighborSea(g, sp) {
	return I.get_connections(g, sp, 'axis').map(Number)
		.find(s => d.spaces[s] && d.spaces[s].terrain === 'sea')
}

console.log('=== A. 无相邻海军 → 空军被消灭 ===')
{
	const g = setup('德国')
	const home = d.id_of('德国')
	R.action(g, 'Axis', 'debug_place', { piece: 'de_a', nation: '德国', type: 'army', space: home })
	R.action(g, 'Axis', 'debug_place', { piece: 'de_air', nation: '德国', type: 'air', space: home })
	I.refresh(g)
	const card = (g.hands['德国'] || []).find(x => String(x).startsWith('15228'))
	const n0 = (g.log || []).length
	R.action(g, 'Axis', 'play_card', { card })
	const lg = logSince(g, n0)
	console.log('  log: ' + lg.slice(0, 200))
	console.log('  de_air.location = ' + JSON.stringify(g.location['de_air']))
	ok('★★ 空军随陆军一起被消灭', g.location['de_air'] == null, String(g.location['de_air']))
	ok('★ 日志说明了原因', /没有相邻本国海军|一起被消灭/.test(lg), lg.slice(0, 120))
	ok('★ 陆军确实被收回（进入重建）', !!g.pending_autobahn || /收回/.test(lg), JSON.stringify(g.pending_autobahn && g.pending_autobahn.remaining))
}

console.log('\n=== B. 相邻格有本国海军（未补给）→ 撤离 ===')
{
	const g = setup('德国')
	const home = d.id_of('德国')
	const sea = neighborSea(g, home)
	R.action(g, 'Axis', 'debug_place', { piece: 'de_a', nation: '德国', type: 'army', space: home })
	R.action(g, 'Axis', 'debug_place', { piece: 'de_air', nation: '德国', type: 'air', space: home })
	R.action(g, 'Axis', 'debug_place', { piece: 'de_n', nation: '德国', type: 'navy', space: sea })
	I.refresh(g)
	console.log('  相邻海域=' + d.name_of(sea) + '（故意不 grant_supply）')
	const card = (g.hands['德国'] || []).find(x => String(x).startsWith('15228'))
	const n0 = (g.log || []).length
	R.action(g, 'Axis', 'play_card', { card })
	const lg = logSince(g, n0)
	console.log('  log: ' + lg.slice(0, 200))
	console.log('  de_air.location = ' + g.location['de_air'] + '（' + d.name_of(g.location['de_air']) + '）')
	ok('★★ 空军撤离到相邻海军所在格', Number(g.location['de_air']) === sea, g.location['de_air'] + ' vs ' + sea)
	ok('★ 日志含"撤离"', /撤离/.test(lg), lg.slice(0, 120))
	ok('★ 不要求海军补给（照常撤离）', true)
}

console.log('\n=== C. 相邻海军是【敌方】的 → 不算，空军被消灭 ===')
{
	const g = setup('德国')
	const home = d.id_of('德国')
	const sea = neighborSea(g, home)
	R.action(g, 'Axis', 'debug_place', { piece: 'de_a', nation: '德国', type: 'army', space: home })
	R.action(g, 'Axis', 'debug_place', { piece: 'de_air', nation: '德国', type: 'air', space: home })
	R.action(g, 'Allies', 'debug_place', { piece: 'uk_n', nation: '英国', type: 'navy', space: sea })
	I.refresh(g)
	const card = (g.hands['德国'] || []).find(x => String(x).startsWith('15228'))
	const n0 = (g.log || []).length
	R.action(g, 'Axis', 'play_card', { card })
	const lg = logSince(g, n0)
	console.log('  log: ' + lg.slice(0, 200))
	console.log('  de_air.location = ' + JSON.stringify(g.location['de_air']))
	ok('★★ 敌方海军不算撤离目标，空军被消灭', g.location['de_air'] == null, String(g.location['de_air']))
}

console.log('\n=== D. 17827 苏联版同款 ===')
{
	const g = setup('苏联')
	/* 17827 由苏联打出：把卡放到苏联手上 */
	R.action(g, 'Axis', 'debug_add_card', { face: '17827', nation: '苏联', dest: 'hand' })
	I.refresh(g)
	const suHome = d.id_of('罗斯')
	R.action(g, 'Axis', 'debug_place', { piece: 'su_a', nation: '苏联', type: 'army', space: suHome })
	R.action(g, 'Axis', 'debug_place', { piece: 'su_air', nation: '苏联', type: 'air', space: suHome })
	R.action(g, 'Allies', 'debug_set_phase', { nation: '苏联', phase: 'play' })   /* 换到苏联回合才能打 */
	I.refresh(g)
	const card = (g.hands['苏联'] || []).find(x => String(x).startsWith('17827'))
	console.log('  17827 卡 = ' + card)
	R.action(g, 'Allies', 'play_card', { card })
	console.log('  log 末段: ' + (g.log || []).slice(-3).join(' | ').slice(0, 220))
	console.log('  su_air.location = ' + JSON.stringify(g.location['su_air']))
	ok('★ 苏联版同样处理空军（无海军→被消灭）', g.location['su_air'] == null, String(g.location['su_air']))
	ok('★ 苏联陆军被收回', !!g.pending_autobahn, JSON.stringify(g.pending_autobahn && g.pending_autobahn.remaining))
}

console.log('\n=== E. 静态守卫 ===')
{
	const src = fs.readFileSync(path.join(MOD, 'rules.js'), 'utf8')
	const i = src.indexOf('function railroad_recall')
	const seg = src.slice(i, i + 2200)
	ok('railroad_recall 处理 piece_type===air', /piece_type\[q\] === 'air'/.test(seg))
	ok('有相邻本国海军则改 location（撤离）', /game\.location\[air\] = nb/.test(seg))
	ok('无海军则 remove_piece（消灭）', /remove_piece\(game, who, air\)/.test(seg))
}

console.log('\n' + (fail === 0 ? 'ALL PASS（' + pass + ' 项）' : fail + ' FAIL / ' + pass + ' 项'))
process.exitCode = fail ? 1 : 0
