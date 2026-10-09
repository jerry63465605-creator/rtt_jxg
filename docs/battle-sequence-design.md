# 战斗预算（event_budget）设计

> 状态：已实现并落地（2026-09-30）
> 关联：`rules.js` 的 `resolve_event_card`（battle 分支）、`do_battle`（after_land 武装）、`event_battle`/`event_finish` action、`event_battle_targets`；客户端 `play.js` 的 `update_event_budget_box`、`on_click_space`
> 关联需求：让《巴巴罗萨》等"发起多次战斗"卡的三次陆战成为**独立原子结算**，并把四种基本卡的实现彻底解耦为最小原子单位

---

## 1. 问题背景

### 1.1 现状缺陷
《闪电战》(15253) / 《……再发起 1 次陆战》(15245) 是 `after_land` 窗口的状态卡：
- `do_battle` 在每次德国陆战末尾调用 `arm_status_instant('after_land', '德国', sp)` 武装该窗口。
- `arm_status_instant` 按 `card_id` 去重（`if (game.status_instant.some(e => e.card_id === cid)) continue`），**不更新已存在条目的 `space`**。

《巴巴罗萨》(15226) 的 3 次陆战若在同一 `resolve_event` action 内循环调用 `do_battle`：
- 第 1 战（地区 A）：武装 `15253`，`status_instant=[{15253, space:A}]`。
- 第 2、3 战（B、C）：`15253` 已存在 → `continue` 跳过 → **`space` 永远停在 A，不更新**。

结果：闪电战只被钉在第 1 战地区 A，且 `once_per_turn` 整回合只能点一次。玩家想在关键第 3 战地区建军却做不到 → 表现为"闪电战没生效"。

### 1.2 用户的决策思路（最终采纳）
1. **四种基本卡 = 最小原子单位**：发起陆战/海战（`do_battle`）、建设陆军（`build_piece`）、征召陆军（`recruit`）。序列层只调度原子，不重写战斗逻辑。
2. **多次发起陆战做成"战斗预算"**：打出卡时建一个 `event_budget`（含 `remaining` 次数），之后**每次 `event_battle` 就是一次完全原子的 `do_battle`**。两场之间交还操作权，玩家可插入任何即时动作（闪电战/15245、免死响应、飞机代受/抵消……），再发起下一场或点"结束"。
3. **彻底解耦、不特例巴巴罗萨**：该预算机制通用化，任何"发起 N 次战斗"的卡（巴巴罗萨、进攻美国、未来卡）都复用，无需改代码。

### 1.3 关键约束
- `once_per_turn` 仍锁死整回合只 1 次 → 独立结算后玩家**挑 1 场**落闪电战，选择权交还玩家，而不是只能落在第 1 战。
- 现有"空军代受"（`pending_battle`）是单场战斗**内部**中断，与预算（多场之间中断）正交，两层必须叠加正确——**但不共用状态机**：预算在 `game.event_budget` 持续保留，`pending_battle` 只在单场内部短暂存在，解出即结束。
- **德国国家技能时点**：`after_card_resolved`（`star_resolved`）必须**晚于最后一场战斗的 `after_land`（闪电战）窗口**。因此预算**不**在打满时自动结算，而是显式 `event_finish` 才触发——玩家先点完闪电战、再点"结束"。

---

## 2. 解耦分层

| 层 | 职责 | 现有/新增 |
|---|---|---|
| 原子层 | 四种基本动作 | 已有：`do_battle` / `build_piece` / `recruit`（不改动逻辑） |
| 预算层 | 多目标战斗的"次数预算" | **新增** `game.event_budget` |
| 动作层 | `event_battle`（逐次发兵）/ `event_finish`（结算放弃剩余） | **新增** 两个 action |

> 注意：**没有"续打序列"状态机**。每一战就是一次普通 `do_battle`，所有原子拦截（代受/抵消、响应、闪电战窗口、15245 二连打）自动生效。

---

## 3. 状态结构 `game.event_budget`

```js
game.event_budget = {
  card_id,            // 源卡实例 id（如 '15226#1'）
  nation,             // 持有国（打出该卡的国家，事件触发方）
  as,                 // 实际发起国（st.as || actor，通常=德国）
  kind,               // 'land' / 'sea'
  against,            // 目标国（st.onlyNation，如 '苏联'）；目标必须含该国陆军/海军
  remaining,          // 剩余可发起次数（= step_pick_count(st)，如巴巴罗萨=3）
  from,               // 发起单位（useNewPiece 处理后的 newPiece，否则 null → do_battle 自动找）
  descs: [...],       // 日志描述累积
  battleOk: 0,        // 成功次数
}
```

`view.event_budget` 额外下发：
- `targets`：当前帧**动态重算**的合法目标地区 id 数组（`event_battle_targets`）。
- `can_finish`：`!game.pending_battle`（代受/抵消未解时置 false，防提前结算）。
- `against` / `kind` / `remaining` / `card_name` / `descs` 供面板展示。

---

## 4. 流程（每战原子结算、两场之间可插动作）

1. 玩家打出巴巴罗萨 → `resolve_event_card` 的 `battle` 步骤**不再内联 for 循环、不建 pending_seq**，而是建 `game.event_budget`，`return {ok:true, pending:true, cardResolved:true}`。
   - 卡照常弃、占 1 次出牌名额；`after_card_resolved` **不在此处调用**（延后到 event_finish）。
