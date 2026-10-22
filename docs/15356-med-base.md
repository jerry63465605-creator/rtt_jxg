# 15356《地中海基地》检查与修复（2026-10-23）

> 卡面：**`<地中海>`的英国海军总是处于补给状态。跳过出牌阶段行动，弃置 2 张手牌：在 `<地中海>` 建设海军。**
> 结论：**光环部分完全正确；激活部分有两处缺陷**。顺带查出 **2 个 `ReferenceError` 级 bug**（不是本卡独有）。

---

## 一、检查结论

| # | 检查项 | 结果 |
|---|---|---|
| 1 | 光环写入 `status_aura.supply_immune['英国']` + scope | ✅ 正确 |
| 2 | scope 限定 `type='navy'` / `space=地中海` | ✅ 正确（别的海域/别的兵种不受影响） |
| 3 | 光环被 `compute_supply` 采用（`sources='aura'`） | ✅ 正确 |
| 4 | 卡离场 `revert_status_ongoing` 清 scope | ✅ 正确 |
| 5 | 激活效果 = "建设海军" | ❌ **误配成 `recruit`（征召）** |
| 6 | `cost.skip_play: true` 的置位时机 | ❌ **早于代价校验 → 可白丢整个出牌阶段** |
| 7 | `tr.requires` 判定函数 `hand_has_matching_card` | ❌ **从未定义 → 一发动就 ReferenceError**（15242 人民冲锋队） |
| 8 | `discard_is` 失败时的日志函数 `status_name` | ❌ **从未定义 → 弃错牌就 ReferenceError**（15242/17539） |

---

## 二、缺陷 ①：把"建设"实现成了"征召"

### 现象（修改前实测）

| 场景 | 结果 |
|---|---|
| `<地中海>` 有英国陆军（**正是能建海军的前提**） | ❌ 拒绝：`地中海 已有本国部队` |
| `<地中海>` 没有任何陆军（**根本不能建海军**） | ✅ 成功建出海军 |

**与卡面完全相反。**

### 原因

`can_recruit_at` 的约束是"该地没有本国部队"；而 `build_piece` 的约束是"相邻陆地有本国陆军（港口）+ 能连回补给源"。两者口径不同，不能混用。

同类历史教训：17843《量与质兼得》卡面写"建设"，原实现也走了 `recruit_piece`，已修。

### 修复

1. `run_status_effect` 新增 `kind === 'build'` 通道（原先只有 `recruit` / `draw` / `battle`）：

```js
if (ef.kind === 'build') {
	const sp = space_id(ef.space)
	const n = ef.nation || nation
	const r = build_piece(game, n, ef.type || 'army', sp)
	...
}
```

2. 15356 的 `effect.kind` 由 `'recruit'` 改为 `'build'`。

### 影响面（重要：只有 1 张）

全库 `effect: { kind: 'recruit' }` 共 **7 处**，逐张对卡面：

| 卡 | 卡面 | 保留 recruit |
|---|---|---|
| 15341 澳大利亚劳管局 | 放弃建设陆军：在`<澳大利亚>`**征召**陆军 | ✅ |
| 15342 印度宣布参战 | 同上（`<印度>`） | ✅ |
| 15345 塞内加尔步兵团 | 法国在`<非洲南部>`**征召**陆军 | ✅ |
| 15347 波兰主权 | 在`<东欧>`**征召**陆军 | ✅ |
| **15356 地中海基地** | 在`<地中海>`**建设**海军 | ❌ → 已改 build |
| 17539 常设联合国防委员会 | 在`<加拿大>`**征召**英国陆军 | ✅ |
| 17742 拉丁世界 | 在`<拉丁美洲>`**征召**陆军 | ✅ |

---

## 三、缺陷 ②：`skip_play` 在代价校验之前置位（影响 9 张状态卡）

### 现象（修改前实测）

```
不带 discard 点发动 15356
→ skip_play_done = {"英国":1}        ← 出牌阶段已被永久跳过
→ 日志「请先选择要弃置的 2 张手牌」  ← 代价没付
→ 效果没结算
→ 再次发动被拒「本回合已跳过出牌阶段」 ← 无法挽回
```

**玩家白丢整个出牌阶段。**

### 原因

`activate_status` 里代价块的顺序是：

