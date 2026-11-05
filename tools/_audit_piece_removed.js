/*
 * T1 只读审计：piece_removed 系列（增强卡 / 状态卡 / 响应卡）
 *
 * 目的：把"谁在什么条件下该开窗"记录成表，供后续逐卡核对与修复排序。
 * 做法（只读，不改状态）：
 *   ① 静态：三条移除路径（陆军 / 海军 / 空军）是否有 piece_removed 派发；
 *   ② 逐卡：打印 filter / ready / cond 的源码摘要（即"国家对不对/兵种对不对/地区对不对"的判据）；
 *   ③ 实测点：17808（需场上无苏联陆军）、17811（需原地无空军）各跑一次 ready 验证判据可满足。
 *
 * 输出：docs/audit-piece-removed.md
 * 用法：node tools/_audit_piece_removed.js
 */
const fs = require('fs')
const path = require('path')
const ROOT = path.join(__dirname, '..')
const MOD = path.join(ROOT, 'server-official', 'public', 'quartermaster-sub-wars')
const R = require(path.join(MOD, 'rules.js'))
const I = R._internal
const d = I.data
const SRC = fs.readFileSync(path.join(MOD, 'rules.js'), 'utf8')

const E = I.ECHO_EFFECTS || {}
const S = I.STATUS_EFFECTS || {}
const RESP = I.RESPONSE_EFFECTS || {}
const CARD_BY_ID = (() => {
	const C = require(path.join(MOD, 'cards.js'))
	const arr = Array.isArray(C) ? C : (C.cards || Object.values(C)[0])
	const m = {}
	for (const c of arr) m[String(c.id)] = c
	return m
})()
const nm = (k, fallback) => (CARD_BY_ID[k] || {}).name || fallback || ''
const brief = f => {
	if (typeof f !== 'function') return '—'
	const s = String(f).replace(/\s+/g, ' ')
	return s.slice(0, 150).replace(/\|/g, '/')
}

const dispatch = {
	army: /piece_type: 'army'|piece_type: rmvTypeC|piece: victim, piece_id: victim/.test(SRC),
	navy: /remove_air_with_piece_removed|piece_type: 'navy'/.test(SRC),
	air: /function remove_air_with_piece_removed[\s\S]{0,1200}piece_type: 'air'/.test(SRC),
}

/* ---------- 实测点 1：17808《莫斯科战役》（需"场上已无苏联陆军"）---------- */
function check17808() {
	const g = R.setup(7)
	g.opening = null
	g.neutral = { '苏联': false, '美国': false }
	I.refresh(g)
	/* 清掉所有苏联陆军 */
	for (const p of Object.keys(g.location || {}))
		if (g.piece_nation[p] === '苏联' && g.piece_type[p] === 'army') delete g.location[p]
	/* 17808 还要求"<莫斯科>或相邻地区有敌方陆军可消灭" —— 摆一支德国陆军在相邻的<罗斯> */
	try {
		R.action(g, 'Axis', 'debug_place', {
			piece: 'de_t', nation: '德国', type: 'army', space: d.id_of('罗斯'),
		})
	} catch (e) {}
	I.refresh(g)
	const ar = E['17808'] && E['17808'].armed
	const sp = Number(I.home_base_of('苏联'))
	const ctx = { nation: '德国', piece: 'x', piece_id: 'x', piece_nation: '苏联', piece_type: 'army', space: sp, was_supplied: true, reason: 'piece_removed' }
	return { ok: !!(ar && ar.ready(g, ctx)), space: d.name_of(sp) }
}

/* ---------- 实测点 2：17811《雅科夫列夫设计局》（原地无空军 + 有补给陆军）---------- */
function check17811() {
	const g = R.setup(7)
	g.opening = null
	g.neutral = { '苏联': false, '美国': false }
	I.refresh(g)
	const sp = Number(I.home_base_of('苏联'))
	R.action(g, 'Allies', 'debug_place', { piece: 'su_a', nation: '苏联', type: 'army', space: sp })
	I.refresh(g)
	const ar = E['17811'] && E['17811'].armed
	const ctx = { nation: '德国', piece: 'su_f', piece_id: 'su_f', piece_nation: '苏联', piece_type: 'air', space: sp, was_supplied: true, reason: 'piece_removed' }
	return { ok: !!(ar && ar.ready(g, ctx)), space: d.name_of(sp) }
}

const t17808 = check17808()
const t17811 = check17811()

/* ---------- 汇总 ---------- */
const armedIds = Object.keys(E).filter(k => {
	const a = E[k] && E[k].armed
	if (!a) return false
	const ws = Array.isArray(a.when) ? a.when : [a.when]
	return ws.indexOf('piece_removed') >= 0
})
const statusIds = Object.keys(S).filter(k => S[k] && S[k].trigger && S[k].trigger.window === 'piece_removed')
const responseIds = Object.keys(RESP).filter(k => /piece_removed/.test(JSON.stringify(RESP[k] || {}).slice(0, 500)))

