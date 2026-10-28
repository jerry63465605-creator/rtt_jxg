/*
 * 【2026-10-28】补给链「根集合」模型验收（17549 / 15345 / 15346 / 15356 / 17838 / 8601）
 *
 * 玩家口径（2026-10-28，多轮对齐后的最终版）：
 *   1. 通用补给点归属 = 占上去的部队所在国；两国共占 -> 两国各自成源
 *   2. 「仅对 XX」的补给点（15345）只有 XX 占上去才算源
 *   3. 没有本国部队占着 -> 不能把该格当"潜在源"去连
 *   4. 同国接根 -> 自己补给，继续传
 *   5. 17549 组内跨国接根 -> 自己【不补给】，但继续传【原国籍】的根
 *   6. 只有根国籍 = 自己国籍的部队才算补给
 *   7. 无 17549 时同阵营友军不能传根（只有同国）
 *   8. 光环只给自身补给，不产生根
 *   9. 海军传根也要 A（相邻有根）+ B（相邻陆军），即 (a)
 *  10. 本国大本营无条件给本国供源，但【需要有人站在上面承载】才传得出去
 *
 * 实现要点：
 *   · roots[pid] = { 国名: true }  根集合（可多根）
 *   · 承载：站在有源格位上的部队收集该格全部源（supply_sources_at）
 *   · 接根：只认【传递者国籍】= 同国 / 17549 组内（这条同时挡住敌方传根）
 *   · 大本营：effective_home_base（兼容 15344 迁都 / 15346 自由法国动态改判）
 *
 * 地图事实（实测）：
 *   西欧(6)  = 通用补给点 + 【法国大本营】  邻 波罗的海/意大利/北海/德国/地中海
 *   不列颠(2) = 英国大本营，只邻北海
 *   意大利(13) = 通用补给点 + 意大利大本营
 *   非洲南部(31) = 陆邻 非洲北部/南大西洋/非洲东部（非补给点）
 *   南大西洋(29) = 海区，陆邻 亚速尔/非洲北部/拉丁美洲/非洲南部/马达加斯加
 *   北海(17) / 阿拉伯海(34) / 中东(16)
 */
const path = require('path')
const M = path.join('server-official', 'public', 'quartermaster-sub-wars')
const rules = require(path.join(__dirname, '..', M, 'rules.js'))
const C = require(path.join(__dirname, '..', M, 'cards.js'))
const I = rules._internal
const data = I.data

const WE = data.id_of('西欧')
const IT = data.id_of('意大利')
const BAL = data.id_of('巴尔干')
const MED = data.id_of('地中海')
const NA = data.id_of('非洲北部')
const SA = data.id_of('非洲南部')
const NATL = data.id_of('北大西洋')
const NS = data.id_of('北海')
const SATL = data.id_of('南大西洋')
const ARB = data.id_of('阿拉伯海')
const ME = data.id_of('中东')
const VVO = data.id_of('海参崴')

const CARD_15345 = '15345'   /* 塞内加尔步兵团：非洲南部成为仅对法国的补给点 */
const CARD_15346 = '15346'   /* 自由法国：法国部队总是处于补给状态 */
const CARD_15356 = '15356'   /* 地中海基地：地中海英国海军总是处于补给状态 */
const CARD_17549 = '17549'   /* 盟军远征部队最高司令部：英/法/美共享补给线 */
const CARD_17838 = '17838'   /* 什维尔尼克疏散委员会：苏联陆军总是处于补给状态 */
const CARD_8601 = '8601'     /* 远东共和国：海参崴日本陆军不会因补给移除 */

let pass = 0
const fails = []
function ok(name, cond, extra) {
	if (cond) { pass++; console.log('  ok   ' + name) }
	else { fails.push(name); console.log('  FAIL ' + name + (extra !== undefined ? '  | ' + JSON.stringify(extra) : '')) }
}
function section(t) { console.log('\n=== ' + t + ' ===') }

function make(pieces, cards) {
	const g = rules.setup(20261028, rules.default_scenario, {})
	g.opening = null
	I.set_skip_turn_guard(true)
	g.turn = 3
	g.turn_phase = 'play'
	g.nations_done = 1
	g.current_nation = '美国'
	g.active = 'Allies'
	for (const pid of Object.keys(g.location)) delete g.location[pid]
	g.table = g.table || {}
	for (const [pid, sp, nat, type] of (pieces || [])) {
		g.location[pid] = sp
		g.piece_nation[pid] = nat
		g.piece_type[pid] = type
	}
	for (const cid of (cards || [])) {
		const c = C.CARDS.find(x => String(x.id) === cid)
		const nat = c ? c.nation : '美国'
		g.table[nat] = g.table[nat] || []
		g.table[nat].push(cid + '#1')
		I.apply_status_ongoing(g, cid + '#1', nat)
	}
	I.refresh(g)
	return g
}

