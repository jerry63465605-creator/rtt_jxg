# 计分标记：统一写法立项计划（阶段 1 起）

> 状态：**计划阶段 —— 本轮只写文档，不做代码级优化**
> 前置：口径与新数据结构已落地（阶段 0，见 `docs/marker-scoring-audit.md`）
> 目标：把当前 **6 条互不相通的通道**合并为**一套声明式配置 + 单一执行器**

---

## 一、为什么要统一

现状（阶段 0 之后仍然是）：

| # | 通道 | 归属怎么定 | 卡 |
|---|---|---|---|
| 1 | `steps: {op:'marker'}` | 通用分支 `add_marker(sp,n,null,null)` | 17829 / 6600 / 17728 |
| 2 | `ongoing.supply_point_and_markers` | `set_space_marker_owner(only)` + 通用 add | 15345 / 15347 / 15443 / 17554 / 17845 / 17742 |
| 3 | `ongoing.remove_supply_and_marker` | 减 + `set_space_marker_owner(only)` | 17840 / 17845 |
| 4 | `ongoing.marker_only` | 通用 add（可带 only） | 17901 |
| 5 | `ongoing.marker_if_controlled` | 通用 add（带前置条件） | 6601 |
| 6 | **卡代码直写** | 各自调用三个 API | 17854 / 17555 / 15233 / 17725 |

三条成本：

1. **新增一张卡要选通道** —— 选错就口径漂移（历史上 6601 把 `'德国','axis'` 硬编码进通用执行器，就是这个原因）；
2. **同一语义分散在 6 处** —— 改口径要改 6 遍，漏一处就是 bug；
3. **撤销无从下手** —— 没有统一的"这张卡改过什么"记录，`revert_status_ongoing` 至今不处理任何标记。

---

## 二、目标形态

### 2.1 统一配置

```js
markers: [
	{ space: '西伯利亚', delta: +1, only: '苏联' },   // 有 only -> 地点级专属
	{ space: '莫斯科',   delta: -1 },                  // 无 only -> 通用
	{ space: '<动态>',   delta: +1, from: 'ctx.space' } // 地区由上下文给（共青城）
]
```

字段语义：

| 字段 | 含义 |
|---|---|
| `space` / `from` | 目标地区（二选一：`from` 用于"建设地区"这类运行时决定） |
| `delta` | `+N` 加、`-N` 减 |
| `only` | 可选；给出则先 `set_space_marker_owner`（改现有 + 约束此后） |
| `require` | 可选；前置地区须全部被某国控制（6601） |
| `permanent` | 可选，默认 `true`；`false` 时卡离场由 revert 回滚（阶段 2） |

### 2.2 单一执行器

```js
function apply_marker_ops(game, ops, ctx) → lines[]
```

内部固定顺序（顺序即语义，不可颠倒）：

```
① only           -> set_space_marker_owner(sp, only)     // 先落地点的持久约束
② delta > 0      -> add_marker(sp, +n, null, null)       // 归属由 add_marker 继承地点
③ delta < 0      -> remove_marker(sp, -n, undefined, undefined)  // 不筛选（掠夺口径）
```

### 2.3 通道退化为"生成 ops"

各通道不再直接操作标记，只负责**翻译**成 ops 再交给执行器：

| 通道 | 翻译成 |
|---|---|
| `steps op:'marker'` | `[{ space, delta: +count }]` |
| `supply_point_and_markers` | `[{ space, delta: +markers, only }]` |
| `remove_supply_and_marker` | `[{ space, delta: -markers, only }]` |
| `marker_only` | `[{ space, delta: +markers, only }]` |
| `marker_if_controlled` | `[{ space, delta: +markers, require }]` |
| 卡代码直写 | 改为声明 ops（或标注 `@markers` 配置） |

---

## 三、逐卡迁移矩阵（阶段 1）

