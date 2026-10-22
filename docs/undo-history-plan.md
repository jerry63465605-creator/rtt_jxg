# 顶栏改造 / 回退（undo）/ 历史行动记录 — 方案与记录

> 记录日期：2026-10-22。状态：**已实施**（口径按玩家 2026-10-22 确认：可退到本回合开始、需对方同意、历史 120 条）。
> 实际实现见文末 §7；关联：`docs/rtt-integration.md`（上层契约）、`RTT模块开发指南.md` §11（undo/回滚范式）。

---

## 0. 本轮已实施

### 0.1 补 `info/rules.html`（修掉死链）

`play.html` 顶栏「规则」原本指向 `info/rules.html`，但该文件不存在（点了 404）。

已补：

| 文件 | 来源 | 内容 |
|---|---|---|
| `info/1.png` | `easy_rule/1.png` | 一、行动顺序 / 二、回合 / 三、补给 / 四、打出手牌 |
| `info/2.png` | `easy_rule/2.png` | 五、建设 / 六、发起战斗 / 七、空军 / 八、海峡 / 九、计分 |
| `info/3.png` | `easy_rule/3.png` | Episode 2 门前惊雷 · 前奏规则（第 1 页） |
| `info/4.png` | `easy_rule/4.png` | 上页续页（前奏结束条件 / 卡牌变动） |
| `info/join_war.png` | `easy_rule/join_war.png` | 苏联参战 / 美国参战规则 |
| `info/rules.html` | 新建 | 目录锚点 + 5 张图（首图 eager，其余 lazy） |

验证：`GET /quartermaster-sub-wars/info/rules.html` → 200；`info/1.png`、`info/join_war.png` → 200。

> 注：`4.png` 是 `3.png` 的续页，单独放会内容悬空，故一并收入。若不需要可删这两条 `<figure>`。

### 0.2 待办（未做）

- [ ] 测试服打包：**含 `cards/`**（用户 2026-10-22 指定）。清单见 `RTT模块开发指南.md` §13 与上一轮说明。
- [ ] `play.html` 补 `?v=` 版本串（当前 0 处，上线后更新会被缓存）。
- [ ] 本文件 §1–§3 的方案，待确认后实施。

---

## 1. 现状核查（事实，非推测）

| 项 | 结论 |
|---|---|
| 军需官有回退吗 | **没有**。`rules.js` 只有 `setup` 里 `undo: []` 占位（21257 附近），全文件无 `push_undo/pop_undo`，`exports.action` 无 `undo` 分支 |
| 顶栏现状 | `#toolbar`（play.html:19-37）= cog（关于/规则）+ info_menu（海峡/相邻查询）+ `#debug_button`（调试面板） |
| 调试面板 | `#debug_panel`（play.html:452），`toggle_debug()`（play.js:9070），内含 `debug_place/debug_remove/debug_clear` 三个服务端动作 |
| 整局体积 | 实测 120 步后仍只 **10 KB**（初始 8 KB）→ 快照式 undo 成本很低 |
| 上层对 undo 的要求 | `server.js:4408`：`action !== "undo" && state.log.length < old_log_length` 才判为回滚。**只有名为 `undo` 的动作允许截断日志** |
| 上层对回放快照 | `server.js:2598`：快照前 `snap_state.undo = []`（回放不存 undo 栈），体积不受影响 |
| client.js | 无 undo 相关 UI → 必须模块自建按钮（PoG 是在 `#actions` 里 `action_button("undo","Undo")`） |
| PoG 实现 | 服务端 `push_undo()`（动作前深拷贝 game，剔除 `undo/rollback/rollback_state/log`）+ `pop_undo()`；前端 `Undo` 按钮。另有 `rollback`（时间回溯，双方同意，顶栏菜单 + dialog） |
| 随机性 | 军需官无骰子；摸牌走 `game.seed`。快照含 seed → 回退后重做同一操作得到同一结果，**无信息泄露** |

