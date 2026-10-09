/* 日本国家技能回归测试（2026-10-04）
 * 玩家口径：【计分阶段】，手里【响应牌不止 1 张】（>=2）时，
 *           可以弃 1 张响应牌 -> 额外【暗置】（打出到桌面背面朝上）1 张响应牌。
 *
 * 与英国的差异（易搞混，务必分开测）：
 *   · 英国：抽牌后触发，弃【任意】3 张，打出【事件/状态】卡
 *   · 日本：计分阶段触发，弃【响应牌】1 张，暗置【响应牌】1 张
 */
const path = require('path')
const MOD = path.resolve('server-official/public/quartermaster-sub-wars')
const rules = require(path.join(MOD, 'rules.js'))
const I = rules._internal
const CARDS = require(path.join(MOD, 'cards.js')).CARDS

let pass = 0, fail = 0
function ok(m, cond, extra) {
	if (cond) { pass++; console.log('  ✓ ' + m) }
	else { fail++; console.log('  ✗ ' + m + (extra ? '  [' + extra + ']' : '')) }
}

const jpResp = CARDS.filter(c => c.nation === '日本' && c.type === 'RESPONSE')
console.log('日本 RESPONSE 卡共', jpResp.length, '张；样本:',
	jpResp.slice(0, 3).map(c => c.id + ' ' + c.name).join(' / '))
ok('找得到日本响应牌样本（>=2 张）', jpResp.length >= 2, 'count=' + jpResp.length)
if (jpResp.length < 2) { console.log('\nPASS=' + pass + ' FAIL=' + fail); process.exit(1) }

const R1 = jpResp[0], R2 = jpResp[1]
const id1 = R1.id + '#1', id2 = R2.id + '#1'
/* 非响应牌（用于反例） */
const jpOther = CARDS.find(c => c.nation === '日本' && c.type !== 'RESPONSE')

function freshJp() {
	const g = rules.setup(1)
	g.current_nation = '日本'
	g.active = 'Axis'
	g.turn_phase = 'scoring'
	g.play_done = {}
	g.hands['日本'] = []
	g.decks['日本'] = []
	for (let k = 1; k <= 30; k++) g.decks['日本'].push('jpfill' + k + '#1')
	g.discard['日本'] = []
	g.table_responses = []
	g.national_skill_used = {}
	g.national_skill_offer = null
	g.extra_play = null
	return g
}

console.log('\n=== 1. 计分阶段：手牌响应 >= 2 才开窗 ===')
{
	const g = freshJp()
	g.hands['日本'] = [id1, id2]          /* 2 张响应 */
	I.run_phase_entry(g, 'scoring', '日本')
	ok('响应 2 张 -> 开窗', !!g.national_skill_offer,
		'offer=' + JSON.stringify(g.national_skill_offer))
	ok('窗口归属日本', g.national_skill_offer && g.national_skill_offer.nation === '日本')
	ok('技能判定可用', I.national_skill_usable(g, '日本'))
}

console.log('\n=== 2. 只有 1 张响应 -> 不开窗（弃完没牌可暗置）===')
{
	const g = freshJp()
	g.hands['日本'] = [id1]               /* 只有 1 张响应 */
	I.run_phase_entry(g, 'scoring', '日本')
	ok('响应 1 张 -> 不开窗', !g.national_skill_offer,
		'offer=' + JSON.stringify(g.national_skill_offer))
	ok('不可用', !I.national_skill_usable(g, '日本'))
}

console.log('\n=== 3. 手牌很多但没有响应牌 -> 不开窗（代价限定类型）===')
{
	const g = freshJp()
	/* 塞 5 张非响应牌 */
	g.hands['日本'] = ['x1#1', 'x2#1', 'x3#1', 'x4#1', 'x5#1']
	I.run_phase_entry(g, 'scoring', '日本')
	ok('无响应牌 -> 不开窗（不能只比手牌总数）', !g.national_skill_offer,
		'offer=' + JSON.stringify(g.national_skill_offer))
}

