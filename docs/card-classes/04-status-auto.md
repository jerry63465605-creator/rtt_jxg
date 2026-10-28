# 04 状态卡·自动结算（`auto`，26 张）

> **一句话判据**：`STATUS_EFFECTS[id].auto` 存在 → 到某个阶段**静默**结算，不弹窗、不问玩家。

## 一、怎么认出这类卡

```js
STATUS_EFFECTS[id].auto   // 有 = 自动型
```

`auto` 字段形态（实测）：

```js
{ phase: 'scoring', trigger_nation: '德国', kind: 'run',
  desc: '计分阶段：<波罗的海>有德国海军+1；<北欧>有德国陆军+1' }

{ phase: 'scoring', trigger_nation: '英国', kind: 'score_per_unit',
  spaces: ['加拿大','北大西洋'], nation: '英国', types: ['army','navy'], per: 1 }
```

## 二、共性：只有两种 `kind`

| kind | 语义 | 需要的字段 |
|---|---|---|
| `run` | 走命令式逻辑（`desc` 写清规则，代码在计分流程里按 id 特判） | `phase` / `trigger_nation` / `desc` |
| `score_per_unit` | 按"某地区的某国部队数量 × per"加分 | `spaces` / `nation` / `types` / `per` |

**共同点**：

1. 全部挂在 `phase: 'scoring'`（计分阶段），目前**没有**别的阶段
2. 都有 `trigger_nation`：**这些分算给谁**（不等于卡持有国 —— 如 15439《北进论》是日本的卡，分数归日本，但很多德国卡也归德国）
3. 不产生 `game.pending_*`，**不打断流程**，玩家只能看日志
4. 不写 `game.status_aura`，**离场即失效**（因为每次计分时重新读桌面还在不在）

## 三、共性：执行流程

```
计分阶段（scoring）
  ↓
遍历桌面状态卡 → 取 STATUS_EFFECTS[face].auto
  ├─ phase 不匹配 -> 跳过
  ├─ kind === 'score_per_unit' -> 数棋子 × per，加到 trigger_nation
  └─ kind === 'run' -> 走该 id 的命令式分支（写在计分函数里）
  ↓
写 game.log（"【德国】+1（波罗的海有德国海军）"）
```

## 四、共同易错点

| # | 坑 | 后果 |
|---|---|---|
| 1 | `trigger_nation` 写成卡持有国 | 分数记给错的国家（静默，不报错） |
| 2 | `kind:'run'` 只写了 `desc`，代码里没实现 | **卡面说加分，实际不加**（26 张里这类最容易漏） |
| 3 | 地区名写中文而不是 id | `spaces` 匹配不到（`data.id_of()` 转换后才能用） |
| 4 | `types` 写 `'air'` | 多数计分卡只算 `army/navy`，空军是否计入要看卡面 |
| 5 | 依赖"卡在桌面"却把卡放进了弃牌堆 | `auto` 只在桌面时被扫到 |
| 6 | 与 `ongoing` 同时存在时口径混淆 | 一张卡可同时有 `ongoing` + `auto`（如 6601），**两者互相独立** |

## 五、验收写法

```js
// 摆局面 + 桌面放卡
g.table_status = [...]                    // 或该卡实际存放字段
const before = score_of(g, '德国')

// 触发一次计分阶段
I.run_scoring(g)                          // 或走完整 phase 流程

ok(score_of(g, '德国') - before === 1, '计分 +1')
ok(/波罗的海/.test(g.log[g.log.length-1]), '日志说明了计分依据')
```

**必测**：① 条件满足加分 ② 条件不满足 **不加** ③ 卡不在桌面 **不加**。

## 六、参考实现

| 想做 | 抄哪张 |
|---|---|
| 按部队数计分（声明式） | **15340 国家资源动员法**（`score_per_unit`） |
| 按"某地区有没有某国部队"计分（命令式） | **15241 瑞典铁矿** / **15244 丰富的资源** |
| 多地区逐个判定 | 15439 北进论 |

> 这 26 张的共性风险是**"卡面写了、代码没写"**：因为没有窗口、没有玩家交互，
> 漏实现完全静默。审查时逐张对照 `desc` 与计分代码。
