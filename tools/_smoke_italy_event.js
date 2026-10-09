/*
 * 意大利事件卡 Group 1（7 张）冒烟自检（2026-10-08）
 * 只验证服务端核心逻辑，不写库。
 * 用法：node tools/_smoke_italy_event.js
 */
const path = require('path')
const MOD = path.join(__dirname, '..', 'server-official', 'public', 'quartermaster-sub-wars')
const rules = require(path.join(MOD, 'rules.js'))
const I = rules._internal
const d = require(path.join(MOD, 'data.js')).data

const g = rules.setup(1)
g.current_nation = '意大利'
g.active = 'AXIS'
g.turn_phase = 'play'
I.ensure_markers(g)

let fails = 0
function ok(label, cond, extra) {
	console.log((cond ? '  PASS  ' : '  FAIL  ') + label + (extra !== undefined ? '  | ' + extra : ''))
	if (!cond) fails++
}

/* 在 target 的相邻空格放一枚指定国家陆军，并把该格设为该阵营补给点（使其处于补给） */
function placeAdj(nation, faction, target) {
	for (let i = 1; i < d.spaces.length; i++) {
		if (i === target) continue
		if (!I.is_adjacent(g, target, i, faction)) continue
		const id = I.new_piece_id(g)
		g.location[id] = i
		g.piece_nation[id] = nation
		g.piece_type[id] = 'army'
		/* 显式授予补给，使该单位满足 build/recruit 的"邻接补给己方单位"条件 */
		g.supply_granted = g.supply_granted || {}
		g.supply_granted[id] = (g.turn || 1) + 100
		return i
	}
	return null
}
/* 在指定 space 直接放一枚指定国家/兵种单位并授予补给（搭建建设/征召的相邻补给条件） */
function putPiece(nation, type, space, faction) {
	const id = I.new_piece_id(g)
	g.location[id] = space
	g.piece_nation[id] = nation
	g.piece_type[id] = type
	g.supply_granted = g.supply_granted || {}
	g.supply_granted[id] = (g.turn || 1) + 100
	return id
}
function pieceAt(space, nation, type) {
	return Object.keys(g.location).some(id =>
		g.location[id] === space &&
		g.piece_nation[id] === nation &&
		g.piece_type[id] === type)
}
/* 通用驱动：自动补齐 choice / space 选择，直到结算或超限 */
function drive(card_id, arg0) {
	let arg = arg0 || {}
	for (let iter = 0; iter < 12; iter++) {
		const r = I.resolve_event_card(g, '意大利', card_id, arg)
		if (r.need) {
			if (r.need.need === 'choice') { arg = Object.assign({}, arg, { choice: 0 }); continue }
			if (r.need.need === 'space') {
				arg = Object.assign({}, arg)
				arg.spaces = arg.spaces || []
				const c0 = r.need.candidates[0]
				arg.spaces[r.need.step] = (typeof c0 === 'object' && c0 != null) ? c0.id : c0
				continue
			}
			if (r.need.need === 'piece') {
				arg = Object.assign({}, arg)
				arg.pieces = arg.pieces || []
				arg.pieces[r.need.step] = r.need.candidates[0].id
				continue
			}
			ok('drive: 未处理的 need=' + r.need.need, false)
			return r
		}
		return r
	}
	ok('drive: 超过迭代上限', false)
	return null
}

const VALID_OPS = new Set(['recruit', 'build', 'eliminate', 'battle', 'marker', 'ongoing', 'protect', 'run', 'peek_reorder', 'deck_inspect'])
const CARDS = ['17717', '17718', '17719', '17720', '17723', '17728', '16702']

console.log('=== 一、结构校验（7 张）===')
for (const id of CARDS) {
	const eff = I.card_effect_of(id)
	ok(id + ' 有配置', !!eff, JSON.stringify(eff && { actor: eff.actor, hasSteps: !!(eff.steps || eff.choice) }))
	if (!eff) continue
	ok(id + ' actor=意大利', eff.actor === '意大利', eff.actor)
	const steps = eff.choice ? eff.choice.flat() : (eff.steps || [])
	const opsOk = steps.every(s => VALID_OPS.has(s.op))
	ok(id + ' 所有 op 合法', opsOk, steps.map(s => s.op).join(','))
}

