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

/* 实际打出：应该真的建成 1 支法国陆军 */
let g1 = mk()
g1 = rules.action(g1, 'Allies', 'play_card', { card: '15323#1', choice: 0 })
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
console.log('\n=== 15325 莱茵河与多瑙河（build + battle useNewPiece）===')
/*
 * 【注意】query 出口把候选转成了【对象】{id, name}（方便客户端显示），
 * 不是裸 id —— 测试里取 id 必须兼容两种形态，否则会误判成"无效 id"。
 */
const candId = (x) => (x && typeof x === 'object') ? x.id : x
const candName = (x) => (x && typeof x === 'object') ? (x.name || d.name_of(x.id)) : d.name_of(x)

let g2 = mk()
const t25 = rules.query(g2, 'Allies', 'event_targets', { card: '15325#1' })
console.log('  candidates -> ' + (t25.candidates || []).map(candName).join('、'))
ok('【修复】需要玩家选地区（need:"space"，不再是 null 直接自动空打）',
	t25 && t25.need === 'space', 'need=' + (t25 && t25.need))
ok('【修复】选的是第 1 步（step=1，即攻击目标）',
	t25 && t25.step === 1, 'step=' + (t25 && t25.step))
ok('【修复】候选非空（含与新陆军相邻的目标）',
	!!(t25 && t25.candidates && t25.candidates.length),
	t25 && t25.candidates ? t25.candidates.map(candName).join('、') : '无')

/* 候选应都与该新陆军位置（西欧）相邻 */
if (t25 && t25.candidates && t25.candidates.length) {
	const nb = (d.spaces[WEU].connections || [])
	const allAdj = t25.candidates.every(x => nb.indexOf(candId(x)) >= 0)
	ok('候选均与新陆军位置<西欧>相邻', allAdj,
		'西欧邻接=' + nb.map(x => d.name_of(x)).join('、'))
	ok('候选都是陆地（陆战）',
		t25.candidates.every(x => (d.spaces[candId(x)] || {}).terrain === 'land'))
}

/* 实际执行：指定 spaces = [建设位, 攻击目标] */
let g3 = mk()
const target = t25 && t25.candidates ? candId(t25.candidates[0]) : null
if (target != null) {
	g3 = rules.action(g3, 'Allies', 'play_card', {
		card: '15325#1', spaces: [WEU, target],
	})
	const fr3 = Object.keys(g3.location).filter(p =>
		g3.piece_nation[p] === '法国' && g3.piece_type[p] === 'army' && g3.location[p] != null)
	ok('执行后法国建成 1 支陆军', fr3.length === 1,
		fr3.map(p => d.name_of(g3.location[p])).join('、'))
	ok('日志包含对指定目标的攻击',
		g3.log.some(l => l.indexOf(d.name_of(target)) >= 0),
		g3.log.slice(-2).join(' / '))
}

console.log('\n通过 ' + pass + ' / 失败 ' + fail)
process.exit(fail ? 1 : 0)
