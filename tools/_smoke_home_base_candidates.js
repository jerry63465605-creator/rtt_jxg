/*
 * 【2026-10-28 待办 #21】「大本营或相邻」候选必须跟随迁都
 *
 * #17 修的是 can_build_at（合法性），本条修的是【候选生成】：
 * 同一句话（"在<某国大本营>或相邻地区建设/征召"）被抄了 5 遍，
 * 每遍都读静态 home_base_of，迁都后候选不跟随（能建但列表里不给 / 高亮却点不动）。
 *
 * 统一到 home_or_adjacent_spaces(game, nation) —— 内部走 effective_home_base。
 *
 * 迁都卡：
 *   17845 迁都古比雪夫（苏联，无条件）莫斯科 -> 西伯利亚
 *   17554 重庆国民政府（美国打出）中国东部 -> 中国西部（需中国东部被敌占）
 *   15344 法国流亡政府（英国）西欧 -> 不列颠（需西欧被敌占）
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

const MOS = d.id_of('莫斯科'), SIB = d.id_of('西伯利亚')
const CE = d.id_of('中国东部'), CW = d.id_of('中国西部')
const WE = d.id_of('西欧'), BR = d.id_of('不列颠')
const names = ids => ids.map(x => d.name_of(x))

function mk() {
	const g = rules.setup(20261028, rules.default_scenario, {})
	g.opening = null
	I.set_skip_turn_guard(true)
	g.current_nation = '美国'
	g.active = 'Allies'
	g.turn = 3; g.turn_phase = 'play'; g.nations_done = 1
	g.score = { axis: 0, allies: 0 }; g.log = []
	I.refresh(g)
	return g
}
/* 在桌面放一张状态卡并生效（建立 home_override 光环） */
function armStatus(g, nation, cardId) {
	g.table[nation] = g.table[nation] || []
	if (g.table[nation].indexOf(cardId) < 0) g.table[nation].push(cardId)
	I.apply_status_ongoing(g, cardId, nation)
	I.refresh(g)
}
function putEnemy(g, space, nation) {
	for (const p of Object.keys(g.location)) if (g.location[p] === space) { delete g.location[p]; delete g.piece_nation[p]; delete g.piece_type[p] }
	g.location['en_' + space] = space
	g.piece_nation['en_' + space] = nation
	g.piece_type['en_' + space] = 'army'
	I.refresh(g)
}

/* ---------------- S1 基线：未迁都 ---------------- */
section('S1 未迁都基线：苏联=莫斯科、中国=中国东部、法国=西欧')
{
	const g = mk()
	ok('苏联 home=莫斯科', I.home_or_adjacent_spaces(g, '苏联').home === MOS,
		d.name_of(I.home_or_adjacent_spaces(g, '苏联').home))
	ok('中国 home=中国东部', I.home_or_adjacent_spaces(g, '中国').home === CE)
	ok('法国 home=西欧', I.home_or_adjacent_spaces(g, '法国').home === WE)
	ok('候选池 = 大本营 + 相邻', I.home_or_adjacent_spaces(g, '苏联').spaces.indexOf(MOS) >= 0)
}

/* ---------------- S2 17845 苏联迁都（无条件） ---------------- */
section('S2 17845 迁都古比雪夫：苏联 home 跟随到西伯利亚')
{
	const g = mk()
	armStatus(g, '苏联', '17845#1')
	const r = I.home_or_adjacent_spaces(g, '苏联')
	ok('★ home=西伯利亚', r.home === SIB, d.name_of(r.home))
	ok('★ 候选池含西伯利亚', r.spaces.indexOf(SIB) >= 0)
	ok('俄罗斯/中亚等新都邻居也在池中', r.spaces.indexOf(d.id_of('罗斯')) >= 0 || r.spaces.indexOf(d.id_of('中亚')) >= 0,
		names(r.spaces))
}

/* ---------------- S3 17554 中国迁都（条件型） ---------------- */
section('S3 17554 重庆国民政府：条件满足才跟随')
{
	/* 3a 条件不满足（中国东部未被敌占）*/
	const g1 = mk()
	armStatus(g1, '美国', '17554#1')
	ok('条件不满足：仍是中国东部', I.home_or_adjacent_spaces(g1, '中国').home === CE,
		d.name_of(I.home_or_adjacent_spaces(g1, '中国').home))

	/* 3b 条件满足（中国东部被德国占领）*/
	const g2 = mk()
	putEnemy(g2, CE, '德国')
	armStatus(g2, '美国', '17554#1')
	const r = I.home_or_adjacent_spaces(g2, '中国')
	ok('★ 条件满足：home=中国西部', r.home === CW, d.name_of(r.home))
	ok('★ 候选池含中国西部', r.spaces.indexOf(CW) >= 0)
	ok('新都邻居（中亚）进池', r.spaces.indexOf(d.id_of('中亚')) >= 0, names(r.spaces))
}