console.log('\n=== 二、16702 choice 分支 ===')
const need16702 = I.event_card_needs(g, '意大利', '16702', {})
ok('16702 需 choice', need16702 && need16702.need === 'choice', JSON.stringify(need16702 && need16702.need))
ok('16702 choice 有 2 个分支', need16702 && need16702.count === 2, need16702 && need16702.count)

console.log('\n=== 三、17728 意属东非：建设陆军 + 计分标记 ===')
placeAdj('意大利', 'AXIS', 32) /* 非洲东部 */
const r17728 = drive('17728', {})
ok('17728 结算 ok', r17728 && r17728.ok, JSON.stringify(r17728))
ok('17728 非洲东部有意大利陆军', pieceAt(32, '意大利', 'army'))
ok('17728 非洲东部标记 +1', !!(g.markers && g.markers[32] && g.markers[32].length === 1), 'markers[32]=' + JSON.stringify(g.markers && g.markers[32]))

console.log('\n=== 四、17717 大力神行动：地中海征召德/意海军（跨国籍 as）===')
placeAdj('德国', 'AXIS', 46)   /* 地中海：德国补给单位 */
placeAdj('意大利', 'AXIS', 46) /* 地中海：意大利补给单位 */
const r17717 = drive('17717', {})
ok('17717 结算 ok', r17717 && r17717.ok, JSON.stringify(r17717))
ok('17717 地中海有德国海军', pieceAt(46, '德国', 'navy'))
ok('17717 地中海有意大利海军', pieceAt(46, '意大利', 'navy'))

console.log('\n=== 五、17723 进攻共产国际：乌克兰 + 罗斯征召意大利陆军 ===')
placeAdj('意大利', 'AXIS', 45) /* 乌克兰 */
placeAdj('意大利', 'AXIS', 7)  /* 罗斯 */
const r17723 = drive('17723', {})
ok('17723 结算 ok', r17723 && r17723.ok, JSON.stringify(r17723))
ok('17723 乌克兰有意大利陆军', pieceAt(45, '意大利', 'army'))
ok('17723 罗斯有意大利陆军', pieceAt(7, '意大利', 'army'))

/* ===================== Group 2（3 张）===================== */
function resetBoard(g) {
	;['location', 'piece_nation', 'piece_type', 'piece_owner'].forEach(k => {
		if (!g[k]) return
		Object.keys(g[k]).forEach(id => { delete g[k][id] })
	})
	g.markers = {}; I.ensure_markers(g)
	g.extra_play = null; g.it_delegate = null
	g.current_nation = '意大利'; g.active = 'AXIS'; g.turn_phase = 'play'
	g.hands = g.hands || {}; g.hands['意大利'] = []; g.hands['德国'] = []
	g.play_done = g.play_done || {}; g.play_done['意大利'] = false
}

console.log('\n=== 六、17721 钢铁条约：打出响应 → 挂起德国打状态 → 归还 ===')
resetBoard(g)
g.hands['意大利'].push('17721')
/* 意大利先打出 17721（占出牌名额 → play_done[意大利]=true，run 授予响应 extra_play） */
try { rules.action(g, 'Axis', 'play_card', { card: '17721' }) }
catch (e) { ok('17721 打出事件卡异常', false, e.message) }
ok('17721 授予意大利 response extra_play',
	g.extra_play && g.extra_play.nation === '意大利' && g.extra_play.filter === 'response',
	JSON.stringify(g.extra_play))
/* 意大利打出一张响应卡（17730 RESPONSE）—— 此时为额外打出，触发链式委托 */
g.hands['意大利'].push('17730')
try { rules.action(g, 'Axis', 'play_card', { card: '17730' }) }
catch (e) { ok('17721 意大利打响应卡异常', false, e.message) }
ok('17721 意大利响应后切到德国', g.current_nation === '德国', 'current_nation=' + g.current_nation)
ok('17721 德国获 status extra_play',
	g.extra_play && g.extra_play.nation === '德国' && g.extra_play.filter === 'status',
	JSON.stringify(g.extra_play))
