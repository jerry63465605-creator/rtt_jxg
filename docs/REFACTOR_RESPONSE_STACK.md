# 响应卡引擎重构说明：基于「入栈」模型

> 本文档定义"响应卡逻辑"从当前"三全局变量"模型迁移到"统一栈"模型的完整方案，并给出分期推进计划。所有改动**复用现有原子**（`request_responses` / `fire_trigger` / `handoff_to` / `reconcile_handoff` / `counter_air_options` / `battle_initiators` 等），不重写底层遍历。

---

## 0. 文档目的

1. 记录当前响应引擎的核心运行原理、全部触发条件与"归还我方时数据清除"的根因；
2. 给出基于"入栈"模型的新设计（入栈顺序、分步执行、判定/结算顺序、插入优先级、中止条件、可预测性）；
3. 明确数据清除的判定时机、影响范围与处理方式；
4. 给出可独立回滚的三期推进计划。

---

## 1. 现状与问题（Root Cause）

当前响应系统由 **三个全局变量** 拼成（见 `rules.js`）：

- `game.response_queue`（`request_responses` @ `L14376`）：同一触发点的多张卡聚成一个 `item`；结算中触发的新响应 `splice(1,0,…)` 插队头之后（深度优先，`L14419`）。
- `game.pending_response_choice`（`trigger_response` pending 分支 @ `L23064`；`resolve_response_choice` @ `L22798` 写入）：单卡 effect 返回 `{pending}` 时挂起的"待选"。
- `game.deferred_response_choice`（`trigger_response` defer 分支 @ `L23089`；`promote_deferred_response` @ `L14484` 提升）：effect 返回 `{defer}` 时存"续打步骤"。

### 1.1 空军"替死"机制（独立于响应引擎，但交互紧密）

`do_battle`（@ `L16091`）内的两段挂起，是响应卡发起战斗后"挂起给敌方"的来源：

- **代受（defend_air）**：防守方同地区同国空军代替被攻击单位受创（原目标保住，空军移除）。触发：`guardAirs.length && opt.defend_air===undefined && opt.air_retreat===undefined && !opt.declined_defend_air`（`L16474`）；决策权经 `delegate_of_nation` 映射（`L16483`）。
- **抵消（counter_air）**：发起方用相邻本国空军抵消这次代受（原目标照常移除，双方各损失 1 支空军）。触发：防守方已选代受且发起方有 `counter_air_options` 且未表态（`L16636`）。
- 两阶段都表态后才落地（`L16668-16766`）；战斗"成功"钩子 `request_responses('battle',…)` 只在两段解完后派发（`L16722` / `L16759`）。
- 挂起全局锁：`game.pending_battle` 期间除 `resolve_battle`/调试外一切操作被挡（`L22457`）。

### 1.2 数据清除陷阱（重点）

> **[2026-10-19 第一期缓解]** 已引入 `response_stack` 帧 + 双写：`game.pending_response_choice` 降级为 `top_response_frame(game)` 的**派生视图**（L22784/22824 等），`view`/`block`/白名单读栈顶帧；15430 仍保留 `{defer}` 兼容壳（`deferred_response_choice` 双写）。故"嵌套响应覆盖续打上下文"的事故路径已堵：15430 海战→陆战步存于帧 `extra.step`，不再依赖手写 `defer` 防覆盖（15426 由触发层自动调度，见 3.9）。**第二期将彻底删除 `pending_response_choice`/`deferred_response_choice` 旧全局**（见 4·第二期）。

`pending_response_choice` 原是 **单一全局**。当某响应卡（如 15430 奇袭）发起战斗，战斗又触发敌方新响应 G，G 结算时也会写 `pending_response_choice`，**直接覆盖**原卡续打上下文。因此 15430/15426 必须手写 `{defer:true}` 把上下文挪到 `deferred_response_choice` 才能幸免（15430 @ `L13823`，第一期仍保留此兼容壳）。一旦某卡忘记返回 `defer`，上下文丢失 → 窗口卡死（见：驱逐舰运输窗口卡死、15346 配给优先被 `status_instant` 清除误杀）。

