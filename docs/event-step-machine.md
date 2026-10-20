# 事件卡分步执行机（方案 B）：每个原子动作手动下一步

> 版本 v1.0 · 2026-10-21 · 设计文档（先文档后实现）
>
> 实现：`server-official/public/quartermaster-sub-wars/rules.js` / `play.js`
> 测试：`server-official/public/quartermaster-sub-wars/_test17532_step.js`（新增）
> 　　　`tools/_verify_multistep.js`、`tools/_verify_fr_events.js`（已接共享驱动器）
> 相关：`docs/event-cards.md`（事件卡总览）、`docs/REFACTOR_RESPONSE_STACK.md`（响应栈）、
> 　　　`docs/status-cards-design.md`（状态卡窗口）、`docs/turn-flow.md`（回合流程）

---

## 0. 文档目的

1. 记录多步事件卡（`steps` / `choice` 配置）当前"一个 action 内同步跑完所有步"的根因，
   以及它为什么会让"建设/征召后立刻触发状态卡"这条卡面语义失效；
2. 定义**方案 B（显式分步执行机）**的完整设计：状态对象、生命周期、与既有机制的叠加规则；
3. 给出服务端 / 客户端改动清单、验证计划与分期推进路径。

---

## 1. 现状与根因（Root Cause）

### 1.1 多步事件卡是一个 action 内同步跑完的

`resolve_event_card`（`rules.js` 的 step 循环，约 `L16400-16763`）用一个 `for` 循环
把 `steps` 里**所有步连续执行完**才返回：

```
play_card → resolve_event_card(arg, startStep=0)
              ├─ step0 build  ──┐
              ├─ step1 build    │ 同一次 action 内连续执行，中间不停
              └─ step2 recruit ─┘
            → 返回 { ok, desc }
play_card 收尾：discard_card + mark_play_done + after_card_resolved
```

### 1.2 已有的两种"边界"机制各覆盖一半

| 机制 | 覆盖范围 | 触发条件 | 现状 |
|---|---|---|---|
| `pauseArmed`（`L16652`/`L16676`） | **只有 ECHO 增强卡**（判据 `has_armed_window` 查 `game.armed_offers`，`L16825`） | 逐步显式配 `pauseArmed:true`，且窗口名在调用点写死 | 全库**只有 15237** 一张卡的两个步在用 |
| `event_budget`（`L16717-16761`） | **只有 battle 步** | 遇到 battle 步就建预算、返回 `pending` | 成熟范式：每战原子、战间可插状态/免死/代受，且带 `resumeStep` 续跑后续步（`L24838-24854`） |

> `event_budget` 已经证明了"原子动作 + 手动推进"这条路可行，
> 方案 B 就是把它从 battle 步推广到**所有步**。

### 1.3 状态卡窗口在多步链路上基本是坏的（本需求的直接根因）

- `build_piece` 建设成功后会设 `game.last_built`（`L7448`）；
- `after_build_army` / `after_build_navy` 窗口是在 **`view` 里懒武装**的
  （`L20952-20962`），武装完**立刻把 `last_built` 清空**；
- 多步卡里：建设#2 会在任何 view 之前**覆盖** `last_built`
  → 只有**最后一次**建设的窗口能被武装，而且是**整张卡结算完之后**才出现；
- 且 `has_armed_window` 只查 `armed_offers`，**根本不看 `status_instant`**
  → 即便配了 `pauseArmed` 也不会为状态卡挂起。

**受影响的状态卡（`status_config_of` 里 `trigger.window`）**：

| 窗口 | 卡 |
|---|---|
| `after_build_navy` | 17544 美国海军陆战队、17547 人工港、17550 |
| `after_build_army` | 17843、17846 坦克运输、17901、15247、15248、17552 |
| `piece_removed` | 17543 雷达 |
| `after_land` | 3902/4133/4205/4330/4457 五张（战斗窗口，已由 `event_budget` 覆盖） |

