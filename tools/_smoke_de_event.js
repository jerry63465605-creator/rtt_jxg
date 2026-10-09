/*
 * 德国事件卡冒烟自检（2026-09-30）
 *
 * 覆盖本次"按实现方式分类重写"引入的 5 个机制：
 *   ① extraPlay 额外打出           （15227/15236/15238/15240）
 *   ② 纯自动（目标写死）            （15225/15230/15237/14502）
 *   ③ 选地区 / 多选                （15226/15231/15238/6600）
 *   ④ cond 前提条件                （15236/15240/6600）
 *   ⑤ cost.attrition 损耗代价       （15227/15238）
 * 外加：额外打出的【乐观消耗】与 next_phase 作废。
 *
 * 用法：node tools/_smoke_de_event.js
 */
const path = require('path')
const MOD = path.join(__dirname, '..', 'server-official', 'public', 'quartermaster-sub-wars')
const rules = require(path.join(MOD, 'rules.js'))
const I = rules._internal
const d = require(path.join(MOD, 'data.js')).data

let pass = 0, fail = 0
function ok(label, cond, extra) {
	if (cond) pass++
	else fail++
	console.log((cond ? '  PASS  ' : '  FAIL  ') + label + (extra ? '  | ' + extra : ''))
	if (!cond) process.exitCode = 1
}
let last_g
function fresh() {
	const g = rules.setup(1)
	g.current_nation = '德国'
	g.active = 'Axis'
	g.turn_phase = 'play'
	g.play_done = {}
	g.extra_play = null
	last_g = g
	return g
}
const lastLogs = n => (last_g.log || []).slice(-n)
const give = (nation, face) => {
	last_g.hands[nation] = last_g.hands[nation] || []
	last_g.hands[nation].push(String(face) + '#1')
}
const play = arg => { last_g = rules.action(last_g, 'Axis', 'play_card', arg) }
/*
 * 放棋子并【授予补给】——否则 build/battle 会因"发起单位不在补给中"被拒，
 * 测试用例就会死于无关的原因（见 ls pitfalls R 系列："薄局面"是 bug 高发区）。
 */
function put(id, nation, type, spaceName) {
	last_g.location[id] = d.id_of(spaceName)
	last_g.piece_nation[id] = nation
	last_g.piece_type[id] = type
	I.grant_supply(last_g, id, last_g.turn || 1)
	I.refresh(last_g)
}

/* ============ ① 额外打出：15227 白色方案 ============ */
console.log('\n=== ① 额外打出（15227 白色方案）===')
fresh()
give('德国', 15227)
give('德国', 15233)
const deckBefore = (last_g.decks['德国'] || []).length
play({ card: '15227#1' })
ok('15227 已打出（进弃牌堆）', (last_g.discard['德国'] || []).indexOf('15227#1') >= 0,
	lastLogs(2).join(' / '))
ok('占了出牌名额', !!(last_g.play_done && last_g.play_done['德国']))
ok('损耗 1 张牌（牌堆 -1）', (last_g.decks['德国'] || []).length === deckBefore - 1,
	'deck ' + deckBefore + ' -> ' + (last_g.decks['德国'] || []).length)
ok('获得额外打出权利 filter=hand', !!last_g.extra_play && last_g.extra_play.filter === 'hand',
	JSON.stringify(last_g.extra_play))

const epSource = last_g.extra_play.source_name
play({ card: '15233#1' })
ok('额外打出的第二张已经结算', (last_g.discard['德国'] || []).indexOf('15233#1') >= 0,
	lastLogs(2).join(' / '))
ok('日志记录"因《XX》的额外打出"',
	(last_g.log || []).some(l => l.indexOf('因《' + epSource + '》的【额外打出】') >= 0))
ok('额外打出已被消耗', !last_g.extra_play)

console.log('\n=== ①b 额外打出：不用于推进阶段则作废 ===')
fresh()
give('德国', 15227)
play({ card: '15227#1' })
ok('已获得额外打出', !!last_g.extra_play)
last_g = rules.action(last_g, 'Axis', 'next_phase', {})
ok('推进阶段后权利作废', !last_g.extra_play)

/* ============ ④⑤ 前提条件 + 限定 tag 的额外打出：15236 ============ */
console.log('\n=== ④⑤ 前提 + 限定 [北方行动] 的额外打出（15236 瑞典支援芬兰）===')
fresh()
give('德国', 15236)
play({ card: '15236#1' })
ok('前提不满足 -> 无效果且不给出额外打出', !last_g.extra_play, lastLogs(1)[0])
ok('卡已打出并占名额', !!(last_g.play_done && last_g.play_done['德国']))