另一个清除点：`status_instant` 窗口在 action 入口被清（`L22310-22332`），现用**动作名白名单**豁免（`trigger`/`pass`/`resolve`/`reorder`/`confirm`/`use`/`skip_armed_offer`），属打补丁式修复，新增动作易遗漏。→ 第三期改为栈内判定（见 4·第三期）。

---

## 2. 目标

1. 续打上下文**结构性**消除"被覆盖"风险（不再依赖各卡手写 `defer`）。
2. 入栈 / 插入 / 结算 **可预测**，支持中途插入新响应。
3. 数据清除只在显式边界发生，范围局限于帧内。

---

## 3. 统一栈模型

### 3.1 栈结构

引入 `game.response_stack`：帧数组，**栈顶 = 当前唯一活动决策**。

```js
frame = {
  card_id, face, owner_side,
  ctx,                       // 触发上下文
  step, extra,              // 该卡多步状态机状态（原 pending/defer 的私有数据）
  pending,                  // 是否正在等玩家选择
  kind, candidates, prompt, // 当前询问
  origin_on, origin_ctx,    // 触发来源（结算后回放/重放）
}
```

- `pending_response_choice`、`deferred_response_choice` **消失**，其数据归入帧字段。
- `response_queue` 的 `item` 改为"连续入栈的若干帧"（同触发点多卡 = 连续帧）。

### 3.2 入栈顺序与排列规则

- **触发点**：`fire_trigger` 命中多张卡 → 作为"触发组"连续压栈；组内按玩家在 `response_reorder`/`response_confirm` 确认的 `order` 排序（FIFO）。
- **结算中触发（深度优先）**：`_resp_settling` 期间新触发的响应压到 **栈顶**，优先于原帧结算 → 泛化当前的 `splice(1,0)`。
- 组间/组内顺序在栈上显式可见，无隐式重排。

### 3.3 严格分步执行规则

每帧是 step 状态机，唯一活动帧 = 栈顶：

1. **JUDGE（判定）**：归属/权限 → 目标合法性 → 前置条件。任一不满足 → 帧 `pop` 并记为"跳过消耗"，**不产生任何副作用**。
2. **SETTLE（结算）**：通过判定才变更局面。
3. **续步**：effect 返回 `{pending}` → 帧留栈顶（仅更新 `frame.pending/candidates/prompt`）；返回 `{defer}` → "续打"作为 **新帧压栈顶**（原帧压在下面，不丢）；返回 `{ok}` → `pop` + 消耗该卡。

### 3.4 每一步的判定顺序与结算顺序

固定顺序，绝不穿插：`权限校验 → 目标有效性 → 前置条件 → 结算变更 → 后置钩子(request_responses / arm_after_battle_status / star_resolved) → 发下一步 pending/defer 或 pop`。判定失败立即 pop，不进入结算。

### 3.5 插入响应的优先级规则

- 结算帧 F 过程中新触发的响应 → **压栈顶** → 先生效（深度优先）。
- 明确规则：**F 结算期间发生的触发，永远落在 F 之上；F 只有等上方帧全部 pop 后才继续**。

### 3.6 响应的中止条件

- effect 返回 `{ok}`（无 pending/defer）→ pop + 消耗。
- `pass_response` 作用于栈顶帧 → pop + 消耗（留桌面）。
- JUDGE 失败 → pop + 记为跳过。
- 栈空 → `response_reconcile_active` 交还操作权；若有被 defer 的续打帧，重新压栈顶恢复。

### 3.7 可预测性 + 中途插入新响应

- `view.response_stack` 向客户端暴露完整栈（每帧 `prompt`/`owner_side`/`step`），玩家精确看到当前挂起顺序与"谁在等决策"。中途插入的新响应实时出现在栈顶，完全可预测。
- 任意时刻只有栈顶是活动决策，中途插入不改变既有帧数据，只改变"接下来先解哪帧"。

### 3.8 数据清除处理（重点）

**根因**：续打上下文存在单一全局 `pending_response_choice`，被嵌套响应覆盖 → 只能靠各卡手写 `{defer}` 规避。

