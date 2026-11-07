---
name: rtt-response-stack
description: RTT 响应栈机制：request_responses 压栈、栈顶两阶段判定、trigger/pass/resolve、响应让权与 deferred 帧。
---

# RTT 响应栈（response stack）

## 目的
把"响应卡（对手打出/发生某事件时触发的卡）的结算"做成统一的纯栈模型：每张命中卡压成独立栈帧，深度优先结算，支持多步续打、跨阵营让权、延期续打。核心是把"待发动帧"与"选目标帧"区分开，避免两类典型死锁。

## 何时使用
- 新增/修改任何响应卡 effect（`RESPONSE_EFFECT_IMPL[face]`）。
- 排查响应类 bug："响应卡弹窗不出现""点击发动/不发动没反应""高亮地点点不动""选了没反应""响应结算卡死""同事件多张响应被误清窗口"。
- 改动 `view.response_choice`、`build_actions` 的响应分支、action 入口 gate、或 `request_responses`。

## 核心数据：栈帧
- `game.response_stack`：栈，每项一帧。`top_response_frame(game)` (~L14446) = 最后一帧（**真相源**），`view.response_choice` 与 `build_actions` 都只读它。
- 帧结构（`request_responses` 压栈，~L14349）：`{card_id, card_face, name, owner_side, on, pre, ctx, kind:'space', candidates:[], prompt:'', extra:null, group_id, group_idx, ordered}`。
- **关键**：刚压栈时 `candidates` 为**空**、`kind:'space'`、`prompt:''`。这代表"请持有方决定是否发动"，【不是】"选目标"。

## 压栈与跨阵营让权
- 引擎事件（`build`/`recruit`/`battle`/`piece_removed`/`play_card`/`status_attacked`/`after_card_resolved`/`play_start` 等）调用 `request_responses(game, on, ctx, pre)` (~L14324)。
- `fire_trigger` 取命中卡 → 每张 `push_response_frame` 压栈（同 `group_id` 连续帧）(~L14349)。
- 若持有方是**对方阵营**：`handoff_to(game, owner_side, 'response')` 锁当前方、让权给持有方；同阵营就地决定 (~L14372)。
- `sync_response_queue_view` 维护 `game.response_queue`（栈的派生只读视图，兼容层）。

## 两阶段判定（最易踩坑）
栈顶帧有**两阶段**，决定白名单与 view：

| 阶段 | 判定 | 含义 | 放行动作 |
|---|---|---|---|
| 待发动 | `!_tf.candidates \|\| !_tf.candidates.length` | request_responses 刚压栈，等持有方表态 | `trigger_response` / `pass_response` / `response_reorder` / `response_confirm` |
| 选目标 | `candidates` 非空 | trigger_response 后 effect 返回 pending | 仅 `resolve_response_choice` |

**铁律 1（已修）**：`build_actions` 的 pendingTrigger 分支（~L21702）必须**同时**用 `owner_side===side` **和** `candidates 是否为空` 判定。若仅凭 `owner_side===side` 就放行 `resolve_response_choice`，会把"待发动且持方为本方"误判为选目标 → 漏放 `trigger_response`/`pass_response` → 客户端 `send_action` 因 `view.actions` 无此 key 静默 `return false` → **点击发动/不发动无反应**。正确分支见 L21724-21733。

**铁律 2（已修）**：`view.response_choice`（~L20829）**只**下发给 `pc.owner_side===side` **且** `pc.candidates` 非空的帧。待发动帧（candidates 空）必须 `return null`，由 `view.pending_trigger` 驱动发动/不发动框。否则待发动帧也下发 response_choice，客户端 `update_pending_trigger_box` 的早退逻辑（`if (view.response_choice) return`）会把发动框误掐掉 → 横幅显示"请决定是否发动"却无弹窗。

**铁律 7（2026-10-26 已修·同组多帧必卡）**：`view.pending_trigger` 在【待发动】阶段必须下发
**整组候选**（同 `group_id` 的全部帧、按 `group_idx` 排序），不能只发栈顶单帧。