---

## 2. 顶栏改造方案

### 2.1 目标状态

```html
<div id="toolbar">
	<details>                      <!-- cog：菜单项扩为 关于 / 规则 / 调试面板 -->
		<summary><img src="/images/cog.svg"></summary>
		<menu>
			<li><a href="about.html" target="_blank">关于</a>
			<li><a href="info/rules.html" target="_blank">规则</a>
			<li class="separator">
			<li onclick="toggle_debug()">调试面板</li>     <!-- 原 debug_button 移到这里 -->
		</menu>
	</details>
	<details id="info_menu"> ... 不动 ... </details>
	<button id="btn_undo"    title="回退上一步"><img src="/images/cycle.svg"></button>
	<button id="btn_history" title="行动记录"><img src="/images/scroll-quill.svg"></button>
</div>
```

- 回退：`/images/cycle.svg`；记录：`/images/scroll-quill.svg`（仓库已有图标，不新增资源）
- 调试按钮**不删除**，只是从顶栏移进 cog 菜单（保留 `toggle_debug()` 与 `#debug_panel`）
- 回退按钮 `disabled` 条件：`params.mode === 'replay'` 或 `!view.actions.undo`；title 用 `view.undo_reason` 说明为何不可回退

### 2.2 记录面板（历史行动记录）

右侧抽屉（`<aside>` 内、`#log` 上方）或居中 `<dialog class="modal">` 二选一，建议**抽屉**：

- 列表每行：`回合 3 · 德国 · 出牌阶段 · 打出《狼群战术》`
- 行内可展开该步产生的日志（`view.log.slice(from, to)`，不额外占服务端体积）
- 筛选：全部 / 只看出牌 / 只看本方
- 可回退的行右侧给「回退到此处」（走 §3 的 `undo` + `steps`）

---

## 3. 回退（undo）方案

### 3.1 语义

| 项 | 方案 |
|---|---|
| 粒度 | **一次一步**；连续回退 = `steps: n` |
| 谁可以 | 只能回退**本方**阵营最近的动作（`side` 匹配） |
| 何时可以 | 本方动作之后、对方尚未行动之前（对方一动手，本方栈全部作废） |
| 冷却/限制 | `game.game_over` 后禁止；`replay` 模式前端隐藏 |
| 撤销代价 | 无（无骰子、无隐藏信息泄露） |

### 3.2 服务端实现（不动原有 if 链）

原 `exports.action`（23927 行起）改名 `_do_action`，外面套一层 wrapper：

```js
const UNDO_MAX = 20

/* 快照：剔除不能回滚的字段（回放/日志/历史/内部标记） */
function snap_game(game) {
	return JSON.stringify(game, (k, v) =>
		(k === 'undo' || k === 'history' || k === 'log' || k === '_in_action') ? undefined : v)
}

function push_undo(game, meta) {
	const arr = game.undo || (game.undo = [])
	arr.push({
		s: snap_game(game),
		log_len: game.log.length,
		hist_len: (game.history || []).length,
		side: meta.side,          // 'axis' | 'allies'：真正执行方
		label: meta.label,
	})
	if (arr.length > UNDO_MAX) arr.splice(0, arr.length - UNDO_MAX)
}

function do_undo(game, side, arg) {
	const steps = Math.max(1, Math.min(Number((arg && arg.steps) || 1), UNDO_MAX))
	if (game.game_over) { game.log.push('对局已结束，不能回退'); return game }
	const arr = game.undo || []
	if (!arr.length) { game.log.push('无可回退的步骤'); return game }
	/* 只能撤销本方最近连续的动作 */
	for (let i = 1; i <= steps; i++)
		if (!arr[arr.length - i] || arr[arr.length - i].side !== side)
			return game.log.push('只能回退本方最近的动作'), game
	const entry = arr[arr.length - steps]
	const save = JSON.parse(entry.s)
	/* 先存后还：快照里没有的字段必须保住（开发指南 §11.2 的真实事故） */
	const log = game.log, undo = arr, hist = game.history || []
	Object.keys(game).forEach(k => delete game[k])
	Object.assign(game, save)
	game.log = log
	game.undo = undo
	game.history = hist
	undo.length = arr.length - steps
	game.log.length = Math.min(entry.log_len, game.log.length)
	game.log.push('** 已回退：' + (entry.label || '上一步') + ' **')
	return game
}

exports.action = function (state, current, action, arg) {
	const game = state
	/* 内部 resume 再入（rules.js:24902 / 26688）不压栈、不记历史 */
	if (game._in_action) return _do_action(state, current, action, arg)
	if (action === 'undo') return do_undo(game, side_of(current), arg)

	const side = current === ALLIES_ROLE ? ALLIES : AXIS
	const from = game.log.length
	push_undo(game, { side, label: label_of(action, arg) })
	game._in_action = true
	try {
		return _do_action(state, current, action, arg)
	} finally {
		delete game._in_action                      // 必须清，否则写进存档
		record_history(game, { action, arg, side, current, from })
	}
}
```

