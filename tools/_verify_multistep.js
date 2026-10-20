/*
 * 验证【多步卡】完整流程（2026-09-29）：
 *   15325 莱茵河与多瑙河 = [法国建设1支陆军, 用该陆军发起1次陆战]
 *
 * 模拟【客户端】真实流程：
 *   ① query event_targets（无参）-> 得到 need/step/total
 *   ② 玩家点地区 -> 累积 spaces[step] -> 带完整 spaces 再 query
 *   ③ 直到 need=null -> send_action 带完整 spaces -> 真正执行
 *
 * 覆盖两种局面：
 *   A. 初始局面（法国无部队）：step0 候选唯一 -> 直接问 step1
 *   B. 西欧已有法国陆军：step0 候选 3 个 -> 先问 step0，再问 step1
 *
 * 用法（从仓库根）：node tools/_verify_multistep.js
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
const candIds = (tg) => (tg && tg.candidates || []).map(x =>
	(typeof x === 'object') ? x.id : x)
const candNames = (tg) => candIds(tg).map(x => d.name_of(x)).join('、')

const WEU = d.id_of('西欧')
const ITA = d.id_of('意大利')

function mk(withFrenchArmy) {
	const g = rules.setup(99)
	g.current_nation = '英国'
	g.active = 'Allies'
	g.turn_phase = 'play'
	g.play_done = {}
	g.hands['英国'] = ['15325#1']
	if (withFrenchArmy) {
		g.location['frX'] = WEU
		g.piece_nation['frX'] = '法国'
		g.piece_type['frX'] = 'army'
	}
	return g
}

/* 完整走一遍客户端流程：返回最终执行的 game
 * （2026-10-21 起改用共享驱动器 tools/event_click_seq.js，见其文件头注释） */
function runClientFlow(g, label, withFr) {
	console.log('\n--- ' + label + ' ---')
	/*
	 * 玩家逐步选择：选候选里【合法】的第一个（跳过会失败的，如已有本国单位）。
	 * 局面B 的 step0 候选含"西欧"，但西欧【已】有法国陆军，
	 * 再建会失败（每国每格限 1 支）—— 真实玩家也会避开，
	 * 故这里显式换一个（picker 由调用方给，驱动器不替玩家猜）。
	 */
	const picker = (tg) => {
		const ids = SEQ.candIds(tg)
		let s = ids[0]
		if (tg.step === 0 && s === WEU && withFr) {
			const alt = ids.find(x => x !== WEU)
			if (alt != null) s = alt
		}
		return s
	}
	const r = SEQ.driveEventCard(g, 'Allies', '15325#1', picker, { log: true })
	console.log('  ③ need=null -> 提交 play_card ' + JSON.stringify(r.arg))
	return { g: r.game, tg: r.last, spaces: (r.arg.spaces || []).slice(), arg: r.arg }
}

/* ===== 局面 A：初始（法国无部队） ===== */
let a = runClientFlow(mk(false), '局面A：初始局面', false)
ok('A: 最终 need=null（选齐）', a.tg.need === null, 'need=' + a.tg.need)
const frA = Object.keys(a.g.location).filter(p =>
	a.g.piece_nation[p] === '法国' && a.g.piece_type[p] === 'army' && a.g.location[p] != null)
ok('A: 法国建成 1 支陆军', frA.length === 1,
	frA.map(p => d.name_of(a.g.location[p])).join('、'))
ok('A: 日志显示发起陆战', a.g.log.some(l => /陆战/.test(l)),
	a.g.log.slice(-1)[0] || '')
ok('A: 卡已打出（离开手牌）',
	(a.g.hands['英国'] || []).indexOf('15325#1') < 0)

/* ===== 局面 B：西欧已有法国陆军（玩家实际可能遇到的） ===== */
let b = runClientFlow(mk(true), '局面B：西欧已有法国陆军', true)
ok('B: 最终 need=null（选齐）', b.tg.need === null, 'need=' + b.tg.need)
/*
 * 【2026-10-21 随"战斗预算制"更新】
 * 15325 的 battle 步已改为"建立战斗预算"（rules.js event_card_needs：
 * `if (st.op === 'battle') continue` —— 不再要求出牌时预选攻击目标），
 * 于是建设步候选唯一时【首次查询即 need=null】，不再有"逐步选 2 步"的交互。
 * 旧断言"spaces 长度 2"是该重构前的口径；多步累积（spaces[step]）的覆盖
 * 现已由 _test17532.js 承担（3 步：remove + 建海军 + 建陆军）。
 */
ok('B: 建设步候选唯一 -> 首次查询即选齐（无需逐步选）',
	b.tg.need === null && (b.arg.spaces || []).length === 0,
	'arg=' + JSON.stringify(b.arg))
const frB = Object.keys(b.g.location).filter(p =>
	b.g.piece_nation[p] === '法国' && b.g.piece_type[p] === 'army' && b.g.location[p] != null)
ok('B: 【关键】法国陆军增加（建设生效）', frB.length === 2,
	'法国陆军在 ' + frB.map(p => d.name_of(b.g.location[p])).join('、'))
/* 建设效果以盘面为准（见上）；日志侧断言"建立陆战预算" */
ok('B: 日志显示建立陆战预算',
	b.g.log.some(l => l.indexOf('陆战') >= 0 && l.indexOf('预算') >= 0),
	b.g.log.slice(-1)[0] || '')
ok('B: 卡已打出', (b.g.hands['英国'] || []).indexOf('15325#1') < 0)

/* ===== 对照：不传 spaces（旧客户端行为） ===== */
console.log('\n--- 对照：只提交 step1（旧客户端行为）---')
let c = mk(true)
c = rules.action(c, 'Allies', 'play_card', { card: '15325#1', spaces: [null, ITA] })
/*
 * 【2026-10-21 更新】旧 bug 是"只填 step1 -> 服务端发现后续 step 没选 ->
 * 返回 pending -> 整张卡不执行、牌留手里"。战斗预算制之后 battle 步不再
 * 需要预选目标，同样的提交现在能正常执行（建陆军 + 建立预算）。
 * 断言随之反转为正向：卡应离开手牌。
 */
ok('对照: 现在能正常打出（离开手牌）—— 旧 bug 已被预算制消除',
	(c.hands['英国'] || []).indexOf('15325#1') < 0,
	'日志=' + (c.log.slice(-1)[0] || ''))

console.log('\n通过 ' + pass + ' / 失败 ' + fail)
process.exit(fail ? 1 : 0)
