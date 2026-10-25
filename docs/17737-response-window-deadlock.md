# 17737《以逸待劳》：响应窗口期"时点仍在同盟 / 轴心点不了发动-不发动"

> 状态：**✅ 已修复（2026-10-25，工作区未提交）**
> 已做：
>   ① `view.pending_trigger` 改读 `top_response_frame`（真相源），不再依赖 `response_queue` 派生缓存；
>      待发动阶段（candidates 空）也返回当前帧一项，避免显示"《》/？"。
>   ② `build_actions_inner` 条件改为 `pendingTrigger || top_response_frame(game)`，
>      非持有方命中后返回 `{log:1}` + `block_reason`（「等待【X】对响应卡表态」）。
>   ③ `do_action` 入口按栈重建 `response_queue`（幂等自愈，彻底消除失步）。
> 验证：`tools/_smoke_batch_b.js` B2 段 9 项 + `tools/_repro_17737.js` 全 PASS
> 反馈（2026-10-25）：意大利响应卡 17737《以逸待劳》触发时，时点仍显示同盟，
> 轴心（持有方）无法点「发动 / 不发动」，对局卡死。
> 复现脚本：`tools/_repro_17737.js`

## 一、卡片与触发条件

| 项 | 内容 |
|---|---|
| 卡 | 17737《以逸待劳》，意大利，RESPONSE |
| 卡面 | 敌方国家在 `<意大利>` 相邻地区建设或征召陆军后：在 `<意大利>` 征召德国和意大利陆军 |
| 配置 | `RESPONSE_TRIGGERS['17737']`（rules.js:14371），`on: ['build','recruit']`，`optional: true` |
| 效果 | `RESPONSE_EFFECTS['17737']`（15352），内部对德国、意大利各调一次 `recruit_piece` |

## 二、本地复现结论（真实原子路径）

`recruit_piece`（8313）派发 `'recruit'` → `request_responses` 压帧 → 让权。实测：

```
active        = Axis
handoff_stack = [{"id":"response","return_active":"Allies","holder_role":"Axis"}]
response_stack= 1 [{"card":"17737#1","side":"axis","on":"recruit"}]
view(Axis).actions        = {"trigger_response":1,"pass_response":1,"response_reorder":1,"response_confirm":1,"log":1,...}
view(Axis).block_reason   = pending_trigger: 响应队列待【轴心国】《以逸待劳》表态…
view(Allies).actions      = {"next_phase":1,"play_card":1,"next_nation":1,"discard_one":1,...}   ← ⚠
view(Allies).block_reason = null                                                              ← ⚠
```

**让权本身是对的**（15794-15797 `owner_side !== curSide → handoff_to`），轴心的 `trigger_response / pass_response` 也在册。

但暴露出两个真实缺陷，足以造成"时点还在同盟 / 轴心点不了 / 卡死"。

## 三、缺陷 1（确凿）：非持有方在窗口期没有被冻结

`build_actions_inner` 的响应分支只在 `_tf.owner_side === side` 时收窄（24451-24476）；
**不满足时直接往下走，落到通用动作表**（`next_phase / play_card / next_nation / discard_one / …`），
且 `block_reason` 被清成 `null`（24414）。

后果（与玩家反馈完全吻合）：

| 症状 | 成因 |
|---|---|
| "时点还是同盟" | 同盟端 `block_reason = null`、按钮全亮 → 界面没有任何"在等对方表态"的提示，玩家以为还是自己的回合 |
| 同盟一动手就彻底错位 | 同盟点 `next_nation` → `current_nation` 推进（25375 顺手把 `active` 重置为 `faction(new_nation)`），而 `handoff_stack['response']` 与栈帧都还在 → 让权与回合国永久错位 |
| 轴心后续点不了 | 错位后 `_tf.owner_side === side` 的分支可能不再命中（栈顶/active 与 side 不一致），`trigger_response` 从 actions 消失 → 客户端 `action_allowed` 拦下 → toast"服务端未授权" |

这是 `build_actions_inner` 的**老毛病第 N 次复现**：排他式 return 只覆盖了"该我动"的一侧，
忘了"不该我动"的一侧也要收窄（同一类问题见 `docs/known-issues.md` 的 event_budget / armed 门禁）。

## 四、缺陷 2（结构性）：`pending_trigger` 读派生缓存，不读真相源

