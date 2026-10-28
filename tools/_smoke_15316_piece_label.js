/*
 * 【2026-10-28 #3】玩家选择部队的候选命名 —— 必须能区分「同格多国同兵种」
 *
 * 玩家报告：15316《佩塔尔二世即位》「\<巴尔干\>消灭 1 支敌方国家陆军」，
 * 同格有德国陆军 + 意大利陆军时，两个候选名字都是「陆军@巴尔干」，完全一样。
 *
 * 根因：候选名只拼「兵种@地区」。而规则是「每国每格 1 个单位 + 1 个飞机」
 * （见 _build_piece_impl），同格允许【不同国家】的同兵种并存 -> 必然重名。
 *
 * 改法：统一走 piece_candidate_label(game, id) = 国家 + 兵种 + @地区，
 * 并把三处「只传裸 id」的候选（15355 / 17511 / 17808）也补上 name。
 *
 * 覆盖：
 *   S1 eliminate_candidates 在巴尔干返回 2 支不同国家的陆军
 *   S2 15316 的 eliminate 步返回 need:'piece'，两个候选名【不同】且各含国家
 *   S3 单候选时不问（沿用"目标唯一即自动结算"）
 *   S4 15355 敌方空军候选带 name（原来只有裸 id）
 *   S5 17808 敌方陆军候选带 name（原来只有裸 id）
 *   S6 命名格式：国家 + 兵种 + @地区
 *   S7 源码守卫：不再有手拼「兵种@地区」（统一走原子）
 */
const path = require('path')
const M = path.join('server-official', 'public', 'quartermaster-sub-wars')
const rules = require(path.join(__dirname, '..', M, 'rules.js'))
const I = rules._internal
const data = I.data

const BAL = data.id_of('巴尔干')
const MSC = data.id_of('莫斯科')

let pass = 0
const fails = []
function ok(name, cond, extra) {
	if (cond) { pass++; console.log('  ok   ' + name) }
	else { fails.push(name); console.log('  FAIL ' + name + (extra !== undefined ? '  | ' + JSON.stringify(extra) : '')) }
}
function section(t) { console.log('\n=== ' + t + ' ===') }

function make() {
	const g = rules.setup(20261028, rules.default_scenario, {})
	g.opening = null
	I.set_skip_turn_guard(true)
	g.turn = 3
	g.turn_phase = 'play'
	g.nations_done = 1
	g.current_nation = '英国'
	g.active = 'Allies'
	return g
}
/* 在指定地区放一支部队 */
function put(g, pid, sid, nation, type) {
	g.location[pid] = sid
	g.piece_nation[pid] = nation
	g.piece_type[pid] = type
	I.refresh(g)
}

/* ============================================================
 * S1 / S2 / S3 15316 佩塔尔二世即位（巴尔干）
 * ============================================================ */
section('S1 巴尔干同时有德国陆军与意大利陆军 -> 两个合法候选')
{
	const g = make()
	put(g, 'pDE', BAL, '德国', 'army')
	put(g, 'pIT', BAL, '意大利', 'army')
	const cands = I.eliminate_candidates(g, '英国', BAL, 'army')
	ok('候选 2 支', cands.length === 2, cands)
	ok('  确实是两个不同国家',
		new Set(cands.map(p => g.piece_nation[p])).size === 2,
		cands.map(p => g.piece_nation[p]))
}

section('S2 15316 的 eliminate 步：两个候选名必须不同且各含国家')
{
	const g = make()
	put(g, 'pDE', BAL, '德国', 'army')
	put(g, 'pIT', BAL, '意大利', 'army')
	g.hands['英国'] = ['15316#1']
	I.refresh(g)

	/*
	 * 候选由 event_card_needs 统一下发（客户端读的就是它，31836 分支），
	 * 而不是 resolve_event_card 的返回值（那里只有 need:'piece' + pending:true）。
	 */
	const need = I.event_card_needs(g, '英国', '15316#1', {})
	ok('返回 need=piece', need && need.need === 'piece', need && Object.keys(need))
	const cs = (need && need.candidates) || []
	ok('候选 2 个', cs.length === 2, cs)
	const names = cs.map(c => c && c.name)
	ok('★ 两个候选名【不相同】', names.length === 2 && new Set(names).size === names.length, names)
	ok('★ 名字里带国家名（德国 / 意大利）',
		names.some(n => /德国/.test(n)) && names.some(n => /意大利/.test(n)), names)
	ok('★ 名字里带兵种与地区', names.every(n => /陆军/.test(n) && /巴尔干/.test(n)), names)
}

