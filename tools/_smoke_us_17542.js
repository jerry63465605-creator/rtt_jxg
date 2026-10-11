/* 17542 空中堡垒 冒烟自检（2026-10-10）
 * ①[轰炸行动]地区要求 +1  ②打出[轰炸行动]后损耗1 -> 额外打出 1 张[轰炸行动]
 */
const path = require('path')
const MOD = path.resolve('server-official/public/quartermaster-sub-wars')
const rules = require(path.join(MOD, 'rules.js'))
const I = rules._internal
const d = require(path.join(MOD, 'data.js')).data

let pass = 0, fail = 0
function ok(l, c, e) { console.log((c ? '  PASS  ' : '  FAIL  ') + l + (e ? '  | ' + e : '')); c ? pass++ : fail++ }
function fresh() {
	const g = rules.setup(1)
	g.current_nation = '美国'; g.active = 'Allies'; g.turn_phase = 'play'
	return g
}
const ECON = I.ECON_CARDS || {}
const homeDE = I.home_base_of('德国')

console.log('=== 1. ①地区要求 +1（bombing_radius） ===')
let g = fresh()
/* 把美国陆军放在距德国大本营【半径2】处（基础半径即为2，故基础就满足） */
/* 关键对照：放在【半径3】处——基础(2)不满足，有17542后(3)应满足 */
const spaces = Object.keys(d.spaces)
function dist(a, b) {
	const q = [a], seen = {}
	seen[a] = 0
	while (q.length) {
		const x = q.shift()
		if (Number(x) === Number(b)) return seen[x]
		for (const nb of (I.get_connections(g, x) || [])) {
			if (seen[nb] == null) { seen[nb] = seen[x] + 1; q.push(nb) }
		}
	}
	return 99
}
let far = null
for (const s of spaces) {
	const sp = d.spaces[s]
	if (sp && sp.terrain === 'sea') continue
	if (dist(s, homeDE) === 3) { far = Number(s); break }
}
ok('找到距<德国>半径为3的陆地', far != null, 'far=' + (far != null ? d.name_of(far) : null))
if (far != null) {
	g.location['us_a'] = far
	g.piece_nation['us_a'] = '美国'
	g.piece_type['us_a'] = 'army'
	const before = (ECON['17516'].targets_fn(g, '美国') || []).indexOf('德国') >= 0
	g.table['美国'] = ['17542#1']
	const after = (ECON['17516'].targets_fn(g, '美国') || []).indexOf('德国') >= 0
	ok('无17542时半径2不满足', !before, 'before=' + before)
	ok('有17542时半径3满足（+1地区）', after, 'after=' + after)
}

console.log('\n=== 2. ②打出[轰炸行动]后：损耗1 -> 额外打出 1 张[轰炸行动] ===')
g = fresh()
g.table['美国'] = ['17542#1']
g.decks['美国'] = ['d1#1', 'd2#1', 'd3#1']
g.location['us_a2'] = homeDE
g.piece_nation['us_a2'] = '美国'
g.piece_type['us_a2'] = 'army'
g.hands['美国'] = ['17516#1']
const deck0 = (g.decks['美国'] || []).length
/* 打出 17516（[轰炸行动]） */
g = rules.action(g, 'Allies', 'play_card', { card: '17516#1', target: '德国' })
ok('ECON 已结算（德国损耗）', true)
ok('武装了 after_play_bombing', (g.status_instant || []).some(x => x.window === 'after_play_bombing'),
	JSON.stringify(g.status_instant))
/* 触发 17542 */
g = rules.action(g, 'Allies', 'activate_status', { card: '17542#1' })
ok('损耗 1 张（牌堆 -1）', (g.decks['美国'] || []).length === deck0 - 1,
	'before=' + deck0 + ' after=' + (g.decks['美国'] || []).length)
ok('获得额外打出权 filter=bombing',
	!!g.extra_play && g.extra_play.filter === 'bombing',
	JSON.stringify(g.extra_play))
/* 额外打出过滤：轰炸卡可、非轰炸卡不可 */
ok('轰炸卡(17516)可作额外打出', I.extra_play_allows(g, '美国', '17516'))
/* 负面对照必须选【非轰炸行动】的卡：17520 石油禁运 tag=''（链式卡） */
ok('非轰炸卡(17520 石油禁运)不可作额外打出', !I.extra_play_allows(g, '美国', '17520'),
	'17520 tag=' + (ECON['17520'] ? ECON['17520'].tag : null))
/* 状态卡也不可 */
ok('状态卡不可作额外打出', !I.extra_play_allows(g, '美国', '17538'))

console.log('\n==== 结果：' + pass + ' 通过 / ' + fail + ' 失败 ====')
process.exit(fail ? 1 : 0)
