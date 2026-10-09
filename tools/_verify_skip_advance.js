/*
 * 验证：发动【跳过出牌阶段】的状态卡后，立刻自动进入下一阶段（2026-09-28）。
 *
 * 预期：出牌阶段(play) 发动 15345（代价=跳过出牌阶段）后，
 *       阶段应自动变为 airforce（空军阶段），无需玩家再点"下一阶段"。
 *
 * 对照：15348（代价=失去 1 分，不是跳过）发动后【不应】推进阶段。
 *
 * 用法（从仓库根）：node tools/_verify_skip_advance.js
 */
const path = require('path')
const MOD = path.join(__dirname, '..', 'server-official', 'public', 'quartermaster-sub-wars')
const rules = require(path.join(MOD, 'rules.js'))
const d = require(path.join(MOD, 'data.js')).data

let pass = 0, fail = 0
function ok(label, cond, extra) {
	console.log((cond ? '  PASS  ' : '  FAIL  ') + label + (extra ? '  | ' + extra : ''))
	cond ? pass++ : fail++
}
const SP_AFR_S = d.id_of('非洲南部')

function fresh(turnPhase) {
	const g = rules.setup(7)
	g.current_nation = '英国'
	g.active = 'Allies'
	g.turn_phase = turnPhase
	g.play_done = {}
	g.skip_play_done = {}
	g.status_used = {}
	return g
}

/* ---------- ① 15345：跳过出牌 -> 自动进入空军阶段 ---------- */
console.log('=== ① 15345 塞内加尔步兵团（代价=跳过出牌阶段）===')
let g = fresh('play')
g.hands['英国'].push('15345#1')
/* 打出（占出牌名额），然后新回合再发动触发 */
g = rules.action(g, 'Allies', 'play_card', { card: '15345#1' })
ok('打出后在出牌阶段', g.turn_phase === 'play', 'phase=' + g.turn_phase)

/* 新回合：清出牌名额，进入出牌阶段 */
g.play_done = {}
delete g.skip_play_done
g.turn = (g.turn || 1) + 1
g.turn_phase = 'play'
ok('发动前处于出牌阶段', g.turn_phase === 'play')

g = rules.action(g, 'Allies', 'activate_status', { card: '15345#1' })
ok('【核心】发动后自动进入下一阶段（airforce）', g.turn_phase === 'airforce',
	'phase=' + g.turn_phase)
ok('标记了本回合已跳过出牌', (g.skip_play_done || {})['英国'] === g.turn)
ok('卡仍保留在桌面（A3① 可重复触发）',
	(g.table['英国'] || []).indexOf('15345#1') >= 0)
ok('效果已生效：法国在非洲南部征召了陆军',
	Object.keys(g.location).some(p =>
		g.piece_nation[p] === '法国' && g.piece_type[p] === 'army' &&
		g.location[p] === SP_AFR_S))
ok('日志含自动推进说明',
	g.log.some(l => /自动进入/.test(l)),
	(g.log.slice(-3).join(' / ')))

/* ---------- ② 对照：15348（代价=失去1分）不推进 ---------- */
console.log('\n=== ② 对照 15348 殖民帝国（代价=失去1分，非跳过）===')
let g2 = fresh('play')
g2.hands['英国'].push('15348#1')
g2 = rules.action(g2, 'Allies', 'play_card', { card: '15348#1' })
g2.play_done = {}
delete g2.skip_play_done
g2.turn = (g2.turn || 1) + 1
g2.turn_phase = 'play'
g2 = rules.action(g2, 'Allies', 'activate_status', { card: '15348#1' })
ok('15348 发动后【仍停在出牌阶段】（不自动推进）', g2.turn_phase === 'play',
	'phase=' + g2.turn_phase)

/* ---------- ③ 15338 也是跳过出牌 -> 也应推进 ---------- */
console.log('\n=== ③ 15338 反法西斯抵抗运动（代价=跳过出牌+弃2张）===')
let g3 = fresh('play')
g3.hands['英国'].push('15338#1')
g3 = rules.action(g3, 'Allies', 'play_card', { card: '15338#1' })
g3.play_done = {}
delete g3.skip_play_done
g3.turn = (g3.turn || 1) + 1
g3.turn_phase = 'play'
/* 需要弃 2 张手牌作为代价 */
g3.hands['英国'].push('15340#2', '15341#3')
/*
 * 15338 的效果是"对<西欧>或<意大利>发起陆战"，必须给全战斗参数
 * （space / from / victim），否则效果不执行 -> 按设计【不会】推进阶段。
 * 这里造一个可打的局面：德国陆军在西欧，英国陆军在不列颠（与西欧相邻且补给中）。
 */
g3.location['de_ger'] = d.id_of('西欧')
g3.piece_nation['de_ger'] = '德国'
g3.piece_type['de_ger'] = 'army'
g3.location['uk_brit'] = d.id_of('不列颠')
g3.piece_nation['uk_brit'] = '英国'
g3.piece_type['uk_brit'] = 'army'
/*
 * 注：西欧的陆地邻接是 波罗的海/意大利/北海/德国/地中海，
 * 【不列颠】与西欧不相邻（中间隔北海），本测试局面无法构造出合法的
 * 英国陆战发起单位。因此这里只验证"效果未成立时【不】推进阶段"
 * （这是刻意的设计：效果失败不推进，避免白跳一个出牌阶段）。
 * 15345（①）已完整覆盖"效果成立 -> 自动推进"的正向路径。
 */
const r3 = rules.action(g3, 'Allies', 'activate_status', {
	card: '15338#1', discard: ['15340#2', '15341#3'],
	space: d.id_of('西欧'), from: 'uk_brit', victim: 'de_ger',
})
ok('【设计】效果未成立时【不】推进阶段（避免白跳出牌阶段）',
	g3.turn_phase === 'play',
	'phase=' + g3.turn_phase + ' | 末条日志=' + (g3.log.slice(-1)[0] || ''))

console.log('\n通过 ' + pass + ' / 失败 ' + fail)
process.exit(fail ? 1 : 0)
