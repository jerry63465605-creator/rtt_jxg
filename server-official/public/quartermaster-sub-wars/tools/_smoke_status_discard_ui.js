/*
 * 回归：状态卡「弃牌代价」的服务端/客户端一致性（2026-10-23）
 *
 * 现场症状：点 15356《地中海基地》弹窗后确认【无反应】。
 *
 * 根因链：
 *   ① 客户端 STATUS_UI 是【手写表】，15356 没登记 -> status_ui_of() 返回 {}
 *   ② ui.discard === undefined -> 跳过弃牌框，落到"通用确认框"
 *   ③ 点【确认发动】-> send_action('activate_status', { card })，【不带 discard】
 *   ④ 服务端 cost.discard 校验失败 -> log('请先选择要弃置的 2 张手牌') -> return
 *   ⑤ 客户端没有任何反馈 -> 表现为"弹窗后点了没反应"
 *
 * 修法与防线：
 *   · 服务端 view.table_status 每项下发 cost_discard（权威值）
 *   · 客户端 on_click_table_status 用 `ui.discard || c.cost_discard` 取张数（兜底）
 *   · 并补登记 STATUS_UI['15356']（保持静态表完整、语义清晰）
 *
 * 本测试锁死：
 *   A. 服务端凡有 trigger.cost.discard 的状态卡，客户端 STATUS_UI 必须登记同样张数
 *   B. view.table_status 下发的 cost_discard 与服务端配置一致
 *   C. 客户端仍有 `ui.discard || c.cost_discard` 兜底（防止只靠手写表又退化）
 *   D. 15356 的 effect.kind 仍是 build（不退回 recruit）
 *
 * 用法：node tools/_smoke_status_discard_ui.js
 */
const path = require('path')
const fs = require('fs')
const MOD = path.resolve(__dirname, '..')
const rules = require(path.join(MOD, 'rules.js'))
const I = rules._internal

const RULES_SRC = fs.readFileSync(path.join(MOD, 'rules.js'), 'utf8')
const PLAY_SRC = fs.readFileSync(path.join(MOD, 'play.js'), 'utf8')

let fail = 0
const ok = (label, cond, extra) => {
	console.log((cond ? '  PASS  ' : '  FAIL  ') + label + (extra !== undefined ? '  | ' + extra : ''))
	if (!cond) fail++
}

/* ---------- 从 rules.js 源码抽出「状态卡配置块」 ---------- */
function status_blocks(src) {
	const lines = src.split('\n')
	const blocks = []
	let cur = null
	for (let i = 0; i < lines.length; i++) {
		const m = lines[i].match(/^\t'(\d{5})':\s*\{/)
		if (m) {
			if (cur) blocks.push(cur)
			cur = { id: m[1], text: lines[i] }
			continue
		}
		if (cur) {
			/* 顶层闭合（行首 }）视为块结束 */
			if (/^\}/.test(lines[i])) { blocks.push(cur); cur = null; continue }
			cur.text += '\n' + lines[i]
		}
	}
	if (cur) blocks.push(cur)
	return blocks
}

const blocks = status_blocks(RULES_SRC)
const withDiscard = []
for (const b of blocks) {
	if (!/trigger:\s*\{/.test(b.text)) continue          /* 只看状态卡（有 trigger） */
	const cm = b.text.match(/cost:\s*\{([\s\S]{0,160}?)\}/)
	if (!cm) continue
	const dm = cm[1].match(/discard:\s*(\d+)/)
	if (dm && Number(dm[1]) > 0) withDiscard.push({ id: b.id, need: Number(dm[1]) })
}

console.log('=== A. 有弃牌代价的状态卡 -> 客户端 STATUS_UI 必须登记 ===')
{
	ok('扫描到带弃牌代价的状态卡', withDiscard.length > 0, withDiscard.map(x => x.id + '(' + x.need + ')').join(' '))
	for (const c of withDiscard) {
		const re = new RegExp("'" + c.id + "':\\s*\\{[^}]*\\bdiscard\\s*:\\s*" + c.need + "\\b")
		ok('STATUS_UI 登记 ' + c.id + ' discard=' + c.need, re.test(PLAY_SRC),
			re.test(PLAY_SRC) ? '' : '未登记（当前只靠服务端 cost_discard 兜底，建议补表）')
	}
}

console.log('\n=== B. view.table_status 下发 cost_discard ===')
{
	const g = rules.setup(901, rules.default_scenario, {})
	g.opening = null
	g.table['英国'] = ['15356#1']
	g.current_nation = '英国'
	g.active = 'Allies'
	g.turn_phase = 'play'
	const v = rules.view(g, 'Allies')
	const e = (v.table_status || []).find(x => String(x.card).indexOf('15356') === 0)
	ok('15356 在 table_status 里', !!e)
	ok('cost_discard = 2', e && e.cost_discard === 2, e && e.cost_discard)
	ok('同时带 ongoing 与 trigger 标记', e && e.ongoing === true && e.trigger === true,
		e && (e.ongoing + '/' + e.trigger))
}

console.log('\n=== C. 客户端保留服务端兜底（不只靠手写表） ===')
{
	ok('on_click_table_status 用 ui.discard || c.cost_discard',
		/ui\.discard\s*\|\|\s*c\.cost_discard/.test(PLAY_SRC))
	ok('兜底值传入 start_status_discard',
		/const discNeed = ui\.discard \|\| c\.cost_discard \|\| 0/.test(PLAY_SRC))
}

console.log('\n=== D. 15356 效果仍是 build（不退回 recruit） ===')
{
	ok("15356 effect.kind='build'",
		/effect: \{ kind: 'build', nation: '英国', type: 'navy', space: '地中海' \}/.test(RULES_SRC))
	const g = rules.setup(902, rules.default_scenario, {})
	g.opening = null
	g.table['英国'] = ['15356#1']
	g.current_nation = '英国'
	g.active = 'Allies'
	g.turn_phase = 'play'
	const cfg = I.status_config_of('15356#1')
	ok('配置层 kind=build', cfg && cfg.trigger && cfg.trigger.effect.kind === 'build',
		cfg && cfg.trigger && cfg.trigger.effect.kind)
	ok('配置层 cost.discard=2', cfg && cfg.trigger.cost.discard === 2)
	ok('配置层 cost.skip_play=true', cfg && cfg.trigger.cost.skip_play === true)
}

console.log('\n----------------------------------------')
if (fail) {
	console.log('SOME ' + fail + ' FAILED')
	process.exit(1)
}
console.log('ALL PASS')
