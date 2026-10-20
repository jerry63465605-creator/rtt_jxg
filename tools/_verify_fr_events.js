/*
 * 验证两张法国事件卡（由英国玩家打出，2026-09-29 修复）：
 *
 *   15323 法国陆军：choice [[build army],[battle land]]
 *     修复前：event_targets 忽略客户端传的 choice -> 永远返回 need:'choice'
 *             -> 客户端反复弹同一个二选一框 -> 永远无法建设（死循环）
 *     修复后：带 choice 查询 -> 返回 need:null（可直接执行）
 *
 *   15325 莱茵河与多瑙河：steps [build army, battle land(useNewPiece)]
 *     修复前：step1 候选 0（新陆军还没建出来）-> 不询问 -> 自动"空打"
 *             -> 玩家没机会选攻击目标
 *     修复后：step1 候选包含"与前一步新建位相邻"的陆地目标 -> 需要玩家选
 *
 * 用法（从仓库根）：node tools/_verify_fr_events.js
 */
const path = require('path')
const MOD = path.join(__dirname, '..', 'server-official', 'public', 'quartermaster-sub-wars')
const rules = require(path.join(MOD, 'rules.js'))
const d = require(path.join(MOD, 'data.js')).data
const SEQ = require(path.join(MOD, 'tools', 'event_click_seq.js'))

let pass = 0, fail = 0
function ok(label, cond, extra) {
	console.log((cond ? '  PASS  ' : '  FAIL  ') + label + (extra ? '  | ' + extra : ''))
	cond ? pass++ : fail++
}
const WEU = d.id_of('西欧')

function mk() {
	const g = rules.setup(93)
	g.current_nation = '英国'
	g.active = 'Allies'
	g.turn_phase = 'play'
	g.play_done = {}
	g.hands['英国'] = ['15323#1', '15325#1']
	return g
}

/* ================= 15323 法国陆军 ================= */
console.log('=== 15323 法国陆军（二选一）===')
let g = mk()
const tg0 = rules.query(g, 'Allies', 'event_targets', { card: '15323#1' })
ok('未传 choice -> need:"choice"（先选哪一项）', tg0 && tg0.need === 'choice',
	JSON.stringify(tg0))

/* 关键：模拟客户端选完 choice 后再查一次（带 choice） */
const tg1 = rules.query(g, 'Allies', 'event_targets', { card: '15323#1', choice: 0 })
ok('【修复】传 choice:0 后【不再】返回 need:"choice"（否则会死循环）',
	tg1 && tg1.need !== 'choice', JSON.stringify(tg1))
ok('传 choice:0 后可直接执行（need:null）—— 候选唯一<西欧>自动选',
	tg1 && tg1.need === null, 'need=' + (tg1 && tg1.need))

/* 实际打出：走完整点击序列（选 choice:0 -> need:null -> 提交），
 * 应该真的建成 1 支法国陆军（2026-10-21 改用共享驱动器） */
const r23 = SEQ.driveEventCard(mk(), 'Allies', '15323#1', null)
const g1 = r23.game
ok('驱动器走完 choice 后 need=null', r23.last && r23.last.need === null,
	'need=' + (r23.last && r23.last.need))
ok('提交参数只带 choice（候选唯一，无需选地区）',
	JSON.stringify(r23.arg) === JSON.stringify({ card: '15323#1', choice: 0 }),
	JSON.stringify(r23.arg))
const fr1 = Object.keys(g1.location).filter(p =>
	g1.piece_nation[p] === '法国' && g1.piece_type[p] === 'army' && g1.location[p] != null)
ok('打出后法国真的建成 1 支陆军', fr1.length === 1,
	'在 ' + fr1.map(p => d.name_of(g1.location[p])).join('、'))
ok('建在西欧（唯一合法候选）', fr1.length === 1 && g1.location[fr1[0]] === WEU,
	fr1.length ? d.name_of(g1.location[fr1[0]]) : '无')

/* choice:1 = 发起陆战 */
const tg2 = rules.query(g, 'Allies', 'event_targets', { card: '15323#1', choice: 1 })
ok('choice:1 也不再返回 need:"choice"', tg2 && tg2.need !== 'choice',
	'need=' + (tg2 && tg2.need))

/* ================= 15325 莱茵河与多瑙河 ================= */
console.log('\n=== 15325 莱茵河与多瑙河（build + battle 预算）===')
/*
 * 【2026-10-21 随"战斗预算制"更新】
 * battle 步已改为建立【战斗预算】（rules.js event_card_needs：
 * `if (st.op === 'battle') continue` —— 不再要求出牌时预选攻击目标），
 * 攻击目标改由预算面板逐次点选（每战一次 do_battle）。
 * 因此首次查询即 need=null（建设步候选唯一被自动选）——
 * 旧断言"need:'space' / step=1 / 候选非空"均为预算制之前的口径。
 * 预算面板的逐次点选覆盖见 tools/test_basic_cards.js 的 event_budget 部分；
 * 多步累积（spaces[step]）覆盖见 _test17532.js。
 */
let g2 = mk()
const r25 = SEQ.driveEventCard(g2, 'Allies', '15325#1', null)
ok('【预算制】首次查询即 need=null（建设自动选 + 战斗建预算）',
	r25.last && r25.last.need === null, 'need=' + (r25.last && r25.last.need))
ok('【预算制】提交参数不带 spaces（无需预选攻击目标）',
	!(r25.arg.spaces || r25.arg.space), JSON.stringify(r25.arg))

const fr25 = Object.keys(r25.game.location).filter(p =>
	r25.game.piece_nation[p] === '法国' && r25.game.piece_type[p] === 'army' &&
	r25.game.location[p] != null)
ok('执行后法国建成 1 支陆军', fr25.length === 1,
	fr25.map(p => d.name_of(r25.game.location[p])).join('、'))
ok('建在西欧（唯一合法候选）', fr25.length === 1 && r25.game.location[fr25[0]] === WEU,
	fr25.length ? d.name_of(r25.game.location[fr25[0]]) : '无')
ok('日志显示建立陆战预算',
	r25.game.log.some(l => l.indexOf('陆战') >= 0 && l.indexOf('预算') >= 0),
	r25.game.log.slice(-1)[0] || '')
ok('卡已打出（离开手牌）',
	(r25.game.hands['英国'] || []).indexOf('15325#1') < 0)

console.log('\n通过 ' + pass + ' / 失败 ' + fail)
process.exit(fail ? 1 : 0)
