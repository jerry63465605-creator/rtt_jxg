/*
 * 【D1 审计】前奏 125 张卡「编译产物语义审计」+ 逐卡验收清单生成（只读）
 *
 * 只依赖编译层与 cards.js / rules.js 源码，不改任何产品代码。
 * 用法：node tools/_audit_prelude_semantics.js
 * 产物：docs/checklist-D1-per-card.md
 *
 * 注意：覆盖率 100% 只保证「卡面文字都被识别」，不保证语义正确。
 * 本脚本按可复核的规则批量找可疑项，供玩家实机逐卡验收。
 */
const fs = require('fs')
const path = require('path')
const ROOT = path.join(__dirname, '..')
const MOD = path.join(ROOT, 'server-official', 'public', 'quartermaster-sub-wars')
const P = require(path.join(MOD, 'prelude_compiler.js'))
const C = require(path.join(MOD, 'cards.js'))
const src = fs.readFileSync(path.join(MOD, 'rules.js'), 'utf8')

/* 按国家验收：node tools/_audit_prelude_semantics.js --nation=德国
 * 无参数 = 全 125 张全量清单。国家名只出现在配置里，不写进逻辑判断。 */
const NATION_FILE = { '德国': 'germany', '日本': 'japan', '苏联': 'ussr',
	'英国': 'uk', '美国': 'usa', '意大利': 'italy' }
const nationArg = (process.argv.find(a => a.indexOf('--nation=') === 0) || '')
	.slice('--nation='.length) || null

/* ---- 从 rules.js 源码提取「权威接线集合」，避免审计规则自己硬编码 ---- */
/* rules.js 是 CRLF：必须用 /\r?\n\}\r?\n/ 找顶格结束，
 * 否则会把整个后续文件吞进 block，导致接线集合与 on 映射全错（首轮审计踩过）。 */
function topLevelBlock(startMark) {
	const start = src.indexOf(startMark)
	if (start < 0) return ''
	const tail = src.slice(start)
	const m = /\r?\n\}\r?\n/.exec(tail)
	return m ? tail.slice(0, m.index + m[0].length) : tail
}
const blockOpWindow = topLevelBlock('const PRELUDE_OP_WINDOW = {')
const blockOnMap = topLevelBlock('const PRELUDE_ON_MAP = {')
const blockFilterType = topLevelBlock('const PRELUDE_FILTER_TYPE = {')
const blockDeferred = topLevelBlock('const PRELUDE_OP_DEFERRED = {')
const blockRunOp = topLevelBlock('function prelude_run_op(')
/* 配置表有两种写法：① 一行多个英文 key（`battle: 'battle', after_battle: ...`）
 * ② 中文带引号 key（`'状态卡': ['STATUS']`）。两种都要抓全，否则 R4/R7 全成误报。 */
const keysOf = txt => {
	const out = new Set()
	for (const m of txt.matchAll(/(?:^|\t|, )([a-z_]+):/gm)) out.add(m[1])
	for (const m of txt.matchAll(/'([^']+)':/g)) out.add(m[1])
	return out
}
const windowOps = keysOf(blockOpWindow)
const onMapKeys = keysOf(blockOnMap)
const filterTypeKeys = keysOf(blockFilterType)
const deferredOps = keysOf(blockDeferred)
const caseOps = new Set([...blockRunOp.matchAll(/case '([a-z_]+)':/g)].map(m => m[1]))
const wiredOps = new Set([...caseOps, ...windowOps])
const TYPE_WORDS = ['响应卡', '状态卡', '军备卡', '战略卡', '事件卡']

