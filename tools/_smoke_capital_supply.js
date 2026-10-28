/*
 * 【2026-10-28】迁都 × 补给 验收（玩家要求确认的两个场景）
 *
 * 场景 A：15344《法国流亡政府》迁都（西欧被敌占 -> 法国大本营=不列颠）
 *          + 17549《盟军远征部队最高司令部》
 *          -> 法国海军补给情况
 * 场景 B：17845《迁都古比雪夫》（苏联大本营 莫斯科 -> 西伯利亚）
 *          -> 相关补给情况
 *
 * 附带修复：#12 的【第二半】——
 *   上一轮只让 aura/granted 参与迭代，但升级分支仍有 `!in_supply[pid]` 守卫，
 *   于是被光环罩住的部队即使接到【本国根】也升级不了 chain、当不了中继。
 *   症状：迁都 + 17549 + 15346 时，法国海军反而比【不加 15346】更差。
 */
const path = require('path')
const fs = require('fs')
const M = path.join('server-official', 'public', 'quartermaster-sub-wars')
const rules = require(path.join(__dirname, '..', M, 'rules.js'))
const I = rules._internal
const d = I.data

let pass = 0
const fails = []
function ok(name, cond, extra) {
	if (cond) { pass++; console.log('  ok   ' + name) }
	else { fails.push(name); console.log('  FAIL ' + name + (extra !== undefined ? '  | ' + JSON.stringify(extra) : '')) }
}
function section(t) { console.log('\n=== ' + t + ' ===') }

const BR = d.id_of('不列颠'), WE = d.id_of('西欧'), MED = d.id_of('地中海'), NORTH = d.id_of('北海')
const BAL = d.id_of('巴尔干'), MOS = d.id_of('莫斯科'), SIB = d.id_of('西伯利亚'), ROS = d.id_of('罗斯')

function mk(nation) {
	const g = rules.setup(20261028, rules.default_scenario, {})
	g.opening = null
	I.set_skip_turn_guard(true)
	g.current_nation = nation
	g.active = 'Allies'
	g.turn = 3; g.turn_phase = 'play'; g.nations_done = 1
	g.score = { axis: 0, allies: 0 }; g.log = []
	for (const p of Object.keys(g.location)) { delete g.location[p]; delete g.piece_nation[p]; delete g.piece_type[p] }
	g.table = g.table || {}
	return g
}
function put(g, pid, sp, nat, type) { g.location[pid] = sp; g.piece_nation[pid] = nat; g.piece_type[pid] = type }
function armStatus(g, nation, cardId) {
	g.table[nation] = g.table[nation] || []
	if (g.table[nation].indexOf(cardId) < 0) g.table[nation].push(cardId)
	I.apply_status_ongoing(g, cardId, nation)
}
function sup(g) { I.refresh(g); return I.compute_supply(g) }
const on = (s, p) => !!s.in_supply[p]
const srcOf = (s, p) => s.sources[p] || ''
const canSrc = (s, p) => !!s.can_source[p]
const rootsOf = (s, p) => Object.keys((s.roots && s.roots[p]) || {}).sort().join('+')

/* ================= 场景 A：法国迁都 + 17549 ================= */
section('A1 15344 条件未满足（西欧无敌人）：法国大本营仍是西欧')
{
	const g = mk('法国')
	armStatus(g, '英国', '15344#1')
	armStatus(g, '美国', '17549#1')
	put(g, 'fr_br', BR, '法国', 'army')
	const s = sup(g)
	ok('法国大本营=西欧', I.effective_home_base(g, '法国') === WE, d.name_of(I.effective_home_base(g, '法国')))
	ok('不列颠法国陆军补给', on(s, 'fr_br'), srcOf(s, 'fr_br'))
}