fresh()
put('de1', '德国', 'army', '罗斯')   /* 满足"罗斯有德国陆军" */
give('德国', 15236)
give('德国', 15233)
give('德国', 15241)
play({ card: '15236#1' })
ok('前提满足 -> 获得 filter=north 的额外打出',
	!!last_g.extra_play && last_g.extra_play.filter === 'north',
	JSON.stringify(last_g.extra_play) + ' | ' + lastLogs(1)[0])

play({ card: '15233#1' })
ok('非[北方行动]牌被拒绝（卡还在手上）',
	(last_g.hands['德国'] || []).indexOf('15233#1') >= 0, lastLogs(1)[0])
ok('被拒后额外打出的权利保留', !!last_g.extra_play)

play({ card: '15241#1' })          /* 15241 瑞典铁矿 = [北方行动] 状态卡 */
ok('[北方行动]牌可以额外打出', (last_g.table['德国'] || []).indexOf('15241#1') >= 0,
	lastLogs(2).join(' / '))
ok('用掉后权利清空', !last_g.extra_play)

/* ============ ④ 前提：15240 / 6600 ============ */
console.log('\n=== ④ 前提（15240 轴心行动 / 6600 伊朗加入轴心国）===')
fresh()
put('it1', '意大利', 'army', '意大利')
give('德国', 15240)
play({ card: '15240#1' })
ok('<意大利>已被占据 -> 无效果、无额外打出',
	!last_g.extra_play && !!(last_g.play_done && last_g.play_done['德国']), lastLogs(1)[0])

fresh()
put('de0', '德国', 'army', '德国')
give('德国', 15240)
play({ card: '15240#1' })
ok('<意大利>空 -> 建设陆军 + 获得额外打出', !!last_g.extra_play, lastLogs(2).join(' / '))

fresh()
give('德国', 6600)
play({ card: '6600#1' })
ok('<中东>无友方陆军 -> 无效果', (last_g.discard['德国'] || []).indexOf('6600#1') >= 0 &&
	!(last_g.log || []).some(l => l.indexOf('计分标记') >= 0), lastLogs(1)[0])

fresh()
put('it2', '意大利', 'army', '中东')     /* 友方（轴心）陆军 */
put('su1', '苏联', 'army', '乌克兰')     /* 唯一候选 -> 自动消灭 */
give('德国', 6600)
const mkBefore = (I.markers_on(last_g, d.id_of('中东')) || []).length
play({ card: '6600#1' })
ok('前提满足 -> 结算成功', (last_g.discard['德国'] || []).indexOf('6600#1') >= 0,
	lastLogs(1)[0])
const mkAfter = (I.markers_on(last_g, d.id_of('中东')) || []).length
ok('<中东>增加 1 个计分标记', mkAfter === mkBefore + 1,
	'before=' + mkBefore + ' after=' + mkAfter)

/* ============ ② 纯自动：15225 / 15230 / 15237 / 14502 ============ */
console.log('\n=== ② 纯自动（卡面写死目标的组合卡）===')
fresh(); put('deA', '德国', 'army', '德国')
give('德国', 15225)
play({ card: '15225#1' })
ok('15225 阿登闪击战自动结算', (last_g.discard['德国'] || []).indexOf('15225#1') >= 0 &&
	!!(last_g.play_done && last_g.play_done['德国']), lastLogs(1)[0])

fresh(); put('deB', '德国', 'army', '西欧')
give('德国', 15230)
play({ card: '15230#1' })
ok('15230 海狮计划自动结算', (last_g.discard['德国'] || []).indexOf('15230#1') >= 0,
	lastLogs(1)[0])

fresh(); put('deC', '德国', 'army', '巴尔干')
give('德国', 15237)
play({ card: '15237#1' })
ok('15237 土耳其加入轴心国自动结算', (last_g.discard['德国'] || []).indexOf('15237#1') >= 0,
	lastLogs(1)[0])

fresh(); put('deD', '德国', 'army', '德国')
give('德国', 14502)
play({ card: '14502#1' })
ok('14502 但泽或战争自动结算', (last_g.discard['德国'] || []).indexOf('14502#1') >= 0,
	lastLogs(1)[0])

