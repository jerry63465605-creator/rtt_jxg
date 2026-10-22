# 15406《南云忠一指挥航空队》打出时点排查（2026-10-23）

> 卡面：**在海域部署或调度飞机后，弃置 1 张 [响应卡]：对相邻地区发起 1 次战斗。**

## 一、现场（game 24）

玩家反馈：日本用 15408《山本五十六指挥大和号》在北太平洋部署空军后，
**没有出现南云忠一的打出时点**。

读库结果：

| 项 | 值 |
|---|---|
| 触发条件本身是否满足 | ✅ 北太平洋（海域）有日本海军 `p63`，且在补给（source=chain）；空军 `p70` 也在 |
| `armed.ready()` | ✅ true |
| 日本手牌 | `15406#17 南云` / `15439 北进论` / `15401 发起陆战` / `15415 气球炸弹` / `15416 潜艇支援` |
| **可作代价的 [响应卡] 数量** | **0** |
| `armed_offers` | 空 |

日志显示，日本打出 15408 时已经"弃置 1 张响应牌"——那是最后一张。

## 二、结论：不是 bug

15406 的代价是 `{ discard: 1, filter: 'response' }`。
`offer_armed_effects` 对**弃牌代价**有预检：

```js
const discNeed = (ar.cost && ar.cost.discard) || 0
if (discNeed) {
    const dpool = 手牌.filter(id => id !== cid && (!dfilter || filter_matches_card(id, dfilter)))
    if (dpool.length < discNeed) continue      // 付不起就不进候选
}
```

手牌里没有响应卡 → 不进候选 → **不弹窗**。这与"按钮能点但点了被拒"是同一套防呆口径
（玩家 2026-10-01 口径：没把握就不弹）。

**复验**：给日本手牌塞 1 张响应卡（15448 泰国）后立刻正常开窗：

```
armed_offers = [{
  when: 'after_deploy_air',
  cards: [{ card_id: '15406#17', name: '南云忠一指挥航空队',
            cost: { attrition: 0, discard: 1, filter: 'response' } }]
}]
```

## 三、顺带修掉一个真 bug：调度分支没上报

`run_sea_air_deploy` 有两条分支：

| 分支 | 原实现 | 是否上报 `after_deploy_air` |
|---|---|---|
| 部署（choice≠1） | 走 `build_piece(game, nat, 'air', space)` | ✅（`_build_piece_impl` 内有 offer） |
| **调度（choice===1）** | 直接 `game.location[air] = space; refresh()` | ❌ **没有** |

卡面明写"部署**或调度**"，但选调度时 15406、17511《美国陆军游骑兵》等
**所有 `after_deploy_air` 卡永远不触发**。

修法：

```js
game.location[air] = space
refresh(game)
/* 与 26834（另一处空军调度入口）一致 */
offer_armed_effects(game, 'after_deploy_air', { space: space, nation: nat })
```

## 四、测试

`tools/_smoke_15406_nagumo.js`（19 项，ALL PASS）

| 段 | 覆盖 |
|---|---|
| A | 前提：北太平洋是海域、同格日本海军在补给、`armed.ready` 为真 |
| B | **手牌无响应卡 → 不弹窗**（复刻 game 24 现场，且无任何提示） |
| C | 手牌有响应卡 → 部署后开窗；代价 = 弃 1 张 `filter:'response'` |
| D | **调度分支也开窗**（本次修复）；空军位置正确 |
| E | 调度到非海域 → 拒绝、不开窗、空军不动 |
| F | 部署路径回归：窗口只开 1 次、15406 只出现 1 次（不重复 offer） |

全量 62 个 smoke：失败 19 个，名单与改动前完全一致。

## 五、回修入口

| 症状 | 先看 |
|---|---|
| 部署/调度飞机后没有任何"可打出"提示 | 手牌里是否有 [响应卡]（代价预检）；`dpool.length < discNeed` 会静默跳过 |
| 只有调度路径不触发 | `run_sea_air_deploy` 的 `choice === 1` 分支是否还有 `offer_armed_effects` |
| 部署后窗口出现两次 | `build_piece` 内部已 offer，外层不要再补一次 |
| 窗口出现但点了没效果 | `ja_battle_targets` 要求**同格有补给中的日本海军**，否则候选为空 |
