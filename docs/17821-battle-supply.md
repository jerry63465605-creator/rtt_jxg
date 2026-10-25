# 17821 华西列夫斯基：发起战斗的部队必须处于补给状态

> 状态：**✅ 已修复（2026-10-25，工作区未提交）**
> 已做：
>   ① 删掉 `op:'battle'` 步里的无条件 `grant_supply`（前一步 recruit 若声明 grantSupply 已在 17598 授予过）
>   ② 去掉 `17821` 与 `17822` 的 `grantSupply: true`（卡面均未写"始终处于补给状态"）
> 验证：`tools/_smoke_batch_b.js` B3 段 4 项全 PASS（配置级）；
>      真实断补场景下 `battle_initiators` 会排除该部队、`event_battle_targets` 随之收窄 —— 与执行端同源。
> 结论：通用规则已实现（`do_battle` / `battle_initiators` 都判补给），但被两处
> **强制授予补给**架空 —— 17821 即使新部队断补也能发起陆战。

## 一、卡面

```9120:9121:server-official/public/quartermaster-sub-wars/rules.js
			{ op: 'recruit', type: 'army', spaces: space_ids_of(['海参崴', '中国东北']), pick: 1, grantSupply: true },
			{ op: 'battle', kind: 'land', useNewPiece: true, spaces: space_ids_of(['中国东北', '中国东部']), pick: 1 },
```

在 `<海参崴><中国东北>` 之一征召陆军，再对 `<中国东北><中国东部>` 之一发起 1 次陆战。
卡面**没有**"该部队始终处于补给状态"字样 —— 这个 `grantSupply: true` 是实现自己加的。

## 二、通用规则本身是对的

| 位置 | 内容 |
|---|---|
| `battle_initiators`（19310） | 候选发起单位必须 `supply.in_supply[p]` |
| `do_battle` 指定 `from` 时（18072） | `if (!supply.in_supply[from]) return '发起单位不处于补给状态'` |
| 预算阶段候选（16949-16953） | `canInit = initsHere.some(x => x.id === np)` —— 也走 `battle_initiators`，与 `do_battle` 同源 |

也就是说：**只要不给它强塞补给，候选与结算会自动一致地排除断补单位**。

## 三、真正的根因：两处强制授予补给

### ① recruit 步的 `grantSupply: true`（17821 自己声明）

```17598:17598:server-official/public/quartermaster-sub-wars/rules.js
				if (st.grantSupply) grant_supply(game, r.id, game.turn || 1)
```

`grant_supply` 写入 `game.supply_granted`，而 `compute_supply`（797-807）会把这些部队直接置
`in_supply = true` → 真实补给线被完全旁路。

### ② battle 步无条件再授一次（**这是通用缺陷，影响所有 useNewPiece 卡**）

```17700:17704:server-official/public/quartermaster-sub-wars/rules.js
			let from = arg.from
			if (st.useNewPiece && newPiece != null) {
				from = newPiece
				grant_supply(game, newPiece, game.turn || 1)
			}
```

这里**不看前一步有没有声明 grantSupply**，一律授予。所以：

- 即使把 17821 的 `grantSupply` 删掉，17703 仍会补上 → 修不干净
- 反过来，凡是"卡面没写始终补给"的 useNewPiece 卡（17821、17822 等），都能让断补部队发起战斗

## 四、修复

### P0 · 删掉 battle 步的无条件授予（1 行）

```js
if (st.useNewPiece && newPiece != null)
    from = newPiece
    /* 补给由前一步 recruit 的 grantSupply（卡面明写"始终处于补给状态"）负责；
       卡面没写就走真实补给线（do_battle / battle_initiators 同源校验）。 */
```

理由：前一步 recruit 若声明了 `grantSupply`，17598 已经授予过，17703 是**重复授予**；
前一步没声明，就不该授予。build 步更不需要 —— 规则书五已规定"建设的新部队处于补给状态"。

### P1 · 去掉 17821 的 `grantSupply: true`

```js
{ op: 'recruit', type: 'army', spaces: space_ids_of(['海参崴', '中国东北']), pick: 1 },
```

### P2 · 待玩家确认：17822《诺门坎战役》同款

```9130:9131:server-official/public/quartermaster-sub-wars/rules.js
			{ op: 'recruit', type: 'army', spaces: space_ids_of(['蒙古']), pick: 1, grantSupply: true },
			{ op: 'battle', kind: 'land', useNewPiece: true, spaces: space_ids_of(['中国东北', '海参崴']), pick: 1 },
```

卡面同样没写"始终补给"，按同一口径应一并去掉。**本次只处理 17821，17822 待确认。**

### 不要动的（卡面确实写了"始终处于补给状态"）

| 行 | 卡 | 依据 |
|---|---|---|
| 9431 / 9440 | 夏威夷 / 新西兰征召 | 卡面写明 |
| 9606 | 非洲南部征召 | 卡面写明（788 行注释即引用此卡） |
| 9252 / 9472 | 中国征召 | 卡面写明 |
| 17820 方面军 | build 型 | 建设本身保证补给，无需 grant |

## 五、修复后的行为

| 场景 | 结果 |
|---|---|
| 在 `<海参崴>` 征召，海参崴断补 | 征召照常，但战斗步**无候选目标**（`event_battle_targets` 为空）→ 该步记 `last_card_fail`，卡正常收尾，不卡死 |
| 在 `<海参崴>` 征召且补给正常 | 正常对 `<中国东北>` 发起陆战 |
| 在 `<中国东北>` 征召（有补给） | 正常对 `<中国东部>` 发起陆战 |

> 注：这张卡在远东断补时"打得出但打不了"，是规则的自然结果。
> 若要更友好，可在 `event_card_needs` 或出牌前给一条明确提示
> （"征召的陆军断补，无法发起陆战"），不改变规则判定。

## 六、验收

1. 造一个海参崴断补的局面 → 17821 出牌后战斗步无目标、不卡死、日志说明原因
2. 造一个补给正常的局面 → 17821 能正常发起陆战（`useNewPiece` 用刚征召的那支）
3. 其它 useNewPiece 卡回归：17820《方面军》、15325《莱茵河与多瑙河》、15422/15423 等
   —— 这些卡的前一步是 build 或声明了 grantSupply，行为不应变化
4. `compute_supply` 不出现 `sources[p] === 'granted'` 的意外增长

## 七、风险

| 项 | 评估 |
|---|---|
| 改动量 | 删 1 行 + 去掉 1 个字段 |
| 影响面 | 所有 `useNewPiece` 事件卡（约 15 张）—— 但只有"卡面没写始终补给且征召地断补"的才会改变结果 |
| 回归重点 | 17820 / 15325 / 15422 等 build 型不受影响；17821/17822 需实测 |
