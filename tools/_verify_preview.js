/*
 * 模拟预览页在浏览器里的模块加载逻辑（用 fs 代替 fetch），
 * 验证：shim 能跑通、EVENT_EFFECTS 可取到、描述能生成。
 */
const fs = require('fs')
const path = require('path')
const DIR = path.join(__dirname, '..', 'server-official', 'public', 'quartermaster-sub-wars')

const MODULES = {}
function runModule(name, code) {
	const module = { exports: {} }
	const require = (p) => {
		const key = String(p).replace(/^\.\//, '')
		if (!MODULES[key]) throw new Error('模块未加载: ' + p)
		return MODULES[key]
	}
	const fn = new Function('module', 'exports', 'require', code)
	fn(module, module.exports, require)
	MODULES[name] = module.exports
	return module.exports
}

for (const name of ['data.js', 'cards.js', 'rules.js']) {
	runModule(name, fs.readFileSync(path.join(DIR, name), 'utf8'))
}

const DATA = MODULES['data.js']
const CARDS = MODULES['cards.js'].CARDS || []
const TYPE_INFO = MODULES['cards.js'].CARD_TYPE_INFO || {}
const I = MODULES['rules.js']._internal

console.log('模块加载 OK')
console.log('  卡牌总数:', CARDS.length)
console.log('  _internal 可取:', !!I)
console.log('  EVENT_EFFECTS 条目:', Object.keys(I.EVENT_EFFECTS).length)
console.log('  event_step_label 可用:', typeof I.event_step_label === 'function')
console.log('  name_of 可用:', typeof DATA.data.name_of === 'function')

/* 复刻页面里的 descOfStep */
function descOfStep(st) {
	let head = I.event_step_label(st)
	const bits = []
	const nameOf = (id) => DATA.data.name_of(id)
	if (st.op === 'ongoing') {
		bits.push('标记 ' + st.flag + '（保护区：' + (st.spaces || []).map(nameOf).join('、') + '）')
	} else if (st.spaces && st.spaces.length) {
		const names = st.spaces.map(id => nameOf(id) + '(' + id + ')')
		if (st.pick > 1) bits.push('从 ' + names.join(' / ') + ' 中选 ' + st.pick + ' 个，各执行一次')
		else bits.push(names.join(' / ') + (names.length > 1 ? '　玩家选一' : ''))
	} else {
		bits.push('地区由规则决定（玩家在合法位置中选）')
	}
	if (st.grantSupply) bits.push('并授予本回合补给')
	if (st.useNewPiece) bits.push('用刚创建的那支部队')
	return head + ' ＠ ' + bits.join('，')
}

console.log('\n=== 各类型数量 ===')
const counts = {}
CARDS.forEach(c => { counts[c.type] = (counts[c.type] || 0) + 1 })
console.log(JSON.stringify(counts))

console.log('\n=== 15 张 EVENT 卡渲染预览 ===')
CARDS.filter(c => c.type === 'EVENT')
	.sort((a, b) => String(a.id).localeCompare(String(b.id)))
	.forEach(c => {
		const eff = I.EVENT_EFFECTS[String(c.id)]
		console.log('\n' + c.id + ' ' + c.name + '  [actor=' + (eff ? eff.actor : '-') + ']')
		console.log('  卡面: ' + c.text)
		if (!eff) { console.log('  >> 尚未实现'); return }
		if (eff.choice) {
			eff.choice.forEach((steps, i) =>
				console.log('  ' + (i + 1) + '. ' + steps.map(descOfStep).join('  →  ')))
		} else {
			(eff.steps || []).forEach((s, i) =>
				console.log('  ' + (eff.steps.length > 1 ? (i + 1) + '. ' : '') + descOfStep(s)))
		}
	})

console.log('\n=== 抽查：EFFECT(增强) 8 张应全部"尚未实现" ===')
CARDS.filter(c => c.type === 'EFFECT')
	.sort((a, b) => String(a.id).localeCompare(String(b.id)))
	.forEach(c => {
		const eff = I.EVENT_EFFECTS[String(c.id)]
		console.log('  ' + c.id + ' ' + c.name + ' -> ' + (eff ? '有配置(异常!)' : '尚未实现 OK'))
	})

console.log('\n=== 检查：是否有配置了但卡不存在的条目 ===')
const ids = new Set(CARDS.map(c => String(c.id)))
for (const k of Object.keys(I.EVENT_EFFECTS)) {
	if (!ids.has(k)) console.log('  孤儿配置: ' + k)
}
console.log('  (无输出即为正常)')
