# B25-a：15343《霍巴特滑稽坦克》压不掉「海峡强制轴心」——归属判定丢失

> 日期：2026-11-06　范围：`rules.js`（1 处：`status_card_effective`）　影响卡：15254 战争海军 / 17747 西班牙控制直布罗陀

## 1. 玩家报障

> 「海峡强制轴心能压制吗？之前局内实测貌似没有压制。」

实测确认：**确实压不掉**。

## 2. 复现（`tools/_probe_15343_strait3/4/5.js`）

布阵：英国海军守<北欧>（海峡 id=4 的落点）→ 海峡控制者 = allies → <北海>↔<波罗的海> 对同盟相邻。

| 步骤 | allies 邻接 | axis 邻接 |
|---|---|---|
| 基准（无 15254） | ✅ true | false |
| 德国回合打出 15254 | ❌ false | ✅ true（强制生效） |
| **英国回合 + 15343 在桌面** | ❌ **仍 false** | ✅ 仍 true |

同时 `status_active(15254, '德国') = false`（本该被压），但引擎实际走的是
`status_active(15254, null) = true`。

## 3. 根因

```js
// 旧实现
function status_card_effective(game, cardId) {
    const cfg = status_config_of(cardId)
    return status_active(game, cardId, (cfg && cfg.actor) || null)   // ← cfg.actor 恒 undefined
}
```

- **所有状态卡配置都没有 `actor` 字段**（15254 / 17747 / 15343 / 15444 / 8601 实测全为 `undefined`）；
- 于是 `owner = null` → `status_active` 里 `faction_of_nation(null) = null` → 提前 `return true`（视为"有效"）；
- 因此**凡走 `status_card_effective()` 的路径永远压不掉**：
  - `compute_connections()` 的海峡强制轴心（15254 / 17747）
  - `compute_supply()` 里 15254 的"波罗的海中继虚拟海军"
- 其它路径（`activate_status` / 桌面 ready / 计分 / 标记 / 反应收集）本来就**显式传桌面归属国**给 `status_active()`，所以一直正常 —— 这正是"部分能压、海峡不行"的来源。

## 4. 修法（1 处）

```js
let owner = cfg.actor || null
if (!owner) {
    const def = inst_card(String(inst_card_id(cardId))) || {}
    owner = def.nation || null              // 卡定义里的国家
}
if (!owner) {
    for (const n of Object.keys(game.table || {}))
        if ((game.table[n] || []).indexOf(cardId) >= 0) { owner = n; break }   // 桌面归属
}
return status_active(game, cardId, owner)
```

三级回退（配置 → 卡定义 → 桌面归属），任一级命中即可正确判阵营；都取不到时保持旧行为（视为有效），不引入新风险。

## 5. 真实测试 `tools/_real_test_15343_strait.js`（11 项）

```
A ★  基准：allies 邻接成立
B ★★ 打 15254：allies=false、axis=true（强制生效）
C ★★ 英国回合 + 15343：allies 恢复 true
D ★★ 轴心失去强制邻接（axis=false）
E ★★ 缓存 get_connections 与现算 compute_connections 同结论
F ★  德国回合 + 15343（不在生效窗口）→ 仍为强制（不受影响）
G ★★ 15353 压制（status_suppressed_this_turn）同样恢复
H ★★ 17747 直布罗陀走同一判据（基准 true → 强制 false → 坦克在场 true）
I/J 静态守卫 2 条
```

## 6. 回归

```
15353 拦截 23、空军派发 16、17811 特例 21、15226 14、17732 auto 11、15215 10
test_basic_cards 288/9（与基线一致）、全量冒烟 112 全绿
```

## 7. 行为变化（要跟玩家说明）

1. **英国回合**里，敌方（轴心）的海峡强制轴心（15254 / 17747）会失效，海峡按**实际控制者**判定；
2. 15254 的"波罗的海中继虚拟海军"同样只在其有效时成立；
3. 德国/意大利回合内不受影响（15343 只在英国回合生效，见 `status_active` 的 2026-10-25 口径）；
4. `status_card_effective` 现在对**所有**状态卡都能拿到归属国，后续新增光环卡不必再各自兜底。

## 8. 未包含（B25-b / B25-c，另行评估）

| 编号 | 内容 | 状态 |
|---|---|---|
| B25-b | `port_as`（15444 丘克群岛）/ `space_immune`（8601 远东共和国）只存**国名**，无卡 id，压制无处落地 | 待评估（见 TODO） |
| B25-c | `pair_adjacency`（17744 土耳其开放海峡）直接改 `limited_connections`，无法撤销 | 待评估 |