/* ---------------- S4 15344 法国改判（条件型） ---------------- */
section('S4 15344 法国流亡政府：西欧被敌占 -> 大本营改不列颠')
{
	const g1 = mk()
	armStatus(g1, '英国', '15344#1')
	ok('条件不满足：仍是西欧', I.home_or_adjacent_spaces(g1, '法国').home === WE)

	const g2 = mk()
	putEnemy(g2, WE, '德国')
	armStatus(g2, '英国', '15344#1')
	const r = I.home_or_adjacent_spaces(g2, '法国')
	ok('★ 条件满足：home=不列颠', r.home === BR, d.name_of(r.home))
}

/* ---------------- S5 17531 候选跟随（真正使用方） ---------------- */
section('S5 17531 现购自运：us_merchant_targets 的池跟随迁都')
{
	const g = mk()
	armStatus(g, '苏联', '17845#1')
	/* 直接看池（us_merchant_targets 还叠加 can_recruit_at，这里只验池的口径） */
	const r = I.home_or_adjacent_spaces(g, '苏联')
	ok('苏联池以新都为首', r.spaces[0] === SIB, d.name_of(r.spaces[0]))
	ok('苏联池不再以莫斯科为首', r.spaces[0] !== MOS)
}

/* ---------------- S6 view 候选（17537 us_china_build） ---------------- */
section('S6 view.us_china_build 候选跟随迁都')
{
	const g = mk()
	putEnemy(g, CE, '德国')
	armStatus(g, '美国', '17554#1')
	/* 造一个 us_china_build 挂起（美国帮中国建设） */
	g.us_china_build = { nation: '中国', steps: [{ op: 'build', type: 'army' }], done: 0 }
	I.refresh(g)
	const v = rules.view(g, 'allies')
	const uc = v.us_china_build
	ok('view 有 us_china_build', !!uc, uc)
	if (uc && uc.candidates) {
		const ids = uc.candidates.map(c => c.id)
		ok('★ view 候选含中国西部（新都）', ids.indexOf(CW) >= 0, names(ids))
		ok('view 候选全部落在新都 + 相邻（不含旧都的独有邻居）',
			ids.every(x => I.home_or_adjacent_spaces(g, '中国').spaces.indexOf(x) >= 0),
			names(ids))
	}
}

/* ---------------- S7 源码守卫 ---------------- */
section('S7 源码守卫：5 处候选生成都走 home_or_adjacent_spaces')
{
	const src = fs.readFileSync(path.join(__dirname, '..', M, 'rules.js'), 'utf8')
	const fnBody = (name) => {
		const i = src.indexOf('function ' + name + '(')
		if (i < 0) return ''
		const j = src.indexOf('\n}', i)
		return src.slice(i, j < 0 ? i + 2000 : j)
	}
	ok('us_china_build_candidates 用新原子', /home_or_adjacent_spaces\(game, nation\)/.test(fnBody('us_china_build_candidates')))
	ok('resolve_us_china_build 用新原子', /home_or_adjacent_spaces\(game, dg\.nation\)/.test(fnBody('resolve_us_china_build')))
	ok('us_merchant_targets 用新原子', /home_or_adjacent_spaces\(game, nation\)/.test(fnBody('us_merchant_targets')))
	ok('17505 P-51 用 effective_home_base', /const hb = effective_home_base\(game, t\)/.test(src))
	ok('view.us_china_build 用新原子', /us_china_build: \(function \(\) \{[\s\S]{0,600}home_or_adjacent_spaces\(game, dg\.nation\)/.test(src))
	/* 反例：上述 4 个函数体内不应再有静态 home_base_of */
	for (const fn of ['us_china_build_candidates', 'resolve_us_china_build', 'us_merchant_targets']) {
		ok(fn + ' 体内已无静态 home_base_of', !/home_base_of\(/.test(fnBody(fn)))
	}
}

console.log('\n' + (fails.length ? 'FAILED' : 'ALL PASS') + '  ' + pass + ' ok, ' + fails.length + ' fail')
if (fails.length) { console.log('失败项: ' + fails.join(' | ')); process.exit(1) }