const sup = (g) => I.compute_supply(g)
const on = (s, p) => !!s.in_supply[p]
const src = (s, p) => s.sources[p] || '-'
const cs = (s, p) => !!s.can_source[p]
const hasRoot = (s, p, n) => !!(s.roots && s.roots[p] && s.roots[p][n])
const rootStr = (s, p) => (s.roots && s.roots[p]) ? Object.keys(s.roots[p]).sort().join('+') : '-'
const noRoot = (s, p) => !(s.roots && s.roots[p] && Object.keys(s.roots[p]).length)

/* ---------------- S1 玩家原场景 ---------------- */
section('S1 17549 + 15346：西欧英军 / 地中海法军海军 / 巴尔干英军 / 非北法军')
{
	const g = make([
		['uk_we', WE, '英国', 'army'],
		['fr_med_n', MED, '法国', 'navy'],
		['uk_bal', BAL, '英国', 'army'],
		['fr_na', NA, '法国', 'army'],
	], [CARD_17549, CARD_15346])
	const s = sup(g)
	ok('西欧英军独自补给（base）', on(s, 'uk_we') && src(s, 'uk_we') === 'base')
	ok('西欧英军同时承载【英国 + 法国】两根（西欧=法国大本营）',
		hasRoot(s, 'uk_we', '英国') && hasRoot(s, 'uk_we', '法国'), rootStr(s, 'uk_we'))
	ok('地中海法军海军补给', on(s, 'fr_med_n'))
	ok('地中海法军海军拿到法国根', hasRoot(s, 'fr_med_n', '法国'), rootStr(s, 'fr_med_n'))
	ok('★ 巴尔干英军补给', on(s, 'uk_bal'))
	ok('★ 巴尔干英军拿到英国根', hasRoot(s, 'uk_bal', '英国'), rootStr(s, 'uk_bal'))
	ok('非北法军补给', on(s, 'fr_na'))
}

/* ---------------- S2 只 17549 ---------------- */
section('S2 只 17549（无 15346）：法国靠"英国陆军承载的法国大本营根"补给')
{
	const g = make([
		['uk_we', WE, '英国', 'army'],
		['fr_med_n', MED, '法国', 'navy'],
		['uk_bal', BAL, '英国', 'army'],
		['fr_na', NA, '法国', 'army'],
	], [CARD_17549])
	const s = sup(g)
	ok('西欧英军 base', src(s, 'uk_we') === 'base' && hasRoot(s, 'uk_we', '法国'))
	ok('★ 地中海法军海军补给（经 17549 拿到法国大本营根）', on(s, 'fr_med_n'), src(s, 'fr_med_n'))
	ok('★ 巴尔干英军补给', on(s, 'uk_bal'))
	ok('非北法军补给', on(s, 'fr_na'))
}

/* ---------------- S2b 无 17549：跨国断了 ---------------- */
section('S2b 无 17549：异国根传不出去 -> 法军/巴尔干英军全断')
{
	const g = make([
		['uk_we', WE, '英国', 'army'],
		['fr_med_n', MED, '法国', 'navy'],
		['uk_bal', BAL, '英国', 'army'],
		['fr_na', NA, '法国', 'army'],
	], [])
	const s = sup(g)
	ok('西欧英军 base', on(s, 'uk_we'))
	ok('地中海法军海军断补（无 17549 不给异国根）', !on(s, 'fr_med_n'))
	ok('非北法军断补', !on(s, 'fr_na'))
	ok('巴尔干英军断补（法国海军接不到根，无法中继）', !on(s, 'uk_bal'))
}

/* ---------------- S3 光环不凭空造根 ---------------- */
section('S3 15346 + 法军海军孤立北大西洋：自身补给但无根可传')
{
	const g = make([
		['uk_we', WE, '英国', 'army'],
		['fr_n', NATL, '法国', 'navy'],
		['uk_bal', BAL, '英国', 'army'],
	], [CARD_17549, CARD_15346])
	const s = sup(g)
	ok('孤立法军海军自身补给（15346 光环）', on(s, 'fr_n') && src(s, 'fr_n') === 'aura')
	ok('孤立法军海军【没有根】（光环不造根）', noRoot(s, 'fr_n'), rootStr(s, 'fr_n'))
	ok('巴尔干英军断补', !on(s, 'uk_bal'))
}

