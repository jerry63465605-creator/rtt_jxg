/*
 * 验证 15345 塞内加尔步兵团（玩家 2026-09-28 口径）：
 *
 *   前段（打出即生效，一次性，永久）：
 *     <非洲南部> 成为【仅对法国】的补给点 + 增加 2 个计分标记
 *   后段（可重复触发，每回合一次）：
 *     代价 = 跳过出牌阶段；效果 = 法国在<非洲南部>征召陆军
 *   约束：
 *     "跳过出牌"必须在【打出牌之前】选择；本回合已打出过牌则不能再触发。
 *
 * 用法（从仓库根）：node tools/_verify_15345.js
 */
const path = require('path')
const MOD = path.join(__dirname, '..', 'server-official', 'public', 'quartermaster-sub-wars')
const rules = require(path.join(MOD, 'rules.js'))
const I = rules._internal
const d = require(path.join(MOD, 'data.js')).data

let pass = 0, fail = 0
function ok(label, cond, extra) {
	console.log((cond ? '  PASS  ' : '  FAIL  ') + label + (extra ? '  | ' + extra : ''))
	cond ? pass++ : fail++
}
const SP_AFR_S = d.id_of('非洲南部')

/* ---------- ① 打出即生效（前段，一次性 + 永久） ---------- */
console.log('=== ① 打出 15345：补给点 + 计分标记（立即、永久） ===')
let g = rules.setup(1)
g.current_nation = '英国'
g.active = 'Allies'
g.turn_phase = 'play'
g.play_done = {}
g.hands['英国'].push('15345#1')
g = rules.action(g, 'Allies', 'play_card', { card: '15345#1' })

ok('15345 进桌面', (g.table['英国'] || []).indexOf('15345#1') >= 0)
ok('非洲南部增加 2 个计分标记', (g.markers[SP_AFR_S] || []).length === 2,
	'len=' + (g.markers[SP_AFR_S] || []).length)
ok('非洲南部成为补给点（对同盟/法国阵营）',
	I.is_supply_point(g, SP_AFR_S, 'allies') === true,
	'is_supply_point(allies)=' + I.is_supply_point(g, SP_AFR_S, 'allies'))
ok('仅对法国：轴心不享受该补给点',
	I.is_supply_point(g, SP_AFR_S, 'axis') !== true,
	'is_supply_point(axis)=' + I.is_supply_point(g, SP_AFR_S, 'axis'))
/* 一次性：再打一张同名卡不应重复叠加标记（此处只验证打出这张时标记恰为 2） */
ok('标记归属法国（S1① 仅对法国）',
	(g.markers[SP_AFR_S] || []).every(m => m.owner === '法国' || m.faction === 'allies' || m.owner == null),
	JSON.stringify(g.markers[SP_AFR_S] || []))

/* ---------- ② 打出牌的当回合：不能再"跳过出牌" ---------- */
console.log('\n=== ② 本回合已打出牌 -> 不能再触发"跳过出牌阶段" ===')
let v = rules.view(g, 'Allies')
let e45 = (v.table_status || []).find(x => x.card === '15345#1') || {}
ok('打出 15345 的当回合 ready=false（出牌行动已用掉）', e45.ready === false,
	'reason=' + (e45.ready_reason || ''))

/* ---------- ③ 新回合（未打出牌）：可触发，触发后法国征召 ---------- */
console.log('\n=== ③ 新回合未打出牌 -> 可触发（跳过出牌，法国征召） ===')
g.play_done = {}                 /* 模拟进入新回合，出牌名额未用 */
g.turn_phase = 'play'
delete g.skip_play_done
v = rules.view(g, 'Allies')
e45 = (v.table_status || []).find(x => x.card === '15345#1') || {}
ok('未打出牌时 ready=true', e45.ready === true, 'reason=' + (e45.ready_reason || ''))

const before = Object.keys(g.location).filter(p =>
	g.piece_nation[p] === '法国' && g.piece_type[p] === 'army' &&
	g.location[p] === SP_AFR_S).length
g = rules.action(g, 'Allies', 'activate_status', { card: '15345#1' })
const after = Object.keys(g.location).filter(p =>
	g.piece_nation[p] === '法国' && g.piece_type[p] === 'army' &&
	g.location[p] === SP_AFR_S).length
ok('法国在非洲南部征召 1 支陆军', after === before + 1, 'before=' + before + ' after=' + after)
ok('本回合标记为已跳过出牌', (g.skip_play_done || {})['英国'] === g.turn,
	'skip_play_done=' + JSON.stringify(g.skip_play_done || {}))
ok('触发后卡仍保留在桌面（A3① 可重复触发）',
	(g.table['英国'] || []).indexOf('15345#1') >= 0)

/* ---------- ④ 已跳过的回合：不能再触发 ---------- */
console.log('\n=== ④ 已跳过出牌的回合 -> 不能重复触发 ===')
v = rules.view(g, 'Allies')
e45 = (v.table_status || []).find(x => x.card === '15345#1') || {}
ok('已跳过出牌后 ready=false', e45.ready === false, 'reason=' + (e45.ready_reason || ''))

/* ---------- ⑤ 再下一回合：又可触发（可重复触发） ---------- */
console.log('\n=== ⑤ 下一回合 -> 又可触发（可重复触发） ===')
g.play_done = {}
delete g.skip_play_done
g.turn = (g.turn || 1) + 1
g.turn_phase = 'play'
v = rules.view(g, 'Allies')
e45 = (v.table_status || []).find(x => x.card === '15345#1') || {}
ok('新回合 ready=true（可重复触发）', e45.ready === true, 'reason=' + (e45.ready_reason || ''))

/* ---------- ⑥ 卡图字段 ---------- */
console.log('\n=== ⑥ view.table_status 含卡图 img ===')
ok('table_status 给出 img（客户端据此显示卡图）', !!e45.img, 'img=' + (e45.img || 'null'))
ok('img 是 15345 的卡图', e45.img === 'sheet153_r5_c0.png', 'img=' + e45.img)

console.log('\n通过 ' + pass + ' / 失败 ' + fail)
process.exit(fail ? 1 : 0)
