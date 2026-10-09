/* 英国国家技能回归测试（2026-10-01）
 * 口径：英国【抽牌后】开窗 -> 弃 3 张手牌 -> 打出 1 张事件牌或状态牌（不占出牌名额）
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

/* 找英国卡：1 张 EVENT + 1 张 STATUS */
const ukEvent = CARDS.find(c => c.nation === '英国' && c.type === 'EVENT')
const ukStatus = CARDS.find(c => c.nation === '英国' && c.type === 'STATUS')
console.log('英国 EVENT 样本:', ukEvent && ukEvent.id, ukEvent && ukEvent.name)
console.log('英国 STATUS 样本:', ukStatus && ukStatus.id, ukStatus && ukStatus.name)
ok('找得到英国 EVENT 卡样本', !!ukEvent)
ok('找得到英国 STATUS 卡样本', !!ukStatus)
if (!ukEvent || !ukStatus) { console.log('\nPASS=' + pass + ' FAIL=' + fail); process.exit(1) }

function freshUk() {
	const g = rules.setup(1)
	g.current_nation = '英国'
	g.active = 'Allies'
	g.turn_phase = 'draw'
	g.play_done = {}
	g.hands['英国'] = []
	g.decks['英国'] = []
	for (let k = 1; k <= 30; k++) g.decks['英国'].push('ukfill' + k + '#1')
	g.discard['英国'] = []
	g.national_skill_used = {}
	g.national_skill_offer = null
	return g
}

console.log('\n=== 1. 抽牌后开窗 ===')
{
	const g = freshUk()
	/* 手牌 5 张：1 张 EVENT + 1 张 STATUS + 3 张任意（当弃牌代价） */
	g.hands['英国'] = [
		ukEvent.id + '#1', ukStatus.id + '#1',
		'fillerA#1', 'fillerB#1', 'fillerC#1',
	]
	I.run_phase_entry(g, 'draw', '英国')
	ok('抽牌后开出英国国家技能窗口', !!g.national_skill_offer,
		'offer=' + JSON.stringify(g.national_skill_offer))
	ok('窗口归属英国', g.national_skill_offer && g.national_skill_offer.nation === '英国')
	ok('技能判定可用', I.national_skill_usable(g, '英国'))
}

console.log('\n=== 2. 弃完会没牌可打时不可用（直接验 usable，不走摸牌补牌）===')
{
	const g = freshUk()
	/* 只有 3 张：弃 3 张后手上空了，付了代价却没牌可打 = 亏本，不该给窗口 */
	g.hands['英国'] = [ukEvent.id + '#1', 'fillerA#1', 'fillerB#1']
	ok('手牌 3 张（弃完无牌可打）-> 不可用', !I.national_skill_usable(g, '英国'),
		'hand=' + g.hands['英国'].length)
	/* 4 张：弃 3 张后还剩 1 张 EVENT，可行 */
	g.hands['英国'] = [ukEvent.id + '#1', 'fillerA#1', 'fillerB#1', 'fillerC#1']
	ok('手牌 4 张（弃完还剩 1 张可打）-> 可用', I.national_skill_usable(g, '英国'),
		'hand=' + g.hands['英国'].length)
}

console.log('\n=== 3. 使用技能：弃 3 张手牌 -> 获得额外打出权 ===')
{
	const g = freshUk()
	g.hands['英国'] = [
		ukEvent.id + '#1', ukStatus.id + '#1',
		'fillerA#1', 'fillerB#1', 'fillerC#1',
	]
	I.run_phase_entry(g, 'draw', '英国')   /* 摸牌阶段会把手牌补到 7 张 */
	const handAfter = g.hands['英国'].slice()
	const before = handAfter.length
	const keepSet = [ukEvent.id + '#1', ukStatus.id + '#1']
	/* 从补牌后的实际手牌里挑 3 张非目标牌作代价 */
	const drop = handAfter.filter(id => keepSet.indexOf(id) < 0).slice(0, 3)
	ok('摸牌后手牌补到 7 张', before === 7, 'len=' + before)
	ok('能挑出 3 张代价牌', drop.length === 3, 'drop=' + JSON.stringify(drop))
	const g2 = rules.action(g, 'Allies', 'use_national_skill', { drop: drop })
	ok('弃掉指定的 3 张', drop.every(d => g2.hands['英国'].indexOf(d) < 0),
		'hand=' + JSON.stringify(g2.hands['英国']))
	ok('手牌恰好减少 3 张', g2.hands['英国'].length === before - 3,
		'before=' + before + ' after=' + g2.hands['英国'].length)
	ok('获得额外打出权', !!g2.extra_play, 'extra_play=' + JSON.stringify(g2.extra_play))
	ok('额外打出归属英国', g2.extra_play && g2.extra_play.nation === '英国')
	ok('本回合已标记用过', (g2.national_skill_used || {})['英国'] === g2.turn)
	ok('窗口已清除', !g2.national_skill_offer)
	ok('被弃的 3 张进了弃牌堆', drop.every(d => (g2.discard['英国'] || []).indexOf(d) >= 0),
		'discard=' + JSON.stringify(g2.discard['英国']))
	/* 保留下来的两张应仍在手上 */
	ok('保留 EVENT 与 STATUS',
		g2.hands['英国'].indexOf(ukEvent.id + '#1') >= 0 &&
		g2.hands['英国'].indexOf(ukStatus.id + '#1') >= 0)
}