| 卡 | 现状通道 | 目标 ops | 行为是否变化 |
|---|---|---|---|
| 15345 塞内加尔步兵团 | ② | `[{space:'非洲南部', delta:+2, only:'法国'}]` | 否 |
| 15347 波兰主权 | ② | `[{space:'东欧', delta:+1, only:'英国'}]` | 否 |
| 15443 前进基地 | ② | `[{space:'马达加斯加', delta:+1, only:'日本'}]` | 否 |
| 17554 重庆国民政府 | ② | `[{space:'中国西部', delta:+1, only:'中国'}]` | 否 |
| 17845 迁都古比雪夫 | ② + ③ | `[{space:'西伯利亚', delta:+1, only:'苏联'}, {space:'莫斯科', delta:-1}]` | 否 |
| 17742 拉丁世界 | ②（无 markers） | `[]`（只做补给点） | 否 |
| 17840 焦土作战 | ③ | `[{space:'乌克兰', delta:-1, only:'苏联'}]` | 否 |
| 17901 工业心脏 | ④ | `[{space:'罗斯', delta:+1}]` | 否 |
| 6601 大德意志帝国 | ⑤ | `[{space:'德国', delta:+1, require:['西欧','德国','东欧']}]` | 否 |
| 17854 共青城 | ⑥ | `[{from:'ctx.space', delta:+1}]` | 否 |
| 17555 大萧条的余波 | ⑥×2 | `[{space:'美国', delta:+1}]` | 否 |
| 17829 毛泽东 | ① | `[{space:<选中>, delta:+1}]` | 否 |
| 6600 伊朗加入轴心国 | ① | `[{space:'中东', delta:+1}]` | 否 |
| 17728 意属东非 | ① | `[{space:'非洲东部', delta:+1}]` | 否 |
| 15233 / 17725 掠夺 | ⑥ | `[{space:<每地>, delta:-1}]` | 否 |

**阶段 1 的核心约束：逐条行为不变**（纯重构），用"迁移前后标记快照对比"验证。

---

## 四、阶段划分

| 阶段 | 内容 | 状态 |
|---|---|---|
| **阶段 0** | 口径确立 + 地点级 `game.marker_only` + `set_space_marker_owner` + B 组去 owner | ✅ **已完成**（2026-10-25，回归 `_smoke_marker_ownership.js` 14/14） |
| **阶段 1** | 统一配置 + 单一执行器 `apply_marker_ops`；6 通道退化为"翻译"；**行为等价** | ⏸ **待做（代码级）** |
| **阶段 2** | `permanent:false` 支持：执行器记录改动，`revert_status_ongoing` 按记录回滚 | ⏸ **待做（代码级）** |
| **阶段 3** | 静态兜底：禁止卡代码直写三个 API（脚本扫描 `add_marker(` / `set_marker_owner(`） | ⏸ **待做（代码级）** |
| **阶段 4** | D 组 PRELUDE 5 张（11300/11310/14901/17205/18410）—— 需先实现 PRELUDE 机制本身 | ⏸ **待做，玩家已决定本轮跳过** |

### 阶段 1 内部顺序（建议小步提交）

1. 加 `apply_marker_ops` + 迁移通道 ④（17901，最孤立）
2. 迁移通道 ⑤（6601）
3. 迁移通道 ②（A 组 5 张，两处执行器）
4. 迁移通道 ③（17840 / 17845）
5. 迁移通道 ①（`op:'marker'` 通用分支）
6. 迁移通道 ⑥（17854 / 17555 / 掠夺两张）

---

## 五、风险与对策

| 风险 | 对策 |
|---|---|
| 重构改坏计分（最严重） | 每一步都跑"标记快照对比"：迁移前后对同一批卡打出流程 dump `game.markers` + `score_breakdown`，逐字节比对 |
| 顺序语义（only 必须在 add 之前）被后继者改坏 | 执行器内固定顺序 + 注释写明"顺序即语义" |
| 动态地区（共青城 `ctx.space`）翻译出错 | 用 `from:'ctx.space'` 显式表达，禁止在执行器里猜 |
| 老对局缺字段 | `ensure_marker_only` 已在 `do_action` 入口兜底（阶段 0 已加） |
| 阶段 2 的回滚误删别人的标记 | 回滚只删"自己加的"，按执行器记录的 owner+数量精确匹配 |

---

## 六、验收清单

**阶段 1**

- [ ] `apply_marker_ops` 覆盖 +/−/only/require/from 五种入参
- [ ] 15 张卡的标记结果与迁移前**完全一致**（快照对比）
- [ ] `_smoke_marker_ownership.js` 仍 14/14
- [ ] 全量 `_run_smoke_report.js` 失败断言不得多于 15 项
- [ ] 代码中 `add_marker(` / `remove_marker(` / `set_marker_owner(` 的直写点降为 0（仅执行器内）

**阶段 2**

- [ ] `permanent:false` 的卡离场后标记被精确回滚
- [ ] A 组（`permanent:true`）离场后标记**保持**

**阶段 3**

- [ ] 扫描脚本纳入回归：卡配置块内出现三个 API 即失败

---

## 七、明确声明

> **本文档只交付计划，代码级优化（阶段 1/2/3）本轮未做。**
>
> 阶段 0 的口径改造已完成并回归通过；阶段 1 起需要在"行为等价"前提下逐通道迁移，
> 建议单独一次提交 + 一次完整回归，不要与当天其它修复混在一起。
