/*
 * 体检「当前本地工作区里还留着哪些修复」
 * 用法：node tools/_audit_local_state.js
 */
const fs = require('fs')
const path = require('path')
const PUB = path.join(__dirname, '..', 'server-official', 'public')
const M = path.join(PUB, 'quartermaster-sub-wars')
const rd = p => { try { return fs.readFileSync(p, 'utf8') } catch (e) { return '' } }

const rules = rd(path.join(M, 'rules.js'))
const play = rd(path.join(M, 'play.js'))
const css = rd(path.join(M, 'play.css'))
const html = rd(path.join(M, 'play.html'))
const fonts = rd(path.join(PUB, 'fonts', 'fonts.css'))
const style = rd(path.join(PUB, 'style.css'))

const groups = [
	['服务端 rules.js（保留 ✅ / 已回退 ❌）', [
		['手牌保密 hand_viewer_for（17853/15410/kv2 不泄漏）', /function hand_viewer_for/, rules],
		['15315 影子盘面 willRemove（征召步有选择）', /const willRemove = \(already != null\)/, rules],
		['15315 连带同国空军（killedAirs 同步）', /连带消灭同格同国空军|killedAirs/, rules],
		['15355 armed run ok:false 不再静默吞代价', /未发动：/, rules],
		['15213 云雾：空军不能代受/不能撤离', /_airNoRetreat/, rules],
		['15213 云雾 air_no_retreat 下发', /air_no_retreat/, rules],
		['15213 复原口径（空军可复原，已按你要求回退禁复原）', /retreatAirsRestorable/, rules, true],
		['17543 雷达 声明式 ready', /ready\(game, ctx\) \{\s*\n\s*const nat = \(ctx && ctx\.piece_nation\)/, rules],
		['17543 arm_status_instant 征询 ready', /typeof cfg\.trigger\.ready === 'function'/, rules],
		['幽灵部队修复 restore_piece 兼容两套字段', /ctx\.piece_nation != null\) \? ctx\.piece_nation : ctx\.nation/, rules],
		['大清洗 view 字段阵营过滤 su_17817_pending', /game\.su_17817_pending && faction_of_nation\('苏联'\) === side/, rules],
		['大清洗 offer 阵营过滤 su_purge_offer', /su_purge_offer: !!\(game\.su_purge_offer[\s\S]{0,120}faction_of_nation\('苏联'\) === side\)/, rules],
		['大萧条 us_depression_offer 阵营过滤', /us_depression_offer:[\s\S]{0,160}faction_of_nation\('美国'\) === side/, rules],
		['su_purge_play/skip 权限门禁', /只有苏联阵营可以处理《大清洗》/, rules],
		['us_depression_use 权限门禁', /只有美国阵营可以处理《大萧条的余波》/, rules],
		['义勇军×百团大战 死锁：预算分支优先让权', /resolve_japan_delegate: 1/, rules],
		['BUDGET_ALLOWED 放行让权动作', /resolve_japan_delegate: 1, us_depression_discard: 1/, rules],
	]],
	['客户端 play.js / play.css（回退后应全部 ❌）', [
		['窄屏日志栏默认关（log_open narrow）', /if \(narrow\) \{\s*\n\s*log_open = false/, play],
		['日志栏自带关闭键 #log_close', /id="log_close"/, html],
		['refit 收敛 log_layout_open', /log_layout_open !== log_open/, play],
		['计分标记右上角（layout 尺寸+中心坐标）', /sp\.x \+ spW \/ 2/, play],
		['宽窄屏互斥 toggle 显隐', /is_narrow_screen\(\) && log_open/, play],
		['#budget_hud.hide 规则', /#budget_hud\.hide/, css],
		['SITE_PREFIX 自适应（本地已无需）', /location\.pathname[\s\S]{0,40}SITE_PREFIX/, html],
	]],
	['平台层 / 资源（保留 ✅）', [
		['fonts.css 无 /pre 绝对路径', /\/pre\/fonts/, fonts, true],
		['style.css 含中文回退字体（线上新版）', /Microsoft YaHei/, style],
		['play.html 资源带版本串 ?v=', /\?v=20261104g/, html],
		['map_lo.webp 存在', null, null],
	]],
]

for (const [title, items] of groups) {
	console.log('\n=== ' + title + ' ===')
	for (const [name, re, src, invert] of items) {
		if (re == null) {
			const ok = fs.existsSync(path.join(M, 'map_lo.webp'))
			console.log('  ' + (ok ? '✅' : '❌') + ' ' + name)
			continue
		}
		const hit = re.test(src)
		const ok = invert ? !hit : hit
		console.log('  ' + (ok ? '✅' : '❌') + ' ' + name)
	}
}