/* ============ ③ 需要玩家选目标（不应直接结算）============ */
console.log('\n=== ③ 需要选择 UI 的卡（不给目标就不结算）===')
fresh()
put('deE', '德国', 'army', '罗斯')
put('suE1', '苏联', 'army', '东欧')
put('suE2', '苏联', 'army', '北欧')
give('德国', 15226)
play({ card: '15226#1' })
ok('15226 巴巴罗萨：不给目标 -> 不结算（卡还在手上）',
	(last_g.hands['德国'] || []).indexOf('15226#1') >= 0, lastLogs(1)[0])

let tg = rules.query(last_g, 'Axis', 'event_targets', { card: '15226#1' })
ok('巴巴罗萨 need=space，pick=min(候选,3)，pickMin=1',
	!!tg && tg.need === 'space' && tg.pickMin === 1 && tg.pick === 2, JSON.stringify(tg))
ok('巴巴罗萨候选 = 与德军相邻的苏军所在地区',
	!!tg && (tg.candidates || []).map(c => c.name).sort().join(',') === '东欧,北欧',
	JSON.stringify((tg && tg.candidates) || []))

/* 玩家选 1 个就够（pickMin=1）-> 只打东欧 */
play({ card: '15226#1', picks: [d.id_of('东欧')] })
ok('巴巴罗萨只打选中的 1 个目标（不是全打）',
	(last_g.discard['德国'] || []).indexOf('15226#1') >= 0 &&
	last_g.location['suE1'] == null && last_g.location['suE2'] != null,
	lastLogs(1)[0])

fresh()
put('deF', '德国', 'navy', '南大西洋')
give('德国', 15231)
play({ card: '15231#1' })
tg = rules.query(last_g, 'Axis', 'event_targets', { card: '15231#1' })
ok('进攻美国：多步 + 多选（total=2 / step=1 / pickMin=1）',
	!!tg && tg.total === 2 && tg.step === 1 && tg.pickMin === 1, JSON.stringify(tg))

fresh()
give('德国', 15238)
play({ card: '15238#1' })
ok('15238 伊卡鲁斯：<冰岛>/<亚速尔>二选一 -> 不结算',
	(last_g.hands['德国'] || []).indexOf('15238#1') >= 0, lastLogs(1)[0])
tg = rules.query(last_g, 'Axis', 'event_targets', { card: '15238#1' })
ok('伊卡鲁斯候选 = 冰岛/亚速尔',
	!!tg && (tg.candidates || []).map(c => c.name).sort().join(',') === '亚速尔,冰岛',
	JSON.stringify((tg && tg.candidates) || []))

/* ============ ⑥ 多步脚本卡：15229 / 15239 / 14503 ============ */
console.log('\n=== ⑥a 15229 生产构思：检视牌堆 -> 选 1 张状态卡打出 -> 洗混 ===')
fresh()
give('德国', 15229)
const tableBefore = (last_g.table['德国'] || []).length
play({ card: '15229#1' })
ok('打出后进入脚本挂起（play_status_from_deck）',
	!!last_g.pending_script && last_g.pending_script.kind === 'play_status_from_deck',
	JSON.stringify(last_g.pending_script))
ok('卡已离手并占名额', (last_g.discard['德国'] || []).indexOf('15229#1') >= 0 &&
	!!(last_g.play_done && last_g.play_done['德国']))

let st = rules.query(last_g, 'Axis', 'script_state', {})
ok('候选只有[状态卡]',
	!!st && st.candidates.length > 0 &&
	st.candidates.every(c => c.type === 'STATUS') &&
	st.need === 1,
	JSON.stringify(st && { n: st.candidates.length, types: Array.from(new Set(st.candidates.map(c => c.type))) }))
ok('对方（同盟）看不到候选', rules.query(last_g, 'Allies', 'script_state', {}) === null)

const pickStatus = st.candidates[0].id
const deckLenBefore = (last_g.decks['德国'] || []).length
last_g = rules.action(last_g, 'Axis', 'resolve_script', { pick: [pickStatus] })
ok('选中的状态卡已打出到桌面',
	(last_g.table['德国'] || []).length === tableBefore + 1 &&
	(last_g.table['德国'] || []).indexOf(pickStatus) >= 0,
	lastLogs(2).join(' / '))
ok('挂起已清空', !last_g.pending_script)
ok('牌堆少了被挑走的那张', (last_g.decks['德国'] || []).length === deckLenBefore - 1,
	deckLenBefore + ' -> ' + (last_g.decks['德国'] || []).length)