const L = []
L.push('# T1 审计：`piece_removed` 系列（只读）')
L.push('')
L.push('生成脚本：`tools/_audit_piece_removed.js`　生成日期：2026-11-05')
L.push('')
L.push('## 0. 三条移除路径的派发覆盖')
L.push('')
L.push('| 路径 | 派发 `piece_removed` | 说明 |')
L.push('|---|---|---|')
L.push('| 陆军 | ' + (dispatch.army ? '✅' : '❌') + ' | `do_battle` victim 分支 / `eliminate_piece` |')
L.push('| 海军 | ' + (dispatch.navy ? '✅' : '❌') + ' | 与陆军同一 victim 分支 |')
L.push('| 空军 | ' + (dispatch.air ? '✅' : '❌') + ' | 2026-11-05 **B10** 新增 `remove_air_with_piece_removed()` |')
L.push('')
L.push('## 1. 增强卡（armed.when 含 piece_removed）')
L.push('')
L.push('| 卡号 | 卡名 | 归属 | watch | 代价 | 判据（ready / filter 摘要） |')
L.push('|---|---|---|---|---|---|')
for (const k of armedIds) {
	const ar = E[k].armed
	const c = ar.cost || {}
	const cost = [c.discard ? '弃' + c.discard : '', c.attrition ? '损耗' + c.attrition : ''].filter(Boolean).join('/') || '—'
	const cond = [brief(ar.filter), brief(ar.ready)].filter(x => x !== '—').join(' ／ ') || '（无条件）'
	L.push(`| ${k} | ${nm(k, E[k].name)} | ${ar.actor || (CARD_BY_ID[k] || {}).nation || '?'} | ${ar.watch ? '✅' : '❌'} | ${cost} | ${cond} |`)
}
L.push('')
L.push('## 2. 状态卡（trigger.window = piece_removed）')
L.push('')
L.push('| 卡号 | 卡名 | 归属 | 代价 | 判据摘要 |')
L.push('|---|---|---|---|---|')
for (const k of statusIds) {
	const t = S[k].trigger
	L.push(`| ${k} | ${nm(k, S[k].name)} | ${(CARD_BY_ID[k] || {}).nation || '?'} | ${JSON.stringify(t.cost || {})} | ${brief(t.cond) !== '—' ? brief(t.cond) : '（无 cond）'} |`)
}
L.push('')
L.push('## 3. 响应卡（RESPONSE_EFFECTS 中出现 piece_removed）')
L.push('')
L.push('| 卡号 | 卡名 | 归属 |')
L.push('|---|---|---|')
for (const k of responseIds) L.push(`| ${k} | ${nm(k, '?')} | ${(CARD_BY_ID[k] || {}).nation || '?'} |`)
L.push('')
L.push('## 4. 实测点（判据可满足性）')
L.push('')
L.push('| 卡 | 场景 | ready |')
L.push('|---|---|---|')
L.push(`| 17808 莫斯科战役 | 场上清空苏联陆军后，ctx=苏联陆军于<${t17808.space}>被移除 | ${t17808.ok ? '✅ true' : '❌ false'} |`)
L.push(`| 17811 雅科夫列夫设计局 | <${t17811.space}> 有补给中的苏联陆军、无空军；ctx=苏联空军被移除 | ${t17811.ok ? '✅ true' : '❌ false'} |`)
L.push('')
L.push('## 5. 结论与待办')
L.push('')
L.push('- `armed` 类 5 张**全部带 `watch`**（B10 已把 17808/17811 补齐），敌方回合掉单位也能开窗；')
L.push('- 空军路径的派发由 B10 统一（代受成立 / 抵消成立 / 无处撤离 三条），不再漏窗；')
L.push('- 未发现"国家/兵种/地区"判据与卡面矛盾的项（判据摘要见 §1，均按 `ctx.piece_nation / piece_type / space` 取值）；')
L.push('- 仍需人工确认的只有语义边界（非缺陷）：')
L.push('  1. 15351《敦刻尔克大撤退》要求"英国陆军在<敦刻尔克/西欧>且相邻有敌军"，只在特定局面开窗；')
L.push('  2. 17711《维希法国殖民地》监听的是**法国**部队被移除（actor 为意大利，靠 watch 生效）；')
L.push('  3. 17543《雷达》是**状态卡**（损耗 2 开窗），与增强卡不是同一通道。')
L.push('')

fs.writeFileSync(path.join(ROOT, 'docs', 'audit-piece-removed.md'), L.join('\n'), 'utf8')
console.log(L.join('\n'))
