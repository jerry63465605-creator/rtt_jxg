# KV-2 弃牌框显示"德国"（应按攻击发起国弃牌）

> 状态：**✅ 已修复（2026-10-25，工作区未提交）**
> 已做（采纳"只在弃牌弹框里切"方案）：
>   ① `pending_cost_nation(pb)`：kv2 → 攻击方；su_step_back → 苏联；guard → 保护卡持有国
>   ② `view.pending_battle` 附加 `cost_nation`（浅拷贝，不写 state）
>   ③ `hands` 构造把 `cost_nation` 也按 own 下发牌面
>   ④ 客户端 `start_guard_discard` / `render_guard_discard_box` 按它取手牌，标题标国名
> 验证：`node tools/_smoke_batch_b.js` B1 段 5 项全 PASS
> 结论：**服务端判定是对的，客户端取错了国家的手牌**；错国会连带把流程卡住。

## 一、卡面与正确口径

17837《KV-2 重型坦克》（苏联，RESPONSE）：

> 苏联陆军被攻击时：**攻击国家**选择「弃置 4 张手牌」或「使该陆军在本次战斗中不会被移除」。

即：弃牌的是**发起攻击的那个国家**（本例日本），不是苏联、也不是轴心代表国德国。

## 二、服务端是对的

```26456:26467:server-official/public/quartermaster-sub-wars/rules.js
			let kv2Drop = []
			let kv2Need = 0
			if (pick === 'discard') {
				const hand = game.hands[pb.attacker] || []
				kv2Need = Math.min(4, hand.length)
				kv2Drop = ((arg && arg.drop) || []).map(String)
					.filter(id => hand.indexOf(id) >= 0)
				if (kv2Drop.length < kv2Need) {
					game.log.push('《KV-2 重型坦克》需弃置 ' + kv2Need +
						' 张手牌（当前指定 ' + kv2Drop.length + ' 张）')
					return game      /* 不消耗卡、不推进战斗 */
				}
			}
```

- 取手牌用 `pb.attacker`（＝发起国，18273 `attacker: nation`）✅
- 无效 id 被 `filter` 掉、数量不足**拒绝并退回**（不吞、不消耗卡）✅
- 实际弃牌 26487 `discard_card(game, pb.attacker, id)` ✅
- 日志 26488 也是 `pb.attacker` ✅

## 三、根因：客户端弃牌框写死 `view.my_nation`

```4525:4525:server-official/public/quartermaster-sub-wars/play.js
	const allHand = (view.hands[view.my_nation] && view.hands[view.my_nation].cards) || []
```

`view.my_nation` 是"此刻我该操作哪个国家"，兜底链在 rules.js:22596-22627：

| 顺序 | 判定 |
|---|---|
| ① | `current_nation` 属于本方 → 用它 |
| ② | 国家技能窗口归属国 |
| ③ | 响应栈栈顶帧的持有国 |
| ④ | 本方 armed 增强窗口归属国 |
| ⑤ | **退回代表国**（轴心＝**德国**、同盟＝英国） |

**整条链里没有 `pending_battle`**。所以：

- 日本发起攻击、但 `current_nation` 此刻不属于日本（如德国回合内由日本发起，或让权/委托场景）
- → 落到 ⑤ → `my_nation = '德国'`
- → 弃牌框列出**德国手牌**
- → 玩家选了 4 张德国牌提交
- → 服务端按 `pb.attacker='日本'` 的手牌过滤 → 全部被剔除 → `0/4` → 拒绝、不推进
- → 玩家反复选、反复失败 = **卡死观感**

同时 `hand_view`（7627-7638）只在 `nation === viewer_nation` 时给牌面，所以即使客户端想读日本手牌，也会拿到 `cards: null`。

## 四、影响面（同一弃牌框的三个使用者）

| 场景 | 触发阶段 | 应由谁弃 | 现状 |
|---|---|---|---|
| 17837 KV-2 | `stage='kv2'` | `pb.attacker`（攻击国） | ❌ 按 my_nation |
| 17853 一步也不许后退 | `stage='su_step_back'` | `pb.su_owner_nation`（苏联自己） | ❌ 按 my_nation |
| 15410 武士道等保护卡 | `stage='guard'` | 保护卡**持有国**（`entry.nation`） | ❌ 按 my_nation（法国 15346 等跨国场景会错） |