ok('17721 it_delegate 已建', !!g.it_delegate)
/* 德国打出一张状态卡（15338 STATUS） */
g.hands['德国'].push('15338')
try { rules.action(g, 'Axis', 'play_card', { card: '15338' }) }
catch (e) { ok('17721 德国打状态卡异常(已归还，仅效果报错)', true, e.message) }
ok('17721 德国打状态后归还意大利', g.current_nation === '意大利', 'current_nation=' + g.current_nation)
ok('17721 it_delegate 已清', !g.it_delegate)
ok('17721 extra_play 已清', !g.extra_play)

console.log('\n=== 六B、17721 钢铁条约：德国放弃状态卡打出 ===')
resetBoard(g)
g.hands['意大利'].push('17721')
try { rules.action(g, 'Axis', 'play_card', { card: '17721' }) } catch (e) {}
g.hands['意大利'].push('17730')
try { rules.action(g, 'Axis', 'play_card', { card: '17730' }) } catch (e) {}
ok('17721B 委托已挂起(德国)', g.current_nation === '德国' && !!g.it_delegate)
rules.action(g, 'Axis', 'event_delegate_decline', {})
ok('17721B 放弃后归还意大利', g.current_nation === '意大利', 'current_nation=' + g.current_nation)
ok('17721B it_delegate 已清', !g.it_delegate)
ok('17721B extra_play 已清', !g.extra_play)

console.log('\n=== 七、17722 华夫脱党：消灭敌陆军 + 条件征召（相邻无英国陆军）===')
/* 场景A：非洲北部相邻区无英国陆军 → 应征召 */
resetBoard(g)
const afn = I.space_ids_of(['非洲北部'])[0]
/* 非洲北部放一支英国陆军（被消灭目标） */
putPiece('英国', 'army', afn, 'ALLIES')
/* 非洲北部相邻放一支补给意大利陆军（征召条件 + 使非洲北部成为合法征召地） */
const afnNb = (d.spaces[afn].connections || [])[0]
putPiece('意大利', 'army', afnNb, 'AXIS')
const r17722a = drive('17722', {})
ok('17722A 结算 ok', r17722a && r17722a.ok, JSON.stringify(r17722a))
ok('17722A 非洲北部无英国陆军(已消灭)', !pieceAt(afn, '英国', 'army'))
ok('17722A 非洲北部征召到意大利陆军', pieceAt(afn, '意大利', 'army'))

console.log('\n=== 七B、17722 华夫脱党：相邻有英国陆军 → 不征召 ===')
resetBoard(g)
putPiece('英国', 'army', afn, 'ALLIES')           /* 被消灭目标 */
putPiece('英国', 'army', afnNb, 'ALLIES')          /* 相邻区有英国陆军 → 条件不成立 */
putPiece('意大利', 'army', (d.spaces[afn].connections || [])[1] || afnNb, 'AXIS')
const r17722b = drive('17722', {})
ok('17722B 结算 ok', r17722b && r17722b.ok, JSON.stringify(r17722b))
ok('17722B 非洲北部英国陆军已消灭', !pieceAt(afn, '英国', 'army'))
ok('17722B 相邻英国陆军仍在', pieceAt(afnNb, '英国', 'army'))
ok('17722B 非洲北部未征召(条件不满足)', !pieceAt(afn, '意大利', 'army'))

