/*
 * 合并 rtt 挂起系 4 个 skill → 1 个伞形 skill「rtt-pending」
 *
 *   原：rtt-pending-suspend / rtt-pending-clear-side / rtt-pending-whitelist-deadlock / rtt-play-quota-windows
 *   新：rtt-pending/SKILL.md（1 条描述 + 症状路由 + 共性铁律）
 *       rtt-pending/references/{suspend,clear-side,whitelist-deadlock,quota-windows}.md（原文逐字搬入）
 *
 * 原有 4 个目录整体移到 ~/.codebuddy/skills-archive/20261107-rtt-pending/（可还原）
 */
const fs = require('fs')
const path = require('path')
const os = require('os')

const SK = path.join(os.homedir(), '.codebuddy', 'skills')
const ARCH = path.join(os.homedir(), '.codebuddy', 'skills-archive', '20261107-rtt-pending')
const OUT = path.join(SK, 'rtt-pending')
const REF = path.join(OUT, 'references')

const SRC = [
	{ dir: 'rtt-pending-suspend', ref: 'suspend.md' },
	{ dir: 'rtt-pending-clear-side', ref: 'clear-side.md' },
	{ dir: 'rtt-pending-whitelist-deadlock', ref: 'whitelist-deadlock.md' },
	{ dir: 'rtt-play-quota-windows', ref: 'quota-windows.md' },
]

const bodyOf = f => {
	const t = fs.readFileSync(f, 'utf8')
	const m = t.match(/^---\r?\n[\s\S]*?\r?\n---\r?\n?/)
	return m ? t.slice(m[0].length) : t
}

fs.mkdirSync(REF, { recursive: true })
fs.mkdirSync(ARCH, { recursive: true })

/* ① 正文逐字搬进 references（顶部加"原 skill 名"映射，避免交叉引用失效） */
const moved = []
for (const s of SRC) {
	const f = path.join(SK, s.dir, 'SKILL.md')
	if (!fs.existsSync(f)) { console.log('skip ' + s.dir + '（不存在）'); continue }
	const body = bodyOf(f)
	const head = '> **来源**：原 skill `' + s.dir + '`（2026-11-07 并入 `rtt-pending`，细则见本文件）\n' +
		'> 其它三份细则：`references/suspend.md`、`references/clear-side.md`、`references/whitelist-deadlock.md`、`references/quota-windows.md`\n\n'
	fs.writeFileSync(path.join(REF, s.ref), head + body, 'utf8')
	moved.push({ dir: s.dir, ref: s.ref, kb: +(Buffer.byteLength(body, 'utf8') / 1024).toFixed(1) })
	/* ② 原目录归档 */
	fs.renameSync(path.join(SK, s.dir), path.join(ARCH, s.dir))
}

/* ③ 伞形 SKILL.md */
const DESC = 'RTT 挂起/让权/出牌配额总纲：窗口凭空消失、点了没动或打不出、跨 action 丢状态、额外打出或跳过出牌后还能再打一次时，先查这里再进 references 细则。'
const SKILL = [
	'---',
	'name: rtt-pending',
	'description: ' + DESC,
	'---',
	'',
	'# RTT 挂起 / 让权 / 出牌配额（总纲）',
	'',
	'本 skill 是 4 份细则的**路由入口**。先按症状对号，再只读那一份 `references/*.md`（渐进披露：不要一次全读）。',
	'',
	'## 一、症状路由',
	'',
	'| 症状（玩家原话/日志） | 看 |',
	'|---|---|',
	'| 某张多步卡 / 战斗卡 / 国家技能窗口在"看似无关"的动作后**凭空消失**；只在某种出牌顺序下复现（先 A 后 B 可以、先 B 后 A 不行） | `references/clear-side.md` |',
	'| **点了没反应 / 某张牌打不出 / 要先清挂起才能清挂起**；或要访问 RTT 服务器前拿不准端口与主机名 | `references/whitelist-deadlock.md` |',
	'| 挂起**跨 action 丢状态**；`active` 翻转后没还原；让权链断在半路；委派出去后回不来 | `references/suspend.md` |',
	'| **额外打出**后同一张卡还能再点；**跳过出牌**后还能继续出牌；让权他国时 `active` 与 `current_nation` 分属不同阵营；`play_start` 卡同回合连发 | `references/quota-windows.md` |',
	'',
	'## 二、四份细则共用的铁律（写任何一个挂起分支前先过一遍）',
	'',
	'1. **判据用 side，不用 current_nation**：动作入口的 `side` 是"真正执行该动作的一方"，`game.current_nation` 是"回合当前国"，续跑/让权期间二者会背离（`rtt-pending-clear-side` 的核心结论）。',
	'2. **挂起必须能落盘**：跨 action 的挂起字段（`pending_*` / `armed_offers` / `response_stack` / `delegate`）要能 JSON 往返，不能依赖内存变量。',
	'3. **`build_actions` 与 `do_action` 双门禁**：客户端看得见 ≠ 服务端收得下；新增"必须回答"的挂起时，两边都要放行，否则死锁（`rtt-pending-whitelist-deadlock`）。',
	'4. **翻转成对**：`set_pending_delegate` / `finish_delegate`、`active` 的翻出与翻回、控制权转移与归还，都必须成对；否则表现为"卡打完了但轮次乱了"。',
	'5. **错过即失效要有出口**：任何"不等了"的窗口都要有明确收尾（卡进弃牌堆 / 标记作废 / 日志说明），不能留在三处都没有的 limbo。',
	'6. **配额三兄弟别混**：`play_done`（名额）/ `play_acted`（本回合动过手）/ `skip_play_done`（跳过）语义不同，混用会"额外打出后还能再点"（`rtt-play-quota-windows`）。',
	'',
	'## 三、细则索引',
	'',
	'| 文件 | 原 skill | 内容 |',
	'|---|---|---|',
	'| `references/suspend.md` | rtt-pending-suspend | 挂起/让权/委派机制：build_actions 守卫、active 翻转还原、跨 action 落盘、让权链 |',
	'| `references/clear-side.md` | rtt-pending-clear-side | 挂起窗口清理的阵营判定（"凭空消失/顺序依赖"类 bug 的排查手册） |',
	'| `references/whitelist-deadlock.md` | rtt-pending-whitelist-deadlock | 挂起 × 动作白名单死锁（"点了没反应"）+ 服务器探活判据 |',
	'| `references/quota-windows.md` | rtt-play-quota-windows | 出牌配额 × 时点窗口 × 让权交叠的接线铁律 |',
	'',
	'> 合并记录：2026-11-07，由 4 个独立 skill 合并；原文逐字保留在 `references/`。',
	'',
].join('\n')
fs.writeFileSync(path.join(OUT, 'SKILL.md'), SKILL, 'utf8')

console.log('=== 合并结果 ===')
for (const m of moved) console.log('  ' + m.dir.padEnd(32, ' ') + '→ references/' + m.ref + '（' + m.kb + ' KB）')
console.log('  SKILL.md = ' + (Buffer.byteLength(SKILL, 'utf8') / 1024).toFixed(1) + ' KB，描述 ' + DESC.length + ' 字')
console.log('  归档：' + ARCH)
