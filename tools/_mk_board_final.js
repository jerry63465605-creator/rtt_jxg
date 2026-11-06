/*
 * 直接把「17811 特例」测试盘面写进本地对局数据库（game 11）
 * 盘面：苏联 莫斯科/罗斯/乌克兰/东欧 陆军（东欧另加空军）+ 手里 17811；
 *       德国 本土陆军 + 空军；当前 = 德国出牌阶段。
 */
const path = require('path')
const ROOT = path.join(__dirname, '..')
const MOD = path.join(ROOT, 'server-official', 'public', 'quartermaster-sub-wars')
const R = require(path.join(MOD, 'rules.js'))
const I = R._internal
const d = I.data
const GID = Number(process.argv[2] || 11)

const g = R.setup(20261106)
g.opening = null
I.refresh(g)
const ID = n => d.id_of(n)

R.action(g, 'Axis', 'debug_set_phase', { nation: '德国', phase: 'play' })
for (const [p, sp] of [['su_m', '莫斯科'], ['su_r', '罗斯'], ['su_u', '乌克兰'], ['su_e', '东欧']])
	R.action(g, 'Allies', 'debug_place', { piece: p, nation: '苏联', type: 'army', space: ID(sp) })
R.action(g, 'Allies', 'debug_place', { piece: 'su_air', nation: '苏联', type: 'air', space: ID('东欧') })
R.action(g, 'Axis', 'debug_place', { piece: 'de_army', nation: '德国', type: 'army', space: ID('德国') })
R.action(g, 'Axis', 'debug_place', { piece: 'de_air', nation: '德国', type: 'air', space: ID('德国') })
R.action(g, 'Allies', 'debug_add_card', { face: '17811', nation: '苏联', dest: 'hand' })
I.refresh(g)

const has17811 = (g.hands['苏联'] || []).some(x => String(x).split('#')[0] === '17811')
console.log('盘面检查：')
console.log('  东欧 =', JSON.stringify(I.pieces_on(g, ID('东欧')).map(p => g.piece_nation[p] + '/' + g.piece_type[p])))
console.log('  德国 =', JSON.stringify(I.pieces_on(g, ID('德国')).map(p => g.piece_nation[p] + '/' + g.piece_type[p])))
console.log('  苏联手牌含 17811 =', has17811, ' 手牌数 =', (g.hands['苏联'] || []).length)
console.log('  current_nation =', g.current_nation, ' phase =', g.turn_phase, ' active =', g.active)

const Database = require(path.join(ROOT, 'server-official', 'node_modules', 'better-sqlite3'))
const db = new Database(path.join(ROOT, 'server-official', 'db'))
db.prepare('insert or replace into game_state (game_id, state) values (?,?)').run(GID, JSON.stringify(g))
db.prepare("update games set status=1, mtime=current_timestamp where game_id=?").run(GID)
db.close()
console.log('已写入 game ' + GID + ' 的状态（' + JSON.stringify(g).length + ' 字节）')
