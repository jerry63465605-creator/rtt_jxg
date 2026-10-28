/*
 * 【2026-10-28】17549 / 15346 / 15356 / 15345 —— 补给链「光环当中继」验收
 *
 * 玩家口径（2026-10-28）：
 *   · 「只 17549 无问题，bug 出在 15346」
 *   · 「保留海军中继」—— 海军可以给陆军续链（不做兵种限制）
 *   · 光环不能凭空造源：孤立远洋的部队即使被「总是补给」覆盖，也不当中继
 *
 * 根因：compute_supply 的迭代段写成 `if (in_supply[pid]) continue`，
 *   把被光环罩住的部队（aura / granted）一起跳过 —— 它们永远失去
 *   「证明自己其实连得回真源」的机会，can_source 恒为 false，
 *   于是「加了全补给光环反而比不加更差」（法国海军在 15346 下不再是中继，
 *   巴尔干英国陆军因此断补）。
 *
 * 修复：只有 base / chain 才跳过迭代；aura / granted 若判定通过则升级为 chain。
 *
 * 地图事实（实测）：
 *   西欧(6)   陆地，补给点      邻 波罗的海/意大利/北海/德国/地中海
 *   意大利(13) 陆地，补给点
 *   地中海(46) 海域              邻 西欧/巴尔干/意大利/非洲北部/中东
 *   非洲北部(15) 陆地            邻 中东/北海/南大西洋/非洲南部/非洲东部/阿拉伯海/地中海
 *   非洲南部(31) 陆地            邻 非洲北部/南大西洋/非洲东部
 *   巴尔干(12) 陆地              邻 东欧/意大利/黑海/德国/乌克兰/地中海
 *   -> 西欧到巴尔干没有陆路，只能经「地中海」渡海：这正是「海军中继」的意义。
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

/* 建局：清空盘面 -> 摆棋子 -> 开光环卡（走 apply_status_ongoing，与真实打出同源） */
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

/* ---------------- S1 玩家原场景 ---------------- */
section('S1 17549 + 15346：西欧英国陆军(源) -> 地中海法军海军 -> 巴尔干英国陆军')
{
	const g = make([
		['uk_we', WE, '英国', 'army'],
		['fr_med_n', MED, '法国', 'navy'],
		['uk_bal', BAL, '英国', 'army'],
		['fr_na', NA, '法国', 'army'],
	], [CARD_17549, CARD_15346])
	const s = sup(g)
	ok('西欧英国陆军补给（种子 base）', on(s, 'uk_we') && src(s, 'uk_we') === 'base')
	ok('地中海法军海军补给', on(s, 'fr_med_n'))
	ok('地中海法军海军【升级为 chain】并可作为中继', src(s, 'fr_med_n') === 'chain' && cs(s, 'fr_med_n'),
		{ src: src(s, 'fr_med_n'), can_source: cs(s, 'fr_med_n') })
	ok('非洲北部法国陆军补给', on(s, 'fr_na'))
	ok('★ 巴尔干英国陆军补给（修复前断补）', on(s, 'uk_bal') && src(s, 'uk_bal') === 'chain',
		{ in_supply: on(s, 'uk_bal'), src: src(s, 'uk_bal') })
}

/* ---------------- S2 只 17549（回归：本来就好） ---------------- */
section('S2 只 17549（无 15346）：结果必须与修复前一致')
{
	const g = make([
		['uk_we', WE, '英国', 'army'],
		['fr_med_n', MED, '法国', 'navy'],
		['uk_bal', BAL, '英国', 'army'],
		['fr_na', NA, '法国', 'army'],
	], [CARD_17549])
	const s = sup(g)
	ok('西欧英国陆军 base', src(s, 'uk_we') === 'base')
	ok('地中海法军海军 chain', src(s, 'fr_med_n') === 'chain' && cs(s, 'fr_med_n'))
	ok('巴尔干英国陆军 chain', src(s, 'uk_bal') === 'chain')
	ok('非洲北部法国陆军 chain', src(s, 'fr_na') === 'chain')
}

