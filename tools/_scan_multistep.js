/*
 * 扫描所有【多步 / 多选项】事件卡，列出它们的 step 结构，
 * 用于排查 R44（"选完第 1 步就提交 -> 整张卡不执行"）是否波及同类卡。
 *
 * 判定：
 *   · steps.length > 1            -> 多步卡（必须逐步累积选择）
 *   · choice（二选一）任一项 >1 步  -> 同样受影响
 *   · 含 useNewPiece              -> 额外依赖 prevSpaces（执行阶段也要传）
 *
 * 用法（从仓库根）：node tools/_scan_multistep.js
 */
const path = require('path')
const MOD = path.join(__dirname, '..', 'server-official', 'public', 'quartermaster-sub-wars')
const rules = require(path.join(MOD, 'rules.js'))
const I = rules._internal || {}

const EV = I.EVENT_EFFECTS || {}
const d = require(path.join(MOD, 'data.js')).data

const stepDesc = (st) => {
	if (!st) return '?'
	let s = st.op || '?'
	if (st.type) s += ':' + st.type
	if (st.kind) s += ':' + st.kind
	if (st.spaces) s += '@配置位'
	if (st.useNewPiece) s += ' [useNewPiece]'
	if (st.grantSupply) s += ' [grantSupply]'
	if (st.pick != null) s += ' pick=' + st.pick
	return s
}

const rows = []
for (const id of Object.keys(EV)) {
	const e = EV[id]
	if (!e) continue
	const groups = []
	if (e.steps && e.steps.length) groups.push({ label: 'steps', list: e.steps })
	if (e.choice) e.choice.forEach((c, i) => groups.push({ label: 'choice[' + i + ']', list: c }))
	for (const g of groups) {
		if (!g.list || g.list.length <= 1) continue
		const usesNew = g.list.some(st => st.useNewPiece)
		const hasPick = g.list.some(st => st.pick != null && st.pick > 1)
		rows.push({
			id, name: e.name, actor: e.actor || '', group: g.label,
			n: g.list.length, usesNew, hasPick,
			detail: g.list.map(stepDesc).join(' => '),
		})
	}
}

console.log('== 多步 / 多选项事件卡（steps 或 choice 任一项 >1 步）==\n')
if (!rows.length) console.log('  （无）')
for (const r of rows) {
	console.log('  [' + r.id + '] 《' + r.name + '》 actor=' + r.actor +
		'  (' + r.group + ' × ' + r.n + ')')
	console.log('      ' + r.detail)
	if (r.usesNew) console.log('      ⚠ 含 useNewPiece —— 依赖 prevSpaces（查询+执行都要传）')
}

console.log('\n== 汇总 ==')
console.log('  多步卡共 ' + rows.length + ' 张')
console.log('  含 useNewPiece: ' + rows.filter(r => r.usesNew).length +
	'  -> ' + rows.filter(r => r.usesNew).map(r => r.id).join(', '))
console.log('  含 pick>1 (多选): ' + rows.filter(r => r.hasPick).length +
	'  -> ' + rows.filter(r => r.hasPick).map(r => r.id).join(', '))

/* 顺带：单步但含 useNewPiece 的（理论上无效配置，值得看一眼） */
const singleNew = []
for (const id of Object.keys(EV)) {
	const e = EV[id]
	if (!e) continue
	const lists = []
	if (e.steps) lists.push(e.steps)
	if (e.choice) e.choice.forEach(c => lists.push(c))
	for (const L of lists) {
		if (L && L.length === 1 && L[0].useNewPiece) singleNew.push(id)
	}
}
if (singleNew.length)
	console.log('\n  ⚠ 单步却含 useNewPiece（无前序单位，可能配置有误）: ' +
		singleNew.join(', '))
