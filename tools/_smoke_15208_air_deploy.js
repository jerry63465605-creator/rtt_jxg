/*
 * 【2026-10-28】15208《齐柏林伯爵号》验收
 *
 * 卡面：建设海军后，损耗1张牌：在该海域【部署或调度】1支空军。
 *
 * 修前三个问题（玩家报，已实测）：
 *   ① 无 ready -> 窗口必弹，run 失败/跳过后代价（损耗1张）已扣 -> 白亏牌
 *      实测：该海域已有德国空军时，牌库 64->63、空军数仍 1
 *   ② 手搓载体判定，漏 unit_slot_free / unit_cap_ok
 *   ③ 卡面「或调度」只实现了部署
 *
 * 修后：
 *   · ready 用 can_deploy_air（= air_host_check + unit_slot_free）+ 「部署或调度至少一条路可走」
 *   · 玩家选：need:'choice' + choiceOptions（复用 15406 的通道，客户端零改动）
 *   · 执行：复用 run_sea_air_deploy（15408 / 17706 同一实现，choice===1 即调度）
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

const NA = d.id_of('北大西洋'), AZ = d.id_of('亚速尔'), DE = d.id_of('德国'), WE = d.id_of('西欧')

/* 造局：德国回合；亚速尔有德国陆军（B 条件）；开 15207 免 A（亚速尔孤岛断补） */
function mk(hand) {
	const g = rules.setup(20261028, rules.default_scenario, {})
	g.opening = null
	I.set_skip_turn_guard(true)
	g.current_nation = '德国'; g.active = 'axis'
	g.turn = 3; g.turn_phase = 'play'; g.nations_done = 1
	g.score = { axis: 0, allies: 0 }; g.log = []
	g.modifiers = []; g.armed_offers = []
	for (const k of Object.keys(g.table || {})) g.table[k] = []
	g.hands['德国'] = (hand || ['15208#1']).slice()
	g.location['de_az'] = AZ; g.piece_nation['de_az'] = '德国'; g.piece_type['de_az'] = 'army'
	g.modifiers.push({ key: 'all_german_supplied', nation: '德国', untilTurn: 3, source: '15207' })
	I.refresh(g)
	return g
}
const AIR08 = I.ECHO_EFFECTS['15208'].armed
const airsAt = (g, sp) => I.pieces_on(g, sp).filter(p => g.piece_nation[p] === '德国' && g.piece_type[p] === 'air')
const germanAirs = g => I.list_pieces(g, { types: ['air'], nation: '德国' })

/* ---------------- S1 正常：选「部署」 ---------------- */
section('S1 正常：先问部署/调度，选部署 -> 扣 1 张 + 空军 +1')
let g1
{
	g1 = mk(['15208#1'])
	/* 柏林先有 1 支德国空军：这样「部署（总数 1/2 未满）」与「调度（别处有一支）」两条路都通 */
	g1.location['de_air0'] = DE; g1.piece_nation['de_air0'] = '德国'; g1.piece_type['de_air0'] = 'air'
	I.refresh(g1)
	I.build_piece(g1, '德国', 'navy', NA)
	const off = (g1.armed_offers || [])[0]
	ok('建海军后 15208 进窗口', !!(off && off.cards.some(c => String(c.card_face || c.card_id).split('#')[0] === '15208')))
	ok('★ ready = true（载体 + 格位都通过）', AIR08.ready(g1, { space: NA, nation: '德国' }) === true)

	const deck0 = (g1.decks['德国'] || []).length
	const n0 = g1.log.length
	/* 第一次点：不带 choice -> 应返回 need:'choice'，且【不付代价】 */
	rules.action(g1, 'axis', 'use_armed_offer', { card: off.cards[0].card_id })
	const pend = (g1.armed_offers[0] || {}).pending
	ok('★ 问「部署 / 调度」二选一（need=choice）', pend && pend.need === 'choice', pend && pend.need)
	ok('★ 两个选项都有（能部署 + 有可调度空军）',
		!!(pend && pend.choiceOptions && pend.choiceOptions.length === 2),
		pend && (pend.choiceOptions || []).map(o => o.id))
	ok('★ 还没扣代价（等选完再付）', (g1.decks['德国'] || []).length === deck0, (g1.decks['德国'] || []).length)
	ok('卡仍在手牌', (g1.hands['德国'] || []).indexOf('15208#1') >= 0)
	ok('该海域还没有空军', airsAt(g1, NA).length === 0)

	/* 第二次：选 deploy */
	rules.action(g1, 'axis', 'use_armed_offer', { card: off.cards[0].card_id, choice: 'deploy' })
	ok('★ 扣了 1 张牌', (g1.decks['德国'] || []).length === deck0 - 1, (g1.decks['德国'] || []).length)
	ok('★ 该海域 +1 支德国空军', airsAt(g1, NA).length === 1, airsAt(g1, NA).length)
	ok('卡已离手进弃牌堆', (g1.discard['德国'] || []).indexOf('15208#1') >= 0 && (g1.hands['德国'] || []).indexOf('15208#1') < 0)
	ok('窗口已清', (g1.armed_offers || []).length === 0)
}