**修复（结构性）**：续打上下文 **就在帧内**（`frame.step/extra/pending`）。当响应帧 F 发起战斗：

- `do_battle` 设 `pending_battle` 并把操作权让给敌方 → **F 仍留在栈上（suspended，不 pop）**。
- 敌方 `resolve_battle` → `do_battle` 完成 → 派发 `'battle'` 响应 → 这些新响应 **压栈顶**，深度优先结算。
- 栈退回到 F 时，`frame.step/extra` 原封未动 → 自动续步（如 15430 的陆战步）。**无数据丢失**。

**清除时机（显式边界）**：瞬态窗口（`status_instant`、增强窗口）只在两类边界清除：

1. 其 **所属帧 pop** 时（该事件的窗口随帧关闭）；
2. 发生 **非栈内"真实"动作** 时（玩家去出牌/推进阶段等）。

嵌套帧的结算 **绝不** 清除下方帧的窗口。

**清除范围**：只清"瞬态 UI/决策窗口"，**绝不**触碰栈帧数据本身。

**替代白名单**：把 `L22324` 的"动作名枚举豁免"改为"本动作是否属于解析该栈"的判定（`game.response_stack.length>0 && 动作在处理栈`），更稳、不随新增动作名遗漏。

### 3.9 案例：15430「奇袭」内嵌 15426 是多余的

**现状**：15430 当前用 `extra.step` 状态机走三步（海战 → 询问是否发动《驱逐舰运输》→ 陆战），并在 `step='transport'` 内**手动内嵌调用 15426** 的效果实现（`runTX`/`buildCont`/`landCont`/`optCont`），再靠手写 `{defer}` + `newResp` 签名对比把奇袭续打存进 `game.deferred_response_choice`，以防被嵌套响应覆盖（见 1.2）。此外，海战自动触发 15426/15430 自身副本时，15430 还要手动"清队列拷贝"（`L13793-13799`）避免重复弹出。

**设计结论**：**15430 内嵌调 15426 是多余的**。海战结束后本来就有时点会向各方发起响应询问（即 `do_battle` 成功钩子 `request_responses('battle',…)`，15426「驱逐舰运输」正是 `on:'battle'` 后建陆军的响应卡）。因此：

- 15430 只需保留【海战 → 陆战】两步，中间的"是否发动驱逐舰运输"选项删除；
- 15426 作为海战后的独立响应卡，由触发层在响应时点自动调度，玩家在响应窗口自行决定是否发动；
- 由此，`runTX`/`buildCont`/`landCont`/`optCont` 整套内嵌机制、手写 `{defer}`、`newResp` 签名对比、`L13793` 清队列拷贝 hack **全部删除**。

**重构后 15430**（两步 + 栈帧承载）：

1. `step='sea'`：帧 `kind:'space'` 选海域海战；海战触发敌方/他国响应 → 新帧压栈顶，15430 帧 suspended 在下方。
2. 海战结算完退回 15430 帧 → 引擎推进到 `step='land'`：帧 `kind:'space'` 选陆地陆战 → `{ok}` → 帧 pop + 消耗。
3. 15426 及其触发的他国响应在栈上独立成帧，深度优先结算，互不覆盖。

**分期归属**：本简化列入第一期"卡逻辑清理"子项（见 4）。

---

## 4. 分期推进计划

### 第一期（消除数据清除 bug，最低风险）✅ 已完成

**状态（截至 2026-10-19）**：全部 7 步已落地。
- 第 1 步（栈辅助 + 双写）：commit `23057b3`
- 第 7 步（15430 简化删内嵌 15426 机制）：commit `80d06b3`
- 第 2–6 步（真相源转正：`view.response_stack` 暴露、`view`/`block`/白名单读栈顶帧、`pending_response_choice` 降为派生）：本期改动（分支 `timed-save-1`，**待 commit**）
- 验证：15430 17/17、15431_queue 14/14、fr_respond 17/17 全绿；`check_reuse` 仅 A 类已知行号漂移 WARN，无 B/C（无新增原子绕过/重复）。客户端零改动（只读 `view.response_choice`，结构不变，铁律 5 满足）。

