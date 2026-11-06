/* B27：fix-log + todo + 审计文档同步 */
const fs = require('fs')
const path = require('path')
const ROOT = path.join(__dirname, '..')

const entry = [
	'## 2026-11-07 · B27 SUPP（增援）牌库 37 张正式入池',
	'',
	'- **玩家报**：「很多卡很多局都没见过」→ 实测确认：全表 446 张里有 **120 张永不出现**',
	'  （SUPP 37 已实装 + PRELUDE 76 + ARMAMENT 7 未实装），每局可见池只有 326/446 = 73%。',
	'- **根因**：`init_nation_deck()` 里 `if (c.deck !== \'CORE\') continue`，',
	'  原注释「SUPP 牌堆（增援）暂不混入核心牌堆，待规则明确后处理」→ 37 张实现了却从不发牌。',
	'- **改法（玩家裁定"让 SUPP 进牌堆"）**：`if (c.deck !== \'CORE\' && c.deck !== \'SUPP\') continue`，',
	'  PRELUDE/ARMAMENT 继续排除；非 BASIC 各 1 张，不动 `BASIC_CARD_COUNTS`。',
	'- **效果**：六国牌堆 +37（英4/德6/日8/苏3/意4/美12），可见池 326 → 363 种（81.4%）。',
	'- **验证**：`tools/_real_test_supp_in_deck.js` 9 项（逐张入池/张数守恒/整副抽空可见/',
	'  BASIC 复制不变/前奏武备不越界/SUPP 可打出/静态守卫）；文档 `docs/change-supp-in-deck.md`。',
	'- **回归**：`test_basic_cards` 288/9、全量冒烟 112 全绿。',
	'',
	'---',
	'',
].join('\n')

const p = path.join(ROOT, 'docs', 'fix-log-2026-11.md')
let s = fs.readFileSync(p, 'utf8')
if (s.indexOf('B27 SUPP（增援）牌库') < 0) {
	const i = s.indexOf('---\r\n\r\n')
	if (i < 0) { console.log('未找到插入点'); process.exit(1) }
	s = s.slice(0, i + 7) + entry + s.slice(i + 7)
	fs.writeFileSync(p, s, 'utf8')
}
console.log('fix-log =', fs.readFileSync(p, 'utf8').indexOf('B27 SUPP（增援）牌库') >= 0)

/* todo：B27 勾完成 */
{
	const t = path.join(ROOT, 'docs', 'todo-2026-10-29.md')
	let u = fs.readFileSync(t, 'utf8')
	u = u.replace('### B27. SUPP 补充牌库 37 张「已实装但从不入池」——玩家"很多卡没见过"的主因',
		'### ✅ B27. SUPP 补充牌库 37 张「已实装但从不入池」——已修（默认入池，见 docs/change-supp-in-deck.md）')
	fs.writeFileSync(t, u, 'utf8')
	console.log('todo B27 =', fs.readFileSync(t, 'utf8').indexOf('✅ B27.') >= 0)
}

/* 审计文档 §7 标注已修 + 数字更新 */
{
	const a = path.join(ROOT, 'docs', 'audit-card-implementation.md')
	let u = fs.readFileSync(a, 'utf8')
	u = u.replace('| **SUPP** | **37** | **100%** | ❌ **从不入池** |',
		'| **SUPP** | **37** | **100%** | ✅ 已入池（**B27 已修**，2026-11-07） |')
	u = u.replace('> 也就是说这 37 张**已实装但从未被发出**，玩家一局都摸不到。已登记 **B27**。',
		'> 这 37 张曾经"已实装但从未被发出"；**B27 已修**（`init_nation_deck` 收 CORE + SUPP），')
	u = u.replace('> 结论：**"很多卡没见过"不是错觉** —— 每局只能见到 326/446 = 73% 的卡，',
		'> 结论：**"很多卡没见过"不是错觉** —— 修前每局只能见到 326/446 = 73% 的卡（修后 363/446 = 81.4%），')
	fs.writeFileSync(a, u, 'utf8')
	console.log('audit =', fs.readFileSync(a, 'utf8').indexOf('B27 已修') >= 0)
}
