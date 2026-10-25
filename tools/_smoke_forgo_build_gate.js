/*
 * 【2026-10-25】"替换建设"（forgo_build_army）状态卡的【国家门禁】回归。
 *
 * bug：桌面状态区是【整个阵营共享可见】的，所以苏联/美国玩家也能看到
 *      英国桌面的 15341《澳大利亚劳管局》/ 15342《印度宣布参战》；
 *      旧判定只看"是否正在打《建设陆军》"，于是非英国建设陆军时这两张卡
 *      也亮成"可放弃建设"（可点击），点了却被服务端拒绝。
 * 修复：服务端 view.table_status[].forgo_build 统一按
 *      "卡归属国 == 当前行动国"给出（并覆盖 17742《拉丁世界》），
 *      客户端直接采信，不再二次判断。
 *
 * 用法：node tools/_smoke_forgo_build_gate.js
 */
const path = require('path')
const MOD = path.join(__dirname, '..', 'server-official', 'public', 'quartermaster-sub-wars')
const rules = require(path.join(MOD, 'rules.js'))
const I = rules._internal

let pass = 0, fail = 0
function ok(name, cond, extra) {
	if (cond) { pass++; console.log('  ✓ ' + name) }
	else { fail++; console.log('  ✗ ' + name + (extra ? '  ' + extra : '')) }
}

/* 英国桌面放 15341/15342；意大利桌面放 17742（同款"替换建设"） */
function scene(currentNation) {
	const g = rules.setup(1)
	g.opening = null
	g.table['英国'] = ['15341#1', '15342#1']
	g.table['意大利'] = ['17742#1']
	g.current_nation = currentNation
	g.turn_phase = 'build'
	return g
}
function forgos(g) {
	const v = rules.view(g, I.faction_of_nation(g.current_nation))
	return (v.table_status || []).map(t => ({
		card: t.card, nation: t.nation, forgo: t.forgo_build,
	}))
}

console.log('\n[1] 英国自己建设陆军 -> 15341/15342 可用')
{
	const g = scene('英国')
	const rows = forgos(g)
	console.log('    ' + JSON.stringify(rows))
	const uk = rows.filter(r => r.nation === '英国')
	ok('两张英国卡 forgo_build = true', uk.length === 2 && uk.every(r => r.forgo === true),
		JSON.stringify(uk))
	ok('意大利 17742 不可用（不是意大利在建设）',
		rows.filter(r => r.nation === '意大利').every(r => r.forgo === false))
}

console.log('\n[2] 苏联建设陆军 -> 英国那两张不可用（本次修的 bug）')
{
	const g = scene('苏联')
	const rows = forgos(g)
	console.log('    ' + JSON.stringify(rows))
	const uk = rows.filter(r => r.nation === '英国')
	ok('15341/15342 forgo_build = false', uk.length === 2 && uk.every(r => r.forgo === false),
		JSON.stringify(uk))
}

console.log('\n[3] 美国建设陆军 -> 同样不可用')
{
	const g = scene('美国')
	const rows = forgos(g)
	const uk = rows.filter(r => r.nation === '英国')
	ok('15341/15342 forgo_build = false', uk.every(r => r.forgo === false), JSON.stringify(uk))
}

console.log('\n[4] 意大利建设陆军 -> 17742 可用、英国那两张不可用')
{
	const g = scene('意大利')
	const rows = forgos(g)
	console.log('    ' + JSON.stringify(rows))
	ok('17742 forgo_build = true',
		rows.filter(r => r.nation === '意大利').every(r => r.forgo === true))
	ok('英国两张不可用', rows.filter(r => r.nation === '英国').every(r => r.forgo === false))
}

console.log('\n[5] 白名单同源：非英国时 activate_status 不登记')
{
	const g = scene('苏联')
	const v = rules.view(g, 'Allies')
	ok('动作表不含 activate_status', !v.actions['activate_status'],
		JSON.stringify(v.actions))
}
{
	const g = scene('英国')
	const v = rules.view(g, 'Allies')
	ok('英国建设时含 activate_status', !!v.actions['activate_status'],
		JSON.stringify(v.actions))
}

console.log('\n结果: ' + pass + ' 通过, ' + fail + ' 失败')
process.exit(fail ? 1 : 0)
