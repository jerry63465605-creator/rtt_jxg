/*
 * 美国状态卡 批次3 冒烟自检（2026-10-10）
 * 覆盖：17545 曼哈顿计划（弃牌阶段计分）/ 17548 胜利花园（资源再分配弃1）/
 *       17551 战时国债（资源再分配取弃牌堆）/ 17546 铆钉女工（弃牌阶段置牌堆底）。
 * 用法：node tools/_smoke_us_status3.js
 */
const path = require('path')
const MOD = path.resolve('server-official/public/quartermaster-sub-wars')
const rules = require(path.join(MOD, 'rules.js'))
const I = rules._internal
const d = require(path.join(MOD, 'data.js')).data

let pass = 0, fail = 0
function ok(label, cond, extra) {
	console.log((cond ? '  PASS  ' : '  FAIL  ') + label + (extra ? '  | ' + extra : ''))
	cond ? pass++ : fail++
}

let g = rules.setup(1)
g.current_nation = '美国'
g.active = 'Allies'

/* ============ 17545 曼哈顿计划 ============ */
console.log('=== 1. 17545 曼哈顿计划：弃牌阶段弃手牌 +1 分 ===')
g.turn_phase = 'discard'
g.table['美国'] = ['17545#1']
g.hands['美国'] = ['hand_x#1']
const before = (g.score['allies'] || 0)
// 直接走 discard_card 钩子（行动阶段人手弃牌也会进入此函数）
I.discard_card(g, '美国', 'hand_x#1')
ok('弃牌阶段弃手牌后美国 +1 分', (g.score['allies'] || 0) === before + 1,
	'before=' + before + ' after=' + (g.score['allies'] || 0))
// 一回合一次：再弃一张不再加分
g.hands['美国'] = ['hand_y#1']
I.discard_card(g, '美国', 'hand_y#1')
ok('一回合仅一次（再弃不加分）', (g.score['allies'] || 0) === before + 1)
// 非弃牌阶段不触发
g.turn_phase = 'play'
g.hands['美国'] = ['hand_z#1']
const mid = (g.score['allies'] || 0)
I.discard_card(g, '美国', 'hand_z#1')
ok('非弃牌阶段不触发', (g.score['allies'] || 0) === mid)

/* ============ 17548 胜利花园 ============ */
console.log('\n=== 2. 17548 胜利花园：资源再分配弃 1 张 ===')
g = rules.setup(1)
g.current_nation = '美国'
g.active = 'Allies'
g.turn_phase = 'resource'
g.table['美国'] = ['17548#1']
g.hands['美国'] = ['drop1#1']
g.decks['美国'] = ['15300#1']   // 一张基本卡作为 take
g = rules.action(g, 'Allies', 'resource_swap', { take: '15300#1', discard: ['drop1#1'] })
ok('17548：弃 1 张成功', (g.hands['美国'] || []).indexOf('15300#1') >= 0,
	'hand=' + JSON.stringify(g.hands['美国']))
ok('17548：弃出的牌离手', (g.hands['美国'] || []).indexOf('drop1#1') < 0)

/* ============ 17551 战时国债 ============ */
console.log('\n=== 3. 17551 战时国债：资源再分配可在弃牌堆取牌 ===')
g = rules.setup(1)
g.current_nation = '美国'
g.active = 'Allies'
g.turn_phase = 'resource'
g.table['美国'] = ['17551#1']
g.hands['美国'] = ['d1#1', 'd2#1', 'd3#1']
g.discard['美国'] = ['15300#1']   // 基本卡放在弃牌堆
g = rules.action(g, 'Allies', 'resource_swap', { take_discard: '15300#1', discard: ['d1#1', 'd2#1', 'd3#1'] })
ok('17551：从弃牌堆取到手牌', (g.hands['美国'] || []).indexOf('15300#1') >= 0,
	'hand=' + JSON.stringify(g.hands['美国']))