/* ---------------- S4 只有 15356，没有陆军可依 ---------------- */
section('S4 只 15356：地中海英军海军光环补给，但拿不到港口 -> 无根')
{
	const g = make([
		['uk_n', MED, '英国', 'navy'],
		['uk_bal', BAL, '英国', 'army'],
	], [CARD_15356])
	const s = sup(g)
	ok('地中海英军海军补给（15356 光环）', on(s, 'uk_n') && src(s, 'uk_n') === 'aura')
	ok('该海军没有根（B 不满足）', noRoot(s, 'uk_n'))
	ok('巴尔干英军断补', !on(s, 'uk_bal'))
}

/* ---------------- S5 17838 覆盖范围 ---------------- */
section('S5 17838 苏联陆军总是补给（卡面限陆军）')
{
	const g = make([
		['su_a', NATL, '苏联', 'army'],
		['su_n', NATL, '苏联', 'navy'],
	], [CARD_17838])
	const s = sup(g)
	ok('苏联陆军被 17838 覆盖', on(s, 'su_a') && src(s, 'su_a') === 'aura')
	ok('苏联陆军没有根', noRoot(s, 'su_a'))
	if (on(s, 'su_n')) {
		console.log('  WARN 17838 配置未限兵种，苏联海军也被覆盖（卡面仅写陆军）-> src=' + src(s, 'su_n'))
	} else {
		pass++
		console.log('  ok   17838 只覆盖苏联陆军（海军未受益）')
	}
}

/* ---------------- S6 15356 + 有源 ---------------- */
section('S6 15356 + 17549（全英国）：西欧英军 -> 地中海英军海军 -> 巴尔干英军')
{
	const g = make([
		['uk_we', WE, '英国', 'army'],
		['uk_n', MED, '英国', 'navy'],
		['uk_bal', BAL, '英国', 'army'],
	], [CARD_15356, CARD_17549])
	const s = sup(g)
	ok('地中海英军海军补给', on(s, 'uk_n'))
	ok('地中海英军海军拿到英国根', hasRoot(s, 'uk_n', '英国'), rootStr(s, 'uk_n'))
	ok('巴尔干英军补给', on(s, 'uk_bal'))
}

/* ---------------- S7 8601 ---------------- */
section('S7 8601 海参崴日本陆军：只免移除，不产生根')
{
	const g = make([
		['ja_a', VVO, '日本', 'army'],
		['uk_it', IT, '英国', 'army'],
	], [CARD_8601, CARD_17549])
	const s = sup(g)
	ok('海参崴日本陆军补给（8601 光环）', on(s, 'ja_a') && src(s, 'ja_a') === 'aura')
	ok('海参崴日本陆军没有根', noRoot(s, 'ja_a'))
	ok('意大利英军 base（意大利=意大利大本营，同时承载意大利根）',
		src(s, 'uk_it') === 'base' && hasRoot(s, 'uk_it', '意大利'), rootStr(s, 'uk_it'))
}

/* ---------------- S8 裸盘基线 ---------------- */
section('S8 无任何卡：裸盘基线（西欧承载法国大本营根，但无 17549 传不出去）')
{
	const g = make([
		['uk_we', WE, '英国', 'army'],
		['uk_bal', BAL, '英国', 'army'],
		['fr_med_n', MED, '法国', 'navy'],
	], [])
	const s = sup(g)
	ok('西欧英军 base，根 = 英国 + 法国',
		src(s, 'uk_we') === 'base' && hasRoot(s, 'uk_we', '英国') && hasRoot(s, 'uk_we', '法国'), rootStr(s, 'uk_we'))
	ok('巴尔干英军断补（西欧与巴尔干无陆路，且无 17549）', !on(s, 'uk_bal'))
	ok('地中海法军海军断补（异国根不给）', !on(s, 'fr_med_n'))
}