```22727:22731:server-official/public/quartermaster-sub-wars/rules.js
	const pendingTrigger = (() => {
		const q = game.response_queue || []
		if (!q.length) return null
		const head = q[0]
		if (head.owner_side !== side) return null
```

真相源是 `game.response_stack`（纯栈模型），`response_queue` 只是 `sync_response_queue_view`
维护的派生缓存（15690）。全仓共 13 处手动 sync（15798/15949/25950/26001/26113/26132/26172/
26244/26280/26331/28365/28810）—— **任何一条新路径漏调，就会出现"栈里有帧、view 没框"**：

- 轴心端 `view(Axis).pending_trigger === null` → 不弹响应框 → 无法发动/不发动
- 而 `response_reconcile_active`（15813）读栈 → active 仍然停在 Axis
- 结果：active≠同盟、同盟点不动、轴心没框 = 死锁

`resolve_response_choice` 里还有一处**直接改写 queue 而不动栈**（26055-26061），
一旦后续没有 sync，队列与栈就永久分叉。

## 五、修复计划

### P0-1 · `pendingTrigger` 改读栈顶（真相源）

```js
const pendingTrigger = (() => {
	const head = top_response_frame(game)      // 不再读 game.response_queue
	if (!head) return null
	if (head.owner_side !== side) return null
	return { /* 原字段不变，candidates 由帧自带 */ }
})()
```

同时 `build_actions_inner` 里 `if (pendingTrigger)` 的语义就变成"有本方待表态帧"，不再受缓存影响。

### P0-2 · 非持有方在窗口期冻结

在 24451 的 `if (_tf && _tf.owner_side === side)` **加 else 分支**：

```js
} else {
	game.block_reason = 'pending_trigger: 等待【' +
		(_tf && (_tf.owner_side === 'axis' ? '轴心国' : '同盟国') || '对方') +
		'】对响应卡表态'
	return { log: 1 }
}
```

配套：`build_actions_inner` 开头清空 `block_reason`（24414）保持不动，只在有帧时重新赋值。

### P1-1 · 派生缓存自愈（防将来再漏）

`do_action` 入口（或 `request_responses` 末尾）加一条幂等重建：

```js
/* 派生视图与栈保持一致：栈非空则按栈重建，栈空则清空 */
sync_response_queue_view(game)
```

`response_queue` 本就不该作为状态持久化，推荐后续把它彻底降级为 `view` 现算字段。

### P1-2 · 让权自愈

`rectify_active` 之前补一条守卫：`handoff_stack` 里存在 `id === 'response'` 但栈已空 → 强制 `reconcile_handoff(game, 'response')`，
避免历史对局里已经错位的存档继续卡死（新对局由 P0 覆盖）。

### P2 · 回归用例

在 `tools/_repro_17737.js` 基础上扩展（已可运行，当前 8 项断言全 PASS）：

| 用例 | 断言 |
|---|---|
| 同盟征召触发 17737 | `active === 'Axis'`；轴心 actions 含 trigger/pass；同盟 actions **只有** `{log:1}` 且 `block_reason` 非空 |
| 轴心点「不发动」 | 栈清空、`handoff_stack` 清空、`active === 'Allies'`、同盟 actions 恢复全套 |
| 轴心点「发动」 | 德国+意大利在 `<意大利>` 各 +1 陆军；卡进弃牌堆；栈清空；`active === 'Allies'` |
| 同盟在窗口期强行 `next_nation` | 服务端应拒绝（actions 里没有该键） |
| 人为把 `response_queue` 清空 | `pending_trigger` 仍非空（P0-1 生效的证明） |

## 六、需要补充的信息

本次只有文字反馈，没有对局号。**若能提供该局的 game id**，可直接读存档确认：

- `game.active` 当时是 `'Allies'` 还是 `'Axis'`
- `game.handoff_stack` 是否残留 `{id:'response'}`
- `game.response_stack.length` 与 `game.response_queue.length` 是否相等

三者一对比即可判定走的是缺陷 1 还是缺陷 2（或两者叠加）。

## 七、验收

1. 响应窗口期，非持有方 actions 只剩 `{log}`，`block_reason` 明确写"等待对方表态"
2. 持有方视野：响应框正常弹出、发动/不发动均可点、点完 active 正确归还
3. 人为制造 `response_queue` 与栈不一致时，响应框仍能弹出（P0-1 生效）
4. 全量回归：`_smoke_responses*` / `_smoke_italy_response.js` / `_repro_17737.js` 全绿
