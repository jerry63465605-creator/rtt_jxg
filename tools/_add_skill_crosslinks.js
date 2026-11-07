/*
 * 给「实现类」与「测试类」skill 各加一段【入口与互补】互链，减少"该加载哪个"的歧义。
 * 只插入在正文标题之后，不改动原有内容；重复执行幂等（已存在则跳过）。
 */
const fs = require('fs')
const path = require('path')
const os = require('os')
const SK = path.join(os.homedir(), '.codebuddy', 'skills')

const BLOCKS = {
	'rtt-event-card-framework': `## 〇、入口与互补（先看这里）

- **本 skill 负责**：这张卡**属于哪一类**、用哪些声明式字段、有哪些结构化范式（判据层）。
- **上游**：\`rtt-fix-workflow\`（动手修之前的流程）。
- **下游**（判据定完再进）：
  - 想知道"这个效果**已经有哪张卡实现过**、代码在哪段" → \`rtt-effect-recipes\`；
  - 想用现成的建设/战斗/补给/计分原子（**禁止自己重写遍历**）→ \`rtt-atomic-operations\`。
- **验证**：真实盘面验收 → \`rtt-realboard-test\`；复现某个 bug → \`rtt-card-bug-repro\`。
`,
	'rtt-effect-recipes': `## 〇、入口与互补（先看这里）

- **本 skill 负责**：效果 → 已有实现卡 → 代码位置的**索引**（抄骨架用）。
- **前置**：先确认"这张卡属哪一类、走哪条通道" → \`rtt-event-card-framework\`。
- **配合**：真正落子时用 \`rtt-atomic-operations\` 的原子，不要照抄旧代码里的手写遍历。
- **边界**：本表只给"抄谁"，不给"该不该属于这一类"——那是 framework 的事。
`,
	'rtt-atomic-operations': `## 〇、入口与互补（先看这里）

- **本 skill 负责**：\`_internal\` 暴露的**原子原语**（建设 / 战斗 / 补给 / 计分 / 标记 / 损耗…）及其用法。
- **前置**：先由 \`rtt-event-card-framework\` 判定"属于哪一类、走 steps 还是 run"，再回来挑原子。
- **找实例**：想知道某效果已经怎么写过 → \`rtt-effect-recipes\`。
- **铁律**：任何"自己 for 循环遍历地区/部队再拼效果"的写法都视为 bug，优先找现成原子。
`,
	'rtt-card-bug-repro': `## 〇、入口与互补（先看这里）

- **本 skill 负责**：把玩家报的一个现象**忠实复现**成可跑的 Node 脚本（定位阶段）。
- **完成后**：用 \`rtt-realboard-test\` 做**验收/回归**（真盘面 + 三层断言 + 客户端点击链）。
- **分工**：本 skill 回答"到底是不是 bug、条件是什么"；realboard 回答"改完在真实局面里还对不对"。
- **不要**：在复现脚本里手写状态替代引擎流程 —— 那会产出假 bug（见本 skill 正文）。
`,
	'rtt-realboard-test': `## 〇、入口与互补（先看这里）

- **本 skill 负责**：**验收/回归**——真盘面或 \`debug_*\` 合成、全真实 action 驱动、三层断言、残留检查、对局级验收。
- **复现阶段**（还不知道是不是 bug、条件是什么）→ 先用 \`rtt-card-bug-repro\`。
- **实现阶段** → \`rtt-event-card-framework\`（分类）→ \`rtt-effect-recipes\`（抄骨架）→ \`rtt-atomic-operations\`（原子）。
- **别混用**：本 skill 的断言默认"实现已改好"，不要在复现还没定性时就直接写 20 项断言。
`,
}

let done = 0
for (const [name, block] of Object.entries(BLOCKS)) {
	const f = path.join(SK, name, 'SKILL.md')
	if (!fs.existsSync(f)) { console.log('skip ' + name); continue }
	let t = fs.readFileSync(f, 'utf8')
	if (t.indexOf('## 〇、入口与互补') >= 0) { console.log('已存在，跳过 ' + name); continue }
	const m = t.match(/^---\r?\n[\s\S]*?\r?\n---\r?\n?/)
	const fm = m ? m[0] : ''
	let body = t.slice(fm.length)
	/* 插在第一个 H1 之后；没有 H1 就插在正文最前 */
	const h1 = body.match(/^#\s+.+\r?\n/)
	if (h1) {
		const idx = h1[0].length
		body = body.slice(0, idx) + '\n' + block + '\n' + body.slice(idx)
	} else {
		body = block + '\n' + body
	}
	fs.writeFileSync(f, fm + body, 'utf8')
	done++
	console.log('✓ 插入 ' + name + '（' + block.length + ' 字符）')
}
console.log('\n完成 ' + done + ' 个')