section('A2 ★15344 条件满足（西欧被德国占）：法国大本营=不列颠，不列颠承载 {法国, 英国} 双根')
{
	const g = mk('法国')
	put(g, 'de_we', WE, '德国', 'army')
	armStatus(g, '英国', '15344#1')
	armStatus(g, '美国', '17549#1')
	/* 不列颠没有英国部队 -> 只有法国大本营 + 地图补给点 */
	put(g, 'fr_br', BR, '法国', 'army')
	const s = sup(g)
	ok('法国大本营=不列颠', I.effective_home_base(g, '法国') === BR, d.name_of(I.effective_home_base(g, '法国')))
	ok('不列颠法国陆军是 base', on(s, 'fr_br') && srcOf(s, 'fr_br') === 'base', srcOf(s, 'fr_br'))
	ok('★ 它的根含【英国】（不列颠同时是英国大本营）', rootsOf(s, 'fr_br').indexOf('英国') >= 0, rootsOf(s, 'fr_br'))
	ok('★ 它的根含【法国】', rootsOf(s, 'fr_br').indexOf('法国') >= 0, rootsOf(s, 'fr_br'))
}

section('A3 ★法国迁都 + 17549：地中海/北海法国海军可补给，且能当中继（巴尔干英军也补给）')
{
	const g = mk('法国')
	put(g, 'de_we', WE, '德国', 'army')
	armStatus(g, '英国', '15344#1')
	armStatus(g, '美国', '17549#1')
	put(g, 'fr_br', BR, '法国', 'army')
	put(g, 'fr_north', NORTH, '法国', 'navy')
	put(g, 'fr_med', MED, '法国', 'navy')
	put(g, 'uk_bal', BAL, '英国', 'army')
	const s = sup(g)
	ok('北海法国海军补给', on(s, 'fr_north'), srcOf(s, 'fr_north'))
	ok('★ 北海法国海军是中继', canSrc(s, 'fr_north'))
	ok('地中海法国海军补给（经北海→非洲北部→地中海 渡海链）', on(s, 'fr_med'), srcOf(s, 'fr_med'))
	ok('★ 地中海法国海军是中继', canSrc(s, 'fr_med'))
	ok('★ 巴尔干英国陆军补给（根含英国）', on(s, 'uk_bal'), { src: srcOf(s, 'uk_bal'), roots: rootsOf(s, 'uk_bal') })
	ok('巴尔干英军的根含【英国】', rootsOf(s, 'uk_bal').indexOf('英国') >= 0, rootsOf(s, 'uk_bal'))
}

section('A4 ★法国迁都 + 17549 + 15346（本次补漏核心）：法国海军仍能升级 chain 当中继')
{
	const g = mk('法国')
	put(g, 'de_we', WE, '德国', 'army')
	armStatus(g, '英国', '15344#1')
	armStatus(g, '美国', '17549#1')
	armStatus(g, '法国', '15346#1')      /* 法国部队总是处于补给状态 */
	put(g, 'fr_br', BR, '法国', 'army')
	put(g, 'fr_north', NORTH, '法国', 'navy')
	put(g, 'fr_med', MED, '法国', 'navy')
	put(g, 'uk_bal', BAL, '英国', 'army')
	const s = sup(g)
	ok('北海法国海军补给', on(s, 'fr_north'))
	ok('★ 北海法国海军升级为 chain（不是 aura）', srcOf(s, 'fr_north') === 'chain', srcOf(s, 'fr_north'))
	ok('★ 北海法国海军仍是中继（旧实现 can_source=false）', canSrc(s, 'fr_north'))
	ok('★ 地中海法国海军也是 chain + 中继', srcOf(s, 'fr_med') === 'chain' && canSrc(s, 'fr_med'),
		{ src: srcOf(s, 'fr_med'), can: canSrc(s, 'fr_med') })
	ok('★ 巴尔干英国陆军仍补给（加光环不比不加更差）', on(s, 'uk_bal'), srcOf(s, 'uk_bal'))
}

section('A5 孤立法军海军（光环覆盖、四周无源）：保持 aura、不当中间源')
{
	const g = mk('法国')
	armStatus(g, '法国', '15346#1')
	put(g, 'fr_med', MED, '法国', 'navy')     /* 地中海无任何陆军/源 */
	const s = sup(g)
	ok('海军自身补给（光环）', on(s, 'fr_med'))
	ok('★ 仍是 aura', srcOf(s, 'fr_med') === 'aura', srcOf(s, 'fr_med'))
	ok('★ 不当中继（光环本身不是源）', !canSrc(s, 'fr_med'))
}

