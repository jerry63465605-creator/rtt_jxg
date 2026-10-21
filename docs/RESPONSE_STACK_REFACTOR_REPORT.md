# 响应卡栈模型重构报告

> 分支：`response-stack-refactor`（已从 `germany` 切出并 push 至 `origin`）
> 关联计划文档：`docs/REFACTOR_RESPONSE_STACK.md`（三期推进计划与记录）
> 报告日期：2026-10-19

## 一、背景与目标

原响应系统以 `game.response_queue`（聚合壳）+ `game.pending_response_choice` + `game.deferred_response_choice` 三个全局变量管理响应卡调度，存在三类结构性问题：

1. **数据清除 bug**：响应结算链中 `pending` 窗口被误清/覆盖（第一期解决）。
2. **续打上下文丢失**：`deferred` 旧全局在栈化后无处存放，导致"先结算配给(响应)再恢复状态卡"之类的窗口被误杀（第二期解决）。
3. **`status_instant` 清除以动作名白名单豁免**：每新增一个动作就要回头补白名单，易遗漏（第三期解决）。

**目标**：响应系统 100% 走 `game.response_stack` 纯栈模型，移除旧全局变量，从结构上消除脆弱点。

> 注：本报告的改动范围聚焦"响应栈重构任务"，不含分支相对 `main` 的历史性改动（`response-stack-refactor` 含 `germany` 分支全量历史，相对 `main` 约 633 文件 / +71591 行，非本次任务范畴）。

## 二、提交清单（本任务相关）

| commit | 说明 |
|--------|------|
| `c1876b5` | docs: 响应卡引擎栈模型重构说明（入栈模型 + 三期计划）|
| `b2d6261` | 引入 `response_stack` 辅助函数（第一期脚手架）|
| `23057b3` | 第一期第 1 步：续打上下文收编栈帧，`trigger/resolve/promote` 协同，`pending_response_choice` 降级派生 |
| `80d06b3` | 15430 简化为海战→陆战两步，删内嵌 15426 及 defer/newResp/清队列 hack |
| `2524f03` | 纯栈模型落地 Step 4/5/7（第二期核心）|
| `9c34227` | docs: Step 4/5/7 收尾记录；15430 测试适配纯栈 |
| `0e6c1a4` | phase 3: `status_instant` 清除改为挂起态判定 |

## 三、核心代码改动（`server-official/public/quartermaster-sub-wars/rules.js`）

### 3.1 栈基础设施工具函数

| 函数 | 当前行号 | 作用 |
|------|----------|------|
| `push_response_frame(game, frame)` | L14437 | 压响应帧入活动栈 |
| `top_response_frame(game)` | L14446 | 取栈顶帧（唯一活动决策）|
| `defer_response_frame(game, frame)` | L14454 | 把续打帧收编进 `game.deferred_response_stack` |
| `promote_deferred_response(game)` | L14460 | 栈清空后把 deferred 帧 FIFO 压回栈顶 |
| `response_reconcile_active(game)` | L14385 | 栈头帧 `owner_side` 让权/归还；空时调 `promote_deferred_response`(L14404) |

`game.response_queue` 仅保留为 `sync_response_queue_view` 派生的**只读**视图（客户端兼容）。

### 3.2 第一期：续打上下文收编栈帧 + 15430 简化

- `trigger_response`(L22983) 纯栈化：读栈顶帧执行 → `{pending}` 更新帧 / `{defer}` 弹**当前帧**（非栈顶，避免误弹 effect 内部刚压的新响应帧）并存 `deferred_response_stack` / `{ok}` 弹帧 + `consume_response`。
- 15430 由"内嵌 15426 + 新建 resp / 清队列 hack"简化为"海战→陆战"两步（commit `80d06b3`），续打由框架 defer 分支统一收编。

### 3.3 第二期（Step 4/5/7）：纯栈模型落地

