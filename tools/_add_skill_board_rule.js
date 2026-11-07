/* 把「建盘必须走 new_board()（含六国弃3初设）」写进 rtt-realboard-test 的 references，并登记到 skill 总纲 */
const fs = require('fs')
const path = require('path')
const os = require('os')
const SK = path.join(os.homedir(), '.codebuddy', 'skills', 'rtt-realboard-test')

/* 注意：这里用单引号字符串数组拼，避免模板字符串里的反引号提前截断 */
const RULE = [
	'',
	'---',
	'',
	'## V28（硬规则）建盘必须走 `new_board()` —— 否则漏掉「初始阶段：每国摸 10 弃 3」',
	'',
	'```js',
	'// ✅ 唯一正确入口',
	"const L = require('../../tools/_board_lib')",
	"const g = L.new_board(seed, { nation: '美国', phase: 'play' })",
	'//   ↑ 内部：R.setup → 清挂起 → 六国 opening_discard（真实动作，各弃 3）→ 可选切阶段',
	'',
	'// ❌ 禁止',
	'const g = R.setup(seed)          // 手牌停在 10 张，与真实开局（7 张）不符',
	'```',
	'',
	'**为什么是硬规则**：真实开局是「摸 10 弃 3 → 留 7」。裸 `R.setup()` 之后直接',
	'`debug_add_card` 插牌，得到「10 张 + 插入卡」，会让以下判断全部失真：',
	'',
	'- 手牌数断言（如“弃 4 张后还剩几张”）；',
	'- 弃牌类代价是否付得起（`cost.discard` 门槛）；',
	'- 弃牌堆基数（“从弃牌堆取回 1 张”类断言）；',
	'- 任何以“手里有几张”为前提的 `ready()` 预检。',
	'',
	'**自检命令**（改/新建任何 `tools/_mk_board_*.js` 之后跑）：',
	'',
	'```powershell',
	'node tools/_audit_board_setup.js     # 期望输出：✅ 全部合规',
	'```',
	'',
	'它扫描所有 `tools/_mk_board_*.js`：出现 `R.setup(` 却没有 `new_board(` 或手写',
	'`opening_discard` → 判违规（退出码 1）。历史脚本 `_mk_board_7.js`、',
	'`_mk_board_final.js` 已在脚本内白名单豁免。',
	'',
	'**初设结果要肉眼确认一次**：`new_board()` 之后六国手牌应为 **7** 张，例如',
	'`L.report(g)` 输出 `德国 7/70　英国 7/69　日本 7/65　苏联 7/66　意大利 7/59　美国 7/76`。',
	'',
].join('\n')

const f1 = path.join(SK, 'references', 'paradigms.md')
let s = fs.readFileSync(f1, 'utf8')
if (s.indexOf('V28（硬规则）') < 0) {
	fs.writeFileSync(f1, s.replace(/\s*$/, '\n') + RULE, 'utf8')
	console.log('✓ 已写入 references/paradigms.md')
} else console.log('• paradigms.md 已有 V28，跳过')

const f2 = path.join(SK, 'SKILL.md')
let m = fs.readFileSync(f2, 'utf8')
if (m.indexOf('建盘前必读') < 0) {
	const add = [
		'## 〇之二、建盘前必读（硬规则 V28）',
		'',
		'建盘一律 `new_board()`（内部含六国「摸 10 弃 3」初设），不要裸调 `R.setup()`；',
		'自检：`node tools/_audit_board_setup.js`（期望 ✅ 全部合规）。',
		'细则见 `references/paradigms.md` 的「V28」。',
		'',
		'',
	].join('\n')
	const anchor = m.indexOf('## 九、关联 skill')
	if (anchor > 0) fs.writeFileSync(f2, m.slice(0, anchor) + add + m.slice(anchor), 'utf8')
	else fs.writeFileSync(f2, m.replace(/\s*$/, '\n') + '\n' + add, 'utf8')
	console.log('✓ 已在 SKILL.md 加「建盘前必读」段')
} else console.log('• SKILL.md 已有提示，跳过')
