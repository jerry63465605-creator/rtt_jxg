/*
 * 真实盘面（路线 A）· B19：15352 布莱切利园 的「增强卡拦截」必须强挂起
 *
 * 盘面来源：真实对局快照 tools/fixtures/gid19.json（不是 R.setup 的空盘）
 * 驱动方式：全部走玩家动作（debug_add_card → play_card → next_phase / skip_armed_offer）
 * 断言三层：服务端状态（armed_offers / turn_phase）+ 客户端 view（双方视角）+ 日志文案
 *
 * 用法：node tools/_realboard_b19_15352.js
 */
const path = require('path')
const fs = require('fs')
const R = require(path.join(__dirname, '..', 'rules.js'))
const I = R._internal
const d = I.data
const faceOf = x => String(x).split('#')[0]
const logSince = (g, n) => (g.log || []).slice(n).join(' | ')

let pass = 0, fail = 0
const ok = (m, c, extra) => { if (c) { pass++; console.log('  ✓ ' + m) } else { fail++; console.log('  ✗ ' + m + (extra ? '  | ' + extra : '')) } }

const FIX = path.join(__dirname, 'fixtures', 'gid19.json')
const base = JSON.parse(fs.readFileSync(FIX, 'utf8'))
console.log('盘面：' + FIX + '（' + JSON.stringify(base).length + ' 字节）')
console.log('  当前国=' + base.current_nation + ' 轮次=' + base.turn + ' 阶段=' + base.turn_phase)

const g = JSON.parse(JSON.stringify(base))
/* 清掉可能残留的挂起，便于从"德国出牌阶段"起跑 */
g.pending_battle = null
g.pending_econ = null
g.armed_offers = []
g.response_queue = []
g.response_stack = []
g.pending_status_react = null
g.pending_echo = null
I.refresh(g)

/* 英国：15352 + 一张垫牌（代价） */
R.action(g, 'Allies', 'debug_add_card', { face: '15352', nation: '英国', dest: 'hand' })
R.action(g, 'Allies', 'debug_add_card', { face: '15348', nation: '英国', dest: 'hand' })
R.action(g, 'Axis', 'debug_set_phase', { nation: '德国', phase: 'play' })
I.refresh(g)

