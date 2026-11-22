/*
 * 【本体 #4 / B51】空军候选必须用 can_deploy_air（不是 can_build_at）。
 *
 * 玩家报障（2026-11-22）：「王牌飞行员飞机 bug」—— 17509《王牌飞行员帕皮·博因顿》
 * （计分阶段：损耗1，在〈中太平洋〉或相邻地区部署1支空军）候选错、部署到无载体格。
 *
 * 根因：`event_cands_filter`（spaces / spacesFn 两条分支的唯一过滤器）对
 * `st.op==='build'|'recruit'` 一律用 can_build_at / can_recruit_at，
 * 而空军载体是【同格】陆/海军（air_host_check）+ 槽位（unit_slot_free）= can_deploy_air；
 * can_build_at(air) 查的是「大本营或【邻接】补给同国部队」-> 对靠海军搭载的
 * 海域空军一律误判非法（can_deploy_air 上方注释的原话）。
 *
 * 修复前实测（美国海军在中太平洋）：spaces / spacesFn 写法候选 []，
 * around / 兜底写法候选 [中太平洋] —— 同一效果换写法结果不同。
 *
 * 范围：本轮只修 17509 这条【普遍误判】；17811《雅科夫列夫设计局》的同类
 * 窄场景（孤立格误杀，`su_air_deploy_spaces` 里 air_host_check 之后又查
 * can_build_at(air)）按玩家决定【记为待观察、本轮不改】。
 *
 * 用法：node tools/_real_test_B51_17509_air_candidates.js
 */
const path = require('path')
const fs = require('fs')
const MOD = path.join(__dirname, '..', 'server-official', 'public', 'quartermaster-sub-wars')
const R = require(path.join(MOD, 'rules.js'))
const I = R._internal
const D = require(path.join(MOD, 'data.js')).data
const J = x => JSON.stringify(x)
const n = id => D.name_of(id)
const MP = D.id_of('中太平洋')
const EP = D.id_of('东太平洋')
const EE = D.id_of('东欧')
const ROS = D.id_of('罗斯')

let pass = 0, fail = 0
const ok = (m, c, extra) => {
	if (c) { pass++; console.log('  ✓ ' + m) }
	else { fail++; console.log('  ✗ ' + m + (extra !== undefined ? '  | ' + extra : '')) }
}

/* 美国海军在中太平洋（空军唯一合法落点就是中太平洋） */
function seed(opts = {}) {
	const g = R.setup(20261112, 'Standard')
	let q = 0
	while (g.opening && q++ < 15) {
		const c = g.current_nation
		R.action(g, g.active, 'opening_discard', { cards: (g.hands[c] || []).slice(0, 3) })
	}
	g.location = {}; g.piece_nation = {}; g.piece_type = {}
	g.location.us_navy = MP
	g.piece_nation.us_navy = '美国'
	g.piece_type.us_navy = 'navy'
	if (opts.supply !== false) I.grant_supply(g, 'us_navy', g.turn || 1)
	I.compute_supply(g)
	return g
}
const cands = (g, st) => I.step_space_candidates(g, '美国', st, {}, []) || []

console.log('=== A. 四条写法必须给同一答案（修复前 spaces/spacesFn 给 []）===')
{
	const forms = [
		['spaces', () => ({ op: 'build', type: 'air', spaces: [MP] })],
		['spacesFn', () => ({ op: 'build', type: 'air', spacesFn: () => [MP] })],
		['around', () => ({ op: 'build', type: 'air', around: MP })],
		['兜底', () => ({ op: 'build', type: 'air' })],
	]
	for (const [label, mk] of forms) {
		const g = seed()
		const out = cands(g, mk())
		ok('★★ ' + label.padEnd(9) + ' 写法 -> 含〈中太平洋〉', out.indexOf(MP) >= 0, J(out.map(n)))
	}
}

console.log('\n=== B. 无载体格必须排除（东太平洋没有美国部队）===')
{
	const g = seed()
	const out = cands(g, { op: 'build', type: 'air', spaces: [MP, EP] })
	ok('★★ 候选只有〈中太平洋〉，不含〈东太平洋〉',
		out.length === 1 && out[0] === MP, J(out.map(n)))
}

