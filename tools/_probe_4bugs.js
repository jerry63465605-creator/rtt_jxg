/*
 * 只读排查 4 个待办：
 *  ① 15228 高速公路：收回德国陆军后，其上的德国空军去哪了（应：有相邻本国海军就撤离，否则一起死）
 *  ② 17747 直布罗陀：<北海>-<地中海> / <非洲北部>-<西欧> 是否对同盟也相邻
 *  ③ 15407 秋水：是否自动执行（无玩家选择）
 *  ④ 15206 轰炸伦敦：计数范围是 1 个地区还是 <不列颠> 地区组的多个地区
 *
 * 用法：node tools/_probe_4bugs.js
 */
const path = require('path')
const ROOT = path.join(__dirname, '..')
const MOD = path.join(ROOT, 'server-official', 'public', 'quartermaster-sub-wars')
const R = require(path.join(MOD, 'rules.js'))
const I = R._internal
const d = I.data

const nm = x => (x == null ? '?' : d.name_of(Number(x)))
const has = (list, x) => (list || []).map(Number).indexOf(Number(x)) >= 0

console.log('=== ② 17747 直布罗陀：基础相邻关系（未打出该卡）===')
{
	const g = R.setup(7); g.opening = null; I.refresh(g)
	for (const [an, bn] of [['北海', '地中海'], ['非洲北部', '西欧']]) {
		const a = d.id_of(an), b = d.id_of(bn)
		console.log('  ' + an + '(' + a + ') - ' + bn + '(' + b + '): 同盟相邻=' +
			has(I.get_connections(g, a, 'allies'), b) + '  轴心相邻=' + has(I.get_connections(g, a, 'axis'), b))
	}
	console.log('  status_connections = ' + JSON.stringify(g.status_connections || []))
}

console.log('\n=== ② 写入 17747 的 pair 后再看（side=axis）===')
{
	const g = R.setup(7); g.opening = null
	g.status_connections = [{ a: d.id_of('北海'), b: d.id_of('地中海'), side: 'axis' },
		{ a: d.id_of('非洲北部'), b: d.id_of('西欧'), side: 'axis' }]
	I.refresh(g)
	for (const [an, bn] of [['北海', '地中海'], ['非洲北部', '西欧']]) {
		const a = d.id_of(an), b = d.id_of(bn)
		console.log('  ' + an + ' - ' + bn + ': 同盟相邻=' + has(I.get_connections(g, a, 'allies'), b) +
			'  轴心相邻=' + has(I.get_connections(g, a, 'axis'), b))
	}
	console.log('  快照 game.limited_connections = ' + JSON.stringify(g.limited_connections).slice(0, 200))
}

console.log('\n=== ① 15228 高速公路：收回德国陆军后，空军是否还在 ===')
{
	const g = R.setup(7); g.opening = null
	g.neutral = g.neutral || {}; g.neutral['苏联'] = false
	I.refresh(g)
	/* 德国陆军@德国 + 同格空军（合法：空军需要同格本国地面部队且补给中） */
	R.action(g, 'Axis', 'debug_set_phase', { nation: '德国', phase: 'play' })
	R.action(g, 'Axis', 'debug_place', { piece: 'de_a', nation: '德国', type: 'army', space: d.id_of('德国') })
	I.refresh(g); I.grant_supply(g, 'de_a', g.turn); I.refresh(g)
	R.action(g, 'Axis', 'debug_place', { piece: 'de_air', nation: '德国', type: 'air', space: d.id_of('德国') })
	I.refresh(g)
	R.action(g, 'Axis', 'debug_add_card', { face: '15228', nation: '德国', dest: 'hand' })
	I.refresh(g)
	const card = (g.hands['德国'] || []).find(x => String(x).startsWith('15228'))
	console.log('  打出前: location de_a=' + JSON.stringify(g.location['de_a']) +
		' de_air=' + JSON.stringify(g.location['de_air']) + '  卡=' + card)
	const n0 = (g.log || []).length
	R.action(g, 'Axis', 'play_card', { card })
	console.log('  log: ' + (g.log || []).slice(n0).join(' | '))
	console.log('  打出后: de_a=' + JSON.stringify(g.location['de_a']) +
		' de_air=' + JSON.stringify(g.location['de_air']) +
		'  pending_autobahn=' + JSON.stringify(g.pending_autobahn && { actor: g.pending_autobahn.actor, remaining: g.pending_autobahn.remaining }))
	console.log('  → 空军是否随陆军一起被移除: ' + (g.location['de_air'] == null ? '是' : '否（仍留在场上 ' + nm(g.location['de_air']) + '）'))
}

console.log('\n=== ③ 15407 秋水：触发方式 ===')
{
	console.log('  CARD_TRIGGERS[15407] = ' + JSON.stringify(R._internal.CARD_TRIGGERS ? R._internal.CARD_TRIGGERS['15407'] : '(未导出)'))
	const src = require('fs').readFileSync(path.join(MOD, 'rules.js'), 'utf8')
	const i = src.indexOf("CARD_TRIGGERS['15407']")
	console.log('  ' + src.slice(i, i + 120).replace(/\n/g, ' '))
	const kindSelf = /CARD_TRIGGERS\['15407'\] = \{ kind: 'self'/.test(src)
	console.log('  kind=self（自动执行，无玩家可选）: ' + kindSelf)
}

console.log('\n=== ④ 15206 轰炸伦敦：只数 1 个地区？ ===')
{
	const src = require('fs').readFileSync(path.join(MOD, 'rules.js'), 'utf8')
	const i = src.indexOf("'15206': {")
	const seg = src.slice(i, i + 1400)
	const line = seg.match(/const bt = space_id\('([^']+)'\)/)
	console.log('  计数用的地区 = ' + (line ? line[1] : '(未找到)'))
	const groups = I.REGION_GROUPS || {}
	console.log('  REGION_GROUPS 里有"不列颠"吗: ' + (!!groups['不列颠']) + '  成员=' + JSON.stringify(groups['不列颠'] || null))
	console.log('  是否遍历地区组: ' + /REGION_GROUPS\[['"]不列颠['"]\]/.test(seg))
}