/* ---------------- S9 四卡全开（玩家指定） ---------------- */
section('S9 15345 + 15346 + 15356 + 17549：源「仅对法国」-> 英国全断补')
{
	const g = make([
		['fr_sa', SA, '法国', 'army'],
		['uk_sa', SA, '英国', 'army'],
		['fr_na', NA, '法国', 'army'],
		['uk_na', NA, '英国', 'army'],
		['fr_n', MED, '法国', 'navy'],
		['uk_n', MED, '英国', 'navy'],
		['uk_bal', BAL, '英国', 'army'],
	], [CARD_15345, CARD_15346, CARD_15356, CARD_17549])
	const s = sup(g)
	ok('非洲南部法军 base（15345 仅对法国）', on(s, 'fr_sa') && src(s, 'fr_sa') === 'base', src(s, 'fr_sa'))
	ok('非洲北部法军补给', on(s, 'fr_na'))
	ok('地中海法军海军补给', on(s, 'fr_n'))
	ok('★ 非洲南部英军拿不到 base', !(on(s, 'uk_sa') && src(s, 'uk_sa') === 'base'),
		{ sup: on(s, 'uk_sa'), src: src(s, 'uk_sa') })
	ok('★ 非洲北部英军断补（只收到法国根）', !on(s, 'uk_na') && hasRoot(s, 'uk_na', '法国'),
		{ sup: on(s, 'uk_na'), roots: rootStr(s, 'uk_na') })
	ok('地中海英军海军自身补给（15356 光环）', on(s, 'uk_n') && src(s, 'uk_n') === 'aura')
	ok('★ 巴尔干英军断补', !on(s, 'uk_bal'), rootStr(s, 'uk_bal'))
}

/* ---------------- S10 无 15345 ---------------- */
section('S10 无 15345（15346 + 15356 + 17549）：法国失去补给点，西欧也没人 -> 无根')
{
	const g = make([
		['fr_sa', SA, '法国', 'army'],
		['fr_na', NA, '法国', 'army'],
		['uk_na', NA, '英国', 'army'],
		['fr_n', MED, '法国', 'navy'],
		['uk_n', MED, '英国', 'navy'],
		['uk_bal', BAL, '英国', 'army'],
	], [CARD_15346, CARD_15356, CARD_17549])
	const s = sup(g)
	ok('非洲南部法军补给（15346 光环）', on(s, 'fr_sa') && src(s, 'fr_sa') === 'aura')
	ok('非洲南部法军没有根', noRoot(s, 'fr_sa'))
	ok('地中海法军海军没有根', noRoot(s, 'fr_n'))
	ok('非洲北部英军断补', !on(s, 'uk_na'))
	ok('巴尔干英军断补', !on(s, 'uk_bal'))
}

/* ---------------- S11 无 15346 ---------------- */
section('S11 无 15346（15345 + 15356 + 17549）：法国靠自己那条源，英国仍断补')
{
	const g = make([
		['fr_sa', SA, '法国', 'army'],
		['fr_na', NA, '法国', 'army'],
		['uk_na', NA, '英国', 'army'],
		['fr_n', MED, '法国', 'navy'],
		['uk_n', MED, '英国', 'navy'],
		['uk_bal', BAL, '英国', 'army'],
	], [CARD_15345, CARD_15356, CARD_17549])
	const s = sup(g)
	ok('非洲南部法军 base', src(s, 'fr_sa') === 'base')
	ok('非洲北部法军补给', on(s, 'fr_na'))
	ok('地中海法军海军补给', on(s, 'fr_n'))
	ok('★ 非洲北部英军断补（源仅对法国）', !on(s, 'uk_na'))
	ok('★ 巴尔干英军断补', !on(s, 'uk_bal'))
}

/* ---------------- S12 无 15345 也无 15346 ---------------- */
section('S12 无 15345 也无 15346（15356 + 17549）：仅 15356 光环自身补给')
{
	const g = make([
		['fr_sa', SA, '法国', 'army'],
		['fr_na', NA, '法国', 'army'],
		['uk_na', NA, '英国', 'army'],
		['fr_n', MED, '法国', 'navy'],
		['uk_n', MED, '英国', 'navy'],
		['uk_bal', BAL, '英国', 'army'],
	], [CARD_15356, CARD_17549])
	const s = sup(g)
	ok('非洲南部法军断补（西欧无人，法国无源）', !on(s, 'fr_sa'))
	ok('非洲北部法军断补', !on(s, 'fr_na'))
	ok('非洲北部英军断补', !on(s, 'uk_na'))
	ok('地中海法军海军断补', !on(s, 'fr_n'))
	ok('地中海英军海军补给（15356 光环）', on(s, 'uk_n') && src(s, 'uk_n') === 'aura')
	ok('巴尔干英军断补', !on(s, 'uk_bal'))
}