console.log('\n=== 4. 重复使用：一回合一次 ===')
{
	const g = freshUk()
	g.hands['英国'] = [
		ukEvent.id + '#1', ukStatus.id + '#1',
		'fillerA#1', 'fillerB#1', 'fillerC#1',
	]
	I.run_phase_entry(g, 'draw', '英国')
	rules.action(g, 'Allies', 'use_national_skill', { drop: ['fillerA#1', 'fillerB#1', 'fillerC#1'] })
	ok('用过后本回合不可再用', !I.national_skill_usable(g, '英国'))
}

console.log('\n=== 5. drop 数量不对 -> 拒绝且状态不变 ===')
{
	const g = freshUk()
	g.hands['英国'] = [
		ukEvent.id + '#1', ukStatus.id + '#1',
		'fillerA#1', 'fillerB#1', 'fillerC#1',
	]
	I.run_phase_entry(g, 'draw', '英国')
	const handAfter = g.hands['英国'].length
	const g2 = rules.action(g, 'Allies', 'use_national_skill', { drop: ['fillerA#1'] })
	ok('只给 1 张 -> 拒绝（手牌数不变）', g2.hands['英国'].length === handAfter,
		'before=' + handAfter + ' after=' + g2.hands['英国'].length)
	ok('拒绝后未获得额外打出权', !g2.extra_play)
	ok('拒绝后窗口仍在', !!g2.national_skill_offer)
}

console.log('\n=== 6. 不使用 -> 窗口清除、手牌不变 ===')
{
	const g = freshUk()
	g.hands['英国'] = [
		ukEvent.id + '#1', ukStatus.id + '#1',
		'fillerA#1', 'fillerB#1', 'fillerC#1',
	]
	I.run_phase_entry(g, 'draw', '英国')
	const handAfter = g.hands['英国'].length
	const g2 = rules.action(g, 'Allies', 'skip_national_skill', {})
	ok('放弃后窗口清除', !g2.national_skill_offer)
	ok('放弃后手牌不变', g2.hands['英国'].length === handAfter,
		'before=' + handAfter + ' after=' + g2.hands['英国'].length)
	ok('放弃后无额外打出权', !g2.extra_play)
}

console.log('\n=== 7. 获得技能后实际打出（extra_play 通道）===')
{
	const g = freshUk()
	g.hands['英国'] = [
		ukEvent.id + '#1', ukStatus.id + '#1',
		'fillerA#1', 'fillerB#1', 'fillerC#1',
	]
	I.run_phase_entry(g, 'draw', '英国')
	const handAfter = g.hands['英国'].slice()
	const keepSet = [ukEvent.id + '#1', ukStatus.id + '#1']
	const drop = handAfter.filter(id => keepSet.indexOf(id) < 0).slice(0, 3)
	rules.action(g, 'Allies', 'use_national_skill', { drop: drop })
	ok('已获得额外打出权', !!g.extra_play, JSON.stringify(g.extra_play))

	/* extra_play_allows 必须限定 EVENT / STATUS，不能放行任意卡 */
	const fidEvent = String(ukEvent.id), fidStatus = String(ukStatus.id)
	ok('允许额外打出【事件牌】', I.extra_play_allows(g, '英国', fidEvent))
	ok('允许额外打出【状态牌】', I.extra_play_allows(g, '英国', fidStatus))
	const deStatus = CARDS.find(c => c.nation === '德国' && c.type === 'STATUS')
	/* 找一张英国的【非 EVENT 非 STATUS】卡（如 BASIC / ECON / RESPONSE）当反例 */
	const ukOther = CARDS.find(c => c.nation === '英国' &&
		c.type !== 'EVENT' && c.type !== 'STATUS')
	ok('找得到英国非 EVENT/STATUS 反例卡', !!ukOther,
		ukOther ? (ukOther.id + ' ' + ukOther.type + ' ' + ukOther.name) : 'none')
	if (ukOther) {
		/*
		 * ⚠ 这是本轮修掉的 bug：extra_play_allows 原先没有 event_status 分支，
		 *   会落到末尾 `return true`，于是【任何手牌】都能额外打出。
		 */
		ok('【不】允许额外打出非 EVENT/STATUS 的卡',
			!I.extra_play_allows(g, '英国', String(ukOther.id)),
			'反例=' + ukOther.id + '(' + ukOther.type + ')')
	}
	/* 德国的 status filter 未受影响 */
	if (deStatus) {
		g.extra_play.filter = 'status'
		ok('德国 filter=status 仍只放行状态卡',
			I.extra_play_allows(g, '英国', String(deStatus.id)) &&
			!I.extra_play_allows(g, '英国', fidEvent))
		g.extra_play.filter = 'event_status'
	}
}