- **Step 4** `request_responses` 改压帧：同触发点多卡各自 `push_response_frame` 连续压栈，深度优先语义保持。
- **Step 5** `trigger_response` 由栈驱动（见 3.2）。
- **Step 7** `response_reconcile_active`(L14385) 栈化：基于栈头帧 `owner_side` 让权/归还；栈空队空时 `promote_deferred_response`(L14404) 把 `deferred_response_stack` 帧 FIFO 压回。
- **删除旧全局**：`game.pending_response_choice` / `game.deferred_response_choice` 全部**写入点**已删除；`view.response_choice` 仅 `top_response_frame(game)`；`block` / `build_actions` 读栈。
- **15430 归一**：删 `{defer}` 兼容壳手写（原自写 `deferred_response_choice`），15430 直接返回 `{defer:true}` 由框架 defer 分支统一收编进 `deferred_response_stack`。

### 3.4 第三期：`status_instant` 清除改为挂起态判定（L22303-22325）

**改动前**（动作名白名单）：

```js
const isStatusCascade = action === 'activate_status' ||
	String(action).startsWith('debug_') ||
	action === 'trigger_response' || action === 'pass_response' ||
	action === 'resolve_response_choice' || action === 'response_reorder' || action === 'response_confirm' ||
	action === 'use_armed_offer' || action === 'skip_armed_offer'
if (!isStatusCascade) {
	game.status_instant = []
	game.pending_status = null
}
```

**改动后**（挂起态集合判定）：

```js
const hasSuspended = (game.response_stack || []).length > 0 ||
	(game.response_queue || []).length > 0 ||
	(game.armed_offers && game.armed_offers.length > 0) || game.armed_offer ||
	game.pending_battle || game.pending_econ || game.pending_status_play ||
	game.pending_uranus || game.pending_autobahn
const isStatusInternal = action === 'activate_status' || String(action).startsWith('debug_')
if (!hasSuspended && !isStatusInternal) {
	game.status_instant = []
	game.pending_status = null
}
```

语义等价原白名单（响应/增强结算动作发生时挂起态必非空；独立回合动作发生时挂起态为空 → 清空窗口），但**新增动作只要正确维护挂起态即自动兼容**，结构性消除"白名单遗漏"风险。各瞬态窗口的生命周期绑定其所属挂起（响应栈帧 / 增强窗口 / 战斗经济挂起），挂起解除即关闭。

## 四、验证结果

| 测试 | 结果 |
|------|------|
| `node --check rules.js` | EXIT=0 |
| `tools/_smoke_15431_queue.js` | 16/0 |
| `tools/_smoke_15430.js` | 17/0 |
| `tools/_smoke_fr_respond.js` | 17/0（15346《自由法国》配给优先窗口在响应结算期间保留、结算后转绿）|
| `tools/_smoke_armed_whitelist.js` | 12/0 |
| `tools/_smoke_15328_attacked.js` | 23/0 |
| `tools/check_reuse.js` | B/C 干净（仅 A 类已知索引漂移 WARN）|

### 4.1 客户端接入情况

客户端（`play.js`）**已天然接入、无需改动**，因其只消费服务端下发的 `view` 快照，不直接持有/读取 `game` 引擎内部状态：

- `view.response_choice`（L20829-20844）真相源已从旧全局 `game.pending_response_choice` 改为 `top_response_frame(game)`（纯栈），返回字段形状 `card_id/name/kind/prompt/candidates` 与客户端期望完全一致。
- 客户端 `play.js` 仅通过 `view.response_choice` 渲染响应窗口（`update_response_choice_box` L6577、`if (view.response_choice)` L6945 / `kind === 'space'` L7941 / `kind === 'piece'` L8029），并发送 `resolve_response_choice`（L6591/L7944/L8032）等已在 action 白名单登记的合法动作。
- 客户端 `play.js` 对 `pending_response_choice` / `deferred_response_choice` / `status_instant` / `response_stack` 的引用均为 **0**，故第二期续打（`deferred_response_stack` 自动 promote）与第三期 `status_instant` 挂起态判定对客户端完全透明。
- `view` 现额外下发只读 `response_stack`（L20821-20828）快照，客户端暂未使用，未来若需展示响应栈深度/续打进度可直接消费，无需协议变更。

### 4.2 修复：待发动阶段 response_choice 误发导致发动/不发动弹窗缺失（2026-10-19）

