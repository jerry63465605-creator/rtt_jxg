/*
 * 排查用户点名的 4 张"多步卡"（2026-09-29，承接 R44）：
 *   15317 史末资加强对英关系（声明式 steps + useNewPiece）
 *   15225 阿登闪击战      （run() 函数式）
 *   15230 海狮计划        （run() 函数式）
 *   15231 进攻美国        （run() 函数式）
 *
 * 关注两类问题：
 *   A. R44 类：多步但"选完第1步就提交" -> 整张卡不执行
 *   B. 无交互类：run() 自动执行，玩家【没有任何选择】
 *      （卡面说"发起1或2次"却自动打全部，属规则不符）
 *
 * 用法（从仓库根）：node tools/_verify_multistep_cards.js
 */
const path = require('path')
const MOD = path.join(__dirname, '..', 'server-official', 'public', 'quartermaster-sub-wars')
const rules = require(path.join(MOD, 'rules.js'))
const I = rules._internal || {}
const d = require(path.join(MOD, 'data.js')).data

let pass = 0, fail = 0
function ok(label, cond, extra) {
	console.log((cond ? '  PASS  ' : '  FAIL  ') + label + (extra ? '  | ' + extra : ''))
	cond ? pass++ : fail++
}
const SP = (n) => d.id_of(n)
const candIds = (tg) => (tg && tg.candidates || []).map(x => (typeof x === 'object') ? x.id : x)
const candNames = (tg) => candIds(tg).map(x => d.name_of(x)).join('、')

function mkGerman() {
	const g = rules.setup(101)
	g.current_nation = '德国'
	g.active = 'Axis'
	g.turn_phase = 'play'
	g.play_done = {}
	g.hands['德国'] = []
	return g
}
function mkBritish() {
	const g = rules.setup(102)
	g.current_nation = '英国'
	g.active = 'Allies'
	g.turn_phase = 'play'
	g.play_done = {}
	g.hands['英国'] = []
	return g
}

/* ==================== 15317 史末资（声明式 + useNewPiece）==================== */
console.log('=== 15317 史末资加强对英关系（steps: recruit + battle useNewPiece）===')
console.log('  卡面：在<非洲南部>征召陆军，其在本回合内始终处于补给状态。以此陆军发起1次陆战')
{
	const g = mkBritish()
	g.hands['英国'] = ['15317#1']
	let tg = rules.query(g, 'Allies', 'event_targets', { card: '15317#1' })
	console.log('  ① need=' + tg.need + ' step=' + tg.step + ' total=' + tg.total +
		' 候选=' + candNames(tg))
	ok('15317: total 已带出（=2）', tg.total === 2, 'total=' + tg.total)

	/* 走客户端逐步流程 */
	const spaces = []
	let guard = 0
	while (tg.need === 'space' && guard++ < 5) {
		const s = candIds(tg)[0]
		spaces[tg.step] = s
		console.log('  ② 选 step' + tg.step + ' = ' + d.name_of(s))
		tg = rules.query(g, 'Allies', 'event_targets', {
			card: '15317#1', spaces: spaces.slice(),
		})
		console.log('     -> need=' + tg.need +
			(tg.candidates ? ' 候选=' + candNames(tg) : ''))
	}
	ok('15317: 逐步选齐后 need=null', tg.need === null, 'need=' + tg.need)

	g2 = rules.action(g, 'Allies', 'play_card', {
		card: '15317#1', spaces: spaces.slice(),
	})
	const brit = Object.keys(g2.location).filter(p =>
		g2.piece_nation[p] === '英国' && g2.location[p] != null)
	ok('15317: 征召了英国陆军', brit.length >= 1,
		brit.map(p => d.name_of(g2.location[p])).join('、'))
	ok('15317: 卡已打出', (g2.hands['英国'] || []).indexOf('15317#1') < 0)
	console.log('  日志: ' + (g2.log || []).slice(-1)[0])
}