/* ================= 场景 B：苏联迁都 ================= */
section('B1 迁都前基线：莫斯科 base，西伯利亚/罗斯 chain')
{
	const g = mk('苏联')
	put(g, 'su_mos', MOS, '苏联', 'army')
	put(g, 'su_sib', SIB, '苏联', 'army')
	put(g, 'su_ros', ROS, '苏联', 'army')
	const s = sup(g)
	ok('苏联大本营=莫斯科', I.effective_home_base(g, '苏联') === MOS)
	ok('莫斯科 base', srcOf(s, 'su_mos') === 'base', srcOf(s, 'su_mos'))
	ok('西伯利亚 chain（相邻莫斯科）', on(s, 'su_sib') && srcOf(s, 'su_sib') === 'chain', srcOf(s, 'su_sib'))
}

section('B2 ★17845 迁都后：西伯利亚 base，莫斯科经相邻接根仍补给')
{
	const g = mk('苏联')
	armStatus(g, '苏联', '17845#1')
	put(g, 'su_mos', MOS, '苏联', 'army')
	put(g, 'su_sib', SIB, '苏联', 'army')
	put(g, 'su_ros', ROS, '苏联', 'army')
	const s = sup(g)
	ok('苏联大本营=西伯利亚', I.effective_home_base(g, '苏联') === SIB, d.name_of(I.effective_home_base(g, '苏联')))
	ok('★ 西伯利亚是 base（新都供源）', srcOf(s, 'su_sib') === 'base', srcOf(s, 'su_sib'))
	ok('莫斯科补给点被移除，但经相邻西伯利亚接根仍补给', on(s, 'su_mos') && srcOf(s, 'su_mos') === 'chain',
		srcOf(s, 'su_mos'))
	ok('罗斯 chain', srcOf(s, 'su_ros') === 'chain', srcOf(s, 'su_ros'))
	ok('全部根都是【苏联】', [rootsOf(s, 'su_mos'), rootsOf(s, 'su_sib'), rootsOf(s, 'su_ros')].every(r => r === '苏联'))
}

section('B3 ★17845 + 17549：英国部队站在西伯利亚只承载苏联根、自己不补给；巴尔干英军断补')
{
	const g = mk('苏联')
	armStatus(g, '苏联', '17845#1')
	armStatus(g, '美国', '17549#1')
	put(g, 'su_sib', SIB, '苏联', 'army')
	put(g, 'uk_sib', SIB, '英国', 'army')     /* 英国部队占着苏联新都 */
	put(g, 'su_mos', MOS, '苏联', 'army')
	put(g, 'uk_bal', BAL, '英国', 'army')
	const s = sup(g)
	ok('苏联陆军在西伯利亚 base', srcOf(s, 'su_sib') === 'base', srcOf(s, 'su_sib'))
	ok('★ 英国陆军在西伯利亚【不补给】（源是苏联，17549 组不含苏联）', !on(s, 'uk_sib'), srcOf(s, 'uk_sib'))
	ok('它承载的根是【苏联】', rootsOf(s, 'uk_sib') === '苏联', rootsOf(s, 'uk_sib'))
	ok('★ 巴尔干英国陆军断补', !on(s, 'uk_bal'), srcOf(s, 'uk_bal'))
}

/* ================= 源码守卫 ================= */
section('S 源码守卫：#12 的第二半（升级分支）存在')
{
	const src = fs.readFileSync(path.join(__dirname, '..', M, 'rules.js'), 'utf8')
	ok('自己补给只认自己国的根', /if \(mine\[nat\]\)/.test(src))
	ok('★ aura/granted/echo 接到本国根时升级为 chain',
		/sources\[pid\] === 'aura' \|\| sources\[pid\] === 'granted' \|\| sources\[pid\] === 'echo'/.test(src))
	ok('升级时同步 sources 改 chain', /sources\[pid\] = 'chain'/.test(src))
	ok('大本营供源走 effective_home_base（迁都生效）', /effective_home_base\(game, n\)\) === sp/.test(src))
}

console.log('\n' + (fails.length ? 'FAILED' : 'ALL PASS') + '  ' + pass + ' ok, ' + fails.length + ' fail')
if (fails.length) { console.log('失败项: ' + fails.join(' | ')); process.exit(1) }
