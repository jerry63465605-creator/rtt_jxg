# 战区移动（17532）重新实现 —— 采用「高速公路」式分步状态机

> 状态：**✅ 已实现（2026-10-25，工作区未提交）**
> 回归：`node tools/_smoke_17532_theater.js` —— 33 项全 PASS（先海军 / 先陆军 / 候选同源 / 非法选择 / 门禁）
> 前置：`docs/17532-theater-remove-target.md`、`17532-build-candidate-mismatch.md`、`17532-space-highlight-stale.md`

## 实现落点（已完成）

| 层 | 位置 | 内容 |
|---|---|---|
| 服务端状态机 | `rules.js` `theater_stage_label` / `theater_step_no` / `theater_targets` / `theater_start` / `theater_finish` / `theater_resolve` | 挂在 `railroad_recall` 之前（高速公路同区块） |
| 卡配置 | `EVENT_EFFECTS['17532']` | 去掉 `steps`，保留 `choice` + `choiceLabels`，加 `pendingTheater: true` |
| 打牌入口 | `play_card` 的 EVENT 分支（17535 之前） | 特判 17532 → `theater_start` |
| view | `view.pending_theater` | actor/stage/order/built/step/total/label/can_act |
| query | `theater_targets` | 按 stage 现算候选（`need` + `candidates`） |
| action | `resolve_theater` | 每调一次处理一步 |
| 前端门禁 | `build_actions_inner` 排他分支（`pending_autobahn` 之前） | 只给 `resolve_theater` + 状态卡 + armed + log |
| 后端冻结 | `do_action`（`pending_autobahn` 冻结段之前） | 对称冻结 |
| 挂起判定 | `hasSuspended` | 加入 `game.pending_theater` |
| 客户端面板 | `update_pending_theater_box` + `#theater_box` | 标题「第 N/3 步」+ 提示 + 顺序/已完成 |
| 客户端点击 | `on_click_space` / `on_click_piece` 最前 | 直接发 `resolve_theater` |
| 客户端高亮 | `reapply_all_highlights` 3.5 段 | 按 RPC 缓存每帧重贴（地区 + 算子） |

**旧 `us_theater_delegate` 代码保留**：已无调用者，但老对局存档若停在旧流程仍可走完，不删。

## 一、目标流程（玩家口径）

```
① 选择建设顺序（先海军 / 先陆军）
② 移除 1 支美国陆军或海军
③ 下一步 → 建设海军（选海域）
④ 下一步 → 建设陆军（选地区）
⑤ 完成
   （顺序反之亦然）
```

## 二、三种候选实现对比

| | A. 事件卡 `steps` + 新增 `event_step_pick` | **B. 专用 `pending_theater`（高速公路式）** | C. 维持现状（一次选齐） |
|---|---|---|---|
| 每步现算候选 | 需新造机制 | **天然：每步一个 action** | ✗（一次性，问题根源） |
| 影响面 | 所有 `oneStep` 多步卡（约 20 张） | **仅 17532** | — |
| 客户端改动 | 改多步累积逻辑（高风险） | 新增一个小面板，低耦合 | — |
| 战斗/响应打断 | 已有 armed 停机制 | 需照抄 `suspend/resume`（有现成代码） | 已有 |
| 高亮残留 | 需另修 `update_map` | **顺带解决**（候选来自 RPC 缓存，每步重算） | ✗ |
| 风险 | 中高 | **低（隔离单卡）** | — |

**推荐 B**。

## 三、B 方案的现成模板：高速公路 15228

| 环节 | 高速公路的实现 | 战区移动照搬 |
|---|---|---|
| 挂起状态 | `game.pending_autobahn = { remaining, total, actor, timing }`（3192） | `game.pending_theater = { actor, card_id, stage, order, built }` |
| 视图 | `pending_autobahn: game.pending_autobahn \|\| null`（23534） | `pending_theater: …` |
| 候选 | `query('autobahn_targets')`（30164） | `query('theater_targets')` |
| 动作 | `resolve_autobahn({space})` **每次一步**（27744） | `resolve_theater({piece \| space})` **每次一步** |
| 前端门禁 | 排他分支：`resolve_autobahn` + `register_status_actions` + armed 放行（24569-24600） | 同款排他分支 |
| 后端冻结 | `if (pending_autobahn && action !== 'resolve_autobahn' && action !== 'activate_status' …)`（25562） | 同款 |
| 战斗打断 | `suspend_autobahn` / `maybe_resume_autobahn`（3214/3230） | 同款（建设触发响应/战斗时） |
| 客户端 | `update_pending_autobahn_box` + `on_click_space` 顶部拦截 + RPC 候选缓存（6365、380） | 同款面板 |

## 四、服务端设计

### 4.1 状态

```js
game.pending_theater = {
  actor: '美国',
  card_id: '17532#n',
  stage: 'remove',            // remove → build_navy → build_army → (收尾)
  order: ['navy', 'army'],    // 由 choice 决定（先海军 / 先陆军）
  built: { navy: false, army: false },
}
```

### 4.2 动作 `resolve_theater`

| stage | 入参 | 处理 | 推进 |
|---|---|---|---|
| `remove` | `{ piece }` | 校验「美国 + 陆军/海军 + 在场上」→ `remove_piece` | `stage = 'build_' + order[0]` |
| `build_navy` | `{ space }` | `build_piece(actor,'navy',sp)`（失败**停在本步**并回显原因，不吞） | `built.navy=true` → `build_army` |
| `build_army` | `{ space }` | `build_piece(actor,'army',sp)`（同上） | `built.army=true` → 收尾 |