**结论**：`17532 战区移动`（先移除、再建海军、再建陆军）建完海军时，
该弹的 `after_build_navy` 窗口不会弹；建完陆军时该弹的 `after_build_army`
也不会弹——窗口被后续步覆盖、或被 view 懒武装的时序吞掉。

### 1.4 响应卡侧的独立既有缺口

EVENT 分支结算完（`L26542-26571`）**没有** `request_responses(game,'play_card',…)`
（STATUS `L23101` / ECON `L26436` / BASIC `L26126` / EFFECT `L26711` 四个分支都有）
→ 事件卡打完后从来不开 `'play_card'` 响应窗。
**本方案不补这一条**（属独立改动，列入手册 §10 分期）。

### 1.5 同类疑似缺陷（一并核查）

`hasSuspended`（`L23291-23308`，决定 `status_instant` 是否在 action 入口被清空的闸门）
**没有 `game.event_budget`**。预算流程日志写着"每战结算后可插入状态/免死/飞机代受等"，
但玩家下一次点目标发兵（`event_battle`）可能在入口就把 `status_instant` 清掉了。
与本需求同类，方案 B 落地时一并修。

---

## 2. 需求

1. **原子动作之间必须给时点**：每建设/征召/移除一个部队后，若存在可发动的
   状态卡窗口 / 增强卡窗口 / 响应帧，必须先让玩家处理完，再继续下一个原子动作；
2. **手动下一步**：每个原子动作执行完后显式停住，由玩家点「下一步」推进到下一个原子动作；
3. **不增加无谓点击**：没有后续步时一步到底（收尾自动完成）；
4. **可预测**：任何时点只有一组合法动作（窗口动作 + 「下一步」），不会误触其它操作。

---

## 3. 方案选型

| | 方案 A：泛化 `pauseArmed` | **方案 B：显式分步执行机（本文档）** | 方案 C：A + 按需 B |
|---|---|---|---|
| 做法 | 把步骤边界从"增强卡专用"泛化成"任何待决窗口" | 每步独立 action + 「下一步」按钮 | A 为默认，`manualStep:true` 卡走 B |
| 新 UI | 无 | 一个分步面板（复用 `event_budget_box` 范式） | 两者都要 |
| 点击次数 | 有窗口才停 | **每步都停**（需求 2 的字面实现） | 视卡而定 |
| 状态可观测性 | 隐式（靠窗口存在性） | **显式**（`pending_event_step` 落 state，可断点/可重放） | 中 |
| 与选目标流程叠加 | 自然 | 需要显式处理（见 §4.3） | 同 B |
| 风险 | 中（改动 `resume_event_after_armed` 的三条触发路径） | 中（新 action + 新 view + 新面板 + 白名单） | 高（两套并存） |

**选 B**：用户明确要求"每一个原子动作都手动下一步到下一个原子动作"，
且 `event_budget` 已跑通同款模式（预算 → `event_battle` 原子动作 → `event_finish` 收尾），
B 是把成熟范式推广，风险可控、状态显式、便于排查。

---

## 4. 状态机设计

### 4.1 状态对象

```js
game.pending_event_step = {
  card_id,          // 实例 id（如 '17532#1'）
  nation,           // 执行国（'美国'）
  step,             // 【下一个】待执行的 step 下标（0-based）
  total,            // 总步数
  choice,           // choice 型卡当前选中的分支（无则 null）
  accum: {},        // 目前为止玩家累积的 arg（space/spaces/piece/pieces/choice/cards…）
  desc,             // 已执行步骤的描述（供面板展示"已完成：移除 1 支海军"）
  token,            // 自增，客户端识别"这是新的一步"
}
```

### 4.2 生命周期

