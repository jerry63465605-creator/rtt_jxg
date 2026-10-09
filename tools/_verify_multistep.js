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

/* 完整走一遍客户端流程：返回最终执行的 game */
function runClientFlow(g, label, withFr) {
	console.log('\n--- ' + label + ' ---')
	const spaces = []
	let tg = rules.query(g, 'Allies', 'event_targets', { card: '15325#1' })
	console.log('  ① 初始: need=' + tg.need + ' step=' + tg.step +
		' total=' + tg.total + ' 候选=' + candNames(tg))
	if (tg.need !== 'space') { return { g, tg } }

	/* 玩家逐步选择：选候选里【合法】的第一个（跳过会失败的，如已有本国单位） */
	let guard = 0
	while (tg.need === 'space' && guard++ < 5) {
		/*
		 * 局面B 的 step0 候选含"西欧"，但西欧【已】有法国陆军，
		 * 再建会失败（每国每格限 1 支）—— 真实玩家也会避开，
		 * 这里选第一个【可建设】的候选（而不是盲目取第一个）。
		 */
		let s = candIds(tg)[0]
		if (tg.step === 0 && s === WEU && withFr) {
			const alt = candIds(tg).find(x => x !== WEU)
			if (alt != null) s = alt
		}
		spaces[tg.step] = s
		console.log('  ② 选 step' + tg.step + ' = ' + d.name_of(s) +
			' -> 累积 spaces=' + JSON.stringify(spaces))
		tg = rules.query(g, 'Allies', 'event_targets', {
			card: '15325#1', spaces: spaces.slice(),
		})
		console.log('     再查: need=' + tg.need +
			(tg.step != null ? ' step=' + tg.step : '') +
			(tg.candidates ? ' 候选=' + candNames(tg) : ''))
	}
	console.log('  ③ need=null -> 提交 play_card {spaces:' + JSON.stringify(spaces) + '}')
	g = rules.action(g, 'Allies', 'play_card', { card: '15325#1', spaces: spaces.slice() })
	return { g, tg, spaces }
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
ok('B: 逐步选了 2 步（spaces 长度 2）',
	b.spaces && b.spaces.filter(x => x != null).length === 2,
	JSON.stringify(b.spaces))
const frB = Object.keys(b.g.location).filter(p =>
	b.g.piece_nation[p] === '法国' && b.g.piece_type[p] === 'army' && b.g.location[p] != null)
ok('B: 【关键】法国陆军增加（建设生效）', frB.length === 2,
	'法国陆军在 ' + frB.map(p => d.name_of(b.g.location[p])).join('、'))
ok('B: 日志含建设 + 陆战', b.g.log.some(l => /建设/.test(l) && /陆战/.test(l)),
	b.g.log.slice(-1)[0] || '')
ok('B: 卡已打出', (b.g.hands['英国'] || []).indexOf('15325#1') < 0)

/* ===== 对照：旧行为（只填 step1）会失败 ===== */
console.log('\n--- 对照：只提交 step1（旧客户端行为）---')
let c = mk(true)
c = rules.action(c, 'Allies', 'play_card', { card: '15325#1', spaces: [null, ITA] })
ok('对照: 卡【未】打出（仍在手里）—— 这正是旧 bug',
	(c.hands['英国'] || []).indexOf('15325#1') >= 0,
	'日志=' + (c.log.slice(-1)[0] || ''))

console.log('\n通过 ' + pass + ' / 失败 ' + fail)
process.exit(fail ? 1 : 0)
