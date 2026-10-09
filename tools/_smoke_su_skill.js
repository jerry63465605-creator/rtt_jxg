/* 苏联国家技能回归测试（2026-10-06）
 * 玩家口径：【计分阶段】，手牌里有【建造陆军】（BASIC name=建设陆军）>=1 且【响应牌】>=1 时，
 *           可以弃 1 张建造陆军 -> 额外【暗置】（打出到桌面背面朝上）1 张响应牌。
 *
 * 与日本的差异（易搞混，务必分开测）：
 *   · 日本：弃【响应牌】1 张，暗置【响应牌】1 张（代价与效果同类型）
 *   · 苏联：弃【建造陆军】1 张，暗置【响应牌】1 张（代价与效果【不同】类型）
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

const suBuild = CARDS.find(c => c.nation === '苏联' && c.type === 'BASIC' && c.name === '建设陆军')
const suResp = CARDS.find(c => c.nation === '苏联' && c.type === 'RESPONSE')
ok('找得到苏联建造陆军卡（BASIC/建设陆军）', !!suBuild, suBuild ? suBuild.id : 'null')
ok('找得到苏联响应牌', !!suResp, suResp ? suResp.id : 'null')
if (!suBuild || !suResp) { console.log('\nPASS=' + pass + ' FAIL=' + fail); process.exit(1) }

const B = suBuild.id + '#1', R = suResp.id + '#1'
/* 非建造陆军、非响应的苏联卡（用于反例） */
const suOther = CARDS.find(c => c.nation === '苏联' && !(c.type === 'BASIC' && c.name === '建设陆军') && c.type !== 'RESPONSE')

function freshSu() {
	const g = rules.setup(1)
	g.current_nation = '苏联'
	g.active = 'Allies'
	g.turn_phase = 'scoring'
	g.play_done = {}
	g.hands['苏联'] = []
	g.decks['苏联'] = []
	for (let k = 1; k <= 30; k++) g.decks['苏联'].push('sufill' + k + '#1')
	g.discard['苏联'] = []
	g.table_responses = []
	g.national_skill_used = {}
	g.national_skill_offer = null
	g.extra_play = null
	return g
}

console.log('\n=== 1. 计分阶段：手牌有建造陆军 + 响应牌 -> 开窗 ===')
{
	const g = freshSu()
	g.hands['苏联'] = [B, R]          /* 1 建造陆军 + 1 响应 */
	I.run_phase_entry(g, 'scoring', '苏联')
	ok('建造陆军+响应 -> 开窗', !!g.national_skill_offer,
		'offer=' + JSON.stringify(g.national_skill_offer))
	ok('窗口归属苏联', g.national_skill_offer && g.national_skill_offer.nation === '苏联')
	ok('技能判定可用', I.national_skill_usable(g, '苏联'))
	ok('offer 带 cost.filter=build', g.national_skill_offer &&
		g.national_skill_offer.cost && g.national_skill_offer.cost.filter === 'build',
		JSON.stringify(g.national_skill_offer && g.national_skill_offer.cost))
	ok('日志文案写"建造陆军"', (g.log || []).join(' | ').indexOf('建造陆军') >= 0,
		(g.log || []).join(' | '))
}

console.log('\n=== 2. 只有建造陆军、没有响应 -> 不开窗（暗置无牌可打）===')
{
	const g = freshSu()
	g.hands['苏联'] = [B, 'x1#1', 'x2#1']   /* 有建造陆军但无响应 */
	I.run_phase_entry(g, 'scoring', '苏联')
	ok('无响应 -> 不开窗', !g.national_skill_offer,
		'offer=' + JSON.stringify(g.national_skill_offer))
	ok('不可用', !I.national_skill_usable(g, '苏联'))
}

console.log('\n=== 3. 只有响应、没有建造陆军 -> 不开窗（付不起代价）===')
{
	const g = freshSu()
	g.hands['苏联'] = [R, 'x1#1', 'x2#1']   /* 有响应但无建造陆军 */
	I.run_phase_entry(g, 'scoring', '苏联')
	ok('无建造陆军 -> 不开窗', !g.national_skill_offer,
		'offer=' + JSON.stringify(g.national_skill_offer))
	ok('不可用', !I.national_skill_usable(g, '苏联'))
}

