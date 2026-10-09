/*
 * 验证状态卡"点击触发"在客户端能否真的发出去（R29）。
 *
 * 关键点：客户端 send_action 查的是 view.actions【不带后缀】的 verb
 * 'activate_status'；服务端 build_actions 原先只登记了
 * 'activate_status:<cid>'，两者对不上 -> 点击静默失败。
 *
 * 本脚本断言两种 key 都存在。
 * 用法（从仓库根）：node tools/_verify_status_click.js
 */
const path = require('path')
const MOD = path.join(__dirname, '..', 'server-official', 'public', 'quartermaster-sub-wars')
const rules = require(path.join(MOD, 'rules.js'))
const d = require(path.join(MOD, 'data.js')).data

let pass = 0, fail = 0
function ok(label, cond, extra) {
	console.log((cond ? '  PASS  ' : '  FAIL  ') + label + (extra ? '  | ' + extra : ''))
	cond ? pass++ : fail++
}

let g = rules.setup(1)
g.current_nation = '英国'
g.active = 'Allies'
g.turn_phase = 'play'
g.play_done = {}

/* 把 15345 塞内加尔步兵团发到英国手里并打出 */
g.hands['英国'].push('15345#1')
g = rules.action(g, 'Allies', 'play_card', { card: '15345#1' })

console.log('=== 打出 15345 塞内加尔步兵团 ===')
ok('15345 进桌面', (g.table['英国'] || []).indexOf('15345#1') >= 0)
ok('非洲南部增加 2 计分标记（地区名可解析）',
	(g.markers[d.id_of('非洲南部')] || []).length === 2)

/* 出牌阶段 + 未跳过出牌 -> play_start 窗口应就绪 */
const v = rules.view(g, 'Allies')
console.log('\n=== 客户端点击所需的白名单 ===')
const acts = v.actions || {}
ok('view.actions 存在', !!v.actions)
ok("【关键】view.actions['activate_status'] = 1（不带后缀，客户端 send_action 查这个）",
	acts['activate_status'] === 1, 'actual=' + acts['activate_status'])
ok("view.actions['activate_status:15345#1'] = 1（带后缀的兼容 key）",
	acts['activate_status:15345#1'] === 1, 'actual=' + acts['activate_status:15345#1'])

const ts = (v.table_status || []).find(x => x.card === '15345#1')
ok('view.table_status 含该卡且 ready', !!ts && ts.ready === true,
	ts ? 'ready=' + ts.ready + ' reason=' + (ts.ready_reason || '') : 'not found')

/* 对照：15348 殖民帝国（本轮修了「南非」->「非洲南部」） */
console.log('\n=== 对照 15348 殖民帝国（地区名修正） ===')
g.play_done = {}
g.hands['英国'].push('15348#1')
g = rules.action(g, 'Allies', 'play_card', { card: '15348#1' })
ok('15348 进桌面', (g.table['英国'] || []).indexOf('15348#1') >= 0)
const v2 = rules.view(g, 'Allies')
ok('15348 也登记了 activate_status',
	((v2.actions || {})['activate_status'] === 1))

console.log('\n通过 ' + pass + ' / 失败 ' + fail)
process.exit(fail ? 1 : 0)
