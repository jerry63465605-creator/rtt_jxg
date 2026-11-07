/* 把「建盘必须 new_board()」写进交接单 §5 与 fix-log（与 skill 的 V28 同源） */
const fs = require('fs')
const path = require('path')
const ROOT = path.join(__dirname, '..')

const h = path.join(ROOT, 'docs', 'handoff-20261107.md')
let s = fs.readFileSync(h, 'utf8')
const LINE = [
	'',
	'### V28（硬规则）建盘必须走 `new_board()`',
	'',
	'```js',
	"const L = require('./_board_lib')",
	"const g = L.new_board(seed, { nation: '美国', phase: 'play' })   // 内部已完成六国摸 10 弃 3",
	'```',
	'',
	'- 裸 `R.setup()` 会让手牌停在 10 张（真实开局是 7 张）→ 手牌数/弃牌代价/弃牌堆基数断言全部失真；',
	'- 自检：`node tools/_audit_board_setup.js`（期望 ✅ 全部合规，退出码 0）；',
	'- 建完先 `L.report(g)` 看一眼，六国手牌都应是 **7**。',
	'',
].join('\n')
if (s.indexOf('V28（硬规则）') < 0) {
	const i = s.indexOf('## 5. 测试手法铁律')
	const j = s.indexOf('\n## ', i + 5)
	const at = j > 0 ? j : s.length
	s = s.slice(0, at) + '\n' + LINE + s.slice(at)
	fs.writeFileSync(h, s, 'utf8')
	console.log('✓ handoff §5 已补 V28')
} else console.log('• handoff 已有 V28')

const fl = path.join(ROOT, 'docs', 'fix-log-2026-11.md')
let f = fs.readFileSync(fl, 'utf8')
const ENTRY = [
	'',
	'---',
	'',
	'## 2026-11-08 · V28 建盘铁律：一律 `new_board()`（含六国摸 10 弃 3）',
	'',
	'- **起因**：手工建盘用裸 `R.setup()` 后直接插牌 → 各国手牌停在 10 张，与真实开局（7 张）不符，',
	'  导致手牌数/弃牌代价/弃牌堆基数类断言失真（本人连续两局踩到）。',
	'- **落地三层**：① `tools/_board_lib.js` 的 `new_board()`（setup → 清挂起 → 六国 `opening_discard` → 切阶段）；',
	'  ② `tools/_audit_board_setup.js` 扫描全部 `_mk_board_*.js`，裸 setup 即违规（退出码 1）；',
	'  ③ skill `rtt-realboard-test` 写入硬规则 V28（SKILL.md「建盘前必读」+ references/paradigms.md）。',
	'- **顺带修**：`_mk_board_real.js`、`_mk_board_b31.js` 改用 `new_board()`；历史 `_mk_board_7/_final` 白名单豁免。',
	'',
].join('\n')
if (f.indexOf('V28 建盘铁律') < 0) {
	fs.writeFileSync(fl, f.replace(/\s*$/, '\n') + ENTRY, 'utf8')
	console.log('✓ fix-log 已补条目')
} else console.log('• fix-log 已有条目')