要点：

1. `undo` 在**任何**"错过即失效"清理之前处理，避免撤销时先清窗口。
2. `_in_action` 用 `try/finally` 清理；它只存在于一次调用期间，不会落库。
3. 内部 resume 调用的是 `exports.action`（24902、26688），靠 `_in_action` 直通，避免一步动作压出十几个快照。
4. `label_of`：`play_card` → `打出《卡名》`；其余按 action 映射中文名（建设陆军/发起战斗/推进阶段/响应…）。
5. 日志截断后由上层判定为回滚，**回放快照会自动清理**——这是期望行为。

### 3.3 体积

- 单局 10 KB × 20 步 ≈ 200 KB（上限）。每步 action 都会整局落库 → 存档从 10 KB 涨到约 200 KB。
- 若不可接受：`zlib.deflateSync(JSON).toString('base64')`（Node 内置）约压到 1/5～1/8，即 25–40 KB；或把 `UNDO_MAX` 降到 8。
- 建议先 `UNDO_MAX = 20` 且不压缩，实测存档体积后再决定。

### 3.4 必须防的坑

| 坑 | 处理 |
|---|---|
| 恢复时把 `log/undo/history` 清空 | 先存后还（见上） |
| 内部 resume 导致每步压多个快照 | `_in_action` 直通 |
| 撤到对方已行动之前 | `side` 逐条校验 |
| 撤销破坏挂起窗口（pending_*） | 快照是整局覆盖，天然一致；不要"局部回滚" |
| 老存档没有 `undo`/`history` 字段 | 所有访问都 `|| []` 兜底 |
| 回放模式误点 | 前端 `params.mode === 'replay'` 隐藏/禁用；服务端 `dont_snap` 无需改 |

---

## 4. 历史行动记录（全局出牌记录）

### 4.1 数据结构（只存索引，不复制日志）

```js
game.history = [{
	n: 1,                          // 序号
	turn: 1, phase: 'play',        // 回合 / 阶段
	nation: '德国', by: 'Axis',    // 当前国 / 操作阵营（side）
	action: 'play_card',           // 动作名
	label: '打出《狼群战术》',       // 摘要
	from: 41, to: 47,              // 对应 game.log 的区间（前端 slice 取详情）
	card: '15249#1',               // 可选：出牌时记卡实例 id，便于跳转预览
}]
```

- 记录点：wrapper 的 `finally`，`from = log.length`（动作前）、`to = game.log.length`。
- 只记"有日志产出"的动作，纯查询/无效果动作不记。
- 上限：保留最近 **80** 条（`history.length > 80` 时 `splice(0, extra)`），另存 `history_total` 计数用于显示"共 N 步"。
- 体积：80 × ≈100 B ≈ **8 KB**（可忽略）。