**收尾**：卡进弃牌堆、`mark_play_done`、`pending_theater = null`、★国家技能窗口（与 `finish_event_card` 同口径）。

**权限**：用 `faction_of_nation(side)` 判定（同 `autobahn_resolve` 3121 的死锁修复），不用 `current_nation` 代理。

### 4.3 候选 `query('theater_targets')`

| stage | 返回 |
|---|---|
| `remove` | `{ need:'piece', candidates:[{id,name}] }` —— 美国在版面上的陆军/海军 |
| `build_navy` | `{ need:'space', candidates:[{id,name}] }` —— `can_build_at(美国,'navy',sp).ok` |
| `build_army` | `{ need:'space', … }` —— `can_build_at(美国,'army',sp).ok` |

**关键**：候选由**本步现算**（此时移除已真实发生），彻底消除"影子盘面 vs 真实盘面"的分歧。

### 4.4 视图 `pending_theater`

```js
pending_theater: {
  actor, stage, order, step: 1|2|3, total: 3,
  label: '移除 1 支陆军或海军' / '建设 1 支海军' / '建设 1 支陆军',
  can_act: faction_of_nation(actor) === side,
}
```

### 4.5 门禁（两端都要）

| 位置 | 内容 |
|---|---|
| `build_actions_inner` | **排他**分支：本方 `resolve_theater` + `register_status_actions` + armed 的 use/skip + `log`；对方只给 `log` |
| `do_action` | 冻结：`if (game.pending_theater && action !== 'resolve_theater' && action !== 'activate_status')` 拒绝 |
| `hasSuspended`（25247） | 加入 `game.pending_theater`，避免建设中 `status_instant` 被清 |

### 4.6 战斗/响应打断

照抄 `suspend_autobahn` / `maybe_resume_autobahn`：
建设后若武装了 `after_build_navy` / `after_build_army` 窗口、或触发响应栈，则
`pending_theater_suspended = pending_theater; pending_theater = null`，窗口结算完再恢复。

## 五、客户端设计

| # | 改动 | 位置参考 |
|---|---|---|
| C1 | `update_pending_theater_box()`：面板显示 `第 N/3 步：label` + 「与"下一步"不同，本步必须选目标」 | 仿 `update_pending_autobahn_box`（6347+） |
| C2 | `on_click_piece` 顶部拦截：`stage==='remove'` 时点美国算子 → `resolve_theater({piece})` | 放在 `pending_event_targets` 判定**之前** |
| C3 | `on_click_space` 顶部拦截：`stage` 为 build 时点地区 → `resolve_theater({space})` | 同上 |
| C4 | 候选走 RPC 缓存 `theater_cands`，`update_map` 每帧按它重贴高亮（地区/算子各一条） | 仿 380-384 |
| C5 | 步骤切换时清空旧缓存并重新 query | 仿 `autobahn_query_remaining` 节流 |

**这五条同时消灭 A3（高亮残留）与 A4（跨流程状态残留）**：本卡不再走 `pending_event_card / pending_targets` 那套流程。

## 六、卡片配置

`17532` 保留 `choice`（选顺序）与卡面文案，但**不再用 `steps`**：

```js
'17532': {
  name: '战区移动', actor: '美国',
  choiceLabels: ['先建设海军，再建设陆军', '先建设陆军，再建设海军'],
  pendingTheater: true,   /* 标记：走 pending_theater 专用管线 */
}
```

`resolve_event_card` 里对 `pendingTheater` 的卡：只选 choice → 建 `pending_theater` → 返回 `{ ok:true, pending:true }`。

## 七、验收（engine smoke，不依赖浏览器）

1. 先海军：`remove` → `build_navy` → `build_army` → 收尾，日志三段齐全
2. 先陆军：顺序反过来同样走通
3. 每步候选与该步执行同源（`_repro` 里逐个候选跑一次 dry-run 校验）
4. 建设失败（例如槽位占用）→ **停在本步**并回显 `can_build_at` 的 reason，可改选
5. 门禁：非本方阵营调 `resolve_theater` 被拒；`play_card` / `next_phase` 在挂起期间被拒
6. 建设后武装 `after_build_navy` 窗口 → 能正常发动，窗口清空后 `pending_theater` 恢复
7. 全部完成后：卡进弃牌堆、占名额、★技能窗口正常

## 八、工作量与风险

| 项 | 估计 |
|---|---|
| 服务端 | ~120 行（状态 + 动作 + query + view + 三处门禁 + suspend/resume） |
| 客户端 | ~80 行（面板 + 两处点击拦截 + 高亮重贴） |
| 影响面 | **仅 17532**（新管线，不碰 `steps` 与 `pending_event_step`） |
| 风险 | 中（客户端无法本地浏览器验证，需玩家实测） |
| 回退 | 删掉 `pendingTheater` 标记即回到旧实现，改动隔离 |

## 九、与用户点的关系

- 「先选建设顺序，然后移除」→ `choice` + `stage='remove'` ✅
- 「下一步，根据顺序先建设海军」→ `stage` 推进 + 面板「第 2/3 步」✅
- 「下一步，建设陆军」→ `stage` 推进 ✅
- 「或者反之」→ `order` 由 choice 决定 ✅
