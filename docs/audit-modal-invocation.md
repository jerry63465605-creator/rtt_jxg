# 盘点：客户端所有"弹 UI"的地方，哪些该走地图、哪些必须弹

> 日期：2026-11-07　脚本：`tools/_survey_modals.js`
> 背景：B31 系列把「选地区」改成零 UI（只靠地图高亮），需要确认是否还有同类多余弹框。

## 1. 总量

```
play.html 里 .modal 元素 = 14 个
play.js 里"显示"代码点（classList.remove('hide')）= 35 处
```

> 35 处里多数是**内联浮动小盒**（ask_box / event_budget / autobahn / theater / uranus /
> event_step / pending_trigger / 事件完成按钮等），它们不是 `.modal`（没有全屏遮罩）。

## 2. 按"交互性质"分类

### ① 地图点选型 —— **应零 UI（只高亮）** ✅ 已改

| 通道 | 位置 | 现状 |
|---|---|---|
| `pending_echo` + `step:'space'` | `update_pending_echo_box()` | 不弹框、无提示条，只 `highlight_targets()`；Esc / 右键 = 放弃（B31-c） |
| `armed_offer.pending.need:'space'` | `update_armed_offer_box()` L~2489 | 同上；本次**删掉了那句 toast**（原来会弹「请点击一个高亮的地区」） |

### ② 必须弹框（信息不在图上，无法用高亮表达）

| modal | 用途 | 为什么必须弹 |
|---|---|---|
| `peek_modal` | 看对手手牌并排序 | 要看到具体卡面与顺序 |
| `script_modal` | 脚本卡选牌（15352/15215 等） | 候选是牌面，不是地区 |
| `resource_modal` | 开局弃 3 摸 1 基本卡 | 同上 |
| `skill_discard_modal` | 国家技能代价弃牌 | 同上 |
| `echo_discard_modal` | 增强卡代价弃牌 | 同上 |
| `lend_lease_modal` | 17535/17855 的"揭示+选牌网格" | 同上 |
| `status_play_modal` / `su_purge_modal` / `uk_enigma_modal` | 状态卡选择 | 候选是状态卡 |
| `us_political_modal` / `us_replay_modal` / `us_wartime_modal` | 美国三类选牌/选状态 | 候选是牌 |
| `attr_log_modal` | 损耗记录查看 | 纯信息展示 |
| `armed_offer` + `need:'status'/'card'` | 选状态卡 / 选对方手牌 | 候选是牌 |

### ③ 内联浮动盒（不是 .modal，无遮罩，不挡地图）

```
ask_box / event_budget_box / event_step_box / pending_autobahn_box /
pending_theater_box / uranus_box / pending_trigger_box / balloon_box /
italy_* / delegate_box / us_japan_box / rollback_bar / deck_panel / reserve_panel
```

这些是角落/底部的小面板，**不遮挡地图**，本次不动。

## 3. 本次结论

- 「选地区」两处通道（`pending_echo` 与 `armed_offer`）现在**都是零 UI**：只高亮，点图即选；
- 只剩 `armed_offer.pending.need:'piece'` 还会弹一句 toast（「请点击一支高亮的部队：<国家>空军…」）——
  因为候选是**多国部队**，单位名字不在地图上，玩家需要知道有哪些；如果也要去掉，可以说；
- `need:'choice'` 用 `ask_box` 里的按钮（陆战/海战等），属必要选项，保留。

## 4. 验证

```powershell
node tools/_dom_test_b31_realboard.js        # pending_echo 选地区：零 UI（7 项）
node tools/_dom_test_armed_space_zero_ui.js  # armed 选地区：零 UI（4 项）
node tools/_survey_modals.js                 # 本盘点表（35 处显示点 + 归属函数）
```

## 5. 约定

```
能用地图高亮表达的（地区/单位）→ 零 UI，只 highlight_targets
候选是"牌/状态/选项"的        → 必须弹框（.modal 或 ask_box）
禁止：为"选地区"再弹任何 modal / 提示条 / toast
```