console.log('\n=== ⑥b 15239 战略规划：检视牌堆选 2 张 -> 弃 1 张 -> 洗混 -> 额外打出 ===')
fresh()
give('德国', 15239)
const handBefore15239 = (last_g.hands['德国'] || []).length
play({ card: '15239#1' })
ok('第 1 步：从牌堆选 2 张',
	!!last_g.pending_script && last_g.pending_script.kind === 'draw_pick_discard' &&
	last_g.pending_script.stage === 1, JSON.stringify(last_g.pending_script))
st = rules.query(last_g, 'Axis', 'script_state', {})
ok('候选 = 本国牌堆、需要选 2 张',
	!!st && st.need === 2 && st.candidates.length === (last_g.decks['德国'] || []).length,
	JSON.stringify(st && { need: st.need, n: st.candidates.length }))

/* 少选 / 多选都要被拒 */
last_g = rules.action(last_g, 'Axis', 'resolve_script', { pick: [st.candidates[0].id] })
ok('少选 1 张被拒（仍在第 1 步）',
	!!last_g.pending_script && last_g.pending_script.stage === 1, lastLogs(1)[0])

const twoPicks = [st.candidates[0].id, st.candidates[1].id]
last_g = rules.action(last_g, 'Axis', 'resolve_script', { pick: twoPicks })
/* 注意：本卡自己已离手（-1），再抽进 2 张 -> handBefore + 1 */
ok('抽到的 2 张进手牌',
	(last_g.hands['德国'] || []).length === handBefore15239 + 1 &&
	twoPicks.every(id => (last_g.hands['德国'] || []).indexOf(id) >= 0),
	'hand ' + handBefore15239 + ' -> ' + (last_g.hands['德国'] || []).length + ' | ' +
		lastLogs(2).join(' / '))
ok('第 2 步：待弃置 1 张手牌',
	!!last_g.pending_script && last_g.pending_script.stage === 2 &&
	last_g.pending_script.need_discard === 1, JSON.stringify(last_g.pending_script))
st = rules.query(last_g, 'Axis', 'script_state', {})
ok('第 2 步候选 = 本国手牌', !!st && st.step_kind === 'discard' &&
	st.candidates.length === (last_g.hands['德国'] || []).length,
	JSON.stringify(st && { kind: st.step_kind, n: st.candidates.length }))

/* 弃掉一张【不是】刚抽到的牌 -> 额外打出的候选就还是那 2 张 */
const other = (last_g.hands['德国'] || []).filter(id => twoPicks.indexOf(id) < 0)[0]
last_g = rules.action(last_g, 'Axis', 'resolve_script', { discard: other })
ok('第 3 步完成 -> 挂起清空 + 洗混牌堆', !last_g.pending_script, lastLogs(2).join(' / '))
ok('获得 filter=drawn 的额外打出（候选 = 抽到的 2 张）',
	!!last_g.extra_play && last_g.extra_play.filter === 'drawn' &&
	last_g.extra_play.cards.length === 2,
	JSON.stringify(last_g.extra_play))

/*
 * 抽到的牌可以额外打出；其它手牌不行。
 *
 * 注意：这里不能用"卡是否结算成功"当判据 —— 抽到的 2 张是什么随机，
 * 目标地区写死的卡（如《进攻美国》）在当前空局面下会因
 * "发起单位不在补给中"被拒，那是【另一回事】。
 * 所以判据取"是否被额外打出的口径接受"（日志不含名额报错）。
 */
/*
 * 挑一张【能在出牌阶段打出】的非抽到牌（增强卡 EFFECT 有自己的时点限制，
 * 会被更靠前的阶段判定拦下，测不到"名额"这一层）。
 */
const nonDrawn = (last_g.hands['德国'] || []).filter(id => {
	if (twoPicks.indexOf(id) >= 0) return false
	const c = I.inst_card(id)
	return c && c.type !== 'EFFECT'
})[0]
if (nonDrawn == null) {
	ok('抽不到的牌仍被名额挡住', true, '（手上没有合适的对照牌，跳过）')
} else {
	play({ card: nonDrawn })
	ok('抽不到的牌仍被名额挡住', lastLogs(1)[0].indexOf('已打出 1 张牌') >= 0,
		lastLogs(1)[0])
}
ok('被拒后权利保留', !!last_g.extra_play)

