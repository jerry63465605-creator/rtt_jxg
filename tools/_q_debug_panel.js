/* 调研：15239 战略规划的选牌实现 / 卡片实例 id 分配 / 现有 debug 面板结构 */
const fs = require('fs')
const path = require('path')
const MOD = path.join(__dirname, '..', 'server-official', 'public', 'quartermaster-sub-wars')
const src = fs.readFileSync(path.join(MOD, 'rules.js'), 'utf8').split('\n')

function show(re, label, limit) {
	console.log('\n=== ' + label + ' ===')
	let n = 0
	src.forEach((l, i) => {
		if (n >= (limit || 12)) return
		if (re.test(l)) { console.log((i + 1) + ': ' + l.trim().slice(0, 130)); n++ }
	})
	if (!n) console.log('  （无命中）')
}

show(/15239/, '15239 战略规划')
show(/next_inst|new_inst|inst_seq|mk_inst|alloc_inst/, '实例 id 分配器')
show(/deck_pick|pending_deck|search_deck|grab_from_deck/, '选牌/牌堆挑选')
show(/function draw_cards/, 'draw_cards')

/* 客户端 debug 面板 html 结构 */
const html = fs.readFileSync(path.join(MOD, 'play.html'), 'utf8').split('\n')
console.log('\n=== play.html 调试面板区块 ===')
const start = html.findIndex(l => l.indexOf('id="debug_panel"') >= 0)
console.log(html.slice(start - 2, start + 36).map((l, k) => (start - 1 + k) + ': ' + l).join('\n'))