console.log('\n=== 4. 一步到位：弃 1 建造陆军 + 暗置打出 1 响应牌，一次提交 ===')
{
	const g = freshSu()
	g.hands['苏联'] = [B, R]
	I.run_phase_entry(g, 'scoring', '苏联')
	const before = g.hands['苏联'].length
	const tblBefore = (g.table_responses || []).length
	const g2 = rules.action(g, 'Allies', 'use_national_skill', { drop: [B], play: R })

	ok('弃掉的建造陆军已离手', g2.hands['苏联'].indexOf(B) < 0,
		'hand=' + JSON.stringify(g2.hands['苏联']))
	ok('弃掉的建造陆军进了弃牌堆', (g2.discard['苏联'] || []).indexOf(B) >= 0,
		'discard=' + JSON.stringify(g2.discard['苏联']))
	ok('暗置打出的响应牌已离手', g2.hands['苏联'].indexOf(R) < 0,
		'hand=' + JSON.stringify(g2.hands['苏联']))
	ok('响应牌进了【桌面暗置区】',
		(g2.table_responses || []).some(r => r.card_id === R),
		'table=' + JSON.stringify(g2.table_responses))
	ok('暗置区数量 +1', (g2.table_responses || []).length === tblBefore + 1,
		'before=' + tblBefore + ' after=' + (g2.table_responses || []).length)
	ok('暗置条目带 owner_side=allies',
		(g2.table_responses || []).some(r => r.card_id === R && r.owner_side === 'allies'))
	ok('响应牌【未】进弃牌堆（暗置≠弃牌）',
		(g2.discard['苏联'] || []).indexOf(R) < 0,
		'discard=' + JSON.stringify(g2.discard['苏联']))
	ok('手牌减少 2 张（1 弃 + 1 打出）', g2.hands['苏联'].length === before - 2,
		'before=' + before + ' after=' + g2.hands['苏联'].length)
	ok('一步模式不再授予 extra_play', !g2.extra_play,
		'extra_play=' + JSON.stringify(g2.extra_play))
	ok('本回合已标记用过', (g2.national_skill_used || {})['苏联'] === g2.turn)
	ok('窗口已清除', !g2.national_skill_offer)
	ok('不占出牌名额', !g2.play_done['苏联'], JSON.stringify(g2.play_done))
	const logTxt = (g2.log || []).map(x => String(x)).join(' | ')
	ok('日志含"暗置打出"', logTxt.indexOf('暗置打出') >= 0, logTxt)
}

console.log('\n=== 4b. 同 1 张牌不能既作代价又打出 ===')
{
	const g = freshSu()
	g.hands['苏联'] = [B, R]
	I.run_phase_entry(g, 'scoring', '苏联')
	const g2 = rules.action(g, 'Allies', 'use_national_skill', { drop: [B], play: B })
	ok('同一张牌既弃又打出 -> 被拒', !g2.table_responses ||
		!(g2.table_responses || []).some(r => r.card_id === B),
		'table=' + JSON.stringify(g2.table_responses))
	ok('拒绝后手牌未变', g2.hands['苏联'].length === 2, 'len=' + g2.hands['苏联'].length)
	ok('拒绝后窗口仍在', !!g2.national_skill_offer)
}

console.log('\n=== 4c. 代价类型错（弃的是响应牌而非建造陆军）-> 被拒 ===')
{
	const g = freshSu()
	g.hands['苏联'] = [B, R, suOther ? suOther.id + '#1' : 'x9#1']
	I.run_phase_entry(g, 'scoring', '苏联')
	/* 故意把响应牌当代价弃掉，建造陆军当打出（类型不符） */
	const g2 = rules.action(g, 'Allies', 'use_national_skill', { drop: [R], play: B })
	ok('代价非建造陆军 -> 被拒', !g2.table_responses ||
		!(g2.table_responses || []).some(r => r.card_id === B),
		'table=' + JSON.stringify(g2.table_responses))
	ok('拒绝后窗口仍在', !!g2.national_skill_offer)
	const logTxt = (g2.log || []).map(x => String(x)).join(' | ')
	ok('提示代价类型不符', logTxt.indexOf('代价牌类型不符') >= 0, logTxt)
}

console.log('\n=== 5. 缺 play -> 提示并拒绝 ===')
{
	const g = freshSu()
	g.hands['苏联'] = [B, R]
	I.run_phase_entry(g, 'scoring', '苏联')
	const g2 = rules.action(g, 'Allies', 'use_national_skill', { drop: [B] })
	ok('缺 play -> 不结算（无暗置）',
		!(g2.table_responses || []).some(r => r.card_id === R),
		'table=' + JSON.stringify(g2.table_responses))
	ok('缺 play -> 未标记用过', (g2.national_skill_used || {})['苏联'] !== g2.turn)
}

console.log('\n=== 6. 跳过 -> 窗口清除（设计：仅成功使用才标记"本回合已用"，跳过=失去本次窗口）===')
{
	const g = freshSu()
	g.hands['苏联'] = [B, R]
	I.run_phase_entry(g, 'scoring', '苏联')
	ok('开窗', !!g.national_skill_offer)
	const g2 = rules.action(g, 'Allies', 'skip_national_skill', {})
	ok('跳过后窗口清除', !g2.national_skill_offer)
	ok('跳过后未标记用过（仅成功使用才标记）',
		(g2.national_skill_used || {})['苏联'] !== g2.turn)
	/* 同一计分阶段只进入一次，下列仅供回归：再次进入仍会重新评估（符合"每次触发=新窗口"策略） */
	const g3 = JSON.parse(JSON.stringify(g2))
	g3.national_skill_offer = null
	I.run_phase_entry(g3, 'scoring', '苏联')
	ok('再次进入计分阶段会重新评估（只要手牌仍满足）', !!g3.national_skill_offer)
}

console.log('\nPASS=' + pass + ' FAIL=' + fail)
process.exit(fail ? 1 : 0)