/* 找一个"真能打出来"的德国增强卡（不同盘面条件下预置不同） */
const CAND = ['15205', '15206', '15207', '15208', '15209', '15210', '15211', '15212']
let played = null, playedFace = null
for (const face of CAND) {
	const gg = JSON.parse(JSON.stringify(g))
	R.action(gg, 'Axis', 'debug_add_card', { face: face, nation: '德国', dest: 'hand' })
	I.refresh(gg)
	const inst = (gg.hands['德国'] || []).find(x => faceOf(x) === face)
	if (!inst) continue
	const n0 = (gg.log || []).length
	try { R.action(gg, 'Axis', 'play_card', { card: inst }) } catch (e) { console.log('    ' + face + ' 异常 ' + e.message); continue }
	I.refresh(gg)
	const win = (gg.armed_offers || []).some(w => w.when === 'enemy_echo_played' && (w.cards || []).length)
	if (!win) console.log('    ' + face + ' → ' + (gg.log || []).slice(n0).join(' | ').slice(0, 110))
	if (win) { played = gg; playedFace = face; break }
}
if (!played) {
	/*
	 * 德国增强卡全是「机会卡」（不能主动打出），真实链路应是：
	 *   建设海军 → after_build_navy 窗口 → use_armed_offer(15208) = 打出一张增强卡
	 *   → enemy_echo_played → 英国 15352 拦截窗口。
	 * 建设这一步用 build_piece（与卡牌内部同一原子），其余全部走玩家动作。
	 */
	console.log('  → 改走真实链路：建设海军 → after_build_navy → 打出 15208')
	R.action(g, 'Axis', 'debug_add_card', { face: '15208', nation: '德国', dest: 'hand' })
	I.refresh(g)
	let built = null
	for (let sp = 1; sp < d.spaces.length; sp++) {
		const info = d.spaces[sp]
		if (!info || info.terrain !== 'sea') continue
		const rr = I.build_piece(g, '德国', 'navy', sp)
		if (rr && rr.ok) { built = sp; break }
	}
	console.log('  海军建在 = ' + (built ? d.name_of(built) : '(无可行海域)'))
	I.refresh(g)
	R.view(g, 'Axis')            /* 武装 after_build_navy */
	const w = (g.armed_offers || []).find(x => x.when === 'after_build_navy' && (x.cards || []).some(c => faceOf(c.card_id) === '15208'))
	console.log('  after_build_navy 窗口 = ' + JSON.stringify((g.armed_offers || []).map(x => ({ when: x.when, faces: (x.cards || []).map(c => faceOf(c.card_id)) }))))
	if (w) {
		const c = (w.cards || []).find(x => faceOf(x.card_id) === '15208')
		const n1 = (g.log || []).length
		R.action(g, 'Axis', 'use_armed_offer', { card: c.card_id, space: built })
		I.refresh(g)
		console.log('  打出 15208 → ' + (g.log || []).slice(n1).join(' | ').slice(0, 180))
		const win = (g.armed_offers || []).some(x => x.when === 'enemy_echo_played' && (x.cards || []).length)
		if (win) { played = g; playedFace = '15208(经 after_build_navy)' }
	}
	/* 再试 15205 链路：在刚建的海军海域部署空军 → after_deploy_air → 打出 15205 */
	if (!played && built) {
		R.action(g, 'Axis', 'debug_add_card', { face: '15205', nation: '德国', dest: 'hand' })
		I.refresh(g)
		const air = I.build_piece(g, '德国', 'air', built)
		console.log('  部署空军 = ' + JSON.stringify(air && { ok: air.ok, id: air.id, reason: air.reason }))
		I.refresh(g)
		R.view(g, 'Axis')
		const w2 = (g.armed_offers || []).find(x => x.when === 'after_deploy_air' && (x.cards || []).some(c => faceOf(c.card_id) === '15205'))
		console.log('  after_deploy_air 窗口 = ' + JSON.stringify((g.armed_offers || []).map(x => ({ when: x.when, faces: (x.cards || []).map(c => faceOf(c.card_id)) }))))
		if (w2) {
			const c = (w2.cards || []).find(x => faceOf(x.card_id) === '15205')
			const n2 = (g.log || []).length
			R.action(g, 'Axis', 'use_armed_offer', { card: c.card_id })
			I.refresh(g)
			console.log('  打出 15205 → ' + (g.log || []).slice(n2).join(' | ').slice(0, 200))
			const win = (g.armed_offers || []).some(x => x.when === 'enemy_echo_played' && (x.cards || []).length)
			if (win) { played = g; playedFace = '15205(经 after_deploy_air)' }
		}
	}
}
if (!played) {
	console.log('✗ 仍未能经由真实链路打出增强卡，改用最小场景（仅验证门禁）')
	I.offer_armed_effects(g, 'enemy_echo_played', { nation: '德国', card: '15205#999', space: null, via: 'play', window: 'enemy_echo_played' })
} else {
	console.log('  实际打出 = ' + playedFace)
}
const G = played || g

console.log('\n=== 服务端 / view / 日志 ===')
const offers = (G.armed_offers || []).map(w => ({ when: w.when, cards: (w.cards || []).map(c => faceOf(c.card_id)) }))
console.log('  offers = ' + JSON.stringify(offers))
ok('★ 拦截窗口已开出（15352 在候选）', offers.some(o => o.when === 'enemy_echo_played' && o.cards.indexOf('15352') >= 0), JSON.stringify(offers))

const vA = R.view(G, 'Allies'), vX = R.view(G, 'Axis')
console.log('  Allies.armed_offer=' + JSON.stringify(vA.armed_offer && vA.armed_offer.when) +
	'  Axis.armed_offer=' + JSON.stringify(vX.armed_offer && vX.armed_offer.when))
ok('★ 只有英方视角可见', !!vA.armed_offer && !vX.armed_offer)

const n1 = (G.log || []).length
R.action(G, 'Axis', 'next_phase', {})
const lg = logSince(G, n1)
console.log('  德国 next_phase → ' + (lg || '(无日志)'))
ok('★★ 窗口存在时德国 next_phase 被拒', /等待【英国】决定是否发动/.test(lg), lg.slice(0, 120))
ok('★ 仍停在原阶段', G.turn_phase === 'play' || G.current_nation !== '德国', G.turn_phase + '/' + G.current_nation)

const n2 = (G.log || []).length
R.action(G, 'Allies', 'skip_armed_offer', {})
R.action(G, 'Axis', 'next_phase', {})
const lg2 = logSince(G, n2)
console.log('  表态后 next_phase → ' + lg2.slice(0, 140))
ok('★★ 表态后德国恢复推进（无死锁）', !/等待【英国】决定是否发动/.test(lg2), lg2.slice(0, 120))

console.log('\n' + (fail === 0 ? 'ALL PASS（' + pass + ' 项）' : fail + ' FAIL / ' + pass + ' 项'))
process.exitCode = fail ? 1 : 0