console.log('\n=== 4. 【2026-10-05 一步到位】弃 1 张响应 + 打出另 1 张响应，一次提交 ===')
{
	const g = freshJp()
	g.hands['日本'] = [id1, id2]
	I.run_phase_entry(g, 'scoring', '日本')
	const before = g.hands['日本'].length
	const tblBefore = (g.table_responses || []).length
	/* 一次提交：drop=[id1] 弃掉，play=id2 暗置打出 */
	const g2 = rules.action(g, 'Axis', 'use_national_skill', { drop: [id1], play: id2 })

	ok('弃掉的响应牌已离手', g2.hands['日本'].indexOf(id1) < 0,
		'hand=' + JSON.stringify(g2.hands['日本']))
	ok('弃掉的响应牌进了弃牌堆', (g2.discard['日本'] || []).indexOf(id1) >= 0,
		'discard=' + JSON.stringify(g2.discard['日本']))
	ok('打出的响应牌已离手', g2.hands['日本'].indexOf(id2) < 0,
		'hand=' + JSON.stringify(g2.hands['日本']))
	/* 关键：打出的牌是【暗置】到桌面，不是进弃牌堆 */
	ok('打出的响应牌进了【桌面暗置区】',
		(g2.table_responses || []).some(r => r.card_id === id2),
		'table=' + JSON.stringify(g2.table_responses))
	ok('暗置区数量 +1', (g2.table_responses || []).length === tblBefore + 1,
		'before=' + tblBefore + ' after=' + (g2.table_responses || []).length)
	ok('暗置条目带 owner_side=axis',
		(g2.table_responses || []).some(r => r.card_id === id2 && r.owner_side === 'axis'))
	ok('打出的响应牌【未】进弃牌堆（暗置≠弃牌）',
		(g2.discard['日本'] || []).indexOf(id2) < 0,
		'discard=' + JSON.stringify(g2.discard['日本']))
	ok('手牌减少 2 张（1 弃 + 1 打出）', g2.hands['日本'].length === before - 2,
		'before=' + before + ' after=' + g2.hands['日本'].length)
	/* 一步模式【不再】授予额外打出权（已经直接打出去了） */
	ok('一步模式不再授予 extra_play', !g2.extra_play,
		'extra_play=' + JSON.stringify(g2.extra_play))
	ok('本回合已标记用过', (g2.national_skill_used || {})['日本'] === g2.turn)
	ok('窗口已清除', !g2.national_skill_offer)
	ok('不占出牌名额', !g2.play_done['日本'], JSON.stringify(g2.play_done))
	const logTxt = (g2.log || []).map(x => String(x)).join(' | ')
	ok('日志含"暗置打出"', logTxt.indexOf('暗置打出') >= 0, logTxt)
}

console.log('\n=== 4b. 一步模式：同 1 张牌不能既作代价又打出 ===')
{
	const g = freshJp()
	g.hands['日本'] = [id1, id2]
	I.run_phase_entry(g, 'scoring', '日本')
	const g2 = rules.action(g, 'Axis', 'use_national_skill', { drop: [id1], play: id1 })
	ok('同一张牌既弃又打出 -> 被拒', !g2.table_responses ||
		!(g2.table_responses || []).some(r => r.card_id === id1),
		'table=' + JSON.stringify(g2.table_responses))
	ok('拒绝后手牌未变', g2.hands['日本'].length === 2, 'len=' + g2.hands['日本'].length)
	ok('拒绝后窗口仍在', !!g2.national_skill_offer)
}

console.log('\n=== 4c. 一步模式：只给 drop 不给 play -> 提示并拒绝 ===')
{
	const g = freshJp()
	g.hands['日本'] = [id1, id2]
	I.run_phase_entry(g, 'scoring', '日本')
	const g2 = rules.action(g, 'Axis', 'use_national_skill', { drop: [id1] })
	ok('缺 play -> 不结算（无暗置）',
		!(g2.table_responses || []).some(r => r.card_id === id2),
		'table=' + JSON.stringify(g2.table_responses))
	ok('缺 play -> 未标记用过', (g2.national_skill_used || {})['日本'] !== g2.turn)
	const logTxt = (g2.log || []).map(x => String(x)).join(' | ')
	ok('提示需要选要打出的响应牌', logTxt.indexOf('还需要选 1 张要打出的响应牌') >= 0, logTxt)
}