ok('17551：弃牌堆该牌移除', (g.discard['美国'] || []).indexOf('15300#1') < 0)

/* ============ 17546 铆钉女工 ============ */
console.log('\n=== 4. 17546 铆钉女工：弃牌阶段置 1–2 张手牌于牌堆底 ===')
g = rules.setup(1)
g.current_nation = '美国'
g.active = 'Allies'
g.turn_phase = 'discard'
g.table['美国'] = ['17546#1']
g.hands['美国'] = ['a1#1', 'a2#1']
g.decks['美国'] = ['deck_top#1']
g = rules.action(g, 'Allies', 'activate_status', { card: '17546#1' })
ok('17546：触发后挂起选第 1 张', !!(g.pending_echo && g.pending_echo.step === 'first'),
	'pe=' + JSON.stringify(g.pending_echo && { step: g.pending_echo.step }))
g = rules.action(g, 'Allies', 'resolve_effect', { pick: 'a1#1' })
ok('17546：选第 1 张后进入第 2 步', !!(g.pending_echo && g.pending_echo.step === 'second'),
	'step=' + (g.pending_echo && g.pending_echo.step))
g = rules.action(g, 'Allies', 'resolve_effect', { done: true })
ok('17546：完成（只放 1 张）后清空挂起', !g.pending_echo)
ok('17546：a1 移出手牌', (g.hands['美国'] || []).indexOf('a1#1') < 0)
ok('17546：a1 置于牌堆底', (g.decks['美国'] || []).indexOf('a1#1') >= 0,
	'deck=' + JSON.stringify(g.decks['美国']))

/* 两阶段：选 2 张，顺序为 a1 在下、a2 在上 */
console.log('\n=== 5. 17546 铆钉女工：选 2 张（顺序验证） ===')
g = rules.setup(1)
g.current_nation = '美国'
g.active = 'Allies'
g.turn_phase = 'discard'
g.table['美国'] = ['17546#1']
g.hands['美国'] = ['a1#1', 'a2#1']
g.decks['美国'] = ['deck_top#1']
g = rules.action(g, 'Allies', 'activate_status', { card: '17546#1' })
g = rules.action(g, 'Allies', 'resolve_effect', { pick: 'a1#1' })
g = rules.action(g, 'Allies', 'resolve_effect', { pick: 'a2#1' })
ok('17546：两阶段完成后清空挂起', !g.pending_echo)
const deck = g.decks['美国']
ok('17546：a1 在牌堆底（末端），a2 在其上',
	deck[deck.length - 2] === 'a1#1' && deck[deck.length - 1] === 'a2#1',
	'deck=' + JSON.stringify(deck))

/* ============ 16304 中国远征军 ============ */
console.log('\n=== 6. 16304 中国远征军：打出后在<东南亚>征召中国陆军 ===')
g = rules.setup(1)
g.current_nation = '美国'
g.active = 'Allies'
g.turn_phase = 'play'
g.hands['美国'] = ['16304#1']
g = rules.action(g, 'Allies', 'play_card', { card: '16304#1' })
ok('16304 进桌面', (g.table['美国'] || []).indexOf('16304#1') >= 0,
	'table=' + JSON.stringify(g.table['美国']))
const sea = d.id_of('东南亚')
const cnArmy = Object.keys(g.location).filter(p =>
	g.piece_nation[p] === '中国' && g.piece_type[p] === 'army' && g.location[p] === sea)
ok('中国在<东南亚>征召陆军', cnArmy.length >= 1, 'count=' + cnArmy.length)