/* ---------------- S2 格位已满：不弹窗（不白扣） ---------------- */
section('S2 该海域【已有德国空军】（格位已满）：ready=false，不弹窗、不白扣')
{
	const g = mk(['15208#1'])
	g.location['de_air_pre'] = NA; g.piece_nation['de_air_pre'] = '德国'; g.piece_type['de_air_pre'] = 'air'
	I.refresh(g)
	I.build_piece(g, '德国', 'navy', NA)
	ok('★ ready = false（格位已满）', AIR08.ready(g, { space: NA, nation: '德国' }) === false)
	const off = (g.armed_offers || [])[0]
	const has08 = !!(off && off.cards.some(c => String(c.card_face || c.card_id).split('#')[0] === '15208'))
	ok('★ 15208 不在窗口候选（旧实现会进，然后白扣 1 张）', !has08, has08)
}

/* ---------------- S3 空军总数已满：只能「调度」 ---------------- */
section('S3 空军总数已满（德国 2 支都在别处）：只能调度')
{
	const g = mk(['15208#1'])
	/* 德国空军上限 2：放两支在别处 */
	g.location['de_air1'] = DE; g.piece_nation['de_air1'] = '德国'; g.piece_type['de_air1'] = 'air'
	g.location['de_air2'] = WE; g.piece_nation['de_air2'] = '德国'; g.piece_type['de_air2'] = 'air'
	I.refresh(g)
	ok('造局：德国空军 2 支（达上限）', germanAirs(g).length === 2, germanAirs(g).length)
	I.build_piece(g, '德国', 'navy', NA)
	ok('★ ready = true（还能调度）', AIR08.ready(g, { space: NA, nation: '德国' }) === true)

	const off = (g.armed_offers || []).find(w => (w.cards || []).some(c => String(c.card_face || c.card_id).split('#')[0] === '15208'))
	ok('15208 在窗口里', !!off)
	if (off) {
		const cid = off.cards.find(c => String(c.card_face || c.card_id).split('#')[0] === '15208').card_id
		rules.action(g, 'axis', 'use_armed_offer', { card: cid })
		const pend = (g.armed_offers.find(w => (w.cards || []).some(c => c.card_id === cid)) || {}).pending
		ok('★ 选项只剩「调度」（部署不可用）',
			!!(pend && pend.choiceOptions && pend.choiceOptions.length === 1 &&
				pend.choiceOptions[0].id === 'move'),
			pend && (pend.choiceOptions || []).map(o => o.id))
		const deck0 = (g.decks['德国'] || []).length
		rules.action(g, 'axis', 'use_armed_offer', { card: cid, choice: 'move' })
		ok('★ 该海域出现 1 支德国空军（调度成功）', airsAt(g, NA).length === 1, airsAt(g, NA).length)
		ok('★ 空军总数不变（没新建，是移动）', germanAirs(g).length === 2, germanAirs(g).length)
		ok('扣了 1 张牌', (g.decks['德国'] || []).length === deck0 - 1)
	}
}

