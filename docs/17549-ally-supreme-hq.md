# 17549《盟军远征部队最高司令部》与海军补给 / 建设口径

> 核查日期：2026-10-23　玩家裁定：**建设口径 = 补给口径**；**15343 不压制持续光环**

---

## 一、17549 是什么

**《盟军远征部队最高司令部》**（美国，CORE / STATUS）

> 英国、法国、美国可以英国、法国、美国的部队连接补给线。
> 英国、法国、美国的海军可以英国、法国、美国的陆军作为港口。

实现为一条 `ongoing` 光环（唯一判定入口 `supply_group_partner`）：

```js
'17549': {
    ongoing: {
        kind: 'shared_supply_group',
        nations: ['英国', '法国', '美国'],
    },
}
```

```js
function supply_group_partner(game, nat, onat) {
    if (nat === onat) return true
    const grp = game.status_aura && game.status_aura.shared_supply_group
    return !!(grp && grp.indexOf(nat) >= 0 && grp.indexOf(onat) >= 0)
}
```

> 法国部队在 state 里是**独立国名 `'法国'`**（非英国子标记），所以组内判定对法国真实有效。

---

## 二、海军补给口径（`compute_supply`，2026-10-20 定稿）

两条**分别**满足：

| 条件 | 内容 |
|---|---|
| **A** | 相邻格有【处于补给状态】的【本国 / 17549 组内】部队 —— **不限兵种** |
| **B** | 相邻格有【本国 / 17549 组内】的**陆军** |

- A 不要求那支陆军补给（2026-10-20 修正：原来压成"邻接一支补给中的陆军"，导致互相依赖时双双断补）
- 组外友军（中国、苏联）**不**参与判定
- 补给点（★）种子**不**因 17549 共享：美军站"仅英国"的补给点上仍不算补给

---

## 三、海军建设口径（`can_build_at`）—— 2026-10-23 改为与补给一致

**玩家口径**：「建设要求和补给一致，但是与本国的陆地部队相邻」

即建设海军 = 补给的两条判定，**分别**满足：

```js
if (type === 'navy') {
    const supply = compute_supply(game)
    let hasLandNeighbor = false     /* B：相邻有本国/组内陆军（不要求补给） */
    let hasSuppliedNb = false       /* A：相邻有补给中的本国/组内任意兵种 */
    for (const nb of nbrs) {
        for (const other of pieces_on(game, nb)) {
            if (!supply_group_partner(game, nation, game.piece_nation[other])) continue
            if (game.piece_type[other] === 'army') hasLandNeighbor = true
            if (supply.in_supply[other]) hasSuppliedNb = true
        }
        if (hasLandNeighbor && hasSuppliedNb) break
    }
    ...
}
```

### 修复前后差异

| 场景 | 旧实现（压成一条） | 新实现（= 补给口径） |
|---|---|---|
| 相邻：补给中的海军 + 断补的陆军 | ❌ 不可建 | ✅ **可建** |
| 相邻：陆军断补，但另有补给源（如相邻补给海军） | ❌ 不可建 | ✅ **可建** |
| 相邻：只有断补陆军（无补给部队） | ❌ | ❌（A 失败，提示"相邻还须有处于补给状态的部队"） |
| 相邻：只有补给海军、无陆军 | ❌ | ❌（B 失败，提示"须邻接陆地部队"） |
| 相邻：组内陆军补给中 | ✅ | ✅ |
| 相邻：组外友军（中国） | ❌ | ❌ |

### 为什么不用"模拟放置海军后跑 compute_supply"

15346《自由法国》的 `always_supplied` 光环会直接把这支**新海军本身**判为补给，从而把 A/B 两条邻居条件整体架空。
所以这里只读**真实盘面**邻居的补给状态，不把待建海军投进计算。

---

## 四、17549 的影响面

| 位置 | 影响 |
|---|---|
| `compute_supply` 海军 A/B | 组内盟国部队可充当 A/B |
| `compute_supply` 陆军链传播 | 组内盟国部队可续接补给链 |
| `can_build_at` 海军 B | 组内盟国**陆军**可充当"本国陆地部队" |
| `can_build_at` 海军 A | 组内盟国**补给中部队**可充当 A |
| 补给点种子 | **不受影响**（不喂免费补给） |

### 实证矩阵（`_smoke_17549_supply_build.js` 16 项 ALL PASS）

| 盘面 | 无 17549 | 有 17549 |
|---|---|---|
| 英国陆军（补给中）邻接 | 美国海军断补 / 不可建 | ✅ 有补给 / 可建 |
| 法国陆军（补给中）邻接 | 同上 | ✅ 有补给 / 可建 |
| 中国陆军（补给中）邻接 | ❌ | ❌ |
| 组内陆军断补 | ❌ | 看 A 是否另有来源 |

---

## 五、玩家裁定：15343《霍巴特滑稽坦克》**不**压制持续光环

15343 卡面：「回合内，敌方国家的[状态卡]无效」。

**玩家裁定（2026-10-23）：否 —— 压制只拦"主动发动"，不撤销 `ongoing` 光环。**

因此现状（`status_active` 只在 `status_window_ready` / `activate_status` 里被查）**是符合裁定**的：

- 17549 被 15343 压制时，`status_window_ready` 会拒（若该卡有 trigger）
- 但 `status_aura.shared_supply_group` **继续生效**，共享补给线不断

同样适用于 15346 `supply_immune`、15344 `home_override` 等所有 `ongoing` 光环卡 —— **不需要改**。

---

## 六、遗留（已评估，暂不动）

| 项 | 说明 |
|---|---|
| `discard_table_card` 不调 `revert_status_ongoing` | 目前只被 17850《大清洗》（无光环）使用，属潜在隐患；未来若用它弃置带光环的状态卡会留下"幽灵光环" |
| 中立美国可打出 17549 | `NEUTRAL_RULES` 只限制"不可攻击"和"禁建地"，未限制打状态卡 → 美国参战前也能让英法先享共享补给线 |
| 同格不传递补给 | `get_connections` 不含自身格；规则原文只写"相邻"，此实现符合原文 |
| 建设/补给对"相邻"的定义 | 均用 `get_connections(game, space, faction)`，受 15254 / 17823 / 17744 等邻接修改影响，两者同源 |

---

## 七、出问题回这里

| 症状 | 先看 |
|---|---|
| 海军建不出来 / 提示"须邻接陆地部队" | `can_build_at` 海军分支 B 条（相邻格是否有本国/组内陆军） |
| 海军建不出来 / 提示"相邻还须有处于补给状态的部队" | 同上 A 条（相邻格是否有补给中的本国/组内部队） |
| 共享补给线不生效 | `supply_group_partner` + `status_aura.shared_supply_group`（卡是否在桌面 / 光环是否被 revert） |
| 共享补给线"卡没了还生效" | `revert_status_ongoing` 是否被调用（`discard_status_instance` 有、`discard_table_card` 没有） |
| 海军断补被误移除 | `compute_supply` 海军分支 816~833 |