```js
if (cost.skip_play) { skip_play_done[国] = turn }   // ← 无校验，直接置位
if (cost.discard)   { 校验不足则 return }            // ← 这里才可能失败
...
if (cost.attrition) { 校验不足则 return }            // ← 这里也可能失败
```

### 修复

把 `skip_play` 块移到 `cost.discard` / `cost.attrition` **全部校验通过之后**、`run_status_effect` 之前。

### 影响面

全库 `cost.skip_play` 共 **9 处**，全部受益（不会再出现"白跳阶段"）：

15338 反法西斯抵抗运动 / 15345 塞内加尔步兵团 / 15347 波兰主权 / **15356 地中海基地** /
17554 重庆国民政府 / 17539 常设联合国防委员会 / 15242 人民冲锋队 / 15255 征兵 / 17746 耀武

---

## 四、缺陷 ③④：两个从未定义的函数（ReferenceError）

这两个不是 15356 引入的，但都在本卡的激活路径上被扫出来。

| 未定义函数 | 调用点 | 触发条件 | 修复 |
|---|---|---|---|
| `hand_has_matching_card` | `status_window_ready` 的 `tr.requires` 分支 | 任何带 `requires` 的状态卡发动时（当前：**15242 人民冲锋队**） | 按 `card_matches_filter` 同源口径补实现 |
| `status_name` | `activate_status` 的 `discard_is` 失败分支 | 15242 / 17539 弃错牌时 | 改用同作用域已有的 `cName` |

原先的表现都是「点了直接抛异常、什么也没发生」。

### 全库复查

写了一次性静态扫描（`tools/undef_scan.js`），提取所有 `标识符(` 调用与 `function`/`const`/参数声明做差集：

```
可疑未定义调用，共 2 → 修复后 0
（剩余 2 个误报 cards_of_nation / cards_of_type 是 cards.js 的解构导入）
```

---

## 五、附带：新增前置闸门

`status_window_ready` 的 `play_start` 分支新增：

```js
/* effect.kind='build' 的状态卡：目标地区当下建不了就置灰 */
if (tr.effect && tr.effect.kind === 'build') {
	const cb = can_build_at(game, tr.effect.nation || nation, bsp, tr.effect.type || 'army')
	if (!cb.ok) return { ok: false, reason: cb.reason }
}
```

避免「点了 → 弃 2 张 + 跳过出牌阶段 → 效果失败」的白亏。
与 17841 近卫军那条"弃牌堆没有[建设陆军]就置灰"同一口径。

---

## 六、测试

`tools/_smoke_15356_med_base.js`（24 项，ALL PASS）

| 段 | 覆盖 |
|---|---|
| A | 光环：地中海英国海军在补给、东海英国海军不在、陆军不受影响；scope 记录 `type/space`；revert 后清空 |
| B | 有港口时激活 → 手牌 -2、地中海海军 +1、`skip_play_done` 置位、日志写"**建设**海军" |
| C | 无港口时 → `status_window_ready` 置灰；强行激活不付代价、不跳阶段、不建兵 |
| D | 不带 `discard` 发动 → **`skip_play_done` 未置位**；重试可成功 |
| E | 其余 6 张 recruit 卡配置未变；15242 弃错牌 → 不跳阶段 + 日志正确（不再崩） |

**全量回归**：55 个 smoke，失败 19 个，**名单与改动前完全一致**（新增 0，且不再有任何 `ReferenceError`）。

---

## 七、回修入口

| 症状 | 先看 |
|---|---|
| `<地中海>` 英国海军仍被判缺补给 | `apply_status_ongoing` 的 `always_supplied` 分支（scope 写入）与 `supply_aura_covers`（消费） |
| 地中海有陆军却说建不了海军 | `can_build_at` 的 A/B 检查（港口 = 相邻陆军；A = 连回补给源） |
| 激活后没建出海军 | `run_status_effect` 的 `kind==='build'` 分支 + 卡面 `space/type/nation` 配置 |
| 状态卡"点了直接跳阶段却什么都没发生" | `activate_status` 的 `skip_play` 是否仍在代价校验之前 |
| 状态卡"点了报错/闪退" | 跑 `node tools/undef_scan.js` 查未定义调用 |
| 15242 弃错牌行为异常 | `hand_has_matching_card`（requires 闸门）与 `discard_is` 分支的 `cName` |
