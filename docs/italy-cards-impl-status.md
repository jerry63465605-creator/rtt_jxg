# 意大利卡牌实现状态（italy-cards-impl-status）

> 本文件记录 RTT 模块 `quartermaster-sub-wars` 意大利卡牌的**实现状态与机制口径**，
> 与 `italy-cards-ocr-task.md`（OCR/识别口径）互补：OCR 文档管"卡面是什么"，
> 本文件管"代码已实现到什么程度、怎么实现的"。
> 新增/改动意大利卡实现后，在此追加或更新对应条目。

---

## 17711《维希法国殖民地》（已实现）

- **国家**：意大利（轴心）
- **类型**：EFFECT（armed 事件触发型，watch）
- **状态**：✅ 已实现并生效（2026-10-09 落地，2026-10-15 用户确认保持现状）
- **卡面效果**：敌方国家在 `<非洲北部><非洲南部><中东><马达加斯加><东南亚>`
  建设、征召或消灭，或【对上述地区发起陆战】后：其损耗 2 张牌。

### 实现位置（rules.js）
| 内容 | 位置 |
|---|---|
| `ECHO_EFFECTS['17711']` 配置（armed watch + 4 窗口 + `run` 调 `attrition_passive`） | `rules.js` ~9771 |
| `CARD_TRIGGERS['17711'] = { kind:'load', nation:'意大利' }`（打出即装载，等事件窗口） | `rules.js` ~12985 |
| `vichy_spaces()`：五地 `space_ids_of` 写死 | `rules.js` ~10942 |
| `vichy_hit(game, ctx)`：触发判定（行动方=敌方 且 事发地区∈五地） | `rules.js` ~10952 |
| 导出到 `_internal`（`vichy_spaces` / `vichy_hit`） | `rules.js` ~23996-23998 |

### 机制
- **四窗口监听**：`armed.when = ['after_build_army','after_recruit','piece_removed','after_battle']`
  （单卡监听多窗口，框架在 `offer_armed_effects` 内支持 `when` 数组，见 `rules.js` ~10368）。
- **必须 `watch:true`**：事件发起国（ctx.nation）是敌方，卡持有国是意大利；
  不声明 `watch` 会被"发起国==持有国"过滤掉而永不触发（框架在 `rules.js` ~10376 处理）。
- **"敌方"= 非轴心阵营**：`vichy_hit` 用 `faction_of_nation(actorNat) !== 'axis'` 判定（意大利属 axis）。
- **派发点**：`after_build_army` / `after_recruit` 为 2026-10-09 新增；`piece_removed`（~11724）、
  `after_battle`（~4149）为已有派发点。

### 当前行为（关键，用户 2026-10-15 确认保持）
敌方在五地触发上述任一动作后，`offer_armed_effects` 生成 `game.armed_offer`
（**触发型、非持久化**窗口）——客户端弹出"打出/跳过"框，**意大利点"打出"后**
`run` 立即对**行动方**（`ctx.nation` 或 `ctx.attacker`）执行
`attrition_passive(game, n, 2)`：**随机损耗 2 张（牌堆顶，无选择）**，卡结算后离手。
意大利**无进一步交互选择**——即"自动损耗"，窗口仅提供"是否发动"的确认。

### 2026-10-15 用户决定
用户曾考虑"在对应时点直接挂起给意大利操作"（改为交互式：选弃哪 2 张 / 选目标国 / 打断敌方动作），
**最终决定保持现状**：维持自动随机损耗 + 仅"打出/跳过"确认窗口。
如需改为交互式，须重做触发模型并明确"损耗≠弃置"语义变化，届时再议。

### 复用/测试提示
- `attrition_passive` 走 `game.decks[nation]`（复数，需 `init_nation_deck` 初始化），
  测试里手填牌库要填 `game.decks` 而非 `game.deck`（同 `rtt-event-card-framework` 的 17805 教训）。
- 验证窗口是否弹出用真实引擎路径：`I.offer_armed_effects` 经四窗口派发点触发后查 `game.armed_offer`。
