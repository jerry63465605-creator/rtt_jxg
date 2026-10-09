/*
 * 验证"替换建设"完整链路（2026-09-28 玩家场景）：
 *
 *   打出《澳大利亚劳管局》后，英国大本营为空、无其他英国陆军，
 *   下一回合打出《建设陆军》-> 没有合法建设位置，但【应能】点状态卡替换。
 *
 * 本脚本验证两个必须同时成立的修复：
 *   A. 白名单：view.actions 必须含 activate_status（否则 send_action 静默失败）
 *   B. 客户端保留 pending_card（在 play.js，本脚本用 forgo_build 标记证明
 *      服务端给出了"桌上有可替换卡"这一信息）
 *
 * 用法（从仓库根）：node tools/_verify_forgo_build.js
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
const SP_AUS = d.id_of('澳大利亚')
const ausArmies = (g) => Object.keys(g.location).filter(p =>
	g.piece_nation[p] === '英国' && g.piece_type[p] === 'army' && g.location[p] === SP_AUS).length

/* 英国大本营为空、无英国陆军的局面 */
function fresh() {
	const g = rules.setup(51)
	g.current_nation = '英国'
	g.active = 'Allies'
	g.turn_phase = 'play'
	g.play_done = {}
	g.table = { '英国': ['15341#1'] }   /* 桌上有澳大利亚劳管局 */
	g.hands['英国'] = []
	return g
}

/* ---------- A. 白名单必须含 activate_status ---------- */
console.log('=== A. 白名单（否则客户端 send_action 静默失败）===')
let g = fresh()
const v = rules.view(g, 'Allies')
const acts = v.actions || {}
ok('【关键】view.actions 含 activate_status', acts['activate_status'] === 1,
	'actual=' + acts['activate_status'])
ok('也含带后缀的 activate_status:15341#1',
	acts['activate_status:15341#1'] === 1)

/* ---------- B. table_status 给出 forgo_build 标记 ---------- */
console.log('\n=== B. table_status 标记 forgo_build（客户端据此保留"建设中"）===')
const e = (v.table_status || []).find(x => x.card === '15341#1') || {}
ok('该卡 forgo_build=true', e.forgo_build === true, 'forgo_build=' + e.forgo_build)
ok('该卡 ready=false（其余时间不可点，符合语义）', e.ready === false,
	'reason=' + (e.ready_reason || ''))

/* ---------- C. 无英国陆军时：建设确实没有合法位置（验证场景成立） ---------- */
console.log('\n=== C. 场景成立性：无英国陆军 -> 无可建位置 ===')
const ukArmies = Object.keys(g.location).filter(p =>
	g.piece_nation[p] === '英国' && g.piece_type[p] === 'army' && g.location[p] != null)
ok('场上确实没有英国陆军（无法建设）', ukArmies.length === 0, 'count=' + ukArmies.length)

/* 取一张英国《建设陆军》卡的 id（用于模拟"正在打出建设卡"） */
const { CARDS } = require(path.join(MOD, 'cards.js'))
const buildFace = CARDS.find(c => c.name === '建设陆军' && c.nation === '英国')
const BUILD_INST = buildFace ? String(buildFace.id) + '#9' : null
ok('找到英国《建设陆军》卡', !!buildFace,
	buildFace ? ('id=' + buildFace.id) : '未找到')

/* ---------- D. 【本次要修的问题】替换后《建设陆军》必须被打出 ---------- */
console.log('\n=== D. 替换建设后，《建设陆军》必须真正打出（进弃牌堆）===')
let gD = fresh()
gD.hands['英国'] = [BUILD_INST, '15341#1']   /* 手上有建设卡 + 桌上有状态卡 */
const before = ausArmies(gD)
gD = rules.action(gD, 'Allies', 'activate_status', {
	card: '15341#1', from_status: true, build_card: BUILD_INST,
})
ok('澳大利亚征召 1 支英国陆军', ausArmies(gD) === before + 1,
	'before=' + before + ' after=' + ausArmies(gD))
ok('【关键】《建设陆军》已进弃牌堆',
	(gD.discard['英国'] || []).indexOf(BUILD_INST) >= 0,
	'discard=' + JSON.stringify(gD.discard['英国'] || []))
ok('【关键】《建设陆军》已离开手牌（没退回手里）',
	(gD.hands['英国'] || []).indexOf(BUILD_INST) < 0,
	'hand=' + JSON.stringify(gD.hands['英国'] || []))
