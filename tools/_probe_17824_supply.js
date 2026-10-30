/* 仅检查：17824《苏德友好条约》是否提供补给、日志怎么写 */
const fs = require('fs')
const path = require('path')
const MOD = path.join(__dirname, '..', 'server-official', 'public', 'quartermaster-sub-wars')
const R = require(path.join(MOD, 'rules.js'))
const I = R._internal
const d = I.data
const t = fs.readFileSync(path.join(MOD, 'rules.js'), 'utf8').split('\n')

/* ① can_recruit_at 是否要求补给 */
const j = t.findIndex(l => l.indexOf('function can_recruit_at') === 0)
console.log('=== can_recruit_at 里"补给"相关行 ===')
t.slice(j, j + 80).forEach((l, k) => {
	if (/supply|补给/.test(l)) console.log((j + k + 1) + ': ' + l.trim().slice(0, 130))
})

/* ② 实测：苏联打出 17824 */
const g = R.setup(1)
g.opening = null
g.current_nation = '苏联'
g.active = 'Allies'
g.turn_phase = 'play'
g.neutral = {}
g.location = {}; g.piece_nation = {}; g.piece_type = {}
/* 只在<苏联>放一支陆军，罗斯/东欧都不在补给链上 */
const SU = d.id_of('苏联')
g.location['su_home'] = SU; g.piece_nation['su_home'] = '苏联'; g.piece_type['su_home'] = 'army'
g.hands['苏联'] = ['17824#1']
g.decks['苏联'] = ['15345#1', '15345#2']
I.refresh(g)

const ROS = d.id_of('罗斯')
const EE = d.id_of('东欧')
console.log('\n布阵：苏联陆军@' + d.name_of(SU) + '；罗斯=' + d.name_of(ROS) + '，东欧=' + d.name_of(EE))
console.log('征召前 罗斯可征召? ' + JSON.stringify(I.can_recruit_at(g, '苏联', ROS, 'army')))
console.log('征召前 东欧可征召? ' + JSON.stringify(I.can_recruit_at(g, '苏联', EE, 'army')))

const n0 = (g.log || []).length
const r = R.action(g, 'Allies', 'play_card', { card: '17824#1', spaces: [ROS, EE] })
console.log('\n=== 打出 17824 的日志 ===')
;(g.log || []).slice(n0).forEach(l => console.log('  ' + l))

console.log('\n=== 新征召的陆军 ===')
const newUnits = Object.keys(g.location).filter(p => p !== 'su_home')
for (const p of newUnits)
	console.log('  ' + p + ' @' + d.name_of(g.location[p]) + '  supply_granted=' +
		JSON.stringify((g.supply_granted || {})[p]) + '  game.turn=' + g.turn)

const sup = I.compute_supply(g)
console.log('\n=== 补给判定（compute_supply） ===')
for (const p of Object.keys(g.location))
	console.log('  ' + p + ' @' + d.name_of(g.location[p]) + ' in_supply=' + !!(sup.in_supply || {})[p])

const gr = g.supply_granted || {}
console.log('\n=== 结算后的 grant 记录 ===')
console.log('  ' + JSON.stringify(gr))
console.log('  到期判定：supply_granted[pid] >= game.turn -> 仍有效（game.turn 为【整轮序号】）')
