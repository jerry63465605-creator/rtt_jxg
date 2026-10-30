/*
 * 拦截类卡清单 + 可被拦截的触发面 + 代价/效果划分（重点：15214 战术革新）
 * 只读审计，不改代码。
 */
const path = require('path')
const MOD = path.join(__dirname, '..', 'server-official', 'public', 'quartermaster-sub-wars')
const R = require(path.join(MOD, 'rules.js'))
const I = R._internal
const C = require(path.join(MOD, 'cards.js'))

const nm = id => (C.CARD_BY_ID[String(id)] || {}).name || '?'
const txt = id => String((C.CARD_BY_ID[String(id)] || {}).text || '')
const type = id => (C.CARD_BY_ID[String(id)] || {}).type || '?'
const nat = id => (C.CARD_BY_ID[String(id)] || {}).nation || '?'

console.log('=== ① 拦截类卡：armed.watch（手牌即用，不用打出） ===')
const EE = I.ECHO_EFFECTS || {}
for (const f of Object.keys(EE)) {
	const ar = EE[f] && EE[f].armed
	if (!ar || !ar.watch) continue
	console.log('  ' + f + ' ' + nm(f) + ' [' + type(f) + '·' + nat(f) + ']')
	console.log('      window=' + ar.when + '  cost=' + JSON.stringify(ar.cost || {}) +
		'  desc=' + String(ar.desc || ''))
	console.log('      卡面: ' + txt(f).slice(0, 90))
}

console.log('\n=== ② 拦截类卡：响应栈 pre-cancel（必须先暗置到桌面） ===')
const RPC = I.RESPONSE_PRE_CANCEL || {}
for (const f of Object.keys(RPC)) {
	console.log('  ' + f + ' ' + nm(f) + ' [' + type(f) + '·' + nat(f) + '] -> ' +
		JSON.stringify(RPC[f]).slice(0, 120))
	console.log('      卡面: ' + txt(f).slice(0, 90))
}

console.log('\n=== ③ 压制/光环类（无窗口，直接让状态卡失效） ===')
for (const f of ['15343', '17805']) {
	console.log('  ' + f + ' ' + nm(f) + ' [' + type(f) + '·' + nat(f) + ']')
	console.log('      卡面: ' + txt(f).slice(0, 90))
}

console.log('\n=== ④ 可被拦截的触发面（哪些"动作"会开拦截窗口） ===')
const ECHO_N = Object.keys(EE).length
let watchN = 0
for (const f of Object.keys(EE)) if (EE[f] && EE[f].armed && EE[f].armed.watch) watchN++
console.log('  enemy_echo_played  : 所有 EFFECT（增强卡）打出时 -> 拦截方 15352 / 16700')
console.log('  enemy_status_effect: 状态卡发动（activate_status）时 -> 拦截方 15353')
console.log('  经济战 [轰炸/潜艇行动]: ECON 打出时 -> 拦截方 15329（反潜战术）')
console.log('  轰炸行动            : -> 拦截方 17736（王牌飞行员）')
console.log('  增强卡总数=' + ECHO_N + '，其中 watch 型拦截卡=' + watchN)

console.log('\n=== ⑤ 15214 战术革新：代价与效果（代码口径） ===')
const cfg = EE['15214']
console.log('  配置: ' + JSON.stringify({ name: cfg.name, actor: cfg.actor, hasRun: typeof cfg.run }))
console.log('  卡面: ' + txt('15214'))
console.log('  两步（run_effect_tactics，由 resolve_effect 驱动）：')
console.log('    step discard（代价）: 玩家选 1 张德国桌面[状态卡] -> 弃置')
console.log('    step play   （效果）: 玩家选 1 张手牌[状态卡]   -> 免费打出（不占出牌名额）')
console.log('  拦截派发点: play_card 的 ECHO 分支，在 resolve_event_card（两步）【之前】')

console.log('\n=== ⑥ 所有带显式 cost 的增强卡（代价由框架在触发时付，对照用） ===')
const withCost = []
for (const f of Object.keys(EE)) {
	const ar = EE[f] && EE[f].armed
	if (!ar || !ar.cost) continue
	withCost.push(f + ' ' + nm(f) + ' [' + nat(f) + '] cost=' + JSON.stringify(ar.cost) +
		' when=' + ar.when)
}
console.log('  共 ' + withCost.length + ' 张')
withCost.slice(0, 20).forEach(x => console.log('    ' + x))