- 曾为修 17737（"栈里有帧、view 里没框"）把它改成读 `top_response_frame` 单帧，
  于是 `candidates` **恒为 1 张**；而客户端 `update_pending_trigger_box` 用
  `multi = candidates.length > 1 && !ordered` 决定是否渲染「响应卡结算顺序」框
  -> `multi` 永远 false -> **排序框永不出现** -> `response_confirm` 发不出
  -> `trigger_response` 被 gate 拒绝「请先在响应框中确认结算顺序」-> **同组响应卡永久卡死**。
  实测：日本建设海军时 15423《潜艇支援》+ 15424《海军特别陆战队》必现。
- 修法（四处同源）：新增 `response_group_frames(game, frame)` 与
  `response_group_ordered(frames)`（**单帧组视为已确认**，覆盖 defer 搬走兄弟帧后只剩一帧的情形），
  由 `view.pending_trigger` 与 `trigger_response` / `response_confirm` / `response_reorder` 共用。
- **「先确认顺序」只拦 `trigger_response`，`pass_response` 必须放行** ——
  整组放弃不需要顺序，这是 UI 异常时唯一的逃生口（旧实现 gate 横在两者之前，连"不发动"都点不动）。

**铁律 8（2026-10-26 已修·defer 跨组插队）**：`defer` 之后**不能只搬同组兄弟帧**。

- 症状（game 29 实测）：15423 潜艇支援的海战触发 15430 奇袭；奇袭第 ① 步海战后 `defer`，
  栈上还压着**外层 build 事件**的 15424 海军特别陆战队（位于奇袭帧**之下**、待发动）。
  旧实现只搬 `f.group_id === gid`，奇袭组里没有兄弟 → 只把自己存进 deferred
  → 15424 立刻顶上来整张做完 → 奇袭的陆战才恢复 =「一张卡被劈成两半」。
- 修法：`defer_other_pending_frames(game, curFrame, baseIdx)` 搬 **`index < baseIdx`** 的待发动帧。
  **边界极其关键**：`index > baseIdx` 的是 effect 执行期间压入的**嵌套响应帧**，必须先结算，
  一搬就整错（15431《全面侵华》建陆军触发的 build 响应被搬走 → 陆战跑到建设之前，`_smoke_15431_queue` 11/5）。
  一句话：**之上 = 它的嵌套（先结算）；之下 = 外层残留（排它后面）**。
  调用方要在**移除本帧之前**取 `idx` 传进来。
- **续打帧必须带 `pending: true`**（三处：trigger 的 `df`、resolve 的 pending 新帧、resolve 的 defer `df`）。
  缺了它 `trigger_response` 的 `if (f.pending) continue` 失效 → 恢复后把 `effect(undefined)` **从头重跑**
  （表现为"回到《X》"之后又问一次第一次的选择）。
- 排查工具：`node tools/_replay_snap.js <game_id> <snap_id> [--grep 关键词]` ——
  用 `game_snap` + `game_replay` 本地复现真实对局的一段，直接看顺序差异。

## 客户端契约
- 发动/不发动：`view.pending_trigger` 驱动弹窗 → 按钮发 `trigger_response`/`pass_response`。
- 选目标：`view.response_choice`（kind + candidates）驱动高亮/候选 → 点高亮地区或候选发 `resolve_response_choice {choice}`。
- 客户端不二次过滤候选，全部读服务端 view 字段（判定同源）。
- `view.actions` 白名单缺失 = 客户端静默不发（见 rtt-pending-whitelist-deadlock）。

## action 入口与 gate
- `isResponseAction`（~L22299）= trigger_response / pass_response / resolve_response_choice / response_reorder / response_confirm。
- 这些动作**不触发** `clear_armed_offer_for_side`（响应动作属同一事件，不应清掉本国阵营武装窗口，否则同事件另一张响应被误清，~L22294 修正）。
- action 入口 gate（~L22507）对响应动作放行，不被普通 gate 拦截（否则选了没反应）。

