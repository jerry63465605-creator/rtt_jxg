/*
 * 只读副本：验证「打出 17513 后重新武装 target_card 的 status_instant」能否让
 * 先进造船厂(17550) 立刻 ready=true。不写回 db。
 * 用法：node tools/_probe_B35_rearm.js [gid]
 */
const path = require('path')
const Database = require(path.join(__dirname, '..', 'server-official', 'node_modules', 'better-sqlite3'))
const MOD = path.join(__dirname, '..', 'server-official', 'public', 'quartermaster-sub-wars')
const R = require(path.join(MOD, 'rules.js'))
const I = R._internal
const d = I.data
const db = new Database(path.join(__dirname, '..', 'server-official', 'db'), { readonly: true })
const gid = Number(process.argv[2] || 19)
const row = db.prepare('SELECT * FROM game_state WHERE game_id = ?').get(gid)
const g = JSON.parse(row.state || row.data || row.json)
const J = x => JSON.stringify(x)

const show = tag => {
	const v = R.view(g, 'Allies')
	const t = (v.table_status || []).find(s => String(s.card).split('#')[0] === '17550')
	console.log(tag + '  status_instant=' + J((g.status_instant || []).map(e =>
		e.card_id + ':' + e.window + '@' + e.space)))
	console.log(tag + '  17550 ready=' + (t && t.ready) +
		'  used_this_turn=' + (t && t.used_this_turn) +
		'  reason=' + (t && t.reason) +
		'  actions[activate_status:17550#100]=' + !!(v.actions['activate_status:17550#100']))
}
show('修复前')

/* 同 window 已有条目（人工港）带的就是「刚建设海军」那一格 */
const same = (g.status_instant || []).find(e => e.window === 'after_build_navy')
const space = same ? same.space : g.last_built
console.log('\n用于重武装的 space = ' + space +
	(space != null ? '（' + (d.name_of(Number(space)) || space) + '）' : ''))
console.log('last_built = ' + J(g.last_built) + '  status_inflight = ' + J(g.status_inflight))
console.log('17550 trigger = ' + J((I.status_config_of ? I.status_config_of('17550#100') : null) || '(未导出)'))

I.arm_status_instant(g, 'after_build_navy', '美国', space)
console.log('')
show('重武装后')

/* 对照：玩家接着点 17550 能否真的发动（副本上再走一次 action） */
const target = (g.table['美国'] || []).find(c => String(c).split('#')[0] === '17550')
const q = R.query(g, 'Allies', 'status_build_spaces',
	{ card: target, nation: '美国', type: 'navy' })
const cs = ((q && q.spaces) || []).map(x => Number(x && x.id != null ? x.id : x))
console.log('\n17550 选位候选数 = ' + cs.length + (cs.length ? ' 首格=' + d.name_of(cs[0]) : ''))
if (cs.length) {
	const n0 = (g.log || []).length
	R.action(g, 'Allies', 'activate_status', { card: target, space: cs[0] })
	console.log('发动日志: ' + (g.log || []).slice(n0).join(' | ').slice(0, 260))
	console.log('发动后 status_used = ' + J(g.status_used))
	console.log('发动后 pending_status_ask = ' + J(g.pending_status_ask))
}
db.close()
