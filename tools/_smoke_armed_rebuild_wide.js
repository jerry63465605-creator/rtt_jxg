/*
 * 【2026-10-28】「建设后：再建设 1 支 X」类增强卡 —— 全图候选验收
 *
 * 玩家报 #11：15405《大日本帝国海军》「无法发动」。
 * 根因：ready/run 把目标焊死成 ctx.space（= 刚建完的那一格），
 *       而该格已有本国单位（每国每格限 1 支）-> can_build_at 必拒
 *       -> ready 恒 false -> 永不弹窗。
 *
 * 玩家口径（2026-10-28）：候选取【全图】合法建设地，不只相邻。
 * 同病一并改：16803 尼米兹（后建海军）、16800 艾森豪威尔（后建陆军）。
 *
 * 不改：17506（卡面写「相邻」）、15208（该海域）、15210（亚速尔相邻）。
 */
const path = require('path')
const M = path.join('server-official', 'public', 'quartermaster-sub-wars')
const rules = require(path.join(__dirname, '..', M, 'rules.js'))
const I = rules._internal
const d = I.data
const fs = require('fs')

let pass = 0
const fails = []
function ok(name, cond, extra) {
	if (cond) { pass++; console.log('  ok   ' + name) }
	else { fails.push(name); console.log('  FAIL ' + name + (extra !== undefined ? '  | ' + JSON.stringify(extra) : '')) }
}
function section(t) { console.log('\n=== ' + t + ' ===') }

const DH = d.id_of('东海'), PH = d.id_of('菲律宾'), SEA = d.id_of('东南亚')
const IT = d.id_of('意大利')

function mk(nation, hand) {
	const g = rules.setup(20261028, rules.default_scenario, {})
	g.opening = null
	I.set_skip_turn_guard(true)
	g.current_nation = nation
	g.active = 'axis'
	g.turn = 3; g.turn_phase = 'play'; g.nations_done = 1
	g.score = { axis: 0, allies: 0 }; g.log = []
	g.hands[nation] = (hand || []).slice()
	g.armed_offers = []
	return g
}
function put(g, pid, sp, nat, type) {
	for (const p of Object.keys(g.location)) if (g.location[p] === sp) { delete g.location[p]; delete g.piece_nation[p]; delete g.piece_type[p] }
	g.location[pid] = sp; g.piece_nation[pid] = nat; g.piece_type[pid] = type
}
function offerOf(g, when) {
	return (g.armed_offers || []).find(w => w.when === when) || null
}

/* ---------------- S1 15405：有第二处陆军 -> 会弹窗 ---------------- */
section('S1 15405 日本在<东海>建海军后：全图还有可建海域 -> 弹出询问')
let g1
{
	g1 = mk('日本', ['15405#1', '15436#1'])          /* 15436 作弃牌代价（响应卡） */
	put(g1, 'jp_ph', PH, '日本', 'army')             /* 菲律宾陆军：中太平洋/南海可建 */
	I.refresh(g1)
	I.build_piece(g1, '日本', 'navy', DH)
	const w = offerOf(g1, 'after_build_navy')
	ok('弹出了 after_build_navy 窗口（旧实现永不弹）', !!w, g1.armed_offers)
	ok('候选含 15405', !!w && w.cards.some(c => String(c.card_id).indexOf('15405') === 0),
		w && w.cards.map(c => c.card_id))
}

/* ---------------- S2 15405：无第二处 -> 不弹（正确的不弹） ---------------- */
section('S2 15405 只有日本本土一支陆军：建完东海后全域无可建 -> 不弹窗（正确）')
{
	const g = mk('日本', ['15405#1', '15436#1'])
	I.refresh(g)
	I.build_piece(g, '日本', 'navy', DH)
	const w = offerOf(g, 'after_build_navy')
	ok('不弹窗', !w, g.armed_offers)
	ok('ready 为 false', I.ECHO_EFFECTS['15405'].armed.ready(g, { space: DH, nation: '日本' }) === false)
}

/* ---------------- S3 15405：run 能真正在别处建成 ---------------- */
section('S3 15405 发动：选<南海>再建 1 支日本海军（旧实现只会往原格建 -> skip）')
{
	const g = mk('日本', ['15405#1', '15436#1'])
	put(g, 'jp_ph', PH, '日本', 'army')
	I.refresh(g)
	I.build_piece(g, '日本', 'navy', DH)
	const before = Object.keys(g.location).filter(p => g.piece_nation[p] === '日本' && g.piece_type[p] === 'navy').length
	const r = I.ECHO_EFFECTS['15405'].armed.run(g, { space: DH, nation: '日本' }, { space: d.id_of('南海') })
	const after = Object.keys(g.location).filter(p => g.piece_nation[p] === '日本' && g.piece_type[p] === 'navy').length
	ok('run 返回 ok 且未 skip', r && r.ok && !r.skip, r)
	ok('日本海军数量 +1', after === before + 1, { before, after })
	ok('新建的海军在<南海>', Object.keys(g.location).some(p => g.location[p] === d.id_of('南海') && g.piece_nation[p] === '日本' && g.piece_type[p] === 'navy'))
}