/* ---- 审计规则 ---- */
const RULES = {
	R1: { level: '高', name: '卡面类型筛选词与「打出」op 语义错位', where: 'prelude_compiler.js 段后处理（P5 收口）/ PRELUDE_OP_WINDOW' },
	R2: { level: '高', name: '检视 op 缺合法 source', where: 'PRELUDE_TOKENS.peek_deck / peek_deck_misc + validate' },
	R3: { level: '高', name: '检视后续 op 缺 peek_scope / source', where: 'prelude_compiler.js 段后处理（source/peek_scope 传播）' },
	R4: { level: '中', name: '卡面类型筛选词未落到选牌 op.filter', where: 'prelude_compiler.js 段后处理 / PRELUDE_FILTER_TYPE' },
	R5: { level: '高', name: '段内含递归打牌 op（可能覆盖段窗口）', where: 'rules.js:prelude_resolve_card / prelude_do_action' },
	R6: { level: '中', name: 'op 既无 case 也无分步窗口（静默丢弃）', where: 'rules.js:prelude_run_op / PRELUDE_OP_WINDOW' },
	R7: { level: '高', name: 'trigger.on 不在 PRELUDE_ON_MAP（军备卡不会触发）', where: 'rules.js:PRELUDE_ON_MAP / prelude_trigger_on_of' },
	R8: { level: '中', name: '卡面关键词与产物不一致', where: 'PRELUDE_TOKENS / parse_text / coverage' },
	R9: { level: '高', name: 'carrier 与 deck/type 不匹配', where: 'prelude_compiler.js:infer_carrier' },
	R10: { level: '中', name: 'op 缺必要参数（space / refs）', where: 'PRELUDE_TOKENS[].emit / prelude_run_op' },
	R11: { level: '高', name: '段分类或代价异常', where: 'prelude_compiler.js:group_segments / compile / validate' },
	R12: { level: '高', name: '编译层自身报 errors / warnings', where: 'prelude_compiler.js:compile' },
}

const cards = C.CARDS.filter(x => x.deck === 'PRELUDE' || x.deck === 'ARMAMENT' ||
	x.type === 'PRELUDE' || x.type === 'ARMAMENT')
	.filter(x => !nationArg || x.nation === nationArg)