```
玩家点手牌《战区移动》
   │
   ▼
play_card → resolve_event_card(accum, startStep=0, {oneStep:true})
   │
   ├─ step0 需要选目标？ ──是──► 返回 pending（现有 event_targets 流程）
   │                             玩家点地图 → 带 accum 重提 play_card
   │                             （本步执行后再次进入 oneStep 逻辑）
   ▼
step0 执行完（移除 1 支海军）
   │
   ├─ 还有后续步？ ──否──► 收尾（discard + mark_play_done + ★国家技能）── 结束
   │
   └─ 是 ──► 写 pending_event_step{step:1} + return {pending, stepPause:true}
                    │
                    ▼
        【玩家看到分步面板：已完成 移除1支海军 / 下一步：建设海军】
                    │
        ┌───────────┴───────────┐
        │ 有状态/增强/响应窗口？  │
        ├── 是 ──► 只能处理窗口（activate_status / use_armed_offer / trigger_response…）
        │           窗口清空后「下一步」才可点
        └── 否 ──► 点「下一步」┐
                              ▼
              action 'event_step_next'
                · 校验阵营 + 无未决窗口
                · resolve_event_card(accum, startStep=ps.step, {oneStep:true})
                · 若该步又需要选目标 → 返回 pending，回 event_targets 流程
                · 执行完：还有后续步 → 再写 pending_event_step（循环）
                · 无后续步 → 收尾，清除 pending_event_step
```

### 4.3 与既有机制的叠加规则（关键）

| 场景 | 规则 |
|---|---|
| **本步需要选目标**（`event_card_needs` 回 `pending`） | 目标选择**优先于**分步：先选齐本步参数，本步执行后再写 `pending_event_step`。即"选目标"与"分步"是两层，不合并成一次交互 |
| **本步是 battle 步** | 仍走 `event_budget`（`L16717`），预算自成一个原子循环；预算 `event_finish` 关预算后按 `resumeStep` 回到分步机 |
| **本步配了 `pauseArmed`** | 保留原语义（armed 窗口未清就挂起 `pending_event_armed`）；两条挂起路径**互斥**——先判 `pauseArmed`，再判分步。`resume_event_after_armed` 续跑时同样带 `{oneStep:true}` |
| **状态卡 / 增强卡 / 响应窗口** | 分步停机时**不自动武装**，只做"检查"：停机后由玩家自主决定是否发动（窗口武装仍走 `arm_status_instant` 的真实路径）。`event_step_next` 入口**强制要求窗口已清空**，否则 toast 提示先处理 |
| **`status_instant` 存活** | `pending_event_step` 必须加入 `hasSuspended`（`L23291`），否则下一个动作入口就把它清空（同类缺陷见 §1.5） |
| **错过即失效** | 玩家在停机期间去做别的独立动作（出牌/弃牌/推进阶段…）→ 按 `L23263-23271` 同款口径作废：卡入弃牌堆 + `mark_play_done` + 日志，**不卡死** |
| **卡在手牌中的重复打出** | 停机期间手牌仍持有该卡（与现有 `pauseArmed` 口径一致）。为防止重跑 step0，`build_actions` 在停机期间**不放行 `play_card`**，客户端手牌点击守卫同步加 `pending_event_step` |

### 4.4 边界判定：哪些步之后必须停

```
remove / build / recruit  → 停（本方案核心）
battle                    → 交给 event_budget（自带原子循环）
eliminate / script / peek → 不停（瞬时效果，无"部队落地"语义）
最后一步                   → 不停，直接收尾
```

### 4.5 收尾（与既有口径对齐）

抽一个共用 `finish_event_card(game, nation, card_id)`，把
`resume_event_after_armed`（`L16847-16855`）与 `event_finish`（`L24855-24858`）
重复的收尾逻辑合一：

```
discard_card → mark_play_done（play 阶段且非 extra）→ card_actions_this_nation++
             → 日志"分步结算完成" → after_card_resolved（★国家技能窗口）
```

---

## 5. 服务端改动清单（`rules.js`）