**目标**：续打上下文收编为栈帧字段，保留 `response_queue` 兼容壳；15430/15426/15431 等平滑过渡。

**步骤**（均已完成）：

1. ✅ 引入 `game.response_stack` 与帧辅助（`push_response_frame` / `pop_response_frame` / `top_response_frame`）。
2. ✅ `trigger_response` 的 pending/defer 分支改为"写入帧"并双写 `pending_response_choice` 派生（兼容壳）。
3. ✅ `resolve_response_choice` 从栈顶帧读写（`top_response_frame || game.pending_response_choice` 回退）。
4. ✅ `promote_deferred_response` 把 deferred 帧重新压栈顶（双写兼容）。
5. ✅ `view` 增加 `response_stack` 字段（L20766 前）；`view.response_choice` 真相源改为 `top_response_frame(game)`。
6. ✅ 保留 `response_queue` 兼容壳（双写并存）。
7. ✅ **卡逻辑清理**：15430 简化删内嵌 15426 机制（commit `80d06b3`）。

**验证**：`tools/_smoke_15430.js`（奇袭发起海战→敌方响应→归还陆战步）、`_smoke_15431_queue.js`、`_smoke_fr_respond.js`（15311 马奇诺跨阵营）、`armed_whitelist` 冒烟，全绿。

### 第二期（统一栈替换 queue）✅ 已完成（2026-10-19，分支 `response-stack-refactor`）

**目标**：彻底删除 `response_queue` 聚合壳 + 旧全局 `pending_response_choice`/`deferred_response_choice`，响应系统 100% 走 `response_stack`。

**步骤**：

1. ✅ **`request_responses` 改压帧**（第一期第 1 步已落地）：同触发点多卡各自 `push_response_frame` 连续压栈，深度优先语义保持。
2. ✅ **`trigger_response` 纯栈化**：已删 `response_queue` head 遍历；读栈顶帧执行 → `{pending}` 更新帧 / `{defer}` 弹**当前帧 f**（非栈顶，避免误弹 effect 内部刚压的新响应帧）并存 `deferred_response_stack` / `{ok}` 弹帧 + `consume_response`。
3. ✅ **`response_reconcile_active` 栈化**：基于栈头帧 `owner_side` 让权/归还（第一期已改）。
4. ✅ **`promote_deferred_response` 栈化**：deferred 续打帧存于 `game.deferred_response_stack`（独立数组，不在活动栈顶；栈清空后 FIFO 压回栈顶），不再写 `deferred_response_choice` 旧全局。新增 `defer_response_frame(game, frame)` 辅助统一收编。
5. ✅ **删除旧全局**：`game.pending_response_choice` / `game.deferred_response_choice` 全部写入点已删除；`view.response_choice` 仅 `top_response_frame(game)`（去掉回退）；`block`/`build_actions` 读栈（第一期已改，已确认不依赖旧全局）。
6. ✅ **触发层去重**：同触发点多卡 = 连续帧；`response_reorder`/`response_confirm` 对栈上连续帧重排（保留 A→B 顺序语义，15431 测试依赖）。
7. ✅ **15430 归一**：删 `{defer}` 兼容壳手写（原 L13717 自写 `deferred_response_choice`），15430 直接返回 `{defer:true}` 由框架 defer 分支统一收编进 `deferred_response_stack`。

**纯栈设计要点**：
- `game.response_stack`：活动响应帧栈，栈顶 = 唯一活动决策。
- `game.deferred_response_stack`：递延缓打帧暂存区（不在活动栈顶，待 `response_stack` 清空后由 `promote_deferred_response` FIFO 压回）。
- `game.response_queue`：仅 `sync_response_queue_view` 派生的**只读**视图（客户端兼容）。
- 旧全局 `pending_response_choice` / `deferred_response_choice`：**已彻底删除**。