2. 玩家点地图上的合法目标（含 `against` 国部队、本方有可发起相邻单位）→ `event_battle {target}`：
   - 校验 `target ∈ event_battle_targets(game, b)`（动态重算，敌军被移除后自动收窄）。
   - 直接 `do_battle(game, b.as, target, null, b.kind, {from: b.from})`，`remaining--`。
   - `do_battle` 成功末尾 `arm_status_instant('after_land')` 武装闪电战/15245 → **每战都武装、sp 正确更新**。
   - 若 `do_battle` 返回 `pending`（空军代受）→ `pending_battle` 自然挂起，预算保留（`remaining` 已扣减），等 `resolve_battle` 解出。
3. 单场结算只由 `resolve_battle` 完成（defend/counter 落地），**不再调用任何"续打"函数**；解出后预算仍在，玩家可再点 `event_battle` 或 `event_finish`。
4. 玩家在两场之间（或每战之后）可插入：闪电战/15245（activate_status）、免死响应、飞机代受/抵消、15245 二连打……全部原子生效。
5. 玩家点"**结束《巴巴罗萨》**"（`event_finish`）→ 清 `event_budget` 并 `after_card_resolved(game, nation, card_id)`（触发德国国家技能）。

> 目标数少于机会时（如盘面只剩 1 块苏联陆地但预算=3），玩家打 1 场后 `targets` 为空，点"结束"放弃剩余 2 次。

### 与空军代受（`pending_battle`）叠加
- 单场触发代受：`do_battle` 返回 `pending`，`pending_battle` 挂起（单场内部）。预算层 `event_budget` **始终保留**，`remaining` 已在 `event_battle` 扣减。
- 玩家解答代受 → `resolve_battle` 落地 → 无"续打"调用，预算直接回到可操作态。
- `event_battle` 在 `pending_battle` 期间被服务端拦截；`view.event_budget.can_finish=false` 让客户端也不点亮目标 → 双保险防"代受未解就发下一战"。

### after_land 窗口协同（核心解耦点，含 15245）
- 每场 `do_battle` 都武装 after_land，挂起期（两场之间）有效。
- 玩家点闪电战 → `activate_status` → 当战地区建军 → 清窗口（`once_per_turn` 锁死整回合只 1 次）。
- 15245（战斗/邻区再发起 1 次陆战）同通道：预算期可点，点击内部再 `do_battle`（用守卫防无限递归）。
- `once_per_turn` 锁死整回合只 1 次 → N 场里玩家挑 1 场落闪电战。

---

## 5. 四种基本卡即原子

预算只"调度"这四个原子，自身零战斗逻辑：
- 发起陆战/海战 → `do_battle(kind)`
- 建设陆军 → `build_piece`
- 征召陆军 → `recruit`

这套机制**不绑定巴巴罗萨**：进攻美国（2 战）、任何未来"发起 N 次战斗"卡都直接复用 `event_budget`，无需改代码（只要卡的 step 是 `op:'battle'`）。

---

## 6. 客户端改动

- **独立面板 `#event_budget_box`**（固定右上角 HUD）：展示卡名、剩余次数、提示文案、"结束《卡名》"按钮、战斗日志。
  - 关键：**不复用 `#ask_box`**，从物理上避免与代受/抵消框争抢（旧 `pending_seq` 的"继续战斗"按钮曾因共用 `#ask_box` 覆盖抵消框导致卡死，见 `pitfalls.md`）。
- `on_click_space`：当 `view.event_budget` 存在且点击地区 ∈ `targets` 且 `can_finish` → 发 `event_battle {target}`。
- `highlight_targets`：预算期把合法目标在地图上高亮。
- `event_card_needs` 对 `op:'battle'` 步骤**不再要求出牌时预选目标**（预算逐次在地图上点）。

---

## 7. 风险与回归

### 风险
- `after_card_resolved` 延后到 `event_finish` 触发：必须保证玩家**先点完闪电战再点结束**，国家技能时点才能晚于闪电战。已通过显式结束按钮满足（不自动结算）。
- 弃牌时机：卡在 `play_card` 时即弃（`cardResolved=true`），预算以独立 state 存续。
- 动作守卫：`event_battle`/`event_finish` 校验 `event_budget` 存在且当前行动方匹配 faction，避免越权；`event_battle` 在 `pending_battle` 期间被拦截。

### 回归/新增测试（`tools/_smoke_seq.js`，50/50 全过）
1. 打出巴巴罗萨即建预算（remaining=3），不预选目标；发起方可见 `targets`、防守方不可见。
2. 逐次 `event_battle`：每战移除苏联陆军、remaining 递减；首战武装闪电战窗口；两场之间可 `activate_status` 落闪电战。
3. 代受/抵消：`event_battle` 触发代受 → `pending_battle` 挂起 → 期间 `can_finish=false` 且 `event_battle` 被拦截 → `resolve_battle` 解出后预算恢复。
4. `event_finish`：清预算、触发 `after_card_resolved`（国家技能晚于闪电战时点）。
5. 目标少于机会：打出即给满 3 次、打完剩余后需结束。
6. 回归：`_smoke_status.js` 21/21、`_smoke_german_status.js` 20/20 无回归。

> 改 `rules.js` / `play.js` 需重启服务器 / 浏览器刷新生效。
