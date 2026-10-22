# D7 棋子计数迁移（逐卡对卡面复核）

> 用途：**出问题时知道回哪里修**。看完这一页就知道"某个卡效果多算/少算了部队数"该看哪个函数。
> 实施日期：2026-10-23　文件：`server-official/public/quartermaster-sub-wars/rules.js`

---

## 一、为什么要做

历史上四个 bug 是**同一形态**：

| 卡 | 症状 | 根因 |
|---|---|---|
| 15218 | 德国陆军数多算 | `pieces_on(...).filter(p => piece_type[p] === 'army')` 没写国别 |
| 15219 | 同上 | 同上 |
| 15220 | 同上 | 同上 |
| 15223 | 同上 | 同上 |

即：**手写遍历 + 只按兵种过滤 + 漏了国别/阵营** → 把别国部队算进"我方有几支"。

修复方式不是逐卡打补丁，而是建四个原语，把"归属条件"变成**必填参数**：

| 原语 | 作用 |
|---|---|
| `region_spaces(game, opt)` | 圈范围：`space` / `spaces` / `radius` / `adjacent` / `side`（阵营连通） |
| `list_pieces(game, opt)` | 唯一实现，返回算子 id 数组 |
| `count_pieces(game, opt)` | = `list_pieces().length` |
| `has_pieces(game, opt)` | = `list_pieces().length > 0` |

**归属四选一**：`nation` / `nations` / `faction` / `enemyOf`。
**四选一全缺 → 返回空 + 写【警告】日志**（绝不"数全场"）。

---

## 二、迁移前实测（不是估算）

| 项 | 数量 | 说明 |
|---|---:|---|
| 原语调用（不含注释行） | **86** | 早已大面积使用，不是"从零开始" |
| `pieces_on(` 直接调用 | 98 | 引擎内部遍历，正常 |
| 手写 `piece_nation[...]` 判定 | 133 处 / 32 函数 | 分三类：筛选 17 / 循环累加 **0** / 单点判定 116 |
| **循环里手写累加（B 类）** | **0** | 计数类迁移其实早就做完了 |
| **只按兵种、无国别（高危）** | **0** | 15218 那批 bug 的同类土壤已清空 |

结论：D7 的真实剩余工作只有 **17 处"筛选类"写法统一**，且它们**功能都正确**。

---

## 三、迁移前等价性验证（4028 项全等）

改代码前先跑 `_equiv_piece_filter.js`：在各国各兵种铺满的真实盘面上，对**每一个格位**比对

- 旧：`pieces_on(g, sp).some/filter/every(手写条件)`
- 新：`has/count/list_pieces(g, {space: sp, ...})`

覆盖 7 种语义形态（nation / nation+type / faction / count / list / every / 阵营反义），
**4028 项比对，不一致 0 项 → ALL EQUIV**，才允许改。

---

## 四、本次迁移的 12 处（★ 出问题先看这里）

| # | 函数 | 影响卡 / 影响面 | 判定内容 | 改法 |
|---|---|---|---|---|
| 1 | `de_is_controlled` | **无调用方（死代码）** | 某地区是否被某国控制 | `some(nation)` → `has_pieces({space, nation})` |
| 2 | `15444` 丘克群岛 `run` | **15444 丘克群岛**（日本 STATUS） | 相邻格是否都有日本海军 | `some(nation+navy)` → `has_pieces({types:['navy']})` |
| 3 | `status_on_attacked` | **15250 陆地巡航者**（德国 STATUS，全库唯一 `react.has_army` 配置） | 被攻击格是否有「配置指定的国」陆军 | `some(nation+army)` → `has_pieces({types:['army']})` |
| 4 | `status_window_ready` | **所有带 `trigger` 的状态卡**（战斗窗口判定，4 处调用） | 目标格是否有发起方阵营单位 | `some(faction)` → `has_pieces({faction})` |
| 5 | `15233` 掠夺 `run` | **15233 掠夺**（德国 EVENT） | 德国控制的地区数 | `some(nation='德国')` → `has_pieces` |
| 6 | `17722` 华夫脱党 `cond` | **17722 华夫脱党**（意大利 EVENT） | 相邻地区是否有英国陆军 | → `has_pieces({nation:'英国', types:['army']})` |
| 7 | `17724` 札萨·汗 `cond` | **17724 札萨·汗**（意大利 EVENT） | 同上（中东） | 同上 |
| 8 | `17725` 掠夺 `cond` | **17725 掠夺**（意大利 EVENT） | 意大利控制的地区数 | → `has_pieces({nation:'意大利'})` |
| 9 | `build_candidate_spaces` | **所有建设/征召类卡**（槽位占用判定，2 处调用） | 该格已有同国同兵种 → 不可再放 | `!some(nation+type)` → `!has_pieces({types:[type]})` |
| 10 | `step_space_candidates` | **所有分步战斗类卡**（6 处调用，如 15226） | 目标须为纯敌方或空地 | `some(faction===我方)` → `has_pieces({faction: 我方})` |
| 11 | `home_base_of` | **21 处调用**（计分、美国技能、P-51、`us_p51` 等） | 该战略点是否被轴心占领 | `some(faction===AXIS)` → `has_pieces({faction: AXIS})` |
| 12 | `us_p51` 分支 | **17505 P-51 野马**（美国 EFFECT） | 目标区每有 1 支美国空军 → 额外损耗 ×2 | `filter().length` → `count_pieces({nation:'美国', types:['air']})` |

