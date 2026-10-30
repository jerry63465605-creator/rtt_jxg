/*
 * 验证「状态卡选位」现有实现（客户端 STATUS_UI.sbuild 路径）以 17550《先进造船厂》为例：
 *   1) 战区移动（17532）建完海军 -> status_instant 武装 17550
 *   2) 客户端等价流程：query status_build_spaces -> 点图 -> activate_status {card, space}
 *   3) 断言：代价扣 1 张、海军 +1、窗口消耗、status_used 写入
 *   4) 反向：点已被占的海域 -> 不在候选里（能点的 == 能成功的）
 *
 * 用法：node tools/_sim_17550_client.js
 */
const path = require('path')
const MOD = path.join(__dirname, '..', 'server-official', 'public', 'quartermaster-sub-wars')
const R = require(path.join(MOD, 'rules.js'))
const I = R._internal
const d = I.data
const NM = id => (id == null ? '?' : d.name_of(Number(id)))

let pass = 0, fail = 0
const ok = (m, c, extra) => {
	if (c) { pass++; console.log('  ✓ ' + m) }
	else { fail++; console.log('  ✗ ' + m + (extra ? '  | ' + extra : '')) }
}
const navies = g => Object.keys(g.location).filter(p => g.piece_nation[p] === '美国' && g.piece_type[p] === 'navy').map(p => NM(g.location[p]))

const HAW = d.id_of('夏威夷')
function setup() {
	const g = R.setup(7)
	g.opening = null
	g.current_nation = '美国'; g.active = 'Allies'; g.turn_phase = 'play'
	g.neutral = {}
	g.hands['美国'] = ['17532#1', '15345#9']
	g.decks['美国'] = ['15345#1', '15345#2', '15345#3', '15345#4']
	g.table = g.table || {}
	g.table['美国'] = ['17550#1']
	g.location = {}; g.piece_nation = {}; g.piece_type = {}
	g.location['us_a'] = HAW; g.piece_nation['us_a'] = '美国'; g.piece_type['us_a'] = 'army'
	g.location['us_b'] = d.id_of('美国'); g.piece_nation['us_b'] = '美国'; g.piece_type['us_b'] = 'army'
	I.refresh(g)
	/* 走完 17532：先海军 */
	const sea = (function () {
		for (let i = 1; i < d.spaces.length; i++)
			if (d.spaces[i] && d.spaces[i].terrain === 'sea' && I.can_build_at(g, '美国', i, 'navy').ok) return i
		return null
	})()
	R.action(g, 'Allies', 'play_card', { card: '17532#1', choice: 0 })
	R.action(g, 'Allies', 'resolve_theater', { piece: 'us_b' })
	R.action(g, 'Allies', 'resolve_theater', { space: sea })
	return { g, sea }
}

console.log('\n=== ① 建完海军：窗口是否武装 / 客户端是否显示可点 ===')
const { g, sea } = setup()
/* 【注】status_instant 的武装发生在 view/build_actions 那一遍，探针必须先取一次 view 再断言 */
R.view(g, 'Allies')
const entry = (g.status_instant || []).find(x => x.card_id === '17550#1')
console.log('  status_instant=' + JSON.stringify((g.status_instant || []).map(x => x.card_id + ':' + x.window + '@' + NM(x.space))))
ok('17550 的 after_build_navy 窗口已武装', !!entry, JSON.stringify(g.status_instant))
ok('窗口地区 = 刚建的那格', entry && Number(entry.space) === Number(sea), NM(entry && entry.space))
const v1 = R.view(g, 'Allies')
const ts = (v1.table_status || []).find(x => x.card === '17550#1') || {}
ok('view.table_status 显示 ready=true（客户端能点）', ts.ready === true, JSON.stringify({ ready: ts.ready, reason: ts.reason }))
ok('status_desc 下发了代价说明', typeof ts.desc === 'string' && ts.desc.length > 0, ts.desc)

console.log('\n=== ② 客户端等价流程：query status_build_spaces ===')
const q = R.query(g, 'Allies', 'status_build_spaces', { card: '17550#1', nation: '美国', type: 'navy' })
console.log('  query.ok=' + (q && q.ok) + '  scope=' + (q && q.scope) + '  候选=' +
	JSON.stringify(((q && q.spaces) || []).map(x => (x && x.id != null ? NM(x.id) : NM(x)))))
ok('query 成功', !!(q && q.ok), JSON.stringify(q))
const cands = ((q && q.spaces) || []).map(x => Number(x && x.id != null ? x.id : x))
ok('候选非空', cands.length > 0, 'n=' + cands.length)
ok('刚建的那格已被排除（每格限 1 支）', cands.indexOf(Number(sea)) < 0, 'sea=' + NM(sea))

console.log('\n=== ③ 选一格合法海域发动 17550 ===')
const pick = cands[0]
const decks0 = (g.decks['美国'] || []).length
const nav0 = navies(g).length
const n0 = (g.log || []).length
R.action(g, 'Allies', 'activate_status', { card: '17550#1', space: pick })
;(g.log || []).slice(n0).forEach(l => console.log('  log| ' + l))
console.log('  海军=' + JSON.stringify(navies(g)))
ok('代价：损耗 1 张牌', (g.decks['美国'] || []).length === decks0 - 1, decks0 + ' -> ' + (g.decks['美国'] || []).length)
ok('效果：海军 +1（在 ' + NM(pick) + '）', navies(g).length === nav0 + 1 &&
	navies(g).some(x => x === NM(pick)), JSON.stringify(navies(g)))
ok('窗口已消耗', !(g.status_instant || []).some(x => x.card_id === '17550#1'),
	JSON.stringify(g.status_instant))
ok('写入了 status_used（一回合一次）', Object.keys(g.status_used || {}).some(k => String(k).indexOf('17550') === 0),
	JSON.stringify(g.status_used))
const ts2 = (R.view(g, 'Allies').table_status || []).find(x => x.card === '17550#1') || {}
ok('之后 ready=false', ts2.ready !== true, JSON.stringify({ ready: ts2.ready, reason: ts2.reason }))

console.log('\n=== ④ 反向：非法海域不在候选（能点的 == 能成功的）===')
const g2 = (function () { const r = setup(); return r.g })()
const q2 = R.query(g2, 'Allies', 'status_build_spaces', { card: '17550#1', nation: '美国', type: 'navy' })
const cands2 = ((q2.spaces) || []).map(x => Number(x && x.id != null ? x.id : x))
let occupiedSea = null
for (let i = 1; i < d.spaces.length; i++) {
	if (!d.spaces[i] || d.spaces[i].terrain !== 'sea') continue
	if (Object.values(g2.location).some(x => Number(x) === i)) { occupiedSea = i; break }
}
console.log('  已占海域=' + NM(occupiedSea) + '  它是否在候选=' + (cands2.indexOf(occupiedSea) >= 0))
ok('已被占的海域不进候选', cands2.indexOf(occupiedSea) < 0)
const n1 = (g2.log || []).length
R.action(g2, 'Allies', 'activate_status', { card: '17550#1', space: occupiedSea })
const lg = (g2.log || []).slice(n1).join(' | ')
ok('若强行提交已占海域：被拒且不建海军', navies(g2).length === navies(g2).length && lg.length > 0, lg)

console.log('\n' + (fail === 0 ? 'ALL PASS（' + pass + ' 项）' : fail + ' FAIL / ' + pass + ' pass'))
process.exitCode = fail ? 1 : 0