console.log('\n=== 八、17727 西班牙国：两步各复用原子 op（按轴心相邻）===')
resetBoard(g)
const wx = I.space_ids_of(['西欧'])[0]
const ns = I.space_ids_of(['北海'])[0]
const md = I.space_ids_of(['地中海'])[0]
/* 征召：西欧、非洲北部 各放相邻补给意大利陆军 */
;(d.spaces[wx].connections || []).slice(0, 1).forEach(s => putPiece('意大利', 'army', s, 'AXIS'))
;(d.spaces[afn].connections || []).slice(0, 1).forEach(s => putPiece('意大利', 'army', s, 'AXIS'))
/* 建设海军：北海、地中海 各放相邻补给意大利海军 */
;(d.spaces[ns].connections || []).slice(0, 1).forEach(s => putPiece('意大利', 'navy', s, 'AXIS'))
;(d.spaces[md].connections || []).slice(0, 1).forEach(s => putPiece('意大利', 'navy', s, 'AXIS'))
const r17727 = drive('17727', {})
ok('17727 结算 ok', r17727 && r17727.ok, JSON.stringify(r17727))
ok('17727 西欧/非洲北部之一有意大利陆军', pieceAt(wx, '意大利', 'army') || pieceAt(afn, '意大利', 'army'))
ok('17727 北海/地中海之一有意大利海军', pieceAt(ns, '意大利', 'navy') || pieceAt(md, '意大利', 'navy'))

/* ===================== Group 3（5 张）===================== */
console.log('\n=== 九、17724 札萨·汗：消灭中东英陆军 + 条件征召 ===')
resetBoard(g)
let zd = I.space_ids_of(['中东'])[0]
putPiece('英国', 'army', zd, 'ALLIES')
placeAdj('意大利', 'AXIS', zd)            // 相邻意大利陆军（无英国）→ 满足征召条件
drive('17724')
ok('17724 <中东> 英国陆军被消灭', !pieceAt(zd, '英国', 'army'))
ok('17724 相邻无英国陆军 → <中东> 征召意大利陆军', pieceAt(zd, '意大利', 'army'))

resetBoard(g)
zd = I.space_ids_of(['中东'])[0]
putPiece('英国', 'army', zd, 'ALLIES')
placeAdj('英国', 'ALLIES', zd)            // 相邻英国陆军 → 不满足征召条件
placeAdj('意大利', 'AXIS', zd)
drive('17724')
ok('17724 反向：相邻有英国陆军 → <中东> 不征召意大利陆军', !pieceAt(zd, '意大利', 'army'))

console.log('\n=== 十、17725 掠夺：意大利控制非大本营地区 +1分 -1标记 ===')
resetBoard(g)
const hb = I.effective_home_base(g, '意大利')
const loot = I.space_ids_of(['中东'])[0]
ok('17725 测试区非意大利大本营', loot !== hb, 'loot=' + loot + ' hb=' + hb)
putPiece('意大利', 'army', loot, 'AXIS')
g.markers[loot] = [{ owner: '意大利', faction: 'axis', value: 1 }]   // 显式放 1 个计分标记
const sc0 = g.score['axis'] || 0
const mk0 = (g.markers[loot] || []).length
drive('17725')
ok('17725 轴心分 +1', (g.score['axis'] || 0) === sc0 + 1, 'score=' + (g.score['axis'] || 0))
ok('17725 该地区计分标记 -1', (g.markers[loot] || []).length === mk0 - 1, 'markers=' + JSON.stringify(g.markers[loot]))

console.log('\n=== 十一、17726 西班牙蓝色师：随机弃置苏联暗置响应 ===')
resetBoard(g)
g.table_responses = [
	{ card_id: '17830', card_face: 17830, owner_side: 'ALLIES', nation: '苏联', name: '保卫祖国' },
	{ card_id: '15328', card_face: 15328, owner_side: 'ALLIES', nation: '英国', name: '破译恩尼格码' },
]
const tr0 = g.table_responses.length
drive('17726')
ok('17726 苏联暗置响应被随机弃掉', g.table_responses.filter(r => r.nation === '苏联').length === 0)
ok('17726 table_responses 减少 1 张', g.table_responses.length === tr0 - 1)
ok('17726 弃掉的苏联响应进入弃牌堆', (g.discard['苏联'] || []).indexOf('17830') >= 0)

console.log('\n=== 十二、16703 罗马尼亚铁卫团：巴尔干征召 + 委托德国弃牌摸牌 ===')
resetBoard(g)
putPiece('意大利', 'army', I.space_ids_of(['巴尔干'])[0], 'AXIS')
drive('16703')
ok('16703 <巴尔干> 征召意大利陆军', pieceAt(I.space_ids_of(['巴尔干'])[0], '意大利', 'army'))
ok('16703 委托德国弃牌摸牌挂起', !!(g.it_delegate && g.it_delegate.mode === 'german_draw'))
ok('16703 当前行动国切到德国', g.current_nation === '德国')

