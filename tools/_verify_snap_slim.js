/*
 * 验证 P0-a：回放快照不再包含 rollback（回退检查点数组）。
 *
 * 做法：直接从 server.js 里抽取真实的 snap_from_state 源码执行（不复制实现，
 * 避免"测试的是我手抄的版本"）。断言：
 *   ① 快照里没有 rollback、log 被换成数字
 *   ② 体积大幅下降（后期存档 388 KB → ~25 KB）
 *   ③ 用快照跑 rules.view() 不炸（回放/观察者路径），且 rollback_points 为空
 *   ④ 原 state 对象未被破坏（rollback/undo/log 复原）
 *   ⑤ 模拟 rewind_game_to_snap 的"捡回仍然有效的回退点"逻辑
 *
 * 用法：node tools/_verify_snap_slim.js
 */
const fs = require('fs')
const path = require('path')
const D = require(path.join(__dirname, '..', 'server-official', 'node_modules', 'better-sqlite3'))
const dbPath = path.join(__dirname, '..', 'server-official', 'db')
const rules = require(path.join(__dirname, '..', 'server-official', 'public', 'quartermaster-sub-wars', 'rules.js'))
const I = rules._internal

let pass = 0, fail = 0
function ok(m, cond, extra) {
	if (cond) { pass++; console.log('  ✓ ' + m + (extra ? '  ' + extra : '')) }
	else { fail++; console.log('  ✗ ' + m + (extra ? '  ' + extra : '')) }
}

/* 抽取真实实现 */
const src = fs.readFileSync(path.join(__dirname, '..', 'server-official', 'server.js'), 'utf8')
const m = src.match(/function snap_from_state\(state\) \{[\s\S]*?\n\}/)
ok('从 server.js 抽到 snap_from_state', !!m)
const snap_from_state = new Function('return (' + m[0] + ')')()
ok('snap_from_state 源码里剔除了 rollback', /state\.rollback = undefined/.test(m[0]),
	JSON.stringify(m[0].match(/state\.rollback = undefined/) ? 'found' : 'missing'))

/* 取一个后期存档 */
const db = new D(dbPath, { readonly: true })
const rows = db.prepare('select game_id,state from game_state').all()
	.filter(r => { try { const g = JSON.parse(r.state); return g && g.hands && g.location } catch (e) { return false } })
	.sort((a, b) => a.state.length - b.state.length)
const late = rows[rows.length - 1]
const state = JSON.parse(late.state)
console.log('\n  样本 game ' + late.game_id + '：log ' + state.log.length + ' 条，rollback ' +
	((state.rollback || []).length) + ' 个，state ' + (late.state.length / 1024).toFixed(1) + ' KB')

const before = {
	rollback: JSON.stringify(state.rollback || []).length,
	undo: state.undo,
	logLen: state.log.length,
}
const snap = snap_from_state(state)
const snapObj = JSON.parse(snap)

ok('快照不含 rollback 键', snapObj.rollback === undefined,
	'keys=' + Object.keys(snapObj).filter(k => /rollback/.test(k)).join(','))
ok('快照的 log 是数字（长度）', typeof snapObj.log === 'number', 'log=' + snapObj.log)
ok('快照体积 < 原 state 的 20%',
	snap.length < late.state.length * 0.2,
	(snap.length / 1024).toFixed(1) + ' KB vs ' + (late.state.length / 1024).toFixed(1) + ' KB')
ok('原 state 的 rollback 未被破坏',
	JSON.stringify(state.rollback || []).length === before.rollback)
ok('原 state 的 log 仍是数组', Array.isArray(state.log) && state.log.length === before.logLen)
ok('原 state 的 undo 复原', state.undo === before.undo)

/* 回放路径：用快照跑 view（不含 log/rollback 的裸状态） */
let viewed = null, threw = null
try { viewed = rules.view(snapObj, 'Axis') } catch (e) { threw = e.message }
ok('用快照跑 rules.view() 不抛异常', !threw, threw || '')
ok('快照视角 rollback_points 为空', viewed && (viewed.rollback_points || []).length === 0,
	viewed ? String((viewed.rollback_points || []).length) : 'n/a')

/* 模拟 rewind_game_to_snap 的捡回逻辑（与 server.js 同款表达式） */
{
	const restored = JSON.parse(snap)
	const kept = (state.rollback || [])
		.filter(p => (p.log_len == null ? 0 : p.log_len) <= restored.log)
	restored.rollback = kept
	restored.rollback_proposal = null
	restored.undo = []
	restored.log = state.log.slice(0, restored.log)
	ok('回退后保留的回退点都 <= 快照日志长度',
		kept.every(p => p.log_len <= state.log.slice(0, restored.log.length).length),
		'kept=' + kept.length + '/' + (state.rollback || []).length)
	let v2 = null, t2 = null
	try { v2 = rules.view(restored, 'Axis') } catch (e) { t2 = e.message }
	ok('回退后的状态 view() 正常', !t2, t2 || '')
	ok('replay 后 rollback_points 与保留数一致',
		v2 && (v2.rollback_points || []).length === Math.min(kept.length, 60),
		v2 ? (v2.rollback_points || []).length + ' vs ' + kept.length : 'n/a')
}

console.log('\n==== 结果：' + pass + ' 通过 / ' + fail + ' 失败 ====')
process.exit(fail ? 1 : 0)