console.log('\n=== 5. 授予范围仍只认响应牌（防落回 return true）===')
{
	const g = freshJp()
	g.hands['日本'] = [id1, id2, 'x9#1']
	I.run_phase_entry(g, 'scoring', '日本')
	/*
	 * 【2026-10-05】日本改成一步模式后【不再】授予 extra_play，
	 * 但仍要守住 national_skill_grant_ok 的 filter='response' 判定
	 * （服务端用它校验 arg.play，漏配会让任何牌都能被打出）。
	 */
	const cfg = I.NATIONAL_SKILL ? I.NATIONAL_SKILL['日本'] : null
	ok('能取到日本技能配置', !!cfg, 'cfg=' + JSON.stringify(cfg))
	if (cfg) {
		ok('响应牌符合授予范围', I.national_skill_grant_ok(cfg, id1), 'card=' + id1)
		if (jpOther) {
			/*
			 * ⚠ 关键反例：若 grant.filter='response' 分支漏了，
			 *   会落到 `default: return true`，变成【任何牌】都能被打出
			 *   （英国那轮 filter=event_status 漏配就是同款）。
			 */
			ok('非响应牌【不】符合授予范围',
				!I.national_skill_grant_ok(cfg, jpOther.id + '#1'),
				'反例=' + jpOther.id + '(' + jpOther.type + ')')
			/* 一步模式里用非响应牌当 play -> 必须被拒 */
			const g2 = rules.action(g, 'Axis', 'use_national_skill',
				{ drop: [id1], play: jpOther.id + '#1' })
			ok('一步模式：非响应牌作 play -> 被拒',
				!(g2.table_responses || []).some(r => r.card_id === (jpOther.id + '#1')),
				'table=' + JSON.stringify(g2.table_responses))
		}
	}
}

console.log('\n=== 6. 代价类型不符 -> 服务端拒绝 ===')
{
	const g = freshJp()
	g.hands['日本'] = [id1, id2, 'x9#1']  /* x9 不是响应牌 */
	I.run_phase_entry(g, 'scoring', '日本')
	const g2 = rules.action(g, 'Axis', 'use_national_skill',
		{ drop: ['x9#1'], play: id2 })
	ok('用非响应牌当代价 -> 被拒（无暗置）',
		!(g2.table_responses || []).some(r => r.card_id === id2),
		'table=' + JSON.stringify(g2.table_responses))
	ok('手牌未变（未付代价）', g2.hands['日本'].length === 3,
		'len=' + g2.hands['日本'].length)
	ok('拒绝后窗口仍在', !!g2.national_skill_offer)
}

console.log('\n=== 7. 端到端（一步到位）：一次提交完成"弃 1 + 暗置 1"（不占名额）===')
{
	const g = freshJp()
	g.hands['日本'] = [id1, id2]
	I.run_phase_entry(g, 'scoring', '日本')
	/* 出牌名额先置为未完成，用来验证"不占名额" */
	g.play_done['日本'] = false
	const tblBefore = (g.table_responses || []).length
	/* 一步：同时给 drop 与 play */
	const g2 = rules.action(g, 'Axis', 'use_national_skill', { drop: [id1], play: id2 })
	ok('响应牌进入桌面暗置区', (g2.table_responses || []).length === tblBefore + 1,
		'table=' + JSON.stringify(g2.table_responses))
	ok('暗置的正是那张响应牌',
		(g2.table_responses || []).some(r => r.card_id === id2),
		'table=' + JSON.stringify(g2.table_responses))
	ok('暗置条目带 owner_side=axis',
		(g2.table_responses || []).some(r => r.card_id === id2 && r.owner_side === 'axis'))
	ok('已离手牌', g2.hands['日本'].indexOf(id2) < 0)
	ok('【未】进弃牌堆（暗置不是弃牌）', (g2.discard['日本'] || []).indexOf(id2) < 0,
		'discard=' + JSON.stringify(g2.discard['日本']))
	ok('【不占】出牌名额', !g2.play_done['日本'],
		'play_done=' + JSON.stringify(g2.play_done))
	const logTxt = (g2.log || []).map(x => String(x)).join(' | ')
	ok('日志留痕"暗置打出"', logTxt.indexOf('暗置打出') >= 0, logTxt)
}

console.log('\n=== 8. 一回合一次 ===')
{
	const g = freshJp()
	g.hands['日本'] = [id1, id2]
	I.run_phase_entry(g, 'scoring', '日本')
	rules.action(g, 'Axis', 'use_national_skill', { drop: [id1], play: id2 })
	ok('用过后本回合不可再用', !I.national_skill_usable(g, '日本'))
}

console.log('\n=== 9. 不使用 -> 窗口清除、手牌不变 ===')
{
	const g = freshJp()
	g.hands['日本'] = [id1, id2]
	I.run_phase_entry(g, 'scoring', '日本')
	const g2 = rules.action(g, 'Axis', 'skip_national_skill', {})
	ok('放弃后窗口清除', !g2.national_skill_offer)
	ok('放弃后手牌不变', g2.hands['日本'].length === 2, 'len=' + g2.hands['日本'].length)
	ok('放弃后无额外打出权', !g2.extra_play)
}