## 动作实现（rules.js）
- `resolve_response_choice`（~L22813）：读栈顶帧 → 校验 `owner_side===side` 与 `choice` 在候选内（防伪造 ~L22830）→ 调 `RESPONSE_EFFECT_IMPL[face](game, owner_side, ctx, choice, extra)` → 按返回：
  - 正常 `{ok}`：按引用移除当前 effect 帧（`remove_response_frame(game, pc)`，不再弹栈顶）、`consume_response` 消耗卡、从 `response_queue` 仅剔除此卡（不删整项 ~L22924）、`response_reconcile_active`。
  - `r.pending`：按引用移除当前 effect 帧（`remove_response_frame(game, pc)`），压新帧（带 candidates/prompt/extra）继续挂起；新帧落在 effect 内 `do_battle` 已压入的嵌套响应帧**之上**（故 pending 续打会插在嵌套响应之前，慎用于"含战斗"的卡）。
  - `r.defer`：按引用移除当前 effect 帧（`remove_response_frame(game, pc)`），把"续打帧"存入 `deferred_response_stack`，等此刻触发的响应（同事件的 on:'battle' 嵌套帧、空军代死 `pending_battle` 等）**全部结算完、栈与队列清空后**，由 `promote_deferred_response` 压回活动栈（不消耗卡、不推进队列）。
  - **铁律 3（2026-10-20 已修）**：原三处（pending/defer/ok）一律 `pop_response_frame(game)`（弹栈顶）。但 effect 内 `do_land_battle_at`/`do_battle` 会把 on:'battle' 嵌套帧压到 effect 帧**之上**，弹栈顶会把嵌套帧误删；且 `pending` 续打新帧会插在嵌套帧之前。改为 `remove_response_frame(game, pc)`（按引用移除 effect 帧本身），保留其上的嵌套响应帧。正常卡 pc 即栈顶，行为不变；仅 effect 触发嵌套时行为变正确。
  - **铁律 4（2026-10-20 已修）**：`defer` 帧恢复依赖 `promote_deferred_response`，它仅在 `response_reconcile_active` 的 else 分支（栈与队列都空时，~L14547）被调用。但"含战斗"的响应（如 15425《海军空降部队》）第一次陆战会触发空军代死 `pending_battle`，其结算路径终点只到 `battle_reconcile_active`（~L21757，**不**调 promote）。故：
    - 在 `battle_reconcile_active` 末尾补守卫式提升：`if (!game.pending_battle && !top_response_frame(game)) promote_deferred_response(game)`；
    - 在 `resolve_response_choice` 的 **defer 分支结尾**也补同样守卫（覆盖"第一次战斗未触发任何嵌套帧/空军代死"的空打情形，否则该 defer 帧永不被恢复 → 第二次询问消失）；
    - 守卫条件 `!pending_battle && !top_response_frame` 确保延期帧只在"无任何待结算挂起"时才压回，绝不抢在仍栈上的 on:'battle' 嵌套帧或待决空军代死之前。
  - **铁律 5（2026-10-20 已修·极其致命）**：延期帧的恢复链共 **5 个** promote 调用点，守卫**全部**含 `!(game.battle_in_progress || 0)`：
    `response_reconcile_active` 的 else 分支 / `battle_reconcile_active` 末尾 / `resolve_response_choice` 的 defer 分支结尾 /
    `refresh_armed_window` / `clear_armed_offer`&`removeArmedWindow`。
    历史上 `battle_in_progress` 靠 `do_battle` 体内**逐个出口手写复位**，而 do_battle 有 32 个 return、只有 2 个会复位 ——
    于是"战斗被拒""空打""代受挂起""代受成立"等日常路径都会把标志**永久钉成 true**，此后**全部 5 条恢复路径同时失效**，
    表现为 defer 续打帧永不恢复（15425 第二步询问消失）。这正是"该 bug 与增强卡无关、且时好时坏"的原因。
    现已在 `do_battle` 外包一层 try/finally 做**成对计数**（函数体改名为 `do_battle_inner`），体内三处手写维护已删除。
    ⚠ **此后给 do_battle 新增出口无需再手写复位**（写了反而重复递减）。语义是"此刻是否在 do_battle 调用栈中"，
    "整场战斗是否未决"由 `game.pending_battle` 单独承担。
  - **铁律 6（2026-10-20 已修）**：`resolve_battle` 的每个分支，只要走到"本场战斗已结算完"，
    **必须**调用 `battle_reconcile_active(game)`（它同时负责归还操作权与触达 promote）。
    此前 guard / kv2 / su_step_back 分支都调了，唯独 **defend 出口（空军代受/不代受，最日常的一条）** 直接 `return game`，
    导致 ①`battle_return_active` 悬空、操作权不归还；②promote 无人触达、续打帧永滞 deferred。新增分支务必对齐这一口径。
