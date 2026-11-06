/* 盘点「最近提到过、但尚未修复」的问题：用代码标记判断修没修 */
const fs = require('fs')
const path = require('path')
const ROOT = path.join(__dirname, '..')
const M = path.join(ROOT, 'server-official', 'public', 'quartermaster-sub-wars')
const PUB = path.join(ROOT, 'server-official', 'public')
const rd = p => { try { return fs.readFileSync(p, 'utf8') } catch (e) { return '' } }

const rules = rd(path.join(M, 'rules.js'))
const play = rd(path.join(M, 'play.js'))
const html = rd(path.join(M, 'play.html'))
const css = rd(path.join(M, 'play.css'))
const todo = rd(path.join(ROOT, 'docs', 'todo-2026-10-29.md'))

const check = (name, re, src, expectFixed) => {
	const hit = re.test(src)
	const fixed = expectFixed ? hit : !hit
	console.log('  ' + (fixed ? '✅ 已修/已在' : '❌ 未修') + '  ' + name)
}

console.log('=== 1. 客户端（外部交付的窄屏浮层）===')
check('窄屏日志栏默认关 + 不写 localStorage', /if \(narrow\) \{\s*\n\s*log_open = false/, play, true)
check('日志面板自带关闭键 #log_close', /id="log_close"/, html, true)
check('窄屏日志/侧栏互斥（开一个关另一个）', /is_narrow_screen\(\) && log_open/, play, true)
check('refit 收敛（只在开合变化时重排地图）', /log_layout_open !== log_open/, play, true)
check('计分标记钉格位右上角（实测宽度+layout 尺寸）', /layout\[data\.name_of\(space_id\)\]/, play, true)

console.log('\n=== 2. 服务端规则 ===')
check('17848 状态卡一回合多次：记账前置（run 之前写 status_used）', /status_used\[[^\]]+\] = freq_key\(game\)[\s\S]{0,200}?run_status_effect/, rules, true)
check('17848 卡 id 归一（写/读统一实例 id）', /activate_status[\s\S]{0,400}inst_card_id\(cardId\)/, rules, true)
check('freq_key 稳定化（game.turn_owner）', /turn_owner/, rules, true)
check('activate_status 失败回滚 attrition 代价', /回滚.*attrition|attrition.*回滚/, rules, true)
check('delegate / it_delegate / pending_autobahn 阵营收敛（hand_viewer 式）', /delegate[\s\S]{0,80}faction_of_nation/, rules, true)

console.log('\n=== 3. 已确认不是 bug（排查结论）===')
check('（说明）remaining<=0 客户端会清高亮 —— 属设计，不是 bug', /eb\.remaining <= 0/, play, true)
check('（说明）空 echo_need 框已根治（S1+S2）', /is_empty_echo_frame/, rules, true)

console.log('\n=== 4. 待办清单里仍挂着的条目 ===')
const lines = todo.split('\n')
const open = lines.filter(l => /^\s*[-*]\s*\[ \]/.test(l) || /待办：/.test(l))
open.slice(0, 12).forEach(l => console.log('  · ' + l.replace(/^\s*[-*]\s*(\[[ x]\])?\s*/, '').slice(0, 110)))