三者共用 `start_guard_discard` → `render_guard_discard_box`（play.js:4477-4560）。

## 五、修复方案

### P0-1 · 服务端下发 `cost_nation`（单一真相）

在 `view.pending_battle` 里增加：

```js
cost_nation: pending_cost_nation(pb),   // 本次"谁付代价"
```

```js
function pending_cost_nation(pb) {
	if (!pb) return null
	if (pb.stage === 'kv2') return pb.attacker
	if (pb.stage === 'su_step_back') return pb.su_owner_nation || pb.defender_nation
	if (pb.stage === 'guard') {
		const g = (pb.guard_cards || [])
		return (g.length === 1 && g[0].nation) || pb.defender_nation
	}
	return null
}
```

### P0-2 · `my_nation` 兜底链补上 `cost_nation`

在 22614-22625 之间（响应栈之后、armed 之前）插入：

```js
const cn = pending_cost_nation(game.pending_battle)
if (cn && faction_of_nation(cn) === side) return cn
```

这一步保证 `hand_view` 会给该国家的牌面（7619-7638 只在等于 viewer 时给 cards）。

### P0-3 · 手牌可见性补一个"代价国"

`hands` 构造（22640-22643）改为：

```js
const costNation = pending_cost_nation(game.pending_battle)
const hands = {}
for (const n of ORDER_OF_NATIONS)
	hands[n] = hand_view(game, n, (n === my_nation || n === costNation) ? n : my_nation)
```

覆盖"代价国 ≠ my_nation"的 guard 跨国场景（法国卡由英国代打时）。

### P0-4 · 客户端读 `cost_nation`

```js
// start_guard_discard(g)：新增 discard_nation
pending_guard_sel.discard_nation = g.discard_nation || (view.pending_battle || {}).cost_nation || view.my_nation

// render_guard_discard_box()：4525
const dn = gs.discard_nation || view.my_nation
const allHand = (view.hands[dn] && view.hands[dn].cards) || []
```

标题同时带上国名，避免再靠"默认国"猜：

```
《KV-2 重型坦克》：请【日本】选 4 张手牌作为代价
```

调用处：
| 调用 | discard_nation |
|---|---|
| KV-2（6126-6150 附近） | `pb.cost_nation`（＝`pb.attacker`） |
| `start_step_back_discard(pb)` | `pb.cost_nation`（＝苏联） |
| guard 选卡后 | `entry.nation`（客户端此时已拿到选中的条目） |

### P1 · 服务端兜底提示

`kv2Drop.length < kv2Need` 时，日志补一句"（应从【日本】手牌中选）"，便于线上定位同类问题。

## 六、验收

1. 日本攻击苏联、`current_nation` 为德国时触发 KV-2 → 弃牌框列出**日本**手牌，标题写【日本】；选满 4 张可提交成功、战斗继续
2. 选择"该陆军不被移除"分支 → 不弹弃牌框、正常继续
3. `current_nation` 为日本时行为与现在一致（回归）
4. 17853 一步也不许后退 → 弃牌框列**苏联**手牌
5. 15410 武士道（日本）/ 15346 自由法国（法国卡由英国代打）→ 弃牌框列**卡持有国**手牌
6. 提交非法 id 时服务端仍拒绝且不消耗响应卡（现有行为不变）

## 七、风险

| 项 | 评估 |
|---|---|
| 改动 | 服务端 ~15 行（新增 helper + view 字段 + my_nation/hands 各 1 处）；客户端 ~5 行 |
| 副作用 | 战斗挂起期间 `my_nation` 会切到"付代价的那个国家" → 手牌面板同步切换。这与 22600-22612 既有设计（"按此刻真正该谁行动切"）一致 |
| 回归重点 | 战斗挂起期间 `build_actions` 只放行 `resolve_battle`，切国不会导致误出牌；但需实测"切国后手牌区不再显示原国手牌"是否符合玩家预期 |