console.log('\n=== 10. 英国技能未受日本改动影响（仍是抽牌后 + 弃 3 任意）===')
{
	const ukEvent = CARDS.find(c => c.nation === '英国' && c.type === 'EVENT')
	ok('找得到英国 EVENT 样本', !!ukEvent)
	if (ukEvent) {
		const g = rules.setup(1)
		g.current_nation = '英国'; g.active = 'Allies'; g.turn_phase = 'draw'
		g.play_done = {}
		g.hands['英国'] = [ukEvent.id + '#1', 'a#1', 'b#1', 'c#1']
		g.decks['英国'] = []
		for (let k = 1; k <= 30; k++) g.decks['英国'].push('ukf' + k + '#1')
		g.national_skill_used = {}; g.national_skill_offer = null
		I.run_phase_entry(g, 'draw', '英国')
		ok('英国仍在【抽牌后】开窗', !!g.national_skill_offer,
			'offer=' + JSON.stringify(g.national_skill_offer))
		/* 英国在计分阶段【不该】开窗（触发点是 draw） */
		const g2 = rules.setup(1)
		g2.current_nation = '英国'; g2.active = 'Allies'; g2.turn_phase = 'scoring'
		g2.hands['英国'] = [ukEvent.id + '#1', 'a#1', 'b#1', 'c#1']
		g2.national_skill_used = {}; g2.national_skill_offer = null
		I.run_phase_entry(g2, 'scoring', '英国')
		ok('英国在【计分阶段】不开窗（触发点是 draw）', !g2.national_skill_offer,
			'offer=' + JSON.stringify(g2.national_skill_offer))
	}
	/* 日本在抽牌阶段【不该】开窗（触发点是 scoring） */
	const g3 = freshJp()
	g3.turn_phase = 'draw'
	g3.hands['日本'] = [id1, id2]
	I.run_phase_entry(g3, 'draw', '日本')
	ok('日本在【摸牌阶段】不开窗（触发点是 scoring）', !g3.national_skill_offer,
		'offer=' + JSON.stringify(g3.national_skill_offer))
}

console.log('\n=== 11. 客户端适配：view 必须下发 cost.filter（弃牌弹框按类型过滤靠它）===')
{
	const g = freshJp()
	g.hands['日本'] = [id1, id2]
	I.run_phase_entry(g, 'scoring', '日本')
	const v = rules.view(g, 'Axis')
	ok('view.national_skill 存在', !!v.national_skill)
	ok('cost.filter = response 已下发',
		v.national_skill && v.national_skill.cost && v.national_skill.cost.filter === 'response',
		JSON.stringify(v.national_skill && v.national_skill.cost))
	ok('cost.discard = 1 已下发',
		v.national_skill && v.national_skill.cost && v.national_skill.cost.discard === 1,
		JSON.stringify(v.national_skill && v.national_skill.cost))
	/* desc 必须是日本口径（含"响应牌"、"暗置"），不能是英国的"事件牌或状态卡" */
	const desc = (v.national_skill && v.national_skill.desc) || ''
	ok('desc 含"响应牌"（代价）', desc.indexOf('响应牌') >= 0, 'desc=' + desc)
	ok('desc 含"暗置"（效果）', desc.indexOf('暗置') >= 0, 'desc=' + desc)
	ok('desc 【不含】英国的"事件牌或状态卡"',
		desc.indexOf('事件牌或状态卡') < 0, 'desc=' + desc)
	/* 英国对照：filter 应为 undefined，desc 是英国口径 */
	const ukStatus = CARDS.find(c => c.nation === '英国' && c.type === 'STATUS')
	if (ukStatus) {
		const g2 = rules.setup(1)
		g2.current_nation = '英国'; g2.active = 'Allies'; g2.turn_phase = 'draw'
		g2.hands['英国'] = [ukStatus.id + '#1', 'a#1', 'b#1', 'c#1']
		g2.national_skill_used = {}; g2.national_skill_offer = null
		I.run_phase_entry(g2, 'draw', '英国')
		const v2 = rules.view(g2, 'Allies')
		const d2 = (v2.national_skill && v2.national_skill.desc) || ''
		ok('英国 desc 是"事件牌或状态卡"口径',
			d2.indexOf('事件牌或状态卡') >= 0, 'desc=' + d2)
		ok('英国 cost 无 filter（弃任意牌）',
			v2.national_skill && v2.national_skill.cost &&
			v2.national_skill.cost.filter === undefined,
			JSON.stringify(v2.national_skill && v2.national_skill.cost))
	}
}

console.log('\n=== 结果 ===')
console.log('PASS=' + pass + '  FAIL=' + fail)
process.exit(fail ? 1 : 0)
