/*
 * 回归测试：17729《卡佩里尼》打出《空军力量》必须带 mode（否则打出了却没效果）。
 *
 * 玩家 2026-10-22：日本因 17729 打出的空军力量没有生效。
 * 根因：resolve_italy_play 只把 { space } 传给 resolve_basic_card，客户端选的
 *       mode（部署/夺取/调度）被丢掉 -> 命中"未指定 mode"分支。
 *
 * 用法：node server-official/public/quartermaster-sub-wars/tools/_smoke_17729_air.js
 */
const path = require('path')
const rules = require(path.join(__dirname, '..', 'rules.js'))
const I = rules._internal

let fail = 0
function ok(label, cond, extra) {
	console.log((cond ? '  PASS  ' : '  FAIL  ') + label + (extra !== undefined ? '  | ' + extra : ''))
	if (!cond) fail++
}
function airsAt(g, sp) {
	return Object.keys(g.piece_nation || {}).filter(p =>
		g.piece_nation[p] === '日本' && g.piece_type[p] === 'air' &&
		String(g.location[p]) === String(sp)).length
}
function base() {
	const g = rules.setup(12345, 'Standard', {})
	g.opening = null
	g.active = 'Axis'
	g.current_nation = '日本'
	g.turn_phase = 'play'
	g.turn = g.turn || 1
	/* 找一个日本陆军所在地当"空军载体" */
	let host = null
	for (const p of Object.keys(g.piece_nation)) {
		if (g.piece_nation[p] === '日本' && g.piece_type[p] === 'army') host = g.location[p]
	}
	g.discard['日本'] = ['15404#1']
	g.delegate = {
		mode: 'order', order: ['德国', '意大利', '日本'], step: 2,
		pickedNation: '日本', pickedCard: '15404#1',
		sub: { kind: 'play', nation: '日本', card: '15404#1' },
		results: [], return_nation: '意大利', return_active: 'Axis',
	}
	return { g, host }
}

console.log('=== A. mode=deploy 必须真的部署 1 支空军 ===')
{
	const { g, host } = base()
	const before = airsAt(g, host)
	const r = rules.action(g, 'Axis', 'resolve_italy_play', { space: host, mode: 'deploy' })
	const after = airsAt(g, host)
	ok('地区已定位', host != null, String(host))
	ok('空军 +1', after === before + 1, before + ' -> ' + after)
	ok('日志含"打出了《空军力量》"', (g.log || []).some(l => l.indexOf('打出了《空军力量》') >= 0),
		(g.log || []).slice(-2).join(' | '))
	ok('链已推进完毕（delegate 清空）', g.delegate === null, JSON.stringify(g.delegate && g.delegate.step))
	ok('动作被接受（未报失败）', !(g.log || []).slice(-2).some(l => l.indexOf('失败') >= 0))
}

console.log('\n=== B. 不带 mode（旧行为）不得凭空生效 ===')
{
	const { g, host } = base()
	const before = airsAt(g, host)
	rules.action(g, 'Axis', 'resolve_italy_play', { space: host })
	const after = airsAt(g, host)
	ok('空军数量不变', after === before, before + ' -> ' + after)
	ok('日志给出失败原因', (g.log || []).some(l => l.indexOf('失败') >= 0),
		(g.log || []).slice(-2).join(' | '))
}

console.log('\n=== C. mode=move（调度）：把本国空军移到载体处 ===')
{
	const { g, host } = base()
	/* 先在另一处放 1 支日本空军（setup 初始没有空军），供调度 */
	const airPid = 'probe_jp_air'
	let from = null
	for (let i = 1; i < I.data.spaces.length; i++) {
		const sp = I.data.spaces[i]
		if (sp && sp.terrain === 'land' && String(i) !== String(host)) { from = i; break }
	}
	g.location[airPid] = from
	g.piece_nation[airPid] = '日本'
	g.piece_type[airPid] = 'air'
	const r = rules.action(g, 'Axis', 'resolve_italy_play', { space: host, mode: 'move', piece: airPid })
	const moved = String(g.location[airPid]) === String(host)
	ok('空军被调度到载体处', moved, JSON.stringify(r && r.desc))
	ok('日志含"调度空军"', (g.log || []).some(l => l.indexOf('调度空军') >= 0),
		(g.log || []).slice(-2).join(' | '))
}

console.log('\n' + (fail === 0 ? 'ALL PASS' : fail + ' FAIL'))
process.exitCode = fail ? 1 : 0