/* ---------------- S4 15405：候选是【全图】，不是仅相邻 ---------------- */
section('S4 15405 候选范围：全图（含与<东海>完全不相邻的欧洲海域）')
{
	const g = mk('日本', ['15405#1', '15436#1'])
	put(g, 'jp_ph', PH, '日本', 'army')
	/* 西欧是地图标定补给点 -> 日本陆军放这里，欧洲海域才真正可建 */
	put(g, 'jp_we', d.id_of('西欧'), '日本', 'army')
	I.refresh(g)
	I.build_piece(g, '日本', 'navy', DH)
	const all = I.build_candidate_spaces(g, '日本', 'navy', {})
	const near = I.build_candidate_spaces(g, '日本', 'navy', { near: DH })
	const far = all.filter(x => near.indexOf(x) < 0)
	ok('全图候选非空', all.length > 0, all.map(x => d.name_of(x)))
	ok('★ 全图包含「相邻候选之外」的海域（证明确实是全图口径）', far.length > 0, all.map(x => d.name_of(x)))
	ok('相邻候选 = 东海周边（中太平洋/南海/南太平洋/北太平洋 的子集）',
		near.every(x => ['中太平洋', '南海', '南太平洋', '北太平洋'].indexOf(d.name_of(x)) >= 0),
		near.map(x => d.name_of(x)))
}

/* ---------------- S5 16803 尼米兹：美国版同口径 ---------------- */
section('S5 16803 尼米兹：建完海军后候选为全图（不再用写死美国的 us_build_candidates）')
{
	const g = mk('美国', ['16803#1'])
	put(g, 'us_la', d.id_of('拉丁美洲'), '美国', 'army')   /* 拉丁美洲 -> 南大西洋/东太平洋/北大西洋 */
	I.refresh(g)
	const usHome = d.id_of('美国')
	const seas = (I.get_connections(g, usHome, 'allies') || []).map(Number).filter(x => d.spaces[x].terrain === 'sea')
	ok('美国本土邻接海域非空（造局前提）', seas.length > 0, seas.map(x => d.name_of(x)))
	const built = seas.find(x => I.can_build_at(g, '美国', x, 'navy').ok)
	if (built == null) { ok('可在美国本土邻海建海军（造局前提）', false); }
	else {
		I.build_piece(g, '美国', 'navy', built)
		const cands = I.build_candidate_spaces(g, '美国', 'navy', {})
		ok('全图候选非空 -> 会弹窗', cands.length > 0, cands.map(x => d.name_of(x)))
		ok('尼米兹 ready 为 true', I.ECHO_EFFECTS['16803'].armed.ready(g, { space: built, nation: '美国' }) === true)
	}
}

/* ---------------- S6 16800 艾森豪威尔：美国陆军版 ---------------- */
section('S6 16800 艾森豪威尔：建完陆军后候选为全图')
{
	const g = mk('美国', ['16800#1'])
	/* 清掉美国本土原有陆军（每国每格限 1 支，否则无法在本土再建） */
	for (const p of Object.keys(g.location)) {
		if (g.piece_nation[p] === '美国' && g.piece_type[p] === 'army') {
			delete g.location[p]; delete g.piece_nation[p]; delete g.piece_type[p]
		}
	}
	put(g, 'us_la', d.id_of('拉丁美洲'), '美国', 'army')
	I.refresh(g)
	const usHome = d.id_of('美国')
	const built = I.can_build_at(g, '美国', usHome, 'army').ok ? usHome : null
	if (built == null) { ok('可在美国本土建陆军（造局前提）', false) }
	else {
		I.build_piece(g, '美国', 'army', built)
		const cands = I.build_candidate_spaces(g, '美国', 'army', {})
		ok('全图候选非空 -> 会弹窗', cands.length > 0, cands.map(x => d.name_of(x)))
		ok('艾森豪威尔 ready 为 true', I.ECHO_EFFECTS['16800'].armed.ready(g, { space: built, nation: '美国' }) === true)
	}
}

/* ---------------- S7 源码守卫 ---------------- */
section('S7 源码守卫：三张卡都走 armed_rebuild_candidates，且不再焊死 ctx.space')
{
	const src = fs.readFileSync(path.join(__dirname, '..', M, 'rules.js'), 'utf8')
	ok('新增 armed_rebuild_candidates 且委托 build_candidate_spaces',
		/function armed_rebuild_candidates\(game, nation, type\) \{\s*return build_candidate_spaces\(game, nation, type, \{\}\)/.test(src))
	for (const id of ['16800', '16803', '15405']) {
		const re = new RegExp("'" + id + "': \\{[\\s\\S]{0,1600}?armed_rebuild_candidates\\(game, ")
		ok(id + ' 配置里调用 armed_rebuild_candidates', re.test(src))
	}
	ok('15405 不再用 can_build_at(..., ctx.space, ...)',
		!/'15405': \{[\s\S]{0,1600}?can_build_at\(game, '日本', sp, 'navy\)/.test(src))
	ok('16800/16803 不再用 us_build_candidates(ctx.space)',
		!/'1680[03]': \{[\s\S]{0,1200}?us_build_candidates\(game, ctx && ctx\.space/.test(src))
}

console.log('\n' + (fails.length ? 'FAILED' : 'ALL PASS') + '  ' + pass + ' ok, ' + fails.length + ' fail')
if (fails.length) { console.log('失败项: ' + fails.join(' | ')); process.exit(1) }