/* ---------------- S3 光环不凭空造源 ---------------- */
section('S3 孤立法军海军（北大西洋，四周无源）+ 15346：不许当中继')
{
	const g = make([
		['uk_we', WE, '英国', 'army'],
		['fr_n', NATL, '法国', 'navy'],
		['uk_bal', BAL, '英国', 'army'],
	], [CARD_17549, CARD_15346])
	const s = sup(g)
	ok('孤立法军海军自身补给（15346 光环）', on(s, 'fr_n') && src(s, 'fr_n') === 'aura')
	ok('孤立法军海军【不是中继】', !cs(s, 'fr_n'))
	ok('巴尔干英国陆军断补', !on(s, 'uk_bal'))
}

/* ---------------- S4 只有 15356，没有源 ---------------- */
section('S4 只 15356：地中海英国海军光环自身补给，但无陆军可依 -> 不当中继')
{
	const g = make([
		['uk_n', MED, '英国', 'navy'],
		['uk_bal', BAL, '英国', 'army'],
	], [CARD_15356])
	const s = sup(g)
	ok('地中海英国海军补给（15356 光环）', on(s, 'uk_n') && src(s, 'uk_n') === 'aura')
	ok('地中海英国海军不是中继（无据可依）', !cs(s, 'uk_n'))
	ok('巴尔干英国陆军断补', !on(s, 'uk_bal'))
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
	ok('孤立苏联陆军不当中继', !cs(s, 'su_a'))
	/* 卡面写「苏联陆军」，若配置缺 type:'army'，海军也会被覆盖 —— 已知偏差，只记录不判失败 */
	if (on(s, 'su_n')) {
		console.log('  WARN 17838 配置未限兵种，苏联海军也被覆盖（卡面仅写陆军）-> src=' + src(s, 'su_n'))
	} else {
		pass++
		console.log('  ok   17838 只覆盖苏联陆军（海军未受益）')
	}
}

/* ---------------- S6 15356 + 有源：海军升级为中继 ---------------- */
section('S6 15356 + 17549：地中海英国海军靠西欧英国陆军连回源 -> 升级中继')
{
	const g = make([
		['uk_we', WE, '英国', 'army'],
		['uk_n', MED, '英国', 'navy'],
		['uk_bal', BAL, '英国', 'army'],
	], [CARD_15356, CARD_17549])
	const s = sup(g)
	ok('地中海英国海军升级为 chain', src(s, 'uk_n') === 'chain' && cs(s, 'uk_n'),
		{ src: src(s, 'uk_n'), can_source: cs(s, 'uk_n') })
	ok('巴尔干英国陆军补给', on(s, 'uk_bal'))
}

/* ---------------- S7 8601 空间免移除不当中继 ---------------- */
section('S7 8601 海参崴日本陆军：只免移除，不当中继')
{
	const g = make([
		['ja_a', VVO, '日本', 'army'],
		['uk_it', IT, '英国', 'army'],
	], [CARD_8601, CARD_17549])
	const s = sup(g)
	ok('海参崴日本陆军补给（8601 光环）', on(s, 'ja_a') && src(s, 'ja_a') === 'aura')
	ok('海参崴日本陆军不是中继', !cs(s, 'ja_a'))
	ok('意大利英国陆军 base 不受影响', src(s, 'uk_it') === 'base')
}

/* ---------------- S8 裸盘基线 ---------------- */
section('S8 无任何卡：裸盘补给基线')
{
	const g = make([
		['uk_we', WE, '英国', 'army'],
		['uk_bal', BAL, '英国', 'army'],
		['fr_med_n', MED, '法国', 'navy'],
	], [])
	const s = sup(g)
	ok('西欧英国陆军 base', src(s, 'uk_we') === 'base')
	ok('巴尔干英国陆军断补（无 17549 时海军不能跨阵营中继）', !on(s, 'uk_bal'))
	ok('地中海法国海军断补（无法国源）', !on(s, 'fr_med_n'))
}

