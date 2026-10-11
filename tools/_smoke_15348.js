/* 15348 殖民帝国：出牌前才能发动（复用 play_done 把关）+ 0 陆军→0 次 + per_unit 上限
 * 运行：node tools/_smoke_15348.js
 * 说明：rules.action 返回 game state（非 {ok}），成败以状态变化 + game.log 判断。
 *       15348 成功结算必扣 1 分（lose_score），故用 score['allies'] 的差值判定成功。
 */
const path = require('path')
const DIR = path.join(__dirname, '..', 'server-official', 'public', 'quartermaster-sub-wars')
const rules = require(path.join(DIR, 'rules.js'))
const { data } = require(path.join(DIR, 'data.js'))

let pass = 0, fail = 0
function ok(cond, msg) {
	if (cond) { pass++; console.log('  ✓ ' + msg) }
	else { fail++; console.log('  ✗ ' + msg) }
}
const SP = (n) => data.id_of(n)
const lastLog = (g) => (g.log[g.log.length - 1] || '')

function mkGame() {
	const g = rules.setup(20261011, 'Standard', {})
	g.current_nation = '英国'
	g.active = 'Allies'
	g.turn_phase = 'play'
	g.location = {}; g.piece_nation = {}; g.piece_type = {}
	g.table = g.table || {}
	g.table['英国'] = g.table['英国'] || []
	if (g.table['英国'].indexOf('15348#1') < 0) g.table['英国'].push('15348#1')
	return g
}
function putArmies(g, n) {
	const spaces = ['加拿大', '印度', '非洲南部']
	let i = 0
	for (const s of spaces) {
		for (let k = 0; k < n; k++) {
			const pid = 'uk_' + s.length + '_' + i++
			g.location[pid] = SP(s); g.piece_nation[pid] = '英国'; g.piece_type[pid] = 'army'
		}
	}
}
/* 发动一次：成功则 allies 分数 -1；返回是否成功 */
function fire(g) {
	const before = g.score['allies']
	g = rules.action(g, 'Allies', 'activate_status', { card: '15348#1' })
	const okFire = (g.score['allies'] === before - 1)
	return { g, okFire }
}

console.log('=== A. 3 支英国陆军：出牌前可发动 3 次，第 4 次被拒 ===')
{
	const g0 = mkGame(); putArmies(g0, 1)
	const start = g0.score['allies']
	let g = g0, ok1, ok2, ok3, ok4
	;({ g, okFire: ok1 } = fire(g))
	;({ g, okFire: ok2 } = fire(g))
	;({ g, okFire: ok3 } = fire(g))
	;({ g, okFire: ok4 } = fire(g))
	ok(ok1 && ok2 && ok3, '前 3 次均发动成功')
	ok(!ok4, '第 4 次被拒（已达上限）：' + lastLog(g))
	ok((start - g.score['allies']) === 3, '共失去 3 分（每次 1 分），实际 ' + (start - g.score['allies']))
}

console.log('=== B. 0 支英国陆军：不可发动 ===')
{
	const g0 = mkGame() // 不放陆军
	const start = g0.score['allies']
	const { g, okFire } = fire(g0)
	ok(!okFire, '0 陆军时拒绝发动：' + lastLog(g))
	ok(g.score['allies'] === start, '0 陆军时分数不变')
}

console.log('=== C. 出牌后（play_done）不可发动 ===')
{
	const g0 = mkGame(); putArmies(g0, 1)
	g0.play_done = g0.play_done || {}
	g0.play_done['英国'] = g0.turn // 模拟本回合已打出过牌
	const start = g0.score['allies']
	const { g, okFire } = fire(g0)
	ok(!okFire, 'play_done 后拒绝发动：' + lastLog(g))
	ok(g.score['allies'] === start, 'play_done 后分数不变')
}

console.log('=== D. 跨回合上限重置（freq_key 含 turn） ===')
{
	let g = mkGame(); putArmies(g, 1)
	fire(g); fire(g); fire(g) // 本回合用满 3 次
	const r4 = fire(g)
	ok(!r4.okFire, '本回合第 4 次被拒：' + lastLog(r4.g))
	g.turn += 1
	g.play_done = {}
	const r5 = fire(g)
	ok(r5.okFire, '新回合上限重置，可再次发动：' + lastLog(r5.g))
}

console.log('\n结果：' + pass + ' 通过，' + fail + ' 失败')
process.exit(fail ? 1 : 0)