const rows = []
for (const x of cards) {
	const text = x.text || ''
	const ir = P.compile({ id: x.id, nation: x.nation, deck: x.deck,
		type: x.type, name: x.name, text })
	const cfg = ir.config
	const segs = cfg.segments || []
	const hits = []
	const hit = (r, detail) => {
		if (!hits.some(h => h.r === r && h.detail === detail))
			hits.push({ r, detail, level: RULES[r].level })
	}
	const allOps = []
	for (const s of segs) for (const o of (s.steps || [])) allOps.push({ o, s })

	/* R1 类型筛选词 vs 打出类 op：P5 只收口了「响应卡」，其余类型词疑似同类错位 */
	for (const s of segs) {
		const fw = (s.filters || []).filter(f => TYPE_WORDS.indexOf(f) >= 0)
		if (!fw.length) continue
		for (const o of (s.steps || []))
			if (o.op === 'play_prelude' || o.op === 'play_prelude_top')
				hit('R1', 'filters=' + fw.join('/') + ' 但 op=' + o.op +
					'（疑似应打出正式牌，却按前奏牌结算）')
	}
	/* R2 / R3 检视来源与传播 */
	for (const { o, s } of allOps) {
		if (o.op === 'peek_reorder' &&
			['formal', 'prelude', 'discard'].indexOf(o.source) < 0)
			hit('R2', 'peek_reorder.source=' + String(o.source))
		if (o.op === 'peek_reorder') {
			const txt = text || ''
			if (/检视前奏牌堆/.test(txt) && o.source !== 'prelude')
				hit('R2', '卡面「检视前奏牌堆」但 source=' + o.source)
			if (/检视弃牌堆/.test(txt) && o.source !== 'discard')
				hit('R2', '卡面「检视弃牌堆」但 source=' + o.source)
			if (/检视牌堆前/.test(txt) && o.source !== 'formal')
				hit('R2', '卡面「检视牌堆前N张」但 source=' + o.source)
			for (const o2 of (s.steps || [])) {
				if (['peek_and_play', 'join_hand', 'play_response'].indexOf(o2.op) < 0) continue
				if (o2.source == null) hit('R3', o2.op + ' 缺 source')
				if (o2.peek_scope == null) hit('R3', o2.op + ' 缺 peek_scope')
			}
		}
	}
	/* R4 类型筛选词是否落到 filter */
	for (const s of segs) {
		const fw = (s.filters || []).filter(f => TYPE_WORDS.indexOf(f) >= 0)
		if (!fw.length) continue
		const pickers = (s.steps || []).filter(o =>
			['peek_and_play', 'play_response', 'join_hand', 'play_prelude'].indexOf(o.op) >= 0)
		for (const f of fw) if (!filterTypeKeys.has(f))
			hit('R4', '类型「' + f + '」无 PRELUDE_FILTER_TYPE 映射')
		if (pickers.length && pickers.every(o => !o.filter))
			hit('R4', 'filters=' + fw.join('/') + ' 但选牌 op 均无 filter')
	}
	/* R5 递归打牌（已知挂起项相关） */
	for (const { o } of allOps)
		if (o.op === 'play_prelude' || o.op === 'play_prelude_top')
			hit('R5', '段内含 ' + o.op + '（递归 prelude_resolve_card）')
	/* R6 未接线 op。PRELUDE_OP_DEFERRED 是 P3 历史残留（P4 已把其中 op 全部接线），
	 * 不作为「已接线」依据，否则会掩盖真缺口；它的残留情况只在摘要里提示。 */
	for (const { o } of allOps)
		if (!wiredOps.has(o.op))
			hit('R6', 'op「' + o.op + '」无 case / 无窗口')
	/* R7 trigger.on 映射 */
	const ons = []
	if (cfg.trigger && cfg.trigger.on) ons.push(cfg.trigger.on)
	for (const t of (cfg.triggers || [])) if (t && t.on) ons.push(t.on)
	for (const s of segs) for (const t of (s.triggers || [])) if (t && t.on) ons.push(t.on)
	for (const on of ons) if (!onMapKeys.has(on)) hit('R7', 'on「' + on + '」无 PRELUDE_ON_MAP 映射')
	/* R8 卡面关键词 vs 产物 */
	const hasPeek = allOps.some(a => a.o.op === 'peek_reorder')
	if (/检视/.test(text) && !hasPeek) hit('R8', '卡面含「检视」但无 peek_reorder')
	if (/\[持续\]/.test(text) && !segs.some(s => s.effectMode === 'ongoing'))
		hit('R8', '卡面含 [持续] 但无 ongoing 段')
	if (/打出1张|打出 1 张|选择并打出/.test(text) &&
		!allOps.some(a => ['play_prelude', 'play_prelude_top', 'peek_and_play',
			'play_response', 'play_response'].indexOf(a.o.op) >= 0))
		hit('R8', '卡面含「打出」但无对应 op')
	/* R9 carrier */
	const isArm = x.deck === 'ARMAMENT' || x.type === 'ARMAMENT'
	if (isArm && ir.carrier !== 'response') hit('R9', '军备卡 carrier=' + ir.carrier)
	if (!isArm && ir.carrier === 'response') hit('R9', '非军备卡 carrier=response')
	/* R10 参数。build/recruit/deploy_air 的 space:null 是 P4「玩家选地区」窗口的
	 * 正常设计，不报；只查需要确定地区才能执行的固定光环类 op 与卡名引用。 */
	for (const { o, s } of allOps) {
		if (['add_marker', 'always_supplied', 'supply_point'].indexOf(o.op) >= 0 &&
			o.space == null)
			hit('R10', o.op + ' 缺 space（不走选地区窗口，无法执行）')
		if (o.op === 'shuffle_into_deck' && !(s.refs || []).length)
			hit('R10', 'shuffle_into_deck 缺 seg.refs（卡名引用）')
	}
	/* R11 段分类 / 代价 */
	for (const s of segs) {
		const c = s.cost || {}
		const noCost = !c.tension && !c.score && !(c.discard || []).length
		if (s.kind === 'optional' && noCost) hit('R11', 'seg' + s.index + ' optional 无代价')
		if (s.kind === 'opponentOptOut' && !s.opponent)
			hit('R11', 'seg' + s.index + ' opponentOptOut 无 opponent（卡面未指定国家；可能是合理缺省，需实机确认答复方）')
	}
	/* R12 编译层自报 */
	if ((ir.errors || []).length) hit('R12', 'errors: ' + ir.errors.join(' / '))
	if ((ir.warnings || []).length) hit('R12', 'warnings: ' + ir.warnings.join(' / '))

	rows.push({ id: x.id, name: x.name, nation: x.nation, deck: x.deck,
		type: x.type, text, carrier: ir.carrier, segs, allOps, hits,
		mainOps: [...new Set(allOps.map(a => a.o.op))] })
}

