/*
 * 15353《保持冷静·继续前进》× 被拦状态卡的「已发动」标记
 *
 * 卡面（15353）：敌方国家发动[状态卡]效果时，弃置 1 张手牌：使其在本回合中无效。
 * 玩家口径：**拦住之后，那张被拦的状态卡应当被标记为「已发动」**
 *           （本次发动机会被消耗，卡面显示"已发动"、不能当没发生过再试）。
 *
 * 现状（读码）：15353 的 run 只记 status_suppressed_this_turn[cid] = freq_key，
 *               不写 status_used -> view.table_status.used_this_turn 仍 false，
 *               客户端一直显示"未发动"；once_per_turn 的卡 ready 也不会变灰。
 */
const path = require('path')
const MOD = path.join(__dirname, '..', 'server-official', 'public', 'quartermaster-sub-wars')
const rules = require(path.join(MOD, 'rules.js'))
const I = rules._internal

const CALM = '15353#1'          /* 英国 保持冷静·继续前进 */
const DE_STATUS = '15255#1'     /* 德国 征兵（play_start，skip_play 代价，无 once_per_turn） */

let bad = 0
const flag = (name, ok, extra) => {
	console.log((ok ? '  ✓ ' : '  ✗ ') + name + (extra ? '   [' + extra + ']' : ''))
	if (!ok) bad++
}
const info = (k, v) => console.log('    ' + k + ' =', typeof v === 'object' ? JSON.stringify(v) : v)
const fk = g => g.turn + ':' + (g.current_nation || '')

function freshGame() {
	const g = rules.setup(1)
	g.opening = null
	g.current_nation = '德国'
	g.active = 'Axis'
	g.turn_phase = 'play'
	g.table = { '德国': [DE_STATUS] }
	g.play_done = {}
	g.skip_play_done = {}
	g.armed_offers = []
	/* 英国手牌：15353 + 一张弃牌素材 */
	const keep = (g.hands['英国'] || [])[0]
	g.hands['英国'] = [CALM, keep]
	return { g, keep }
}

function deStatus(g) {
	const st = (rules.view(g, 'Axis').table_status || []).find(s => s.card === DE_STATUS)
	return st || {}
}

console.log('=== S1 德国发动 15255 -> 英国用 15353 拦截 ===')
{
	const { g, keep } = freshGame()
	info('拦截前 15255 ready / used', [deStatus(g).ready, deStatus(g).used_this_turn])

	const before = g.log.length
	rules.action(g, 'Axis', 'activate_status', { card: DE_STATUS })
	info('activate_status 新增日志', g.log.slice(before))
	const hasWindow = (g.armed_offers || []).some(w => w.when === 'enemy_status_effect')
	flag('派发了 enemy_status_effect 拦截窗口', hasWindow, 'offers=' + (g.armed_offers || []).length)
	flag('被拦截时状态卡效果尚未执行（play_done 为空）',
		!g.play_done['德国'], JSON.stringify(g.play_done))

	const b2 = g.log.length
	rules.action(g, 'Allies', 'use_armed_offer', { card: CALM, drop: [keep] })
	info('英国拦截新增日志', g.log.slice(b2))
	info('status_suppressed_this_turn', g.status_suppressed_this_turn)
	info('status_used', g.status_used)
	info('拦截后 15255 ready / used', [deStatus(g).ready, deStatus(g).used_this_turn])

	flag('已记下本回合压制', (g.status_suppressed_this_turn || {})[DE_STATUS] === fk(g),
		'suppressed=' + JSON.stringify(g.status_suppressed_this_turn))
	/* ★ 本次要修的判据 */
	flag('★ 被拦的状态卡应标记为已发动（status_used）',
		(g.status_used || {})[DE_STATUS] === fk(g), 'status_used=' + JSON.stringify(g.status_used))
	flag('★ view 下发的 used_this_turn 应为 true', deStatus(g).used_this_turn === true,
		'实际=' + deStatus(g).used_this_turn)
	/* 没有 once_per_turn 的卡（15255）不会因 status_used 关窗，必须靠压制判定关窗 */
	flag('★ 拦截后窗口关闭（不再是"亮着但点了被拒"）', deStatus(g).ready === false,
		'实际 ready=' + deStatus(g).ready + ' reason=' + deStatus(g).ready_reason)
	flag('状态卡仍留在桌面（被无效，不弃置）',
		(g.table['德国'] || []).indexOf(DE_STATUS) >= 0, JSON.stringify(g.table['德国']))
	flag('德国没有因此白付代价（play_done 仍空）', !g.play_done['德国'], JSON.stringify(g.play_done))

	console.log('\n=== S2 德国再点这张卡：应被明确拒绝且不产生效果 ===')
	{
		const b = g.log.length
		rules.action(g, 'Axis', 'activate_status', { card: DE_STATUS })
		info('新增日志', g.log.slice(b))
		flag('提示已被《保持冷静》压制', /压制|已经发动过/.test(g.log.slice(b).join('|')),
			g.log.slice(b).join(' | ').slice(0, 90))
		flag('仍未生效（play_done 仍空）', !g.play_done['德国'], JSON.stringify(g.play_done))
	}
}

console.log('\n=== S3 对照：英国放弃拦截 -> 不该标"已发动" ===')
{
	const { g } = freshGame()
	rules.action(g, 'Axis', 'activate_status', { card: DE_STATUS })
	flag('先有拦截窗口', (g.armed_offers || []).some(w => w.when === 'enemy_status_effect'))
	rules.action(g, 'Allies', 'skip_armed_offer', {})
	info('放行后 15255 used / ready', [deStatus(g).used_this_turn, deStatus(g).ready])
	flag('放行不算"被拦"（suppressed 未写）',
		!(g.status_suppressed_this_turn || {})[DE_STATUS], JSON.stringify(g.status_suppressed_this_turn || {}))
	/* 放行后德国照常发动，此后 status_used 由正常结算写入，内容应体现"发动过" */
	info('放行后 play_done', g.play_done)
}

console.log('\n=== S4 防御：历史/半途状态（只有压制、没有 used）再点也应补标已发动 ===')
{
	const { g } = freshGame()
	/* 模拟"旧存档/旧代码"留下的状态：只记了压制 */
	g.status_suppressed_this_turn = { [DE_STATUS]: fk(g) }
	rules.action(g, 'Axis', 'activate_status', { card: DE_STATUS })
	info('status_used', g.status_used)
	flag('再次被拦时补标 status_used', (g.status_used || {})[DE_STATUS] === fk(g),
		'status_used=' + JSON.stringify(g.status_used))
	flag('view used_this_turn 随之为 true', deStatus(g).used_this_turn === true,
		'实际=' + deStatus(g).used_this_turn)
}

console.log('\n发现 BUG 项 = ' + bad)
