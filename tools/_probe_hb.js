/* 探测：各国大本营 id、地区名->id，供 17749 轴心协定测试构造场景 */
const path = require('path')
const rules = require(path.join(__dirname, '..', 'server-official', 'public', 'quartermaster-sub-wars', 'rules.js'))
const M = require(path.join(__dirname, '..', 'server-official', 'public', 'quartermaster-sub-wars', 'data.js'))
const I = rules._internal
const data = M.data

const g = rules.setup(20260922, 'Standard', {})

console.log('=== 各国大本营（effective_home_base）===')
for (const n of ['意大利', '德国', '日本', '英国', '苏联', '美国', '法国', '中国']) {
	let hb = null, nm = null
	try { hb = I.effective_home_base(g, n) } catch (e) { hb = 'ERR:' + e.message }
	if (hb != null && data.spaces[hb]) nm = data.spaces[hb].name
	console.log('  ' + n + ' -> ' + hb + (nm ? ' (' + nm + ')' : ''))
}

console.log('\n=== 部分地区名->id ===')
const want = ['莫斯科', '东欧', '西欧', '巴尔干', '地中海', '中国东部', '英国', '伦敦']
if (M.SPACE) {
	for (const w of want) console.log('  SPACE[' + w + '] = ' + M.SPACE[w])
} else {
	console.log('  (no SPACE export)')
}

console.log('\n=== 意大利桌面/手牌结构 ===')
console.log('  table keys =', JSON.stringify(Object.keys(g.table || {})))
console.log('  hands keys =', JSON.stringify(Object.keys(g.hands || {})))
console.log('  score =', JSON.stringify(g.score))
console.log('  turn =', g.turn, ' current_nation =', g.current_nation)