- **现象**：日本出牌阶段开始，顶部横幅显示"响应卡结算中：请决定是否发动《舰队决战》"，但无客户端弹窗可操作。
- **根因（契约不一致 / 违反判定同源）**：`request_responses`（L14324）在"等待发动决定"阶段就把每张命中卡压成 `response_stack` 帧（`kind:'space'`、`candidates:[]`，L14350），使 `view.response_choice`（`top_response_frame`，L20831）在"等待发动"时**已非空**。客户端 `update_pending_trigger_box`（play.js L6945）的 `if (view.response_choice) return` 原意是"已在选目标阶段、抑制发动框"，此时被错误触发，把发动/不发动框掐掉；而 `update_response_choice_box`（play.js L6595）遇到 `kind==='space'` 但 `candidates` 为空只 `toast` 后 return，不弹窗 → 表现为"有横幅、无弹窗"。
- **修复（服务端单点守卫，view.response_choice 生成处 L20838）**：顶帧 `candidates` 为空（即待发动帧）时返回 `null`，仅已发动、确有候选（选目标/选项阶段）才下发。未改动引擎逻辑（`response_stack` / `trigger_response` / `response_reconcile_active` 不变），符合判定同源铁律。
- **验证**：`node --check rules.js` 通过；lint 0 错。客户端无需改动——发动/不发动框由 `view.pending_trigger`（L20232 / 横幅 L21476）正常驱动，且 `update_pending_trigger_box` 的早退假设恢复成立（选目标阶段 `view.response_choice` 仍非空，正确抑制发动框以避免冲突）。

#### 4.2.1 二次症状：弹窗出现但点击"发动/不发动"无反应（同一根因的 action 侧）

- **现象（接续）**：补上 view 守卫后弹窗正常出现，但点击"发动响应"/"不发动"按钮服务端毫无反应。
- **根因（action 白名单遗漏，与 view 侧同源）**：`build_actions`（L21683）在 `pendingTrigger` 分支先读栈顶帧 `_tf = top_response_frame(game)`；当 `_tf.owner_side === side`（待发动帧持有方恰为本方，例如日本出牌阶段日本自己的响应卡）时，原代码**无条件只放行 `resolve_response_choice`**（L21719），把 `trigger_response` / `pass_response` 漏出白名单。客户端 `send_action` 因 `view.actions` 无此 key 而静默 return（记忆 91738748：不在册=静默不发）→ 点击无反应。
- **为何"选目标"分支正确、仅"待发动"误判**：栈顶帧在"选目标"阶段 `candidates` 已被 `trigger_response` 填成非空（L23052），此时只放行 `resolve_response_choice` 是对的；但"待发动"阶段帧 `candidates` 为空，本应放行 `trigger/pass_response`，却被同一 `_tf.owner_side===side` 条件误归到选目标分支。
- **修复（`build_actions` L21714 分支）**：增加候选空判定——`_tf.candidates` 为空（待发动）时放行 `trigger_response / pass_response / response_reorder / response_confirm`；非空（选目标）才只放行 `resolve_response_choice`。与 view 侧守卫（`candidates` 空 → `response_choice=null`）判定口径完全一致。
- **配套性**：view 守卫解决"弹窗出现"、build_actions 修复解决"点击生效"，两者缺一不可；action 入口 gate（L22490-22504）对 `trigger_response` / `pass_response` 本就放行（L22493 显式豁免），无需改动。
- **验证**：`node --check rules.js` 通过；lint 0 错。

## 五、风险与遗留

- `check_reuse.js` 的 A 类 WARN 为 SKILL 索引行号漂移（历史累积，非本次引入）。
- 已知预存失败（与重构无关，已 `git stash` 比对确认 HEAD 同款）：`tools/_smoke_pending_union.js` 6 FAIL、`tools/_smoke_jp_response.js` 8 FAIL、`tools/test_15430_queue_filter.js` 6 FAIL（旧 `response_queue` 中心模型断言，栈模型下已不合时宜）。
- `main` 通过 PR/merge 更新，不在 `main` 直推（feature 分支策略）。

## 六、结论

响应系统已完成从"三全局变量 + 聚合壳"到"`response_stack` 纯栈 + `deferred_response_stack` 续打缓冲"的迁移，并消除 `status_instant` 清除的动作名白名单脆弱点。三期计划（第一期消除数据清除 bug、第二期统一栈替换 queue、第三期栈内/挂起态判定）全部完成，分支 `response-stack-refactor` 已完整承载成果并推送至 `origin`。