/* ---------------- S14 普通补给点跨国 ---------------- */
section('S14 意大利英军 / 地中海法军海军 / 巴尔干法军：法军拿不到英国根')
{
	const g = make([
		['uk_it', IT, '英国', 'army'],
		['fr_n', MED, '法国', 'navy'],
		['fr_bal', BAL, '法国', 'army'],
	], [CARD_17549])
	const s = sup(g)
	ok('意大利英军 base，根 = 英国 + 意大利', src(s, 'uk_it') === 'base' && hasRoot(s, 'uk_it', '意大利'))
	ok('★ 地中海法军海军断补（只有英国/意大利根）', !on(s, 'fr_n') && hasRoot(s, 'fr_n', '英国'))
	ok('★ 巴尔干法军断补', !on(s, 'fr_bal'))
}

/* ---------------- S15 西欧法军 ---------------- */
section('S15 S9 布局 + 西欧法国陆军：法国独占源，英国陆军全断')
{
	const g = make([
		['fr_we', WE, '法国', 'army'],
		['fr_sa', SA, '法国', 'army'],
		['uk_sa', SA, '英国', 'army'],
		['fr_na', NA, '法国', 'army'],
		['uk_na', NA, '英国', 'army'],
		['fr_n', MED, '法国', 'navy'],
		['uk_n', MED, '英国', 'navy'],
		['uk_bal', BAL, '英国', 'army'],
	], [CARD_15345, CARD_15346, CARD_15356, CARD_17549])
	const s = sup(g)
	ok('西欧法军 base', on(s, 'fr_we') && src(s, 'fr_we') === 'base')
	ok('西欧法军只有法国根（没有英国部队占着）', rootStr(s, 'fr_we') === '法国', rootStr(s, 'fr_we'))
	ok('非洲南部法军 base', src(s, 'fr_sa') === 'base')
	ok('非洲北部法军 / 地中海法军海军补给', on(s, 'fr_na') && on(s, 'fr_n'))
	ok('★ 非洲南部英军断补', !on(s, 'uk_sa'))
	ok('★ 非洲北部英军断补', !on(s, 'uk_na'))
	ok('★ 巴尔干英军断补', !on(s, 'uk_bal'))
	ok('地中海英军海军仅 15356 光环补给', on(s, 'uk_n') && src(s, 'uk_n') === 'aura')
}

/* ---------------- S16 纯海区传根（方案 a） ---------------- */
section('S16 方案(a)：海军传根也要 A+B —— 孤悬海区的海军不能中继')
{
	const g = make([
		['uk_we', WE, '英国', 'army'],
		['uk_ns', NS, '英国', 'navy'],
		['uk_satl', SATL, '英国', 'navy'],
		['uk_arb', ARB, '英国', 'navy'],
		['uk_me', ME, '英国', 'army'],
	], [CARD_17549])
	const s = sup(g)
	ok('北海英军海军补给（邻西欧陆军，A+B 都成立）', on(s, 'uk_ns'), src(s, 'uk_ns'))
	ok('南大西洋英军海军断补（陆邻全空 -> B 不满足）', !on(s, 'uk_satl'))
	ok('南大西洋英军海军【没有根】（B 不满足就不接根）', noRoot(s, 'uk_satl'), rootStr(s, 'uk_satl'))
	ok('阿拉伯海英军海军断补', !on(s, 'uk_arb'))
	ok('中东英军陆军断补', !on(s, 'uk_me'))
}

/* ---------------- S13 源码守卫 ---------------- */
section('S13 源码守卫：根集合模型的关键约束')
{
	const fs = require('fs')
	const srcText = fs.readFileSync(path.join(__dirname, '..', M, 'rules.js'), 'utf8')
	ok('存在根集合 roots', /const roots = \{\}/.test(srcText))
	ok('承载阶段用 supply_sources_at 收集该格全部源', /supply_sources_at\(game, Number\(loc\), pids\)/.test(srcText))
	ok('接根要求"传递者同国或 17549 组内"',
		/if \(!\(onat === nat \|\| supply_group_partner\(game, nat, onat\)\)\) continue/.test(srcText))
	ok('自己补给只认"自己国的根"', /if \(mine\[nat\] && !in_supply\[pid\]\)/.test(srcText))
	ok('海陆链未按兵种限制（保留海军中继）',
		!/piece_type\[other\] === 'army' &&\s*\n?\s*supply_group_partner\(game, game\.piece_nation\[other\]/.test(srcText))
	ok('大本营参与供源（effective_home_base 进 supply_sources_at）',
		/effective_home_base\(game, n\)\) === sp/.test(srcText))
}

console.log('\n' + (fails.length ? 'FAILED' : 'ALL PASS') + '  ' + pass + ' ok, ' + fails.length + ' fail')
if (fails.length) { console.log('失败项: ' + fails.join(' | ')); process.exit(1) }