### 按"影响面"排序（出问题优先查后三个）

1. **`home_base_of`**（21 处调用）— 计分点归属、美国技能判定都过它
2. **`step_space_candidates`**（6 处）— 分步战斗卡的"目标格是否合法"
3. **`build_candidate_spaces`**（2 处，但覆盖所有建设卡）— 槽位是否被占
4. **`status_window_ready`**（4 处）— 状态卡能不能点

---

## 五、评估后**保留不改**的 5 处（附理由）

| 位置 | 内容 | 为什么不改 |
|---|---|---|
| 原 4557 | `some(faction_of_nation(nation) !== fac)` | **阵营反义**（"有敌方"），原语只有正向 `faction`/`enemyOf`(按国)，改写要额外算对方阵营，可读性下降 |
| 原 4919 | `ps.every(p => piece_nation[p] === '德国')`（17745 维希法国） | **every 语义**（"全是德国"），原语无 all 模式 |
| 原 11191 | `some(faction !== 苏联阵营)`（17900 八月风暴） | 阵营反义，同上 |
| 原 20523 | `occupants.filter(p => piece_nation[p] === nation)` | `occupants` 由调用方算好传入（计分快照），改用原语会**改变数据来源**，风险大于收益 |
| 原 24646 | `Object.keys(location).filter(...)` 补给检查 | **跨全图扫描**（不是单格查询），套原语要遍历所有格，反而更慢更绕 |

---

## 六、新增的两个测试（改坏了会红）

### 1. `tools/_smoke_count_contract.js` — 契约测试（33 项 ALL PASS）

锁住原语行为，防止有人改 `_pieces_owner_missing` 让漏洞静默回来：

- **A 段（最重要）**：缺归属 → `[]` + 每次写一条【警告】日志（4 种调用各一次）
- **B 段**：`nation` / `nations` / `faction` / `enemyOf` 四种归属语义（含"同阵营不算敌"）
- **C 段**：`types` / `supplied` 附加过滤
- **D 段**：`region_spaces` 的 `space` / `spaces` / `radius`（含自身）/ `adjacent` / `excludeSelf` / `side`
  + `side` 与 `radius` 互斥保护
- **E 段**：`count`/`has` 与 `list` 同源、返回顺序 = `game.location` 遍历顺序（客户端候选展示依赖）
- **F 段**：空盘面、`location = null`（已消灭）不计入

### 2. `tools/_smoke_count_baseline.js` — 源码基线（5 项 ALL PASS）

把口径冻结成三条硬线：

1. **循环内手写计数 = 0**
2. **只数兵种、不数国别（高危形态）= 0**
3. **筛选类手写只允许白名单 5 处**（即上面第五节），新增即报红
4. 原语调用数 ≥ 80（跌下去说明有人把手写加回来了）

---

## 七、出问题时怎么排查（症状 → 去哪）

| 症状 | 先看 |
|---|---|
| 某卡"每有 N 支部队"算多了 / 算上了别国 | 该卡 `run`/`cond` 里是否直接写 `pieces_on`；对照第四节表 |
| 建设类卡"该格明明空了却说被占" / "能重复建" | `build_candidate_spaces`（槽位判定） |
| 分步战斗卡"目标格选不了" / "能打自己人" | `step_space_candidates`（纯敌方判定） |
| 状态卡点不出来（战斗窗口） | `status_window_ready` |
| 计分/美国技能"某战略点归属算错" | `home_base_of`（21 处调用都过它） |
| 日志里出现 `【警告】棋子查询缺少归属条件` | 有代码调了 `list_pieces` 但没给 `nation/nations/faction/enemyOf` → **这就是 bug 现场**，按警告条数定位调用点 |

> 最后一行是这套原语最实用的地方：**归属漏写不再静默数错，而是直接写日志**。

---

## 八、回归结果（2026-10-23 实测）

| 项 | 结果 |
|---|---|
| `node --check rules.js` | OK |
| 等价性验证（4028 项） | ALL EQUIV |
| `_smoke_count_contract.js` | 33 项 ALL PASS |
| `_smoke_count_baseline.js` | 5 项 ALL PASS |
| 模块全量 smoke（47 个） | 失败 19 个，与迁移前对比 **新增失败 0 个** |
| 迁移前 vs 后失败名单 | before=20 → after=19（唯一变化：`_smoke_count_baseline.js` 在旧代码上本来该 FAIL，迁移后转绿） |
| lint | 0 条 |

---

## 九、还剩什么

- 17 处筛选类 → 已迁 12、保留 5（第五节），**没有遗留**
- 若要继续收口，可考虑给原语加 `allOf` 模式（支持 `every` 语义），把 4919 那处也吃掉——收益低，暂不做
- `de_is_controlled` 是死代码（0 调用方），本次只做了等价改写，未删除；要清理可单独一轮连同调用方一起确认