**验证（分支 `response-stack-refactor`）**：
- 全绿：`_smoke_15431_queue.js` 16/16、`_smoke_15430.js` 17/17、`_smoke_fr_respond.js` 17/0、`_smoke_armed_whitelist.js` 12/0、`_smoke_15428.js`（SMOKE_PASS）、`_smoke_15328_attacked.js` 23/0、`_smoke_axis_pact.js` 16/0、`_smoke_delegate.js` ALL PASS、`_smoke_autobahn_resp_fix.js` ALL PASS、`_smoke_armed_handoff.js` 14/0、`_smoke_armed_multiwindow.js` 20/0、`_smoke_15237_whitelist.js` ALL PASS、`_smoke_15426.js` 10/0、`check_reuse.js`（B/C 干净，仅 A 类已知行号漂移 WARN）。
- **已知预存失败（与本次重构无关，已用 `git stash` 回退 rules.js 到 HEAD 比对确认同款失败）**：`_smoke_pending_union.js` 6 FAIL、`_smoke_jp_response.js` 8 FAIL（含 `resolve_response_choice` 白名单、`15427/15428/15431` 节描述断言）、`test_15430_queue_filter.js` 6 FAIL。根因：这些测试为旧 `response_queue` 中心模型编写，部分断言在栈模型下已不合时宜；其失败在本次改动**之前**即存在，非 Step 4/5/7 引入。

**前置建议（已采纳）**：第一期 + 第二期成果在本分支 `response-stack-refactor` 统一提交，可整体 revert。

### 第三期（status_instant 清除改为栈内判定）

- 删除 `L22324` 的动作名白名单，改为"栈内动作"判定。
- 各瞬态窗口绑定其所属帧，帧 pop 时关闭。

---

## 5. 风险与回滚

- 每期独立 commit，可单独 revert。
- 第一期必须保证现有冒烟测试全绿；引入回归即用 `rules.js.bak-*` 比对。
- 禁止在卡逻辑里裸写 `game.active=`（铁律），统一走 `handoff_to`。

---

## 6. 相关代码锚点（供实施引用）

- 替死/抵消：`do_battle` `L16091` / 代受 `L16474` / 抵消 `L16610-16662` / 战斗成功钩子 `L16722` / `L16759`
- 战斗挂起：`set_pending_battle` `L21584` / `battle_reconcile_active` `L21602`
- 队列：`request_responses` `L14376`（深度优先 `L14419`，让权 `L14438`）
- 协调：`response_reconcile_active` `L14448` / `promote_deferred_response` `L14484`
- 触发/解析：`trigger_response` `L23050` / `resolve_response_choice` `L22798`（pending 分支 `L23064`，defer 分支 `L23089`）
- 清除白名单：`status_instant` 清除 `L22310-22332`
- 待清理内嵌：15430 当前内嵌 15426（`L13713` / `L13823`）+ 清队列拷贝（`L13793`），重构后删除（见 3.9，第一期第 7 步已删内嵌，commit `80d06b3`）

**[2026-10-19 第一期新增锚点]**
- `view.response_stack` 字段：L20766 前（`response_choice` IIFE 上方）
- `view.response_choice` 真相源：`top_response_frame(game)`（无回退，已删 `pending_response_choice`，第二期第 5 步）
- `block` 拦截读栈顶帧：L21640 / L21896（`top_response_frame(game)`）
- `build_actions` 白名单"响应挂起"判定：`队列非空 || 栈非空`（L22417）
- 15430 `{defer}` 兼容壳已删除（第二期第 7 步）：15430 直接返回 `{defer:true}`，由 `trigger_response`/`resolve_response_choice` 的 defer 分支统一收编进 `game.deferred_response_stack`
- ⚠ 行号随未提交改动漂移（A 类 WARN，已知，不影响 B/C 正确性）

**[第二期关键函数（待读当前实现以精确定点）]**
- `request_responses`：原 `L14376`（深度优先 `splice` @ `L14419`，让权 @ `L14438`）
- `response_reconcile_active`：原 `L14448`
- `promote_deferred_response`：原 `L14484`
- `trigger_response`：原 `L23050`（pending 分支 `L23064`，defer 分支 `L23089`）
- `resolve_response_choice`：原 `L22798`