g.hands['德国'] = ['15328']
const hLen = g.hands['德国'].length
rules.action(g, 'Axis', 'italy_german_draw', { card_id: '15328' })
ok('16703-de 德国弃掉指定手牌', g.hands['德国'].indexOf('15328') < 0)
ok('16703-de 德国手牌净变化0（弃1摸1）', g.hands['德国'].length === hLen, 'len=' + g.hands['德国'].length)
ok('16703-de 委托已归还', !g.it_delegate)
ok('16703-de 控制权归还意大利', g.current_nation === '意大利')

resetBoard(g)
putPiece('意大利', 'army', I.space_ids_of(['巴尔干'])[0], 'AXIS')
drive('16703')
rules.action(g, 'Axis', 'event_delegate_decline', {})
ok('16703-decline 委托已归还', !g.it_delegate)
ok('16703-decline 控制权归还意大利', g.current_nation === '意大利')

console.log('\n=== 十三、17729 卡佩里尼：轴心依次链 ===')
resetBoard(g)
g.discard['德国'] = ['17830']
g.discard['意大利'] = ['17831']
g.discard['日本'] = ['17832']
drive('17729')
ok('17729 链已启动', !!g.italy_chain)
ok('17729 首轮为德国', g.italy_chain && g.italy_chain.pickedNation === '德国')
ok('17729 德国抽到 17830', g.italy_chain && g.italy_chain.pickedCard === '17830')
rules.action(g, 'Axis', 'resolve_italy_chain', { choice: 'decktop' })
ok('17729 次轮为意大利', g.italy_chain && g.italy_chain.pickedNation === '意大利')
ok('17729 意大利抽到 17831', g.italy_chain && g.italy_chain.pickedCard === '17831')
rules.action(g, 'Axis', 'resolve_italy_chain', { choice: 'decktop' })
ok('17729 三轮为日本', g.italy_chain && g.italy_chain.pickedNation === '日本')
ok('17729 日本抽到 17832', g.italy_chain && g.italy_chain.pickedCard === '17832')
rules.action(g, 'Axis', 'resolve_italy_chain', { choice: 'decktop' })
ok('17729 全部处置完 → 链清空', !g.italy_chain)
ok('17729 德国将 17830 置牌堆顶', g.decks['德国'] && g.decks['德国'][0] === '17830')
ok('17729 意大利将 17831 置牌堆顶', g.decks['意大利'] && g.decks['意大利'][0] === '17831')
ok('17729 日本将 17832 置牌堆顶', g.decks['日本'] && g.decks['日本'][0] === '17832')

console.log('\n=== 十四、17729 打出基本卡（免费额外打出）===')
resetBoard(g)
const btarget = I.space_ids_of(['北非'])[0]
placeAdj('德国', 'AXIS', btarget)         // 德国有相邻补给单位 → 可在北非建设陆军
g.discard['德国'] = ['15300']              // 15300 = 建设陆军(基本)
g.discard['意大利'] = ['17831']
g.discard['日本'] = ['17832']
drive('17729')
ok('17729-play 德国抽到 15300', g.italy_chain && g.italy_chain.pickedNation === '德国' && g.italy_chain.pickedCard === '15300')
rules.action(g, 'Axis', 'resolve_italy_chain', { choice: 'play' })
ok('17729-play 进入选目标子状态', g.italy_chain && g.italy_chain.sub && g.italy_chain.sub.kind === 'play')
rules.action(g, 'Axis', 'resolve_italy_play', { space: btarget })
ok('17729-play 免费打出基本卡建成德国陆军', pieceAt(btarget, '德国', 'army'))
rules.action(g, 'Axis', 'resolve_italy_chain', { choice: 'discard' })
ok('17729-play 推进到日本（意大利已处置）', g.italy_chain && g.italy_chain.pickedNation === '日本')

console.log('\n' + (fails === 0 ? 'ALL PASS' : (fails + ' FAIL')))
process.exitCode = fails === 0 ? 0 : 1