/* ---- 统计 ---- */
const byRule = {}
for (const r of Object.keys(RULES)) byRule[r] = []
for (const row of rows) {
	const seen = new Set()
	for (const h of row.hits) {
		if (seen.has(h.r)) continue      /* 同一张卡同一规则只计一次 */
		seen.add(h.r)
		byRule[h.r].push(row)
	}
}
const high = rows.filter(r => r.hits.some(h => h.level === '高'))
const mid = rows.filter(r => r.hits.length && !r.hits.some(h => h.level === '高'))
const clean = rows.filter(r => !r.hits.length)

/* ---- 生成清单文档 ---- */
const L = []
L.push('# D1 前奏逐卡验收清单' + (nationArg ? '（' + nationArg + '专项）' : '') +
	'（只读语义审计，2026-11-12）')
L.push('')
L.push('> 由 `node tools/_audit_prelude_semantics.js` 生成，**只读**，不改产品代码。')
L.push('> 覆盖率 100% 只保证「卡面文字被识别」，不保证语义正确；本清单按可复核规则列出可疑项供实机验收。')
L.push('> 行号会漂移，定位一律用符号名 grep；接线点索引见各 `docs/change-D1-*.md`。')
L.push('')
L.push('## 一、审计摘要')
L.push('')
L.push('| 项 | 数 |')
L.push('|---|---|')
L.push('| ' + (nationArg || '全部国家') + '前奏/军备卡 | ' + rows.length + ' |')
L.push('| 高优先级可疑卡 | ' + high.length + ' |')
L.push('| 中优先级可疑卡 | ' + mid.length + ' |')
L.push('| 无命中（仍需实机抽检） | ' + clean.length + ' |')
L.push('')
L.push('| 规则 | 级别 | 命中 | 说明 | 改哪里 |')
L.push('|---|---|---|---|---|')
for (const r of Object.keys(RULES))
	L.push('| ' + r + ' | ' + RULES[r].level + ' | ' + byRule[r].length +
		' | ' + RULES[r].name + ' | `' + RULES[r].where + '` |')
L.push('')
L.push('接线集合（从 `rules.js` 源码自动提取）：`prelude_run_op` case ' +
	caseOps.size + ' 类、`PRELUDE_OP_WINDOW` ' + windowOps.size +
	' 类、`PRELUDE_ON_MAP` ' + onMapKeys.size +
	' 个 on、`PRELUDE_FILTER_TYPE` ' + filterTypeKeys.size + ' 类。')
L.push('')
L.push('`PRELUDE_OP_DEFERRED` 仍有 ' + deferredOps.size +
	' 条 P3 历史残留登记（P4 已把其中 op 全部接线，本审计不把它当作「已接线」依据）。')
