/* 登记 4 条待办（B19~B22） */
const fs = require('fs')
const path = require('path')
const P = path.join(__dirname, '..', 'docs', 'todo-2026-10-29.md')
let s = fs.readFileSync(P, 'utf8')

const block = [
	'',
	'## 2026-11-06 新登记（B19 ~ B22，玩家报）',
	'',
	'### B19. 增强卡拦截窗口（15352 布莱切利园）未强挂起 —— 玩家没时间点就被跳过',
	'',
	'- 现状：`_oppMoment` 门禁只认 `ctx.piece_nation / target_nation`；',
	'  `enemy_echo_played` 的 ctx 是 `{nation, card, space, via, window}`，没有这两个字段',
	'  → 门禁不触发，打牌方可以继续 `next_phase / play_card`，窗口随即过期。',
	'- 实测（`tools/_probe_15352_gate.js`）：窗口存在时德国 `next_phase` 成功进入空军阶段，`被强挂起=false`。',
	'- 方案：把门禁判据改成「窗口内卡片的**归属国**不属于本方阵营」→',
	'  `w.cards[0].nation`（缺省回退 `ctx.piece_nation / target_nation`）；',
	'  这样 15352 / 15353 / 16700 / 15311 等「对方时点」统一强挂起，本方自有窗口仍是"错过即失效"。',
	'- 需回归：B8（piece_removed 强挂起）、15353 拦截 23 项、17732 借用、全量冒烟。',
	'',
	'### B20. 被 15353 压制（无效）的状态卡，15328 密码机也应能弃掉',
	'',
	'- 现状：`step_status_react()` 遇到 `status_suppressed_now()` 时直接 `continue`',
	'  （`rules.js:8751-8754`），被压制的卡**没进 `p.fired`**；',
	'  收尾只在 `fired` 非空时调 `notify_german_status_used()`（L8773），',
	'  且 `mode === \'scoring\'` 一律不上报 → 15328 拿不到目标。',
	'- 方案：① 压制分支也把 `it.cid` 记入「已发动清单」（区分 suppressed / effective 两种标记）；',
	'  ② 计分类（scoring）也上报 —— 与 B14 同源，可合并处理。',
	'- 需回归：15353 拦截 23 项、15328 相关冒烟、计分是否正确（被压制不加分）。',
	'',
	'### B21. 状态拦截窗口在计分/弃牌阶段重复询问两次 + 日志泄露',
	'',
	'- 疑点 A（重复）：`queue_status_react()` 有三处入口（attacked / scoring / econ），',
	'  若同一阶段被调用两次（例：`phase_scoring` 的 `__afterIntercept` 重入 + 另一个触发点），',
	'  `items` 会重建、`it.asked` 归零 → 同一张卡问两次。需实测计数确认。',
	'- 疑点 B（日志）：窗口打开时 `game.log` 里写了「【X】可打出 1 张增强卡」一类的全局日志，',
	'  双方都能看到 → 暴露对方手里有拦截卡。需改为只发给持有方（`view` 字段）或改文案不含可推断信息。',
	'- 方案：① 给 `pending_status_react` 加 `phase_key`（`freq_key`）去重，重复入队直接忽略；',
	'  ② 窗口日志改为 `pending_trigger` 式的持有方可见，不进双方 `game.log`。',
	'',
	'### B22. 17846《坦克运输》：找不到"刚建成的那支陆军"是哪个',
	'',
	'- 现状：`activate_status` 已能通过 `precheck` 拒绝"用错部队"（见 `docs/17846-tank-transport-in-build.md`），',
	'  但**客户端不知道刚建成的是哪一支**：`view` 里没有 `last_built` 的 piece id，',
	'  玩家在"选发起单位"时看到的是全部相邻陆/海军，只能靠猜。',
	'- 方案：① `view.status_instant`（或新增 `view.last_built`）下发 `{piece_id, space, type, nation}`；',
	'  ② 17846 的候选 query 只返回这一支（服务端 `battle_initiators` 加 `only_piece` 过滤）；',
	'  ③ 客户端选单位框给该支加高亮/前缀「刚建成」。',
	'- 需回归：`_smoke_17846_tank_transport.js` 17 项 + 17827 西伯利亚铁路多次建设。',
	'',
].join('\n')

if (s.indexOf('B19. 增强卡拦截窗口') < 0) {
	s = s.replace(/\s*$/, '\n') + block
	fs.writeFileSync(P, s, 'utf8')
}
const back = fs.readFileSync(P, 'utf8')
console.log('回读：B19=', back.indexOf('B19. 增强卡拦截窗口') >= 0,
	' B20=', back.indexOf('B20. 被 15353 压制') >= 0,
	' B21=', back.indexOf('B21. 状态拦截窗口') >= 0,
	' B22=', back.indexOf('B22. 17846') >= 0)