section('S3 只有 1 个合法目标时：不问（自动结算）')
{
	const g = make()
	put(g, 'pDE', BAL, '德国', 'army')
	g.hands['英国'] = ['15316#1']
	I.refresh(g)
	const r = I.resolve_event_card(g, '英国', '15316#1', {}, 0, null, {})
	ok('★ 不再返回 need=piece', !(r && r.need === 'piece'),
		r && (r.need || Object.keys(r)))
}

/* ============================================================
 * S4 / S5 原来只传裸 id 的两张卡
 * ============================================================ */
section('S4 15355 特种空勤团：敌方空军候选带 name')
{
	const g = make()
	/* 英国空军在北海（补给），相邻有德国空军 */
	const NS = data.id_of('北海')
	const WE = data.id_of('西欧')
	put(g, 'ukN', NS, '英国', 'navy')
	put(g, 'ukA', NS, '英国', 'air')
	put(g, 'deA', WE, '德国', 'air')
	const eff = I.ECHO_EFFECTS['15355']
	const r = eff.armed.run(g, {}, null)
	ok('返回 need=piece', r && r.need === 'piece', r && (r.need || Object.keys(r)))
	const cs = (r && r.candidates) || []
	ok('★ 候选是 {id,name} 对象（不再裸 id）',
		cs.length > 0 && cs.every(c => c && typeof c === 'object' && c.id != null && c.name),
		cs)
	if (cs.length) ok('  名字带国家名', /德国/.test(cs[0].name), cs[0].name)
}

section('S5 17808 莫斯科战役：敌方陆军候选带 name')
{
	const g = make()
	put(g, 'de1', MSC, '德国', 'army')
	const eff = I.ECHO_EFFECTS['17808']
	const r = eff.armed.run(g, { space: MSC }, null)
	ok('返回 need=piece', r && r.need === 'piece', r && (r.need || Object.keys(r)))
	const cs = (r && r.candidates) || []
	ok('★ 候选是 {id,name} 对象（不再裸 id）',
		cs.length > 0 && cs.every(c => c && typeof c === 'object' && c.id != null && c.name),
		cs)
	if (cs.length) ok('  名字带国家名', /德国/.test(cs[0].name), cs[0].name)
}

/* ============================================================
 * S6 命名格式
 * ============================================================ */
section('S6 piece_candidate_label 格式 = 国家 + 兵种 + @地区')
{
	const g = make()
	put(g, 'pDE', BAL, '德国', 'army')
	const s = I.piece_candidate_label(g, 'pDE')
	ok('★ 结果 = 德国陆军@巴尔干', s === '德国陆军@巴尔干', s)
}

/* ============================================================
 * S7 源码守卫：不再有手拼「兵种@地区」
 * ============================================================ */
section('S7 源码守卫：候选命名统一走 piece_candidate_label')
{
	const src = require('fs').readFileSync(path.join(__dirname, '..', M, 'rules.js'), 'utf8')
	/* 先剔掉原子自身的函数体（它当然要拼 "兵种@地区"），再查是否还有手拼 */
	const i0 = src.indexOf('function piece_candidate_label')
	const i1 = src.indexOf('function eliminate_candidates')
	const rest = (i0 >= 0 && i1 > i0) ? (src.slice(0, i0) + src.slice(i1)) : src
	const handBuilt = rest.match(/piece_type_zh\([^)]*\)\s*\+\s*'@'/g) || []
	ok('★ 没有残留的手拼「兵种@地区」（原子内部除外）', handBuilt.length === 0, handBuilt)
	const uses = (src.match(/piece_candidate_label\(/g) || []).length
	ok('★ piece_candidate_label 被使用（>=6 处）', uses >= 6, uses)
}

console.log('\n' + (fails.length ? ('有失败断言：' + fails.join(', ')) : '全部通过') +
	'  PASS ' + pass + ' / FAIL ' + fails.length)
process.exitCode = fails.length ? 1 : 0