/* ============ 17555 大萧条的余波 ============ */
console.log('\n=== 7. 17555 大萧条的余波：结束中立 -> 弃此牌 -> <美国>+1 计分标记 ===')
g = rules.setup(1)
g.current_nation = '美国'
g.active = 'Allies'
g.table['美国'] = ['17555#1']
const usSp = d.id_of('美国')
const mkBefore = ((g.markers || {})[usSp] || []).length
/* 直接触发结束中立（走 end_neutral 的美国分支） */
I.end_neutral(g, '美国', '测试触发')
ok('结束中立后置起机会窗口', !!g.us_depression_offer, 'offer=' + g.us_depression_offer)
g = rules.action(g, 'Allies', 'us_depression_use', {})
const mkAfter = ((g.markers || {})[usSp] || []).length
ok('<美国>增加 1 个计分标记', mkAfter === mkBefore + 1,
	'before=' + mkBefore + ' after=' + mkAfter)
ok('17555 已弃置进弃牌堆', (g.discard['美国'] || []).indexOf('17555#1') >= 0)
ok('17555 离开桌面', (g.table['美国'] || []).indexOf('17555#1') < 0)
ok('机会窗口已消费', !g.us_depression_offer)

/* ============ 16304 移除反应（让权美国） ============ */
console.log('\n=== 8. 16304 中国远征军：<东南亚>中国陆军被移除后让权美国选地征召 ===')
g = rules.setup(1)
g.current_nation = '日本'   /* 故意设在他人回合，验证"自己或其他人回合都能触发" */
g.active = 'Axis'
g.table['美国'] = ['16304#1']
const seaId = d.id_of('东南亚')
/* 模拟：<东南亚>的中国陆军被移除 -> 派发点调用 offer */
const okOffer = I.offer_us_china_delegate(g, seaId, '中国', 'army')
ok('中国陆军在<东南亚>被移除 -> 触发让权', !!okOffer && !!g.us_china_delegate)
ok('操作权翻转给美国（Allies）', g.active === 'Allies', 'active=' + g.active)
const cands = (g.us_china_delegate || {}).candidates || []
ok('给出相邻陆地候选', cands.length >= 1, 'cands=' + JSON.stringify(cands.map(c => d.name_of(c))))
/* 美国点其中一个候选地区 */
const pick = cands[0]
g = rules.action(g, 'Allies', 'resolve_china_delegate', { space: pick })
const cnAt = Object.keys(g.location).filter(p =>
	g.piece_nation[p] === '中国' && g.piece_type[p] === 'army' && g.location[p] === pick)
ok('中国在所选相邻地区征召到陆军', cnAt.length >= 1, 'count=' + cnAt.length)
ok('征召地不在<东南亚>', pick !== seaId)
ok('挂起已清空', !g.us_china_delegate)
ok('操作权归还（Axis）', g.active === 'Axis', 'active=' + g.active)

/* 非中国陆军/非<东南亚>不应触发 */
g2 = rules.setup(1)
g2.current_nation = '日本'; g2.active = 'Axis'; g2.table['美国'] = ['16304#1']
ok('非中国部队不触发', !I.offer_us_china_delegate(g2, seaId, '日本', 'army'))
ok('非<东南亚>不触发', !I.offer_us_china_delegate(g2, d.id_of('中国东部'), '中国', 'army'))

/* ============ 17541 工业巨头 ============ */
console.log('\n=== 9. 17541 工业巨头：打出[战略卡]后损耗2，将其洗入牌堆 ===')
g = rules.setup(1)
g.current_nation = '美国'
g.active = 'Allies'
g.turn_phase = 'play'
g.table['美国'] = ['17541#1']
/* 手牌放一张基本卡（[战略卡]=BASIC）并打出 */
const BASIC_NAME = '建设陆军'
g.hands['美国'] = ['15300#1']   /* 15300 = 建设陆军（BASIC） */
g.decks['美国'] = ['d1#1', 'd2#1', 'd3#1', 'd4#1']
const deckBefore = g.decks['美国'].length
const basicName = (I.inst_card ? I.inst_card('15300#1') : null)
/* 直接触发：武装窗口 + 记录刚打出的牌（模拟 play_card BASIC 分支的挂载） */
g.status_instant = [{ card_id: '17541#1', nation: '美国', window: 'after_play_basic', space: null }]
g.last_basic_played = { nation: '美国', card: '15300#1', space: null }
/* 打出后进弃牌堆 */
g.discard['美国'] = ['15300#1']
g = rules.action(g, 'Allies', 'activate_status', { card: '17541#1' })
ok('刚打出的[战略卡]已洗入牌堆',
	(g.decks['美国'] || []).indexOf('15300#1') >= 0,
	'deck=' + JSON.stringify(g.decks['美国']))
