# T1 审计：`piece_removed` 系列（只读）

生成脚本：`tools/_audit_piece_removed.js`　生成日期：2026-11-05

## 0. 三条移除路径的派发覆盖

| 路径 | 派发 `piece_removed` | 说明 |
|---|---|---|
| 陆军 | ✅ | `do_battle` victim 分支 / `eliminate_piece` |
| 海军 | ✅ | 与陆军同一 victim 分支 |
| 空军 | ✅ | 2026-11-05 **B10** 新增 `remove_air_with_piece_removed()` |

## 1. 增强卡（armed.when 含 piece_removed）

| 卡号 | 卡名 | 归属 | watch | 代价 | 判据（ready / filter 摘要） |
|---|---|---|---|---|---|
| 15311 | 马奇诺防线 | 法国 | ✅ | 弃4 | filter(game, ctx) { return ctx.piece_nation === '法国' && ctx.piece_type === 'army' && data.name_of(ctx.space) === '西欧' } |
| 15351 | 敦刻尔克大撤退 | 英国 | ✅ | 弃2 | ready(game, ctx) { const nat = ctx && ctx.piece_nation const typ = ctx && ctx.piece_type const sp = ctx && ctx.space if (nat && nat !== '英国' && nat != |
| 17711 | 维希法国殖民地 | 意大利 | ✅ | — | ready(game, ctx) { return vichy_hit(game, ctx) } |
| 17808 | 莫斯科战役 | 苏联 | ✅ | 弃1 | ready(game, ctx) { /* 必须：被移除的是苏联陆军 + 场上已无苏联陆军 + 有可消灭目标 */ if (!ctx // ctx.piece_nation !== '苏联' // ctx.piece_type !== 'army') return false const hasSu |
| 17811 | 雅科夫列夫设计局 | 苏联 | ✅ | — | ready(game, ctx) { if (!ctx // ctx.piece_nation !== '苏联' // ctx.piece_type !== 'air') return false if (ctx.space == null) return false return su_air_d |

## 2. 状态卡（trigger.window = piece_removed）

| 卡号 | 卡名 | 归属 | 代价 | 判据摘要 |
|---|---|---|---|---|
| 17543 | 雷达 | 美国 | {"attrition":2} | （无 cond） |

## 3. 响应卡（RESPONSE_EFFECTS 中出现 piece_removed）

| 卡号 | 卡名 | 归属 |
|---|---|---|
| 15330 | 防御姿态 | 英国 |
| 15332 | 皇家空军 | 英国 |
| 15334 | 驱逐舰 | 英国 |
| 15337 | 生命的飞跃 | 英国 |
| 15420 | 本土决战 | 日本 |
| 15421 | 关东军 | 日本 |
| 15436 | 战舰修理 | 日本 |
| 17730 | 贝尔萨列里神射手团 | 意大利 |
| 17733 | 卡西诺山 | 意大利 |
| 17734 | 罗马尼亚增援 | 意大利 |
| 17735 | 山地特种兵 | 意大利 |
| 17831 | 撤退与整编 | 苏联 |
| 17832 | 列宁格勒保卫战 | 苏联 |
| 17833 | 莫斯科保卫战 | 苏联 |
| 17835 | 斯大林格勒保卫战 | 苏联 |
| 17836 | 无休止的扩张 | 苏联 |

## 4. 实测点（判据可满足性）

| 卡 | 场景 | ready |
|---|---|---|
| 17808 莫斯科战役 | 场上清空苏联陆军后，ctx=苏联陆军于<莫斯科>被移除 | ✅ true |
| 17811 雅科夫列夫设计局 | <莫斯科> 有补给中的苏联陆军、无空军；ctx=苏联空军被移除 | ✅ true |

## 5. 结论与待办

- `armed` 类 5 张**全部带 `watch`**（B10 已把 17808/17811 补齐），敌方回合掉单位也能开窗；
- 空军路径的派发由 B10 统一（代受成立 / 抵消成立 / 无处撤离 三条），不再漏窗；
- 未发现"国家/兵种/地区"判据与卡面矛盾的项（判据摘要见 §1，均按 `ctx.piece_nation / piece_type / space` 取值）；
- 仍需人工确认的只有语义边界（非缺陷）：
  1. 15351《敦刻尔克大撤退》要求"英国陆军在<敦刻尔克/西欧>且相邻有敌军"，只在特定局面开窗；
  2. 17711《维希法国殖民地》监听的是**法国**部队被移除（actor 为意大利，靠 watch 生效）；
  3. 17543《雷达》是**状态卡**（损耗 2 开窗），与增强卡不是同一通道。
