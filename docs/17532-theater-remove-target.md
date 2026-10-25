# 【待做】战区移动（17532）移除步骤提示"该算子不是合法目标"

> 状态：**已排查，待修**（2026-10-25 反馈，线上 game 5732）
> 复现脚本：`tools/_repro_17532_remove.js`
> 续篇：**建设步骤"候选高亮但拒绝建造"** 见 `docs/17532-build-candidate-mismatch.md`

## 一、结论先说

| 层 | 结论 |
|---|---|
| **服务端** | **正确**。remove 步候选 = 美国全部陆军/海军，不含敌方（实测见下） |
| **客户端** | 提示"该算子不是合法目标"来自**基本卡**分支（`play.js:9137`），说明点算子时 `pending_card` 还残留着上一张基本卡的状态 |
| 附带缺陷 | ① 打事件卡时**没有清基本卡状态**；② 9137 是万能兜底文案，掩盖真实原因 |

## 二、服务端实测（真实引擎路径）

`node tools/_repro_17532_remove.js`：

```
陆军 id=p9 @冰岛，海军 id=p10 @波罗的海
【美国】《战区移动》：《战区移动》需先选择 1 支部队

query(event_targets, choice:0) =
{ "need":"piece", "step":0, "total":3,
  "candidates":[{"id":"p7","name":"陆军@美国"},
                {"id":"p9","name":"陆军@冰岛"},
                {"id":"p10","name":"海军@波罗的海"}],
  "pick":1, "pickMin":1 }
```

- 候选含本方陆军 + 海军 ✅
- 候选不含敌方算子（p11 德国陆军）✅
- `total: 3` 也正确带上（16458 的修复还在）

也就是说"能选却被拒"**不是服务端候选算错**。

## 三、客户端四条分支与各自的提示

点算子的入口 `on_click_piece`，按顺序命中：

| 顺序 | 条件 | 位置 | 提示文案 |
|---|---|---|---|
| ① | `view.us_theater_delegate.current_op === 'remove'`（**旧 delegate 路径**） | 9046-9056 | 《战区移动》只能选高亮的美国陆军或海军 |
| ② | `pending_event_targets.need === 'piece'`（**新标准管线**） | 9062-9071 | 《战区移动》不能选这支部队 |
| ③ | `battle_flow`（战斗选发起单位） | 9080+ | 不能用它发起战斗… |
| ④ | **`pending_card && pending_targets`（基本卡）** | 9119-9139 | **该算子不是合法目标** ← 反馈的这句 |
| ⑤ | 兜底 | 9147+ | 显示该算子信息 |

**关键**：①②③④ 的文案互不相同。玩家看到的是第 ④ 条，说明点击那一刻
`pending_event_targets` 为 null（或未命中）、而 `pending_card` 仍非空。

## 四、根因：跨流程状态残留

```3611:3611:server-official/public/quartermaster-sub-wars/play.js
	query_event_targets(c.id)
```

```2953:2969:server-official/public/quartermaster-sub-wars/play.js
function query_event_targets(card_id) {
	pending_event_card = inst_card_client(card_id)
	pending_event_targets = null
	pending_event_choice = null
	pending_event_spaces = null
	pending_event_pieces = null
	send_query("event_targets", { card: card_id, nation: lend_lease_active || undefined })
	return null
}
```

`query_event_targets` 只清事件卡自己的 5 个变量，**不清 `pending_card / pending_targets / pending_mode / battle_flow`**。
而清这些的只有 `cancel_basic_card()`（5660-5663），它只在这些时机被调用：

| 触发 | 位置 |
|---|---|
| 再点同一张基本卡 | 5538 |
| 点「取消」 | 5630 / 5939 / 5842 等 |
| 提交成功后 | 9134 / 9306 / 7976 等 |

于是典型路径：

1. 玩家点了某张**基本卡**（如《建设陆军》）→ 进入选目标，`pending_card` 被设上、`pending_targets` 为敌方单位
2. 未点「取消」，直接去点**《战区移动》** → 走 `query_event_targets`，`pending_card` **仍在**
3. `event_targets` 查询还在路上（异步），`pending_event_targets` 仍是 null
4. 玩家点自己的陆军 → ① 不命中（新管线无 delegate）→ ② 不命中（targets 为 null）→ ④ 命中 → **"该算子不是合法目标"**
5. 同时 `pending_targets.pieces` 里是**敌方**单位，点自己部队必然不在其中

## 五、修复方案

### P0-1 · 打事件卡前清掉基本卡状态（根因，1 行）

```js
function query_event_targets(card_id) {
	cancel_basic_card()          /* 【2026-10-25】切流程先清基本卡选目标态，避免两个流程并存 */
	pending_event_card = inst_card_client(card_id)
	...
```

`cancel_basic_card` 同时会清 `pending_card / pending_mode / pending_targets / battle_flow / italy_chain_active`，
并清掉 initiator 高亮，语义正好是"放弃上一张卡的选目标"。

**反向也要对称**：`begin_basic_card`（5547/5552）里清掉 `pending_event_card / pending_event_targets`，
避免"先点事件卡、再点基本卡"时出现同样的交叉。

### P0-2 · 9137 那个兜底提示改成"按当前挂起态说话"

```js
toast("该算子不是合法目标")
```
→ 改为：

```js
const why =
	(pending_event_targets && pending_event_targets.need)
		? ('《' + (pending_event_card ? pending_event_card.name : '?') + '》当前步骤不接受选择算子')
	: (view.us_theater_delegate && view.us_theater_delegate.current_op === 'remove')
		? '《战区移动》只能选高亮的美国陆军或海军'
	: (pending_card ? ('《' + pending_card.name + '》的目标不含这支部队') : '该算子当前不可选')
toast(why)
```

目的：把"万能兜底"变成可定位的具体原因，避免下次又只能靠猜。

### P1 · 排查同类的流程交叉

同类"多个选目标流程并存"的风险点：

| 变量 | 谁设 | 谁清 | 是否需要补 |
|---|---|---|---|
| `pending_card / pending_targets` | 基本卡 | `cancel_basic_card` | 打事件卡前补 |
| `pending_event_card / _targets` | `query_event_targets` | 3278 / 提交后 | 打基本卡前补 |
| `battle_flow` | 战斗两步流程 | `cancel_basic_card` | 已有 |
| `pending_armed` | armed 选点 | `update_armed_offer_box` | 在 on_click_piece 里优先级最高（2200），风险低 |

## 六、验收

1. 先点《建设陆军》进入选地块 → 不点取消，直接点《战区移动》→ 战区移动的 remove 高亮正常出现，点自己的陆军可提交
2. 反过来：先点《战区移动》→ 再点基本卡 → 基本卡的目标高亮正常，不会残留选区
3. 任何未完成的选择状态下点"不该选"的算子 → 提示**能对应到具体卡**
4. 正常单流程（不交叉）时行为不变
5. `_repro_17532_remove.js` 的 3 项候选断言仍 PASS

## 七、需要补充的信息

若方便，请提供该局的操作顺序（先点了哪张牌、再点战区移动），可确认走的是"基本卡残留"还是"async 空窗"（两者都靠 P0-1 一并覆盖）。
