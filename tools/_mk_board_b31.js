/*
 * 建一局可真实点验 B31 的盘面（写入本地 DB 的新对局）：
 *   美国 · 计分阶段 → 手中持有 17509《王牌飞行员帕皮·博因顿》
 *   → 用真实 play_card 打出 → 服务端产生 pending_echo(step='space', 6 个候选)
 *   → 把【带挂起的状态】写库，打开页面即能看到那个「选目标地区」弹框
 *
 * 用法：node tools/_mk_board_b31.js [gameId] [seed]
 */
const path = require('path')
const ROOT = path.join(__dirname, '..')
const MOD = path.join(ROOT, 'server-official', 'public', 'quartermaster-sub-wars')
const R = require(path.join(MOD, 'rules.js'))
const I = R._internal
const d = I.data
const faceOf = x => String(x).split('#')[0]
const logSince = (g, n) => (g.log || []).slice(n).join(' | ')

const GID = Number(process.argv[2] || 13)
const SEED = Number(process.argv[3] || 20261107)

/* 1) 真实 setup + 布阵（只加"美国在太平洋有存在"这一必要前提） */
const g = R.setup(SEED)
g.pending_battle = null; g.pending_econ = null
g.armed_offers = []; g.response_queue = []; g.response_stack = []
g.pending_status_react = null; g.pending_echo = null; g.pending_script = null
g.pending_event_step = null; g.pending_event_targets = null

R.action(g, 'Allies', 'debug_place', { piece: 'us_hw', nation: '美国', type: 'army', space: d.id_of('夏威夷') })
R.action(g, 'Allies', 'debug_place', { piece: 'us_cp', nation: '美国', type: 'navy', space: d.id_of('中太平洋') })
R.action(g, 'Allies', 'debug_add_card', { face: '17509', nation: '美国', dest: 'hand' })
I.refresh(g)
for (const p of ['us_hw', 'us_cp']) I.grant_supply(g, p, g.turn)
I.refresh(g)

/* 2) 切到美国·计分阶段（17509 的时点） */
R.action(g, 'Allies', 'debug_set_phase', { nation: '美国', phase: 'scoring' })
I.refresh(g)

/* 3) 真实打出 → 产生待选地区的挂起 */
const card = (g.hands['美国'] || []).find(x => faceOf(x) === '17509')
const n0 = (g.log || []).length
R.action(g, 'Allies', 'play_card', { card })
I.refresh(g)
const lg = logSince(g, n0)
console.log('=== 打出 17509 ===')
console.log('  卡实例 = ' + card)
console.log('  log = ' + (lg || '(无)').slice(0, 240))
const pe = g.pending_echo || null
console.log('  pending_echo = ' + JSON.stringify(pe && {
	kind: pe.kind, step: pe.step, card: pe.card, cands: (pe.cands || []).length,
	title: pe.title,
}))
if (pe && pe.cands) console.log('  候选地区 = ' + pe.cands.map(s => d.name_of(s)).join('、'))

/* 4) 写库 */
const Database = require(path.join(ROOT, 'server-official', 'node_modules', 'better-sqlite3'))
const db = new Database(path.join(ROOT, 'server-official', 'db'))
const exists = db.prepare('select game_id from games where game_id=?').get(GID)
if (!exists) {
	db.prepare(`insert into games (game_id, status, title_id, scenario, options, player_count,
		join_count, invite_count, user_count, owner_id, notice, is_private, is_random, is_match,
		ctime, mtime, xtime, moves)
		values (?, 1, 'quartermaster-sub-wars', 'Standard', '', 2, 2, 0, 2, 1, '', 0, 0, 0,
		current_timestamp, current_timestamp, current_timestamp, 0)`).run(GID)
}
db.prepare('insert or replace into game_state (game_id, state) values (?,?)').run(GID, JSON.stringify(g))
db.prepare('update games set status=1, mtime=current_timestamp where game_id=?').run(GID)
db.close()
console.log('\n已写入 game ' + GID + '（' + Math.round(JSON.stringify(g).length / 1024) + ' KB）')
console.log('打开：http://localhost:8091/quartermaster-sub-wars/play.html?game=' + GID + '&role=Allies')