### 4.2 view

```js
view.history = game.history || []          // 全量（已截断到 80）
view.actions.undo = can_undo ? 1 : null    // 顶栏按钮可用性
view.undo_reason = can_undo ? null : '对方已行动 / 无可回退步骤'
```

### 4.3 前端

- 顶栏「记录」→ 抽屉列出 `view.history`（倒序，最新在上）
- 每条可展开 → `view.log.slice(from, to)` 渲染详情
- 「回退到此处」= `send_action('undo', { steps: 当前长度 - 该条 n })`（仅在 `by === 本方阵营` 且其后没有对方动作时可点）
- 出牌条目可点击弹卡面预览（复用 `show_card_preview`）

---

## 5. 分期与工时

| 阶段 | 内容 | 风险 | 预估 |
|---|---|---|---|
| **P1** | 历史行动记录（只读）+ 顶栏两个按钮骨架 | 极低（不改规则） | 1 h |
| **P2** | 单步 undo（本方最近一步）+ 顶栏「回退」可用性 | 中（入口 wrapper） | 2 h |
| **P3** | 回退到任意历史点（`steps`）+ 抽屉内「回退到此处」 | 低（P2 之上加参数） | 1 h |
| **P4**（可选） | 双方同意的时间回溯（PoG `rollback` 完整版：提议/审阅/接受） | 高（新增状态机） | 0.5 d |

建议先做 **P1 + P2**（顶栏一次改到位），P3 紧随，P4 看是否需要。

---

## 6. 玩家确认口径（2026-10-22）

1. 回退范围：**允许退到本回合开始**（当轮内任一国家回合开始的检查点）；
2. **必须对方同意**才生效（PoG rollback 语义，不是单方撤销）；
3. 顶栏两按钮：`回退`(cycle.svg) + `行动记录`(scroll-quill.svg)，调试移入 cog 菜单 —— 通过；
4. 历史保留 **120 条**。

---

## 7. 实施记录（2026-10-22）

### 7.1 服务端（`rules.js`）

| 位置 | 内容 |
|---|---|
| 顶部 | `require('zlib')`（检查点压缩；rules.js 仅服务端加载） |
| 「四点五」新节 | `HISTORY_MAX=120`、`ROLLBACK_MAX=60`、`rollback_pack/unpack`、`push_rollback_point`、`record_action_history`、`rollback_points_of`、`do_propose_rollback`、`do_answer_rollback`、`do_cancel_rollback` |
| `create_empty_game_state` | 新增 `history: []`、`history_total: 0`、`rollback: []`、`rollback_proposal: null` |
| `exports.action` 的 `finally` | **每步一个检查点**（`n = history.n`，与行动记录一一对应；无日志产出的动作不压点） |
| `setup` 末尾 | 压开局检查点（`n=0` / `开局`） |
| `do_action`（原 `exports.action` 主体） | 改名；入口新增「提议待确认期间只放行同意/拒绝/撤回/log」守卫 |
| `exports.action`（新 wrapper，文件末尾） | `_in_action` 去重内部 resume；`from=log.length`；`finally` 里 `record_action_history`；四个回退动作分派 |
| `build_actions` 外层 | 追加 `propose_rollback` / `accept_rollback` / `reject_rollback` / `cancel_rollback`（内层有十几处排他式提前 return，写在内层会漏） |
| `exports.view` | 新增 `history`、`history_total`、`rollback_points`、`rollback_proposal`、`can_propose_rollback` |
| `exports.dont_snap` | 提议挂起期间返回 true（回放里不产生多余跳点） |

### 7.2 前端