- `trigger_response`/`pass_response`（~L23009）：发动/不发动；pass 走拦截捕获（被拦截牌进弃牌堆）。
- `response_reorder`/`response_confirm`（~L22952）：组内排序/确认。

## effect 续打协议（多步响应卡的写法）
`RESPONSE_EFFECT_IMPL[face]` 是 effect 函数，签名 `(game, side, ctx, choice, extra)`。
- **首调**（`choice === undefined`）：用 `pick_space_then(game, ctx, undefined, {kind, base:ctx.space, includeBase, nation, prompt})` 取候选，返回 `{pending:true, kind, candidates, prompt, ...}` 并设 `p.extra = {step:'...'}`。
- **续调**（有 `choice`/`extra.step`）：执行动作，返回 `{ok}` 或再次 `{pending, ..., extra}`（更多步）。
- **标准多步骨架**（照抄 15426 驱逐舰运输，~L13637）：
  `if (choice===undefined)` 选第1个目标 → `if (extra.step==='region1')` 执行第1步并询问"是否再一步"（option 候选 `{id:1,name:'…(共2支)'},{id:0,name:'完成(共1支)'}`） → `if (extra.step==='ask2')` 选完成则结束、选继续则 `pick_space_then` 取第2个候选（用 `.filter(c=>c.id!==extra.used)` 排除已用） → `if (extra.step==='region2')` 执行第2步。
- 落地原语：`build_piece(game, nation, type, space)`、`do_sea_battle_at(game, space, nation)`、`do_land_battle_at(game, space, nation)`、`recruit_piece(...)`。每国每格限1支，故"1或2支"= 在1个地区建1支、可选在另1个地区再建1支（落在不同相邻地区）。
- `ctx.space` = 触发该响应的原始地区（如建设/战斗地区），`pick_space_then` 的 `base` 用它取相邻候选。
- **「1 或 2 次」多步卡的第 2 次【允许】落回同一地区**（2026-10-26 玩家裁决，曾误判为禁止）：
  15423 潜艇支援 / 15424 海军特别陆战队 / 15425 海军空降部队 / 15426 驱逐舰运输 四张口径一致 ——
  **不排除首次、不拦执行**。`others`（"是否再战/再建"的判定）也**不能**排除首次，
  否则"只有一格可打"时连问都不问，等于把重复打法阉掉。
  ⚠️ 曾有一轮把 15423/15424/15426 改成"第 2 次排除首次"（还删了 15425 原有的允许写法），
  玩家判定为错误并全部回退。**不要再给这几张卡加去重逻辑。**
  ✅ 该补的是 `p.extra = { step:'battle2', desc1: extra.desc1 }` ——
  第 2 步要拼"第1次结果 + 第2次结果"，丢了 `desc1` 会写出 `undefined`。
  ✅ 失败文案要读 `r.desc`（`do_sea_battle_at` / `do_land_battle_at` 返回 `{ok, desc}`，
  没有 `reason` 字段，读 `reason` 会得到空字符串）。
- **含战斗的卡（如 15425 海军空降部队"1 或 2 次陆战"）铁律**：第一次战斗（`do_land_battle_at`/`do_battle`）会触发 on:'battle' 嵌套响应帧 + 空军代死 `pending_battle`。**绝对不要用 `pending` 续打来问"是否再战"**——pending 新帧会插在嵌套响应/空军代死**之前**，违背"第二次询问须在第一次完全结束后"的玩家口径。**必须用 `defer`**：第一步战斗发起后返回 `{defer:true, candidates: option候选, extra:{step:'ask2',...}}`，续打帧进入 `deferred_response_stack`，由铁律 4 的守卫式提升在第一次全部嵌套结算后才恢复询问（详见 15425 改造）。