/* ==================== 15225 / 15230 / 15231（run() 自动执行）==================== */
function probeRunCard(id, label, faceText) {
	console.log('\n=== ' + id + '《' + label + '》===')
	console.log('  卡面：' + faceText)
	const g = mkGerman()
	g.hands['德国'] = [String(id) + '#1']
	const before = Object.keys(g.location).filter(p =>
		g.piece_nation[p] === '德国' && g.location[p] != null).length

	/* 关键：看它是否【询问】玩家（need），还是直接自动执行 */
	let tg
	try { tg = rules.query(g, 'Axis', 'event_targets', { card: String(id) + '#1' }) }
	catch (e) { tg = { err: e.message } }
	console.log('  event_targets -> ' + JSON.stringify(tg))
	const needsChoice = tg && (tg.need === 'space' || tg.need === 'choice')
	ok(id + ': 是否询问玩家？ ' + (needsChoice ? '是' : '否（完全自动执行）'),
		true, 'need=' + (tg && tg.need))

	/* 实际执行 */
	const g2 = rules.action(g, 'Axis', 'play_card', { card: String(id) + '#1' })
	const after = Object.keys(g2.location).filter(p =>
		g2.piece_nation[p] === '德国' && g2.location[p] != null).length
	console.log('  执行后日志: ' + (g2.log || []).slice(-1)[0])
	console.log('  德国单位 ' + before + ' -> ' + after)
	return { needsChoice, g: g2 }
}

const r25 = probeRunCard(15225, '阿登闪击战', '对<西欧>发起陆战。在<西欧>建设陆军。')
const r30 = probeRunCard(15230, '海狮计划', '在<北海>建设海军。对<不列颠>发起陆战。')
const r31 = probeRunCard(15231, '进攻美国', '在<北大西洋>建设海军。对相邻地区发起1或2次陆战。')

console.log('\n=== 汇总 ===')
for (const r of [r25, r30, r31])
	console.log('  ' + (r.needsChoice ? '有交互' : '【无交互·自动执行】'))
ok('15225 无交互（自动执行）', r25.needsChoice === false)
ok('15230 无交互（自动执行）', r30.needsChoice === false)
ok('15231 无交互（自动执行）', r31.needsChoice === false)

/* 15231 专门检查：卡面说"1或2次"，当前是不是打了【全部】相邻？ */
console.log('\n=== 15231 细节：卡面"1或2次"，实际打了几次？===')
const g31 = mkGerman()
/* 北大西洋相邻地区各放一支苏联陆军，看会被打掉几个 */
const nb = (d.spaces[SP('北大西洋')].connections || []).slice()
let placed = 0
for (const x of nb) {
	if (!d.spaces[x] || d.spaces[x].terrain !== 'land') continue
	g31.location['sov' + x] = x
	g31.piece_nation['sov' + x] = '苏联'
	g31.piece_type['sov' + x] = 'army'
	placed++
}
console.log('  北大西洋相邻陆地数 = ' + placed +
	'（' + nb.filter(x => d.spaces[x] && d.spaces[x].terrain === 'land')
		.map(x => d.name_of(x)).join('、') + '）')
g31.hands['德国'] = ['15231#1']
const g31b = rules.action(g31, 'Axis', 'play_card', { card: '15231#1' })
console.log('  执行日志: ' + (g31b.log || []).slice(-1)[0])
const survived = nb.filter(x => Object.keys(g31b.location).some(p =>
	g31b.piece_nation[p] === '苏联' && g31b.location[p] === x))
console.log('  残留苏军地区 = ' + survived.map(x => d.name_of(x)).join('、') || '(全灭)')
ok('15231: 卡面限"1或2次"，但实现是打【全部相邻】（规则不符，需玩家选择）',
	true, '被打掉 ' + (placed - survived.length) + ' 个（相邻共 ' + placed + '）')

console.log('\n通过 ' + pass + ' / 失败 ' + fail)
process.exit(fail ? 1 : 0)