console.log('\n=== 9. 端到端：摸牌阶段【当场打出】1 张事件牌 ===')
{
	const g = freshUk()
	g.hands['英国'] = [
		ukEvent.id + '#1', ukStatus.id + '#1',
		'fillerA#1', 'fillerB#1', 'fillerC#1',
	]
	I.run_phase_entry(g, 'draw', '英国')
	const keepSet = [ukEvent.id + '#1', ukStatus.id + '#1']
	const drop = g.hands['英国'].filter(id => keepSet.indexOf(id) < 0).slice(0, 3)
	rules.action(g, 'Allies', 'use_national_skill', { drop: drop })
	ok('仍在摸牌阶段', g.turn_phase === 'draw', 'phase=' + g.turn_phase)
	ok('摸牌阶段仍持有额外打出权（phase 已对齐 draw）', I.has_extra_play(g, '英国'),
		'extra_play=' + JSON.stringify(g.extra_play))

	const g2 = rules.action(g, 'Allies', 'play_card', { card: ukEvent.id + '#1' })
	const logTxt = (g2.log || []).map(x => String(x)).join(' | ')
	/*
	 * 判据用【日志】而非猜 pending 字段名：
	 * 事件卡常需要玩家再选目标/选项，会停在 pending 而不立刻进弃牌堆，
	 * 但日志一定会留下"因《…》的【额外打出】"，这正是我们要验证的通道。
	 */
	ok('走了【额外打出】通道（日志留痕）', logTxt.indexOf('额外打出') >= 0, logTxt)
	ok('【未】被"只能在出牌阶段打出"拒绝',
		logTxt.indexOf('只能在出牌阶段打出') < 0, logTxt)
	ok('额外打出权已被消耗或已进入打出流程',
		!g2.extra_play || logTxt.indexOf('额外打出') >= 0,
		'extra_play=' + JSON.stringify(g2.extra_play))
}

console.log('\n=== 10. 德国技能未受影响（★卡 + 损耗 1 + 状态卡）===')
{
	const g = rules.setup(1)
	g.current_nation = '德国'
	g.active = 'Axis'
	g.turn_phase = 'play'
	g.play_done = {}
	g.hands['德国'] = []
	g.decks['德国'] = []
	for (let k = 1; k <= 30; k++) g.decks['德国'].push('defill' + k + '#1')
	g.national_skill_used = {}
	const deStatus = CARDS.find(c => c.nation === '德国' && c.type === 'STATUS')
	ok('找得到德国 STATUS 样本', !!deStatus)
	if (deStatus) {
		g.hands['德国'] = [deStatus.id + '#1']
		/* 德国触发是 star_resolved，且代价是损耗 */
		ok('德国技能触发点仍是 star_resolved',
			I.NATIONAL_SKILL && I.NATIONAL_SKILL['德国'] &&
			I.NATIONAL_SKILL['德国'].trigger === 'star_resolved')
		/* 抽牌阶段不应给德国开窗（德国不是 draw 触发） */
		g.turn_phase = 'draw'
		I.run_phase_entry(g, 'draw', '德国')
		ok('德国在摸牌阶段【不】开窗（触发点是 star_resolved）', !g.national_skill_offer,
			'offer=' + JSON.stringify(g.national_skill_offer))
	}
}

console.log('\n=== 结果 ===')
console.log('PASS=' + pass + '  FAIL=' + fail)
process.exit(fail ? 1 : 0)