/* ---------------- S4 既不能部署也不能调度 ---------------- */
section('S4 既不能部署也不能调度：ready=false')
{
	const g = mk(['15208#1'])
	/* 空军 2 支，且都已在目标海域之外——但要制造"无可调度"：把 2 支都放到目标海域是不可能的（格位 1）。
	 * 改用：空军 2 支都在别处 + 目标格位被占 -> 由 S2 覆盖。
	 * 这里测"空军已达上限 且 只有那 1 支就在本格"（格位 1 支 = 目标格已满）——S2 已测。
	 * 故本组改为：空军 1 支（未达上限 2）-> 能部署；确认 ready=true（对照，保证 S3/S4 不误判）。 */
	g.location['de_air1'] = DE; g.piece_nation['de_air1'] = '德国'; g.piece_type['de_air1'] = 'air'
	I.refresh(g)
	I.build_piece(g, '德国', 'navy', NA)
	ok('空军 1 支（未达上限）-> ready = true（可部署）', AIR08.ready(g, { space: NA, nation: '德国' }) === true)
}

/* ---------------- S5 载体断补：ready=false（旧实现白扣） ---------------- */
section('S5 该海域德国海军断补（无载体）：ready=false，旧实现会白扣 1 张')
{
	const g = mk(['15208#1'])
	I.build_piece(g, '德国', 'navy', NA)
	/* 建完后关掉 15207 -> 海军断补 -> air_host_check 失败 */
	g.modifiers = []
	I.refresh(g)
	const sup = I.compute_supply(g)
	const navy = I.pieces_on(g, NA).find(p => g.piece_nation[p] === '德国' && g.piece_type[p] === 'navy')
	ok('造局：该德意志海军断补', !!navy && !sup.in_supply[navy], sup.in_supply[navy])
	ok('★ ready = false（无补给载体）', AIR08.ready(g, { space: NA, nation: '德国' }) === false)
	ok('★ run 也返回 skip（双保险，不扣代价）',
		!!(AIR08.run(g, { space: NA, nation: '德国' }, {}) || {}).skip)
}

/* ---------------- S6 15231 文案：单格不带「各」 ---------------- */
section('S6 15231《进攻美国》文案：单格不再出现「各建设」')
{
	const g = mk(['15231#1'])
	rules.action(g, 'axis', 'play_card', { card: '15231#1' })
	const log = g.log.join('\n')
	ok('★ 文案为「在 北大西洋 建设 1 支海军」', /在 北大西洋 建设 1 支海军/.test(log), log.slice(-160))
	ok('★ 不再出现「各建设」', !/各建设/.test(log))
	ok('step1 已建出海军', I.pieces_on(g, NA).some(p => g.piece_nation[p] === '德国' && g.piece_type[p] === 'navy'))
}

/* ---------------- S7 源码守卫 ---------------- */
section('S7 源码守卫')
{
	const src = fs.readFileSync(path.join(__dirname, '..', M, 'rules.js'), 'utf8')
	const seg = src.slice(src.indexOf("'15208': {"), src.indexOf("'15210': {"))
	ok('15208 有 ready 钩子', /ready\(game, ctx\)/.test(seg))
	ok('ready 用 can_deploy_air（同源：载体 + 格位）', /can_deploy_air\(game, '德国', sp, \{ terrain: 'sea' \}\)/.test(seg))
	ok('ready 检查「部署或调度至少一条路」',
		/unit_cap_ok\(game, '德国', 'air'\)/.test(seg) && /list_pieces\(game, \{ types: \['air'\], nation: '德国' \}\)/.test(seg))
	ok('run 返回 need:\'choice\' + choiceOptions',
		/need: 'choice'/.test(seg) && /choiceOptions: options/.test(seg))
	ok('★ run 复用 run_sea_air_deploy（不自己 build_piece）',
		/run_sea_air_deploy\(game, \{[\s\S]{0,160}\}, '德国'\)/.test(seg) && !/build_piece\(game, '德国', 'air'/.test(seg))
	ok('提供「部署 / 调度」两个选项 id',
		/id: 'deploy'/.test(seg) && /id: 'move'/.test(seg))
	ok('单格不带「各」（两处文案）',
		!/\+ ' 各征召 1 支' \+/.test(src) && /names\.length > 1 \? ' 各建设 1 支' : ' 建设 1 支'/.test(src))
}

console.log('\n' + (fails.length ? 'FAILED' : 'ALL PASS') + '  ' + pass + ' ok, ' + fails.length + ' fail')
if (fails.length) { console.log('失败项: ' + fails.join(' | ')); process.exit(1) }
