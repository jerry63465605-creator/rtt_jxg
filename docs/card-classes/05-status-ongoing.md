# 05 状态卡·持续光环（`ongoing`，24 张 / 15 种 kind）

> **一句话判据**：`STATUS_EFFECTS[id].ongoing` 存在 → 打出时把效果写进 `game.status_aura`，
> 之后**每个读取点裸读**这个持久字段，不需要窗口、不问玩家。

## 一、怎么认出这类卡

```js
STATUS_EFFECTS[id].ongoing = { kind, space?, require?, markers?, desc }
```

## 二、共性：15 种 `kind` 全表

| kind | 张数 | 卡 | 改判什么 |
|---|---:|---|---|
| `always_supplied` | 4 | 15346 自由法国 / 15356 地中海基地 / 17838 什维尔尼克疏散委员会 / 17849 中国人民解放军 | 指定部队**永远补给** |
| `supply_point_and_markers` | 4 | 15345 塞内加尔步兵团 / 15347 波兰主权 / 15443 前进基地 / 17742 拉丁世界 | 该地区变成**补给点** + 计分标记 |
| `space_immune` | 2 | 8601 远东共和国 / 17539 常设联合国防委员会 | 该地区部队**不受**敌方效果 |
| `home_override` | 2 | 17554 重庆国民政府 / 17845 迁都古比雪夫 | **改大本营**（补给起点换地区） |
| `pair_adjacency` | 2 | 17744 土耳其开放海峡 / 17747 西班牙控制直布罗陀 | 两个地区**永久相邻** |
| `axis_only_seas` | 1 | 15254 战争海军 | 某海区**只与轴心相邻** |
| `free_french` | 1 | 15344 法国流亡政府 | 法国流亡机制 |
| `shared_supply_group` | 1 | 17549 盟军远征部队最高司令部 | 多国**共享补给组** |
| `suppress_enemy_status` | 1 | 15343 霍巴特滑稽坦克 | 压制敌方状态卡 |
| `watch_us_japan` | 1 | 17553 抗日义勇军 | 监视美日互动 |
| `marker_if_controlled` | 1 | 6601 大德意志帝国 | 控制指定地区则加标记 |
| `marker_only` | 1 | 17901 工业心脏 | 只加标记 |
| `port` | 1 | 15444 丘克群岛 | 该地区变**港口** |
| `remove_supply_and_marker` | 1 | 17840 焦土作战 | **移除**敌方补给点/标记 |
| **（无 kind）** | 1 | 16304 中国远征军 | 只有 `ongoing` 空壳，逻辑在别处 |

## 三、共性：三段生命周期

```
① 打出（play_card -> activate_status / apply_status_ongoing）
     -> 往 game.status_aura.<字段> 写入（数组 push / 对象置位）
② 生效（所有读取点裸读 game.status_aura）
     get_connections / compute_supply / is_supply_point / home_of_nation …
③ 离场 / 压制（revert_status_ongoing / status_card_effective）
     -> 旧实现：多数 kind 没写 revert，压制也不查
```

## 四、共同易错点（这一类**最大的坑**）

| # | 坑 | 后果 |
|---|---|---|
| 1 | **压制不生效**：`status_card_effective()` 只接了 15254，其余 23 张被 15353《保持冷静》压制后**照旧生效** | 玩家压制了没用 |
| 2 | **离场不撤销**：`revert_status_ongoing()` 的 case 列表不全 | 卡离开桌面后光环**永久残留** |
| 3 | **裸读**：`game.status_aura.xxx` 直接读，不判"写它的卡还在不在" | 无法回溯来源，改不了上面的 1、2 |
| 4 | **过滤不分阵营**：15254 曾对轴心自己也收紧 | 己方部队被自己的光环限制 |
| 5 | **改判被顺带套到补给上**：`get_connections` 的收紧类逻辑被 `compute_supply` 复用 | 同盟海军在北海 100% 断补（已修：补给计算传 `{ no_sea_axis_only: true }`） |
| 6 | 只写 `apply` 不写 `revert`，也没写"读取时先判有效" | 只能靠存档重开局恢复 |

**正确做法（15254 已是范式）**：

```js
// 存 cardId 而不是布尔/纯数组
game.status_aura.strait_force_axis[sid] = card_id

// 读取时先判卡是否仍然有效
if (status_card_effective(game, game.status_aura.strait_force_axis[sid])) { ...改判... }
```

这样**压制、离场、被打断全部自动失效**，不需要维护 revert 列表。

## 五、验收写法

每条光环至少 4 个断言：

```js
// S1 未打出 -> 不改判
ok(connBefore.length === connAfter.length)

// S2 打出 -> 改判生效
I.apply_status_ongoing(g, '15254#1', '德国')
ok(get_connections(g, BAL, 'axis').indexOf(NORDIC) < 0, '北欧被切断')

// S3 被 15353 压制 -> 恢复
g.status_suppressed_this_turn['15254#1'] = freq_key(g)
ok(get_connections(g, BAL, 'axis').indexOf(NORDIC) >= 0, '压制后恢复')

// S4 离场 -> 清除
I.revert_status_ongoing(g, '15254#1')
ok(!g.status_aura.strait_force_axis, '光环已清空')
```

> 参考已完成的 15254 验收（`docs/fix-log-2026-10-26.md` 里的 S1–S10）。

## 六、参考实现

| 想做 | 抄哪张 |
|---|---|
| **带 cardId + 有效性判定的光环（推荐范式）** | **15254 战争海军**（已改造） |
| 改大本营 | 17554 / 17845（注意 #17：改判要贯通建设/补给/撤回） |
| 永久相邻（放宽类） | 17744 / 17747（**放宽**类不该被补给过滤误伤） |
| 变补给点 | 15345 / 15347 / 15443 / 17742 |

## 七、这一类当前的系统性待办

`docs/bug-todo-2026-10-28.md` 的 **#4「A 类：光环生命周期」**（批 3 处理）：

> 24 张 `ongoing` 卡里，除 15254 外**都没有**「压制判定」与「离场撤销」。
> 统一改法：`status_aura` 各字段存 `cardId`，读取走 `status_card_effective()`。