ok('本次出牌名额已被那张建设卡占掉', (gD.play_done || {})['英国'] === true,
	'play_done=' + JSON.stringify(gD.play_done || {}))
ok('日志说明建设卡已打出',
	gD.log.some(l => /已打出进弃牌堆/.test(l)), gD.log.slice(-2).join(' / '))

/* ---------- D2. 【2026-09-29】不传 build_card：不得猜卡打出 ---------- */
console.log('\n=== D2. 不传 build_card -> 不扣任何手牌（禁止猜测）===')
let gD2 = fresh()
gD2.hands['英国'] = [BUILD_INST]
const b2a = ausArmies(gD2)
gD2 = rules.action(gD2, 'Allies', 'activate_status', { card: '15341#1', from_status: true })
ok('效果照常（征召）', ausArmies(gD2) === b2a + 1)
ok('【关键】手牌里的建设卡【未被】打掉（不猜测）',
	(gD2.hands['英国'] || []).indexOf(BUILD_INST) >= 0,
	'hand=' + JSON.stringify(gD2.hands['英国'] || []))
ok('【关键】弃牌堆里没有那张建设卡',
	(gD2.discard['英国'] || []).indexOf(BUILD_INST) < 0,
	'discard=' + JSON.stringify(gD2.discard['英国'] || []))
ok('未占出牌名额（没有卡被打出）', !(gD2.play_done || {})['英国'],
	'play_done=' + JSON.stringify(gD2.play_done || {}))

/* ---------- D4. 模拟 17526 民主兵工厂：美国让英国建设，英国替换 ---------- */
console.log('\n=== D4. 模拟美国 17526《民主兵工厂》：英国替换，不得扣英国手牌 ===')
/*
 * 17526 卡面：「英国按任意顺序执行：建设1支海军 及 建设1支陆军。」
 * 将来实现走 { actor:'英国', steps:[{op:'build',type:'navy'},{op:'build',type:'army'}] }
 * -> build_piece(game,'英国',...) —— 英国【没有打出】《建设陆军》卡。
 * 若那时允许英国用 15341 替换，提交时【没有 build_card】，
 * 必须只换结果（征召）而【不扣任何手牌】。
 */
let gD4 = fresh()
gD4.current_nation = '美国'          /* 美国回合打出 17526 */
gD4.active = 'Allies'
gD4.hands['英国'] = [BUILD_INST]     /* 英国手里正好有一张建设陆军 */
const b4a = ausArmies(gD4)
gD4 = rules.action(gD4, 'Allies', 'activate_status', { card: '15341#1', from_status: true })
ok('英国仍能替换（不受阶段/回合限制）', ausArmies(gD4) === b4a + 1,
	'before=' + b4a + ' after=' + ausArmies(gD4))
ok('【关键】英国手牌的建设卡【没有被扣】',
	(gD4.hands['英国'] || []).indexOf(BUILD_INST) >= 0,
	'hand=' + JSON.stringify(gD4.hands['英国'] || []))
ok('【关键】未占用英国出牌名额', !(gD4.play_done || {})['英国'],
	'play_done=' + JSON.stringify(gD4.play_done || {}))

/* ---------- D3. 手牌里没有建设卡时：只记日志，效果照常 ---------- */
console.log('\n=== D3. 手牌无建设卡：不阻断，效果照常执行 ===')
let gD3 = fresh()
gD3.hands['英国'] = []
const b3a = ausArmies(gD3)
gD3 = rules.action(gD3, 'Allies', 'activate_status', { card: '15341#1', from_status: true })
ok('效果照常（征召）', ausArmies(gD3) === b3a + 1)
ok('未占出牌名额（没有建设卡被打出）', !(gD3.play_done || {})['英国'])
/* 后续断言沿用 g（保持原场景） */
g = gD

/* ---------- E. 不带 from_status 仍被拒（安全） ---------- */
console.log('\n=== E. 不带 from_status 仍被拒绝（放行的是发送权不是执行权）===')
let g2 = fresh()
const b2 = ausArmies(g2)
g2 = rules.action(g2, 'Allies', 'activate_status', { card: '15341#1' })
ok('未征召（被拒绝）', ausArmies(g2) === b2, 'before=' + b2 + ' after=' + ausArmies(g2))
ok('日志给出拒绝理由', g2.log.some(l => /现在不能发动/.test(l)), g2.log.slice(-1)[0] || '')

console.log('\n通过 ' + pass + ' / 失败 ' + fail)
process.exit(fail ? 1 : 0)
