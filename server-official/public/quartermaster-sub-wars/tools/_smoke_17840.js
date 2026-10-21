/*
 * 回归测试：17840《焦土作战》
 *   卡面：<乌克兰>不为其他国家提供补给。<乌克兰>减少1个计分标记。
 *   玩家口径（2026-10-22）：剩余那 1 个标记【仅对苏联有效】—— 轴心占着乌克兰也不得分。
 *
 * 用法：node server-official/public/quartermaster-sub-wars/tools/_smoke_17840.js
 */
const path = require('path')
const rules = require(path.join(__dirname, '..', 'rules.js'))
const I = rules._internal

let fail = 0
function ok(label, cond, extra) {
	console.log((cond ? '  PASS  ' : '  FAIL  ') + label + (extra !== undefined ? '  | ' + extra : ''))
	if (!cond) fail++
}

const game = rules.setup(12345, 'Standard', {})
I.ensure_markers(game)
const sp = I.space_id_of('乌克兰')
if (sp == null) { console.error('FAIL: 乌克兰 未配置'); process.exit(1) }

const before = (game.markers[sp] || []).slice()
ok('开局乌克兰有 2 个标记', before.length === 2, JSON.stringify(before))
ok('开局标记无主（公共分）', before.every(m => m.owner == null))

const lines = I.apply_status_ongoing(game, '17840', '苏联')
console.log('  应用日志:', JSON.stringify(lines))

const after = game.markers[sp] || []
console.log('  after 乌克兰 markers:', JSON.stringify(after))

console.log('\n=== A. 标记：2 -> 1，且剩的那个仅苏联 ===')
ok('标记数 = 1', after.length === 1, 'count=' + after.length)
ok('剩余标记 owner = 苏联', !!(after[0] && after[0].owner === '苏联'), JSON.stringify(after[0]))
ok('剩余标记 value = 1', !!(after[0] && after[0].value === 1))

console.log('\n=== B. 配置 desc 同步 ===')
const cfg = I.status_config_of('17840')
const desc = (cfg && cfg.ongoing && cfg.ongoing.desc) || ''
ok('desc 含"仅对苏联"', desc.indexOf('仅对苏联') >= 0, desc)

console.log('\n=== C. 补给点：两阵营都失效 ===')
const ov = game.supply_override && game.supply_override[sp]
ok('override = {axis:false, allies:false}', !!(ov && ov.axis === false && ov.allies === false),
	JSON.stringify(ov))

console.log('\n=== D. 计分：只有苏联能拿乌克兰这 1 分 ===')
function cloneWith(nation, type) {
	const g = JSON.parse(JSON.stringify(game))
	const pid = 'probe_' + nation
	g.location[pid] = sp
	g.piece_nation[pid] = nation
	g.piece_type[pid] = type || 'army'
	return g
}
function ukItem(g, nation) {
	const b = I.score_breakdown(g, nation)
	return (b.items || []).find(it => it && String(it.space) === String(sp)) || null
}
const su = ukItem(cloneWith('苏联'), '苏联')
ok('苏联占乌克兰 -> +1', !!(su && su.gained === 1), JSON.stringify(su))
const de = ukItem(cloneWith('德国'), '德国')
ok('德国占乌克兰 -> 0 分', de === null, JSON.stringify(de))
const uk = ukItem(cloneWith('英国'), '英国')
ok('英国占乌克兰 -> 0 分', uk === null, JSON.stringify(uk))

console.log('\n' + (fail === 0 ? 'ALL PASS' : fail + ' FAIL'))
process.exitCode = fail ? 1 : 0