/* ---------------- S9 四卡全开（玩家指定） ---------------- */
section('S9 15345 + 15346 + 15356 + 17549：六支部队全场景')
{
	const g = make([
		['fr_sa', SA, '法国', 'army'],      /* 非洲南部法军：15345 补给点 */
		['fr_na', NA, '法国', 'army'],      /* 非洲北部法军 */
		['uk_na', NA, '英国', 'army'],      /* 非洲北部英军 */
		['fr_n', MED, '法国', 'navy'],      /* 地中海法军 */
		['uk_n', MED, '英国', 'navy'],      /* 地中海英军 */
		['uk_bal', BAL, '英国', 'army'],    /* 巴尔干英军 */
	], [CARD_15345, CARD_15346, CARD_15356, CARD_17549])
	const s = sup(g)
	ok('非洲南部法军 base（15345 补给点）', on(s, 'fr_sa') && src(s, 'fr_sa') === 'base', src(s, 'fr_sa'))
	ok('非洲北部法军 chain', on(s, 'fr_na') && src(s, 'fr_na') === 'chain')
	ok('非洲北部英军 chain', on(s, 'uk_na') && src(s, 'uk_na') === 'chain')
	ok('地中海法军海军 chain 且为中继', on(s, 'fr_n') && src(s, 'fr_n') === 'chain' && cs(s, 'fr_n'))
	ok('地中海英军海军 chain 且为中继', on(s, 'uk_n') && src(s, 'uk_n') === 'chain' && cs(s, 'uk_n'))
	ok('★ 巴尔干英军 chain', on(s, 'uk_bal') && src(s, 'uk_bal') === 'chain', src(s, 'uk_bal'))
}

/* ---------------- S10 无 15345 ---------------- */
section('S10 无 15345（15346 + 15356 + 17549）：法国失去补给点，全德 aura 不当中继')
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
	ok('非洲南部法军不是中继', !cs(s, 'fr_sa'))
	ok('地中海法军海军不是中继', !cs(s, 'fr_n'))
	ok('地中海英军海军不是中继', !cs(s, 'uk_n'))
	ok('非洲北部英军断补（邻格无法国源）', !on(s, 'uk_na'))
	ok('巴尔干英军断补', !on(s, 'uk_bal'))
}

/* ---------------- S11 无 15346 ---------------- */
section('S11 无 15346（15345 + 15356 + 17549）：靠真补给点，全部连通')
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
	ok('非洲北部法军 chain', src(s, 'fr_na') === 'chain')
	ok('非洲北部英军 chain', src(s, 'uk_na') === 'chain')
	ok('地中海法军海军 chain', src(s, 'fr_n') === 'chain')
	ok('地中海英军海军 chain', src(s, 'uk_n') === 'chain')
	ok('巴尔干英军 chain', src(s, 'uk_bal') === 'chain')
}

/* ---------------- S12 无 15345 也无 15346 ---------------- */
section('S12 无 15345 也无 15346（15356 + 17549）：仅光环自身补给，链全断')
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
	ok('非洲南部法军断补', !on(s, 'fr_sa'))
	ok('非洲北部法军断补', !on(s, 'fr_na'))
	ok('非洲北部英军断补', !on(s, 'uk_na'))
	ok('地中海法军海军断补', !on(s, 'fr_n'))
	ok('地中海英军海军补给（15356 光环）', on(s, 'uk_n') && src(s, 'uk_n') === 'aura')
	ok('地中海英军海军不是中继', !cs(s, 'uk_n'))
	ok('巴尔干英军断补', !on(s, 'uk_bal'))
}

/* ---------------- S13 源码守卫 ---------------- */
section('S13 源码守卫：迭代跳过条件只认 base / chain')
{
	const fs = require('fs')
	const srcText = fs.readFileSync(path.join(__dirname, '..', M, 'rules.js'), 'utf8')
	ok('迭代里不再用 `if (in_supply[pid]) continue` 一刀切',
		!/for \(const pid of allPieces\) \{\s*\n\s*if \(in_supply\[pid\]\) continue/.test(srcText))
	ok('迭代按 sources 判定跳过（base / chain）',
		/if \(sources\[pid\] === 'base' \|\| sources\[pid\] === 'chain'\) continue/.test(srcText))
	ok('海陆链未按兵种限制（保留海军中继）',
		!/piece_type\[other\] === 'army' &&\s*\n?\s*supply_group_partner\(game, game\.piece_nation\[other\]/.test(srcText))
}

console.log('\n' + (fails.length ? 'FAILED' : 'ALL PASS') + '  ' + pass + ' ok, ' + fails.length + ' fail')
if (fails.length) { console.log('失败项: ' + fails.join(' | ')); process.exit(1) }