| # | 位置 | 改动 |
|---|---|---|
| S1 | `resolve_event_card` 签名 | 加第 7 参 `opt = { oneStep }`；`remove`/`build`/`recruit` 三步执行成功后，若 `opt.oneStep && i+1 < steps.length` → 写 `game.pending_event_step` 并 `return { ok:true, pending:true, stepPause:true, desc }` |
| S2 | 新函数 `finish_event_card(game, nation, card_id)` | 收尾逻辑合一（§4.5），`resume_event_after_armed` / `event_finish` / 新分步机共用 |
| S3 | 新 action `event_step_next` | 校验 `pending_event_step` 存在 + 阵营 + **无未决窗口**（`armed_offers`/`status_instant`/`top_response_frame`/`pending_battle`）→ 清挂起 → `resolve_event_card(accum, ps.step, extra, {oneStep:true})` → 未完则再写挂起，完则 `finish_event_card` |
| S4 | `create_empty_game_state` | 初始化 `pending_event_step: null` |
| S5 | `hasSuspended`（`L23291`） | 加入 `game.pending_event_step`；**并核查/加入 `game.event_budget`**（§1.5） |
| S6 | 作废分支（`L23263` 旁） | 加 `pending_event_step` 的错过即失效处理（与 `pending_event_armed` 同款） |
| S7 | `build_actions` | 停机期间放行 `event_step_next`（同 `event_budget` 的 `L22968-22971` 范式）；有挂起时**不**放行 `play_card` |
| S8 | `exports.view` | 新增 `pending_event_step`（只给归属阵营；含 `step/total/desc/token/next_label`），`next_label` 由 `event_step_label` 服务端算好 |
| S9 | `resume_event_after_armed` | 续跑时传 `{oneStep:true}`，并修正其裸 `extra` 引用（`L16846`）为显式传参 |

---

## 6. 客户端改动清单（`play.js`）

| # | 改动 |
|---|---|
| C1 | 新面板 `update_event_step_box()`：复用 `event_budget_box` 的 DOM/样式范式，显示"《战区移动》第 2/3 步：建设海军"+ 已完成描述 + 「下一步」按钮（`send_action('event_step_next', {})`） |
| C2 | 在 `update_phase_buttons()`（`update_event_budget_box()` 旁）调用；`view.pending_event_step` 为空则隐藏 |
| C3 | `on_click_hand_card` 的待决守卫（`L2927-2935`）加入 `view.pending_event_step`，并给出明确 toast（"请先点「下一步」完成《X》"） |
| C4 | 面板文案全部取服务端下发的 `next_label` / `desc`，客户端不自己拼（判定同源，pitfalls 通用教训 3） |

> **不需要**新的选目标交互：本步需要选目标时，服务端返回 pending，
> 客户端走既有 `event_targets` 查询 → 高亮 → 点地图 → 带 `accum` 重提。

---

## 7. 交互流程（玩家视角，17532 为例）

```
① 点手牌《战区移动》
     → 二选一框：「先建设海军，再建设陆军」/「先建设陆军，再建设海军」
② 选「先建海军」
     → 地图高亮两国部队，点美国海军（阿拉伯海）
     → 【分步面板】《战区移动》第 1/3 步已完成：移除 1 支海军
                  下一步：建设海军
     → （若桌上有 after_build_navy 状态卡，此处正是发动时点）
③ 点「下一步」
     → 高亮海域，点印度洋
     → 【分步面板】第 2/3 步已完成：在 印度洋 建设 1 支海军
                  下一步：建设陆军
     → （若桌上有 after_build_army 状态卡，此处正是发动时点）
④ 点「下一步」
     → 高亮陆地，点中东
     → 自动收尾：卡入弃牌堆 + 美国★国家技能窗口
```

对比现状：现在是"点两下地图，卡直接全做完"，状态卡窗口永远错过。

---

## 8. 验证计划

新增 `_test17532_step.js`（走共享驱动器 `tools/event_click_seq.js`）：

