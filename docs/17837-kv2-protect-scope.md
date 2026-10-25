# 17837 KV-2 保护范围：应是"本次战斗"，实现成了"本回合"

> 状态：**✅ P0 已修复（2026-10-25，工作区未提交）；P1 同类审计仍待做**
> 已做：`has_modifier` 增加 `piece` 维度；17837 的 protect 带 `piece: pb.victim`，
>      并在本场战斗（`do_battle` 重放）结束后立即撤销。
> 验证：`node tools/_smoke_a1a2.js` —— piece 维度 3 项 + 17853 旧写法回归 1 项全部 PASS。
> 结论：17837 与 17853 用了**完全相同**的 protect 注册方式，但两张卡卡面口径不同。

## 一、卡面对比（关键差异）

| 卡 | 卡面 |
|---|---|
| **17837 KV-2 重型坦克** | 苏联陆军被攻击时：攻击国家选择 弃置 4 张手牌 或 使该陆军在**本次战斗中**不会被移除 |
| 17853 一步也不许后退! | 苏联陆军被攻击时，弃置 4 张手牌：使其在**本回合中**不会被移除 |

两者只差"本次战斗 / 本回合"，实现却是一模一样的。

## 二、现状：两处注册完全相同

```26479:26483:server-official/public/quartermaster-sub-wars/rules.js
			if (pick === 'protect') {
				register_modifier(game, {
					key: 'protect', nation: pb.victim_nation, type: 'army',
					spaces: [pb.space], untilTurn: game.turn, card: '17837',
				})
```

```26562:26565:server-official/public/quartermaster-sub-wars/rules.js
			register_modifier(game, {
				key: 'protect', nation: pb.victim_nation, type: 'army',
				spaces: [pb.space], untilTurn: game.turn, card: '17853',
			})
```

17853 这样写是对的；17837 抄了同一份，就成了"本回合"。

## 三、为什么影响面比想象的更大

`protect` 的判定入口只有一个（正确设计）：

```8969:8987:server-official/public/quartermaster-sub-wars/rules.js
function has_modifier(game, key, piece) {
	...
		if (key === 'protect' && m.turnNation != null && m.turnNation !== game.current_nation) continue
		if (m.nation != null && m.nation !== nation) continue
		if (m.type != null && m.type !== type) continue
		if (m.types && m.types.indexOf(type) < 0) continue
		if (m.spaces && m.spaces.length && m.spaces.indexOf(space) < 0) continue
```

匹配维度只有 **nation / type / spaces / untilTurn / turnNation**，**没有"哪一支棋子"和"哪一场战斗"**。所以 KV-2 的"保护"实际是：

| 维度 | 实际范围 | 卡面要求 |
|---|---|---|
| 时间 | 本回合内（`untilTurn: game.turn` + `turnNation: current_nation`） | **本次战斗** |
| 对象 | 该地区**所有**苏联陆军 | 只保护**被攻击的那一支**（`pb.victim`） |
| 事件 | 同时挡住 **断补移除**（983 `resolve_supply` 也走 `is_protected`） | 只挡本次战斗的移除 |

最明显的破绽：**本回合稍后若该地区断补，这支部队不会被移除** —— 卡面显然没这个效果。

## 四、修复方案

### P0-1 · 加"棋子"维度（2 行）

`has_modifier` 增加一条：

```js
if (m.piece != null && m.piece !== piece) continue
```

KV-2 注册时带 `piece: pb.victim`。其它卡不传该字段，行为不变。

### P0-2 · "本次战斗"= 重放结束即撤销（核心）

KV-2 的 protect 只在**这一场战斗的重放期间**有效：

```js
let kv2Prot = null
if (pick === 'protect') {
	kv2Prot = register_modifier(game, {
		key: 'protect', nation: pb.victim_nation, type: 'army',
		piece: pb.victim, spaces: [pb.space],
		untilTurn: game.turn, card: '17837',
	})
	...
}
game.pending_battle = null
let r = do_battle(...)          /* 重放期间保护有效 */
if (kv2Prot) game.modifiers = (game.modifiers || []).filter(m => m !== kv2Prot)
if (!r.ok) { set_pending_battle(game, pb); ... }   /* 失败重挂起：保护已撤销，重选后重新注册 */
```

要点：
- 撤销必须在 `do_battle` **之后**、`if (!r.ok)` 重挂起**之前**
- `untilTurn` 保留作为兜底（万一异常路径漏撤销，也不会跨回合残留）

### P1 · 同类审计（同一口径问题可能不止这一张）

所有 `key: 'protect'` 的注册点都在 `untilTurn: game.turn` 这一档，需逐张核对卡面写的是"本次战斗"还是"本回合"：

| 行 | 场景 |
|---|---|
| 4198 | 美国海军保护 |
| 10460 | 法国陆军保护 |
| 12508 | 动态（按 `piece_nation`） |
| 14472 / 14481 / 14499 / 14522 | 多张 armed 保护卡 |
| 14554 / 14563 / 14607 | 多张 armed 保护卡 |
| 15329 / 15339 / 15349 | 英国/日本响应卡 |
| 15599 | 苏联 |
| 17336-17338 | 事件卡 `op:'protect'` 步骤 |

本次只修 17837；上表留作下一轮核对。

### P2 · 日志措辞

26484 与 26566 现在都写"本次战斗/本回合不会被移除"，17837 修完后应与卡面一致（"本次战斗中"）。

## 五、验收

1. KV-2 选 protect → 本次战斗 victim 不被移除（现有行为保持）
2. **同一回合稍后该地区断补** → victim 正常被移除（新行为，证明已不是"本回合"）
3. **同一回合同一地区再发生一次战斗** → KV-2 保护不再生效，需重新询问
4. 同格若有其它苏联陆军（理论上不会，格子规则 1 单位 + 1 飞机）→ 不受影响（`piece` 维度生效）
5. 17853 一步也不许后退 → 仍为"本回合"，行为不变（回归）
6. guard 保护卡不传 `piece` → 行为不变

## 六、风险

| 项 | 评估 |
|---|---|
| 改动 | `has_modifier` 1 行 + KV-2 注册处 ~5 行 |
| 影响面 | 仅传了 `piece` 的新注册点会变；17853 与 guard 类不变 |
| 注意 | `do_battle` 重放期间若有**嵌套战斗**（闪电战等），嵌套发生在重放内，仍受保护；但 `spaces:[pb.space]` 已把作用域限在本地区，实际影响可忽略 |