| 文件 | 内容 |
|---|---|
| `play.html` | 顶栏：调试按钮 → 「回退」`btn_rollback`(cycle.svg) + 「行动记录」`btn_history`(scroll-quill.svg)；调试移入 cog 菜单；`</main>` 后新增 `#history_panel` 抽屉与 `#rollback_bar` 横幅 |
| `play.js` | `toggle_history` / `update_history_ui` / `update_rollback_bar` / `propose_rollback_to` / `answer_rollback` / `cancel_rollback`；接进 `update_map()`；回放模式（`params.mode==='replay'`）禁止提议 |
| `play.css` | 抽屉（右侧 fixed，深色）+ 检查点行 + 流水行（本方轴心红/同盟蓝左边框）+ 横幅样式 + 手机满宽 |

### 7.3 实测数据

> 【2026-10-22 二次对齐】玩家要求对齐上层 admin rewind 的粒度（截图里 `REWIND 130/129/128…`），
> 即**每一步都可退**，并确认参数：**60 个检查点 + 剔除 `limited_connections`**。
> 下表为二次对齐后的实测值。

| 指标 | 值 |
|---|---|
| 单个检查点（deflate+base64，已剔除 `limited_connections`） | **3.27 KB** |
| 检查点上限 | **60 个**（约 196 KB） |
| 整局存档（140 步、120 条历史、60 检查点） | **232.8 KB**（其中 rollback 196 KB、history 16.9 KB） |
| `view` 体积 | **54.7 KB** |
| 历史条目上限 | 120（`history_total` 累计） |
| 检查点编号 | `n` = 行动记录编号（`0` = 开局），前端在历史条目右侧直接「↺ 回退」 |

### 7.4 测试

`tools/_smoke_history_rollback.js`：**52 项 ALL PASS**。覆盖：初始字段、记录与 `log.slice` 一致性、120 条裁剪、提议/切 active/白名单、提议期间动作被拦、拒绝、同意（盘面/日志/历史/检查点全部回退 + 新落子消失 + 编号连续）、权限（非行动方/自批/撤回）、检查点范围（turn=0 越界点被拒）、JSON 存档往返后仍可回退。

回归：模块 40 个 `_smoke_*.js` 中 19 个既有失败名单与本轮改动前**完全一致**；仓库 75 个 `tools/_smoke_*.js` 逐项 PASS/FAIL 行数差异 **0**。

### 7.5 与上层 admin rewind 的差异（2026-10-22 二次对齐后）

| 维度 | admin rewind（上层 `/join` 页） | 本模块（玩家版） |
|---|---|---|
| 快照来源 | `game_snap` 表（DB） | `game.rollback`（随 state 落库，deflate 压缩） |
| 粒度 | 每 move 一份 | **每步一份**（`n` = 行动记录编号） |
| 保留量 | 全部历史 | 最近 **60** 步 |
| 谁能发起 | `user_id===1` / moderator | 当前行动方（`view.actions.propose_rollback`） |
| 需对方同意 | 否 | **是**（`accept_rollback` / `reject_rollback` / `cancel_rollback`） |
| 恢复实现 | 直接写 DB + 重推 state（不经过 rules） | 模块内覆盖 state（`Object.assign` + `refresh`） |
| 回放快照 | 主动 `delete_snaps_after_rollback` | 由上层 `is_rollback`（`state.log.length` 变短）自动删 |
| `games.moves` | 减到 `snap_id-1` | **不减**（上层字段，模块无权限） |
| `undo` 栈 | 清空 | 保留（可连续回退） |

### 7.6 仍待办

- [x] `play.html` 补 `?v=20261022` 版本串（`play.css` / `data.js` / `layout.js` / `play.js`）。
- [x] 测试服打包（含 `cards/`）：`quartermaster-sub-wars-testserver-20261022.zip`
      469 文件 / 177.1 MB / SHA256 `B0A7D8941ECDF7900C3DB3FD585DE053948B85561B375A7EF00960DA5EFA26D3`
- [ ] 可选优化：`view.history` 只下发最近 60 条（当前 120 条占 view 约 17 KB）。