1. **停机正确**：step0 执行后 `pending_event_step.step===1`、`total===3`，
   且返回 `stepPause:true`；盘面上海军已移除、尚未建设；
2. **时点可用**：桌面放 17544（`after_build_navy`）→ 停机后 `status_instant` 含该卡
   → `activate_status` 发动成功 → 续跑建设#2；
3. **未清窗口不让推进**：窗口未处理时 `event_step_next` 被拒（日志提示），状态不变；
4. **手动推进**：`event_step_next` 后执行下一步、再次停机；
5. **收尾**：最后一步后 `pending_event_step` 清空、卡入弃牌堆、
   `mark_play_done`、`after_card_resolved` 触发；
6. **无后续步不停机**：单步卡（如 15326）行为不变（不新增点击）；
7. **错过即失效**：停机期间做独立动作 → 卡入弃牌堆 + 日志，不卡死；
8. **`event_budget` 共存**：battle 步仍走预算，`event_finish` 后回到分步机；
9. **`status_instant` 不被误清**：停机期间 `status_instant` 存活（§1.5 修复验证）。

回归：`_test_resp`、`_test17528`、`_test17513/17526/17529/17532`、
`_verify_multistep`、`_verify_fr_events`、`_smoke_15425_defer`、`_smoke_15426/15431/fr_respond`、
`test_15430_queue_filter`、`check_reuse`、`test_event_cards`。

---

## 9. 风险与回滚

| 风险 | 缓解 |
|---|---|
| 多步卡全部变多点击，玩家不习惯 | 只对 `steps.length > 1` 的卡生效；单步卡零变化（§8.6） |
| 停机期间误触其它动作导致卡死 | `build_actions` 只放行 `event_step_next` + 窗口动作；错过即失效收尾（S6） |
| 与 `pauseArmed`（15237）路径冲突 | 先判 `pauseArmed` 再判分步；两条路径都带 `{oneStep:true}` 续跑，语义一致 |
| `status_instant` 被动作入口清空 | S5 加入 `hasSuspended`（并修 §1.5 的 `event_budget` 遗漏） |
| 老对局缺 `pending_event_step` 字段 | S4 初始化 + `view` 惰性兼容（`game.pending_event_step \|\| null`） |
| 需要整体回退 | 所有改动集中在 `resolve_event_card` 的一个分支 + 一个新 action + 一个 view 字段 + 一个客户端面板，`git revert` 单点可退 |

---

## 10. 分期推进

| 期 | 内容 | 验收 |
|---|---|---|
| 一 | S1/S2/S3/S4 + C1/C2（17532 跑通分步） | §8.1/3/4/5/6 |
| 二 | S5/S6/S7 + C3/C4（闸门、作废、白名单、守卫） | §8.7/9 |
| 三 | §1.4 响应卡缺口：EVENT 分支补 `request_responses('play_card')` | 响应卡可拦截事件卡 |
| 四 | §1.5 `hasSuspended` 补 `event_budget` | 预算期间 `status_instant` 存活 |

---

## 11. 关联踩坑（落地时必须遵守）

- **判定同源**：面板文案、`next_label`、可点性一律服务端算好下发，客户端不二次判断
  （pitfalls 通用教训 3；本次 17532「选项标签」bug 即因客户端/服务端各算一套）。
- **query 是只读 RPC**：`event_targets` 查询不写 state，客户端不能依赖 query 的副作用
  （`play.js:2711` 注释；本次「piece 候选被二次包装」bug 即出在 query 出口）。
- **动作必须登记白名单**：`event_step_next` 漏登记 = 点了静默无反应
  （pitfalls 通用教训 11）。
- **多步卡的参数必须按下标累积**：`arg.spaces[step]` / `arg.pieces[step]`，
  只发 `arg.space` 服务端读不到（15325"点了没反应"根因，见 `pick_space_for` 注释）。
  共享驱动器 `tools/event_click_seq.js` 已固化了这套口径。