const logBeforeExtra = (last_g.log || []).length
play({ card: twoPicks[0] })
const tailLogs = (last_g.log || []).slice(logBeforeExtra)
ok('抽到的牌被额外打出的口径接受',
	tailLogs.some(l => l.indexOf('因《战略规划》的【额外打出】') >= 0) &&
	!tailLogs.some(l => l.indexOf('已打出 1 张牌') >= 0),
	tailLogs.join(' / '))
ok('额外打出已消耗', !last_g.extra_play)

console.log('\n=== ⑥c 14503 提尔比茨号：让权给英国 -> 英国选 1 张暗置响应暗弃 ===')
fresh()
put('uk1', '英国', 'army', '不列颠')
/* 英国桌面上放 2 张暗置响应（其中一张用来弃） */
last_g.table_responses = last_g.table_responses || []
last_g.table_responses.push({ card_id: '15329#1', owner_side: 'allies' })
last_g.table_responses.push({ card_id: '15330#1', owner_side: 'allies' })
give('德国', 14503)
const activeBefore = last_g.active
play({ card: '14503#1' })
ok('打出后挂起 + 操作权让给英国',
	!!last_g.pending_script && last_g.pending_script.kind === 'uk_facedown_discard' &&
	last_g.active === 'Allies',
	JSON.stringify(last_g.pending_script) + ' active=' + last_g.active + '（前=' + activeBefore + '）')
ok('德国（轴心）看不到候选', rules.query(last_g, 'Axis', 'script_state', {}) === null)
st = rules.query(last_g, 'Allies', 'script_state', {})
ok('英国看得到 2 张暗置响应',
	!!st && st.step_kind === 'answer' && st.candidates.length === 2,
	JSON.stringify(st && { kind: st.step_kind, names: st.candidates.map(c => c.name) }))

/* 德国此时试图提交必须被拒（不是自己的回合位） */
last_g = rules.action(last_g, 'Axis', 'resolve_script', { pick: ['15329#1'] })
ok('轴心侧提交被拒（仍未结算）', !!last_g.pending_script, lastLogs(1)[0])

const downBefore = last_g.table_responses.length
last_g = rules.action(last_g, 'Allies', 'resolve_script', { pick: ['15329#1'] })
ok('英国选择的响应已从桌面移除',
	last_g.table_responses.length === downBefore - 1 &&
	!last_g.table_responses.some(r => String(r.card_id) === '15329#1'),
	JSON.stringify(last_g.table_responses))
ok('挂起清空、操作权归还德国',
	!last_g.pending_script && last_g.active === activeBefore,
	'active=' + last_g.active)
ok('暗牌语义：公共日志【不含】卡名',
	(last_g.log || []).some(l => l.indexOf('暗牌弃置') >= 0) &&
	!(last_g.log || []).some(l => l.indexOf('反潜战术') >= 0),
	lastLogs(1)[0])

/* ============ ⑦ 德国国家技能：★卡结算后 -> 损耗1 -> 打出1张状态卡 ============ */
console.log('\n=== ⑦ 德国国家技能（一回合一次）===')
fresh()
put('deG', '德国', 'army', '德国')
/* 手牌：1 张★卡（15225 阿登闪击战）+ 1 张状态卡（15241 瑞典铁矿） */
give('德国', 15225)
give('德国', 15241)
play({ card: '15225#1' })
ok('★卡结算后出现国家技能窗口',
	!!last_g.national_skill_offer && last_g.national_skill_offer.nation === '德国',
	JSON.stringify(last_g.national_skill_offer))
ok('窗口的 usable 为真',
	I.national_skill_usable(last_g, '德国') === true)

const dBefore = (last_g.decks['德国'] || []).length
last_g = rules.action(last_g, 'Axis', 'use_national_skill', {})
ok('使用后：损耗 1 张牌（牌堆 -1）', (last_g.decks['德国'] || []).length === dBefore - 1,
	dBefore + ' -> ' + (last_g.decks['德国'] || []).length)
ok('使用后：获得 filter=status 的额外打出',
	!!last_g.extra_play && last_g.extra_play.filter === 'status' &&
	last_g.extra_play.source_name === '德国国家技能',
	JSON.stringify(last_g.extra_play))
ok('窗口已消费', !last_g.national_skill_offer)

