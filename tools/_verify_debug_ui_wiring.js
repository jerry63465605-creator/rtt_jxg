/* 静态校验：调试卡牌/阶段面板的 HTML id ↔ JS getElementById ↔ 菜单 onclick ↔ CSS 选择器 */
const fs = require('fs')
const path = require('path')
const MOD = path.join(__dirname, '..', 'server-official', 'public', 'quartermaster-sub-wars')
const html = fs.readFileSync(path.join(MOD, 'play.html'), 'utf8')
const js = fs.readFileSync(path.join(MOD, 'play.js'), 'utf8')
const css = fs.readFileSync(path.join(MOD, 'play.css'), 'utf8')

let pass = 0, fail = 0
const ok = (m, c, extra) => {
	if (c) { pass++; console.log('  ✓ ' + m) }
	else { fail++; console.log('  ✗ ' + m + (extra ? '  | ' + extra : '')) }
}

console.log('\n=== 菜单入口 ===')
ok('菜单有「调试单位」', /onclick="toggle_debug\(\)">调试单位</.test(html))
ok('菜单有「调试卡牌」', /onclick="toggle_debug_cards\(\)">调试卡牌</.test(html))
ok('菜单有「调试阶段」', /onclick="toggle_debug_phase\(\)">调试阶段</.test(html))
ok('旧文案「调试面板」已不存在于菜单', html.indexOf('>调试面板</li>') < 0)

console.log('\n=== 面板 DOM ===')
for (const id of ['debug_card_panel', 'debug_phase_panel']) {
	ok('#' + id + ' 存在', html.indexOf('id="' + id + '"') >= 0)
	ok('#' + id + ' 默认 hide', new RegExp('id="' + id + '"[^>]*class="hide"').test(html) ||
		new RegExp('<div id="' + id + '" class="hide">').test(html))
	ok('#' + id + ' 有 CSS 样式', css.indexOf('#' + id) >= 0)
}
for (const id of ['dbg_card_nation', 'dbg_card_type', 'dbg_card_kw', 'dbg_card_hint', 'dbg_card_grid',
	'dbg_card_dest', 'dbg_phase_nation', 'dbg_phase_key', 'dbg_phase_hint']) {
	ok('#' + id + ' 在 HTML 中', html.indexOf('id="' + id + '"') >= 0)
}
for (const d of ['hand', 'deck_top', 'deck_bottom', 'discard']) {
	ok('去向选项 ' + d, new RegExp('<option value="' + d + '">').test(html))
}
ok('JS 读取 #dbg_card_dest', js.indexOf('dbg_card_dest') >= 0)
ok('JS 发送 dest 字段', js.indexOf('dest: dest') >= 0)

console.log('\n=== 关闭按钮（×）===')
for (const id of ['debug_panel', 'debug_card_panel', 'debug_phase_panel']) {
	ok('#' + id + ' 有 panel-close 按钮',
		new RegExp('class="panel-close"[^>]*onclick="close_debug_panel\\(\'' + id + '\'\\)"').test(html))
}
ok('close_debug_panel 函数存在', /function close_debug_panel\(/.test(js))
ok('CSS 有 .panel-close 样式', css.indexOf('.panel-close') >= 0)
ok('CSS 有 hover 反馈', /\.panel-close:hover/.test(css))

console.log('\n=== 类型下拉改为动态生成（修 ECHO/EFFECT 不匹配）===')
ok('面板只剩一个「全部」占位项',
	/dbg_card_type[\s\S]{0,200}?<option value="">全部<\/option>/.test(html))
ok('不再写死 value="ECHO"', html.indexOf('value="ECHO"') < 0)
ok('JS 有 populate_debug_card_types', /function populate_debug_card_types\(/.test(js))
ok('JS 用真实 type EFFECT 排序表', /DBG_TYPE_ORDER[\s\S]{0,120}?"EFFECT"/.test(js))
ok('on_reply 里先重建下拉再渲染',
	/populate_debug_card_types\(\)[\s\S]{0,80}?render_debug_cards\(\)/.test(js))

console.log('\n=== 调试卡牌网格 3 列 ===')
ok('grid 固定 3 列', /#debug_card_panel \.card-grid\s*\{[^}]*grid-template-columns:\s*repeat\(3,\s*1fr\)/.test(css),
	css.match(/#debug_card_panel \.card-grid[\s\S]{0,120}/))

console.log('\n=== JS 绑定 ===')
ok('toggle_debug_cards 定义', /function toggle_debug_cards\(/.test(js))
ok('toggle_debug_phase 定义', /function toggle_debug_phase\(/.test(js))
ok('render_debug_cards 定义', /function render_debug_cards\(/.test(js))
ok('debug_do_set_phase 定义', /function debug_do_set_phase\(/.test(js))
ok('send_query debug_card_catalog 调用', js.indexOf("send_query(\"debug_card_catalog\"") >= 0)
ok('send_action debug_add_card 调用', js.indexOf('"debug_add_card"') >= 0)
ok('send_action debug_set_phase 调用', js.indexOf('"debug_set_phase"') >= 0)
ok('on_reply 处理 debug_card_catalog', js.indexOf('q === "debug_card_catalog"') >= 0)

console.log('\n=== 阶段下拉 7 项且与 PHASES 一致 ===')
const PH = ['resource', 'play', 'airforce', 'supply', 'scoring', 'discard', 'draw']
/* 只在 #dbg_phase_key 这个 select 内部统计（去向下拉里也有 value="discard"，不能用全局正则） */
const phaseSelStart = html.indexOf('id="dbg_phase_key"')
const phaseSelEnd = html.indexOf('</select>', phaseSelStart)
const phaseSel = phaseSelStart >= 0 ? html.slice(phaseSelStart, phaseSelEnd) : ''
for (const k of PH) {
	ok('阶段项 ' + k + ' 存在', new RegExp('<option value="' + k + '">').test(phaseSel))
}
const m = phaseSel.match(/<option value="(resource|play|airforce|supply|scoring|discard|draw)">/g) || []
ok('恰好 7 个阶段项', m.length === 7, 'got ' + m.length)

console.log('\n=== 国家下拉含 8 国 ===')
for (const n of ['德国', '英国', '日本', '苏联', '意大利', '美国', '法国', '中国']) {
	ok('国家项 ' + n, new RegExp('<option value="' + n + '">').test(html))
}

console.log('\n' + (fail === 0 ? 'ALL PASS（' + pass + ' 项）' : fail + ' FAIL / ' + pass + ' pass'))
process.exitCode = fail ? 1 : 0