console.log('\n=== C. 载体不处于补给 -> 排除（air_host_check 的补给校验不回归）===')
{
	const g = seed({ supply: false })
	ok('★ 前提：同格海军确实不补给',
		!I.compute_supply(g).in_supply.us_navy, J(I.compute_supply(g).in_supply.us_navy))
	ok('★★ 不补给载体 -> 候选为空', cands(g, { op: 'build', type: 'air', spaces: [MP] }).length === 0,
		J(cands(g, { op: 'build', type: 'air', spaces: [MP] }).map(n)))
}

console.log('\n=== D. 陆军/海军判据不回归（仍走 can_build_at / can_recruit_at）===')
{
	const g = seed()
	/* 德国陆军在〈东欧〉，美国陆军在〈东欧〉不行（敌方）；用美国陆军放〈东欧〉邻接补给链 */
	g.location.us_army = EE
	g.piece_nation.us_army = '美国'
	g.piece_type.us_army = 'army'
	I.grant_supply(g, 'us_army', g.turn || 1)
	I.compute_supply(g)
	const armyOut = cands(g, { op: 'build', type: 'army', spaces: [EE] })
	const byAtom = I.can_build_at(g, '美国', EE, 'army').ok
	ok('★★ army 候选与 can_build_at 同源（不受 air 特判影响）',
		(armyOut.indexOf(EE) >= 0) === byAtom, J({ armyOut: armyOut.map(n), can_build_at: byAtom }))
	/* 空军判据与 can_build_at 不同源（正因如此才要特判） */
	const airOut = cands(g, { op: 'build', type: 'air', spaces: [MP] })
	ok('★ air 候选与 can_deploy_air 同源、与 can_build_at 无必然关系',
		(airOut.indexOf(MP) >= 0) === I.can_deploy_air(g, '美国', MP).ok,
		J({ airOut: airOut.map(n), deploy: I.can_deploy_air(g, '美国', MP).ok,
			buildAt: I.can_build_at(g, '美国', MP, 'air').ok }))
}

console.log('\n=== E. recruit + air 也走新判据（预防，当前无卡）===')
{
	const g = seed()
	const out = cands(g, { op: 'recruit', type: 'air', spaces: [MP, EP] })
	ok('★★ recruit air 同样只认〈中太平洋〉', out.length === 1 && out[0] === MP, J(out.map(n)))
}

console.log('\n=== F. 静态守卫 ===')
{
	const src = fs.readFileSync(path.join(MOD, 'rules.js'), 'utf8')
	const i = src.indexOf('function event_cands_filter')
	const j = src.indexOf('if (st.onlyNation)', i)
	const seg = src.slice(i, j > i ? j : i + 1400)
	ok('★★ event_cands_filter 含 can_deploy_air 特判', /can_deploy_air/.test(seg))
	ok('★★ air 分支与 can_build_at / can_recruit_at 三元互斥（air 走 can_deploy_air）',
		/st\.type === 'air'\)[\s\S]{0,60}\?\s*out\.filter\(sp => can_deploy_air\(game, actor, sp\)\.ok\)[\s\S]{0,40}:\s*out\.filter\(sp => \(st\.op === 'recruit' \? can_recruit_at : can_build_at\)/.test(seg.replace(/\r/g, '')))
	ok('★ 非 air 分支仍保留 can_build_at / can_recruit_at', /can_recruit_at : can_build_at/.test(seg))
	/* 17811 本轮不改（玩家口径：窄场景待观察）——守卫防止误改 */
	const k = src.indexOf('function su_air_deploy_spaces')
	const seg2 = src.slice(k, k + 700)
	ok('★ 17811 那条（su_air_deploy_spaces）本轮保持原样、未动',
		/can_build_at\(game, nation, sp, 'air'\)\.ok/.test(seg2))
	/* B54 起客户端有改动（17535 遮罩让位）-> 版本串会再 bump，这里只校验统一非空 */
	ok('★ 版本串统一且非空（B51 当轮 20261122a，B54 起 20261122b）',
		(vers => vers.length >= 5 && vers.every(v => v && v === vers[0]))(
			(fs.readFileSync(path.join(MOD, 'play.html'), 'utf8')
				.match(/\?v=([0-9a-z]+)/g) || []).map(s => s.slice(3))))
}

console.log('\n' + (fail === 0 ? 'ALL PASS（' + pass + ' 项）' : 'FAIL ' + fail + ' 项 / PASS ' + pass + ' 项'))
process.exitCode = fail ? 1 : 0