L.push('')
L.push('## 二、高优先级逐卡验收（建议先测这些）')
L.push('')
if (!high.length) L.push('（无高优先级命中）')
for (const r of high) {
	L.push('- [ ] `' + r.id + '` ' + r.name + '（' + r.nation + ' / ' +
		r.deck + '·' + r.type + ' / carrier=' + r.carrier + '）')
	L.push('  - 卡面：`' + String(r.text).replace(/`/g, "'").slice(0, 90) + '`')
	L.push('  - 段：' + r.segs.map(s => 'seg' + s.index + ':' + s.kind + '/' +
		s.steps.length + 'op').join('，'))
	for (const h of r.hits)
		L.push('  - **' + h.r + '（' + h.level + '）** ' + h.detail +
			' → `' + RULES[h.r].where + '`')
	L.push('  - 验收要点：对照卡面逐段走一遍，记录「期望 / 实际 / 日志」')
}
L.push('')
L.push('## 三、中优先级逐卡验收')
L.push('')
if (!mid.length) L.push('（无中优先级命中）')
for (const r of mid) {
	L.push('- [ ] `' + r.id + '` ' + r.name + ' — ' +
		r.hits.map(h => h.r + ':' + h.detail).join('；'))
}
L.push('')
L.push('## 四、全量逐卡索引（按主 op 分组，供打勾）')
L.push('')
const groups = {}
for (const r of rows) {
	const key = r.mainOps.length ? r.mainOps.slice().sort().join(',') : '(无 op)'
	;(groups[key] = groups[key] || []).push(r)
}
for (const key of Object.keys(groups).sort()) {
	L.push('### `' + key + '`（' + groups[key].length + ' 张）')
	L.push('')
	for (const r of groups[key])
		L.push('- [ ] `' + r.id + '` ' + r.name + '（' + r.nation + '）' +
			(r.hits.length ? ' ⚠ ' + [...new Set(r.hits.map(h => h.r))].join('/') : ''))
	L.push('')
}
L.push('## 五、已知挂起项（不在本清单里重复）')
L.push('')
L.push('- `14900` 的 A 段 `play_prelude` 连锁打出第二张手牌时，两次 `prelude_resolve_card` 都写 `p.pending`，**前一个段窗口被覆盖丢失**（见 `docs/change-D1-P11-play-flow-b.md` §4）。')
L.push('- 含战斗的多步 `defer` 军备卡续打（58 张实测全单段，当前无卡触发）。')
L.push('- EVENT/ECON 正式牌留场语义、`order` 跨牌堆排序（无现有卡需求）。')
L.push('')
L.push('## 六、验收后怎么修（归类批量，别逐卡打补丁）')
L.push('')
L.push('1. 记录三件事：卡 id + 期望行为 + 实际行为（日志/截图）。')
L.push('2. 按接线点归类：编译层规则 / op 参数 / 执行器映射 / 窗口 kind / `view` 字段 / UI —— 一类问题改一处配置或函数，一次覆盖同组所有卡。')
L.push('3. 每类落一条编号真实测试 + 分层回归，**不**按卡 id 写 `if-else`、**不**改 `cards.js` 卡面。')
L.push('4. 一轮只修一类；改完重跑本审计脚本，命中数应下降。')
L.push('')
L.push('## 七、配套编号测试（分层回归基线）')
L.push('')
L.push('```')
for (const f of ['_test_prelude_compiler.js', '_test_prelude_diy.js',
	'_real_test_P2_prelude_engine.js', '_real_test_P3_prelude_ops.js',
	'_real_test_P4_op_windows.js', '_real_test_P5_armament_response_stack.js',
	'_real_test_P6_semantics.js', '_real_test_P7_inspect_chain.js',
	'_real_test_P8_formal_play.js', '_test_prelude_hand_zone.js',
	'_real_test_P11_play_flow.js', '_real_test_P12_visibility.js'])
	L.push('node tools/' + f)
L.push('node tools/_run_smoke_report.js   # 4 个基线未登记失败 = 零新增')
L.push('```')
L.push('')

const out = path.join(ROOT, 'docs', nationArg
	? 'checklist-D1-' + (NATION_FILE[nationArg] || nationArg) + '.md'
	: 'checklist-D1-per-card.md')
fs.writeFileSync(out, L.join('\n'), 'utf8')

console.log('范围:', nationArg || '全部国家', '| 卡片:', rows.length,
	'| 高:', high.length, '| 中:', mid.length, '| 无命中:', clean.length)
for (const r of Object.keys(RULES))
	if (byRule[r].length) console.log('  ' + r + ' [' + RULES[r].level + '] ' +
		byRule[r].length + ' 张: ' + byRule[r].map(x => x.id).join(','))
console.log('已写出 ' + out)