ok('该牌已移出弃牌堆', (g.discard['美国'] || []).indexOf('15300#1') < 0)
ok('损耗 2 张（牌堆减少后又被洗回 1 张）',
	(g.decks['美国'] || []).length === deckBefore - 2 + 1,
	'before=' + deckBefore + ' after=' + (g.decks['美国'] || []).length)

/* ============ 17543 雷达 ============ */
console.log('\n=== 10. 17543 雷达：美国海军被移除后损耗2 -> 还原且不被移除 ===')
g = rules.setup(1)
g.current_nation = '美国'
g.active = 'Allies'
g.table['美国'] = ['17543#1']
g.decks['美国'] = ['d1#1', 'd2#1', 'd3#1', 'd4#1']
const navySp = d.id_of('北大西洋') || d.id_of('北海')
const navyId = 'us_navy_1'
g.location[navyId] = navySp
g.piece_nation[navyId] = '美国'
g.piece_type[navyId] = 'navy'
/* 模拟：该海军被移除，并武装 piece_removed 窗口 */
delete g.location[navyId]
g.last_piece_removed = { nation: '美国', type: 'navy', space: navySp, reason: 'piece_removed', piece: navyId }
g.status_instant = [{ card_id: '17543#1', nation: '美国', window: 'piece_removed', space: navySp }]
g = rules.action(g, 'Allies', 'activate_status', { card: '17543#1' })
ok('美国海军已还原到原地区', g.location[navyId] === navySp,
	'loc=' + g.location[navyId] + ' expect=' + navySp)
ok('损耗 2 张（牌堆 4 -> 2）', (g.decks['美国'] || []).length === 2,
	'deck=' + JSON.stringify(g.decks['美国']))

/* ============ 17553 抗日义勇军 ============ */
console.log('\n=== 11. 17553 抗日义勇军：中国行动后让权日本弃牌+损耗 ===')
g = rules.setup(1)
g.current_nation = '美国'
g.active = 'Allies'
g.table['美国'] = ['17553#1']
g.hands['日本'] = ['jp1#1', 'jp2#1']
g.decks['日本'] = ['jd1#1', 'jd2#1', 'jd3#1']
/* 触发：中国征召（直接调用 offer），应让权日本 */
I.offer_us_japan_delegate ? I.offer_us_japan_delegate(g, '中国征召') : null
ok('已挂起让权给日本', !!g.us_japan_delegate, 'dg=' + JSON.stringify(g.us_japan_delegate))
ok('操作权切给日本（Axis）', g.current_nation === '日本' && g.active === 'Axis',
	'nation=' + g.current_nation + ' active=' + g.active)
/* 日本提交弃牌 */
g = rules.action(g, 'Axis', 'resolve_japan_delegate', { card: 'jp1#1' })
ok('日本弃置了 1 张手牌', (g.hands['日本'] || []).indexOf('jp1#1') < 0 &&
	(g.discard['日本'] || []).indexOf('jp1#1') >= 0,
	'hand=' + JSON.stringify(g.hands['日本']))
ok('日本损耗 1 张（牌堆 3 -> 2）', (g.decks['日本'] || []).length === 2,
	'deck=' + JSON.stringify(g.decks['日本']))
ok('挂起已清空', !g.us_japan_delegate)
ok('操作权归还美国（Allies）', g.active === 'Allies', 'active=' + g.active)

console.log('\n==== 结果：' + pass + ' 通过 / ' + fail + ' 失败 ====')
process.exit(fail ? 1 : 0)