/* 名额已满 -> 靠国家技能把状态卡打出去 */
const tableBeforeSkill = (last_g.table['德国'] || []).length
play({ card: '15241#1' })
ok('状态卡已打出到桌面（名额已满仍可打）',
	(last_g.table['德国'] || []).length === tableBeforeSkill + 1 &&
	(last_g.hands['德国'] || []).indexOf('15241#1') < 0,
	lastLogs(2).join(' / '))
ok('日志记录"因《德国国家技能》的额外打出"',
	(last_g.log || []).some(l => l.indexOf('因《德国国家技能》的【额外打出】') >= 0))
ok('额外打出已消耗', !last_g.extra_play)

/*
 * 同一回合第二次：不可用（一回合一次）。
 * 局面要同时让 15225（西欧陆战+建设）和 15230（北海建海军+不列颠陆战）
 * 都能真正结算 —— 否则卡被拒、根本走不到"给不给窗口"这一步
 * （薄局面是 bug 高发区，见 pitfalls）。
 */
fresh()
put('deG2', '德国', 'army', '德国')
give('德国', 15225)
give('德国', 15230)
give('德国', 15241)
give('德国', 15242)
play({ card: '15225#1' })
ok('第一张★卡：给出窗口', !!last_g.national_skill_offer)
last_g = rules.action(last_g, 'Axis', 'use_national_skill', {})
play({ card: '15241#1' })     /* 用掉国家技能打出的状态卡 */
/*
 * 本回合已用过 -> usable 为假。（这里【不再】演示"又打出一张★卡"：
 * 出牌名额早已用完，那张★卡本来也打不出来，写进用例只会得到假结论。）
 */
ok('本回合已用过 -> usable 为假（一回合一次）',
	I.national_skill_usable(last_g, '德国') === false,
	JSON.stringify(last_g.national_skill_offer) + ' | ' + lastLogs(1)[0])
ok('已用过的回合不会再给窗口', !last_g.national_skill_offer)
last_g = rules.action(last_g, 'Axis', 'use_national_skill', {})
ok('强行使用被拒（不扣牌）', !last_g.extra_play, lastLogs(1)[0])

/* "不使用" 分支 */
fresh()
put('deG3', '德国', 'army', '德国')
give('德国', 15225)
give('德国', 15241)
play({ card: '15225#1' })
const dSkip = (last_g.decks['德国'] || []).length
last_g = rules.action(last_g, 'Axis', 'skip_national_skill', {})
ok('不使用 -> 窗口清掉、不扣牌',
	!last_g.national_skill_offer && !last_g.extra_play &&
	(last_g.decks['德国'] || []).length === dSkip, lastLogs(1)[0])

/* 窗口不跨动作残留：再做别的动作就失效 */
fresh()
put('deG4', '德国', 'army', '德国')
give('德国', 15225)
give('德国', 15241)
play({ card: '15225#1' })
ok('先有窗口', !!last_g.national_skill_offer)
last_g = rules.action(last_g, 'Axis', 'next_phase', {})
ok('推进阶段后窗口失效', !last_g.national_skill_offer)

/* ============ ⑦b 带★牌清单（玩家 2026-09-30 确认） ============ */
console.log('\n=== ⑦b 带★牌清单 ===')
const STARRED = ['15225', '15226', '15230', '15232', '15235', '15237', '6600', '14503']
const NOT_STARRED = ['6601', '15227', '15228', '15229', '15233', '15238', '14502', '15241']
ok('8 张★卡全部登记',
	STARRED.every(id => I.is_starred_card(id)),
	STARRED.filter(id => !I.is_starred_card(id)).join(','))
ok('6601 大德意志帝国【不】带★（玩家纠正）',
	NOT_STARRED.every(id => !I.is_starred_card(id)),
	NOT_STARRED.filter(id => I.is_starred_card(id)).join(','))

/* 新加入的★卡确实能触发窗口：15232 巴尔干军政府（目标写死，自动结算） */
fresh()
put('deH', '德国', 'army', '德国')
put('suH', '苏联', 'army', '乌克兰')   /* 第 2 步"在<乌克兰>消灭 1 支敌方陆军"要有目标 */
give('德国', 15232)
give('德国', 15241)
play({ card: '15232#1' })
ok('15232（新确认的★卡）结算后给出窗口', !!last_g.national_skill_offer,
	JSON.stringify(last_g.national_skill_offer) + ' | ' + lastLogs(1)[0])

console.log('\n===== 汇总：' + pass + ' 通过 / ' + fail + ' 失败 =====')