## 结算后操作权回收
- `response_reconcile_active`（~L14385）：栈/队列还有后续帧则让权给队首持有方；空了则 `reconcile_handoff` 交还 + `promote_deferred_response` 提升延期帧。
- `defer_response_frame`/`promote_deferred_response`（~L14454）：延期续打帧独立数组，栈清空后压回活动栈（同样按 owner_side 让权）。

## 修改要点（已落地修复清单）
1. **view.response_choice 早退**（~L20842）：加 `if (!pc.candidates || !pc.candidates.length) return null`。让待发动帧不下发，pending_trigger 弹窗出现。
2. **build_actions 漏放**（~L21724）：加 `if (!_tf.candidates || !_tf.candidates.length)` 分支。待发动帧放行 trigger/pass_response；选目标帧才只放行 resolve_response_choice。
3. **pop→按引用移除（铁律 3，2026-10-20）**：`resolve_response_choice` 三处 `pop_response_frame(game)` → `remove_response_frame(game, pc)`（新增同文件 helper，按引用 splice）。保留 effect 内 `do_battle` 触发的 on:'battle' 嵌套帧，不再误删、不再插队。
4. **defer 恢复链（铁律 4，2026-10-20）**：
   - `battle_reconcile_active`（~L21757）末尾加守卫式提升：`if (!game.pending_battle && !top_response_frame(game)) promote_deferred_response(game)` —— 覆盖空军代死 `pending_battle` 结算完后的恢复。
   - `resolve_response_choice` 的 **defer 分支结尾**加同样守卫式提升 —— 覆盖"第一次战斗未触发任何嵌套帧/空军代死"的空打情形（否则 defer 帧永不被恢复）。
5. **15425《海军空降部队》改造（2026-10-20）**：单步陆战 → 两步（1 或 2 次陆战）。`battle1` 步 `do_land_battle_at` 后由 `pending:true` 改为 `defer:true`（续打帧存 deferred，第一次全部嵌套响应/空军代死结算后才问"是否再起 1 次陆战"）。`ask2` 选继续 → `pick_space_then(land)`（方案 A：不排除首次地区）选第 2 次地区 → `battle2` 步再 `do_land_battle_at`。
6. **`battle_in_progress` 改为成对计数（2026-10-20）**：`do_battle` 变成 try/finally 包装（进入 +1 / finally -1），
   函数体改名 `do_battle_inner`；删除体内入口 `=true`、抵消分支 `=false`、正常末尾递减三处手写维护。详见铁律 5。
7. **defend 出口补 reconcile（2026-10-20）**：`resolve_battle` 的代受/不代受分支在成功 return 前补
   `battle_reconcile_active(game)`。详见铁律 6。
8. **诊断三件套（排 deferred 续打帧问题时优先读这三个量）**：
   `game.battle_in_progress` / `game.deferred_response_stack.length` / `view(g,'Axis').response_choice`。
   ⚠ `view.response_choice` **不带 card / card_face**，只有 `name / kind / candidates / prompt` ——
   必须按 **name + prompt** 判定；用卡 id 断言会把"服务端已正确下发"误判成失败（已踩过）。
- 验证：`node --check rules.js`；`_test_resp.js`（7/7 回归）；新增 `_test15425.js`（5/5，验证 defer 恢复机制的三种守卫）；用 `rules.action` 实跑（日本=axis 传 `'Axis'`）断言"第一次陆战及其空军代死/嵌套响应全部结算后，才出现第二次询问"。

## 交叉引用
- `rtt-card-id-face`：card_id（实例）vs card_face（面 id）的区分（effect 用 face 索引 `RESPONSE_EFFECT_IMPL[face]`）。
- `rtt-pending-suspend` / `rtt-pending-clear-side` / `rtt-pending-whitelist-deadlock`：挂起、阵营判定、白名单死锁。
- `rtt-handoff-authority`：跨阵营让权（响应卡跨阵营时 `handoff_to`）。
