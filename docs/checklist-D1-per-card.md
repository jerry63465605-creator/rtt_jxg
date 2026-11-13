# D1 前奏逐卡验收清单（只读语义审计，2026-11-12）

> 由 `node tools/_audit_prelude_semantics.js` 生成，**只读**，不改产品代码。
> 覆盖率 100% 只保证「卡面文字被识别」，不保证语义正确；本清单按可复核规则列出可疑项供实机验收。
> 行号会漂移，定位一律用符号名 grep；接线点索引见各 `docs/change-D1-*.md`。

## 一、审计摘要

| 项 | 数 |
|---|---|
| 官方前奏/军备卡 | 125 |
| 高优先级可疑卡 | 16 |
| 中优先级可疑卡 | 1 |
| 无命中（仍需实机抽检） | 108 |

| 规则 | 级别 | 命中 | 说明 | 改哪里 |
|---|---|---|---|---|
| R1 | 高 | 1 | 卡面类型筛选词与「打出」op 语义错位 | `prelude_compiler.js 段后处理（P5 收口）/ PRELUDE_OP_WINDOW` |
| R2 | 高 | 0 | 检视 op 缺合法 source | `PRELUDE_TOKENS.peek_deck / peek_deck_misc + validate` |
| R3 | 高 | 0 | 检视后续 op 缺 peek_scope / source | `prelude_compiler.js 段后处理（source/peek_scope 传播）` |
| R4 | 中 | 1 | 卡面类型筛选词未落到选牌 op.filter | `prelude_compiler.js 段后处理 / PRELUDE_FILTER_TYPE` |
| R5 | 高 | 10 | 段内含递归打牌 op（可能覆盖段窗口） | `rules.js:prelude_resolve_card / prelude_do_action` |
| R6 | 中 | 0 | op 既无 case 也无分步窗口（静默丢弃） | `rules.js:prelude_run_op / PRELUDE_OP_WINDOW` |
| R7 | 高 | 3 | trigger.on 不在 PRELUDE_ON_MAP（军备卡不会触发） | `rules.js:PRELUDE_ON_MAP / prelude_trigger_on_of` |
| R8 | 中 | 1 | 卡面关键词与产物不一致 | `PRELUDE_TOKENS / parse_text / coverage` |
| R9 | 高 | 0 | carrier 与 deck/type 不匹配 | `prelude_compiler.js:infer_carrier` |
| R10 | 中 | 0 | op 缺必要参数（space / refs） | `PRELUDE_TOKENS[].emit / prelude_run_op` |
| R11 | 高 | 3 | 段分类或代价异常 | `prelude_compiler.js:group_segments / compile / validate` |
| R12 | 高 | 0 | 编译层自身报 errors / warnings | `prelude_compiler.js:compile` |

接线集合（从 `rules.js` 源码自动提取）：`prelude_run_op` case 18 类、`PRELUDE_OP_WINDOW` 8 类、`PRELUDE_ON_MAP` 18 个 on、`PRELUDE_FILTER_TYPE` 6 类。

`PRELUDE_OP_DEFERRED` 仍有 10 条 P3 历史残留登记（P4 已把其中 op 全部接线，本审计不把它当作「已接线」依据）。

## 二、高优先级逐卡验收（建议先测这些）

- [ ] `18300` 军情五处（英国 / PRELUDE·PRELUDE / carrier=event）
  - 卡面：`检视前奏牌堆顶3张牌，以任意顺序置于前奏牌堆顶或前奏牌堆底。[失去2分] 打出前奏牌堆顶的牌。`
  - 段：seg0:mandatory/1op，seg1:optional/1op
  - **R5（高）** 段内含 play_prelude_top（递归 prelude_resolve_card） → `rules.js:prelude_resolve_card / prelude_do_action`
  - 验收要点：对照卡面逐段走一遍，记录「期望 / 实际 / 日志」
- [ ] `18306` 战争迫近（英国 / PRELUDE·PRELUDE / carrier=event）
  - 卡面：`[紧张度+1] 打出1张前奏手牌。[失去2分] 打出前奏牌堆顶的牌。`
  - 段：seg0:mandatory/1op，seg1:optional/1op
  - **R5（高）** 段内含 play_prelude（递归 prelude_resolve_card） → `rules.js:prelude_resolve_card / prelude_do_action`
  - **R5（高）** 段内含 play_prelude_top（递归 prelude_resolve_card） → `rules.js:prelude_resolve_card / prelude_do_action`
  - 验收要点：对照卡面逐段走一遍，记录「期望 / 实际 / 日志」
- [ ] `14900` 德奥合并（德国 / PRELUDE·PRELUDE / carrier=event）
  - 卡面：`[紧张度+1] 打出1张前奏手牌 或 前奏牌堆顶的牌。[弃置1张手牌] 检视牌堆，选择并将1张[战略卡]置入手牌。`
  - 段：seg0:mandatory/1op，seg1:optional/1op
  - **R5（高）** 段内含 play_prelude（递归 prelude_resolve_card） → `rules.js:prelude_resolve_card / prelude_do_action`
  - 验收要点：对照卡面逐段走一遍，记录「期望 / 实际 / 日志」
- [ ] `14902` 建设高速公路（德国 / PRELUDE·PRELUDE / carrier=event）
  - 卡面：`将1张[高速公路]洗入正式牌堆。[失去2分] 打出1张前奏手牌。`
  - 段：seg0:mandatory/1op，seg1:optional/1op
  - **R5（高）** 段内含 play_prelude（递归 prelude_resolve_card） → `rules.js:prelude_resolve_card / prelude_do_action`
  - 验收要点：对照卡面逐段走一遍，记录「期望 / 实际 / 日志」
- [ ] `14903` 进军莱茵兰（德国 / PRELUDE·PRELUDE / carrier=event）
  - 卡面：`[紧张度+2] 检视前奏牌堆，选择并打出1张[军备卡]。[除非英国弃置2张手牌] 打出1张前奏手牌。`
  - 段：seg0:mandatory/2op，seg1:opponentOptOut/1op
  - **R5（高）** 段内含 play_prelude（递归 prelude_resolve_card） → `rules.js:prelude_resolve_card / prelude_do_action`
  - 验收要点：对照卡面逐段走一遍，记录「期望 / 实际 / 日志」
- [ ] `14905` 四年计划（德国 / PRELUDE·PRELUDE / carrier=event）
  - 卡面：`将1张[枪支与黄油]洗入正式牌堆。[紧张度+1] 打出1张前奏手牌。`
  - 段：seg0:mandatory/1op，seg1:mandatory/1op
  - **R5（高）** 段内含 play_prelude（递归 prelude_resolve_card） → `rules.js:prelude_resolve_card / prelude_do_action`
  - 验收要点：对照卡面逐段走一遍，记录「期望 / 实际 / 日志」
- [ ] `18406` 仆从国军（日本 / PRELUDE·PRELUDE / carrier=event）
  - 卡面：`[若<中国>有日本陆军] 紧张度-1。增加1支陆军后备。[否则弃置1张手牌] 增加1支陆军后备。`
  - 段：seg0:mandatory/1op，seg1:opponentOptOut/1op
  - **R11（高）** seg1 opponentOptOut 无 opponent（卡面未指定国家；可能是合理缺省，需实机确认答复方） → `prelude_compiler.js:group_segments / compile / validate`
  - 验收要点：对照卡面逐段走一遍，记录「期望 / 实际 / 日志」
- [ ] `18407` 日苏中立条约（日本 / PRELUDE·PRELUDE / carrier=status）
  - 卡面：`[紧张度-1][持续] 若日本未对苏联发起战斗，苏联对日本发起战斗后：其失去4分。[除非弃置1张手牌] 从苏联前奏牌堆打出[苏日中立条约]。`
  - 段：seg0:mandatory/1op，seg1:opponentOptOut/0op
  - **R11（高）** seg1 opponentOptOut 无 opponent（卡面未指定国家；可能是合理缺省，需实机确认答复方） → `prelude_compiler.js:group_segments / compile / validate`
  - 验收要点：对照卡面逐段走一遍，记录「期望 / 实际 / 日志」
- [ ] `18002` 反法西斯人民阵线（苏联 / PRELUDE·PRELUDE / carrier=event）
  - 卡面：`[紧张度+1] 选择 损耗1张前奏牌 或 跳过。打出前奏牌堆顶的牌。获得2分。`
  - 段：seg0:mandatory/3op
  - **R5（高）** 段内含 play_prelude_top（递归 prelude_resolve_card） → `rules.js:prelude_resolve_card / prelude_do_action`
  - 验收要点：对照卡面逐段走一遍，记录「期望 / 实际 / 日志」
- [ ] `18006` 苏日中立条约（苏联 / PRELUDE·PRELUDE / carrier=status）
  - 卡面：`[紧张度-1][持续] 若苏联未对日本发起战斗，日本对苏联发起战斗后：其失去4分。[除非弃置1张手牌] 从日本前奏牌堆打出[日苏中立条约]。`
  - 段：seg0:mandatory/1op，seg1:opponentOptOut/0op
  - **R11（高）** seg1 opponentOptOut 无 opponent（卡面未指定国家；可能是合理缺省，需实机确认答复方） → `prelude_compiler.js:group_segments / compile / validate`
  - 验收要点：对照卡面逐段走一遍，记录「期望 / 实际 / 日志」
- [ ] `18015` 反间谍总局（苏联 / ARMAMENT·ARMAMENT / carrier=response）
  - 卡面：`任一国家的回合开始时：选择1张德国或意大利[军备卡]或[响应卡]，将其暗牌弃置。`
  - 段：seg0:mandatory/0op
  - **R7（高）** on「turn_start」无 PRELUDE_ON_MAP 映射 → `rules.js:PRELUDE_ON_MAP / prelude_trigger_on_of`
  - 验收要点：对照卡面逐段走一遍，记录「期望 / 实际 / 日志」
- [ ] `18016` 米格设计局（苏联 / ARMAMENT·ARMAMENT / carrier=response）
  - 卡面：`空军阶段开始时：部署或调度1支空军。发起1次夺取制空权。`
  - 段：seg0:mandatory/2op
  - **R7（高）** on「airforce」无 PRELUDE_ON_MAP 映射 → `rules.js:PRELUDE_ON_MAP / prelude_trigger_on_of`
  - 验收要点：对照卡面逐段走一遍，记录「期望 / 实际 / 日志」
- [ ] `17200` 蒂泽德使团（美国 / PRELUDE·PRELUDE / carrier=event）
  - 卡面：`打出1张前奏手牌。[英国弃置1张手牌] 打出前奏牌堆顶的牌。`
  - 段：seg0:mandatory/1op，seg1:opponentOptOut/1op
  - **R5（高）** 段内含 play_prelude（递归 prelude_resolve_card） → `rules.js:prelude_resolve_card / prelude_do_action`
  - **R5（高）** 段内含 play_prelude_top（递归 prelude_resolve_card） → `rules.js:prelude_resolve_card / prelude_do_action`
  - 验收要点：对照卡面逐段走一遍，记录「期望 / 实际 / 日志」
- [ ] `17204` 振兴公共事业（美国 / PRELUDE·PRELUDE / carrier=status）
  - 卡面：`[持续][大萧条]检视牌堆前10张牌，选择并打出1张[状态卡]。打出[事件卡]后，可弃置[大萧条]和手牌共3张：打出1张[状态卡]。`
  - 段：seg0:mandatory/2op，seg1:mandatory/1op
  - **R1（高）** filters=状态卡 但 op=play_prelude（疑似应打出正式牌，却按前奏牌结算） → `prelude_compiler.js 段后处理（P5 收口）/ PRELUDE_OP_WINDOW`
  - **R4（中）** filters=状态卡 但选牌 op 均无 filter → `prelude_compiler.js 段后处理 / PRELUDE_FILTER_TYPE`
  - **R5（高）** 段内含 play_prelude（递归 prelude_resolve_card） → `rules.js:prelude_resolve_card / prelude_do_action`
  - 验收要点：对照卡面逐段走一遍，记录「期望 / 实际 / 日志」
- [ ] `17206` 炉边谈话（美国 / PRELUDE·PRELUDE / carrier=event）
  - 卡面：`打出1张[大萧条]。获得1分。[弃置1张手牌] 检视前奏牌堆，选择并打出1张[大萧条]。`
  - 段：seg0:mandatory/1op，seg1:mandatory/1op，seg2:optional/2op，seg3:mandatory/0op
  - **R5（高）** 段内含 play_prelude（递归 prelude_resolve_card） → `rules.js:prelude_resolve_card / prelude_do_action`
  - 验收要点：对照卡面逐段走一遍，记录「期望 / 实际 / 日志」
- [ ] `17214` 生产令（美国 / ARMAMENT·ARMAMENT / carrier=response）
  - 卡面：`摸牌阶段开始时：增加1支空军后备。部署1支空军。`
  - 段：seg0:mandatory/2op
  - **R7（高）** on「draw」无 PRELUDE_ON_MAP 映射 → `rules.js:PRELUDE_ON_MAP / prelude_trigger_on_of`
  - 验收要点：对照卡面逐段走一遍，记录「期望 / 实际 / 日志」

## 三、中优先级逐卡验收

- [ ] `11309` 西班牙政变 — R8:卡面含「打出」但无对应 op

## 四、全量逐卡索引（按主 op 分组，供打勾）

### `(无 op)`（5 张）

- [ ] `18311` 军情六处（英国）
- [ ] `18317` 哈肯贝格堡（英国）
- [ ] `18319` 总参二局（英国）
- [ ] `14919` 西墙（德国）
- [ ] `18015` 反间谍总局（苏联） ⚠ R7

### `add_marker`（1 张）

- [ ] `17205` 整顿经济（美国）

### `add_marker,recruit`（4 张）

- [ ] `14901` 瓜分捷克斯洛伐克（德国）
- [ ] `18410` 伪满洲国（日本）
- [ ] `11300` 入侵阿尔巴尼亚（意大利）
- [ ] `11310` 维也纳仲裁（意大利）

### `add_marker,recruit,supply_point`（1 张）

- [ ] `18011` 长征（苏联）

### `add_reserve`（1 张）

- [ ] `18406` 仆从国军（日本） ⚠ R11

### `add_reserve,deploy_air`（1 张）

- [ ] `17214` 生产令（美国） ⚠ R7

### `always_supplied,recruit`（2 张）

- [ ] `18308` 法国殖民地基地（英国）
- [ ] `18400` 九一八事变（日本）

### `attrition_deck`（2 张）

- [ ] `18012` 自由德国全国委员会（苏联）
- [ ] `11316` 伊拉克独立运动（意大利）

### `attrition_deck,attrition_prelude`（1 张）

- [ ] `17210` 武汉会战（美国）

### `attrition_deck,gain_score`（4 张）

- [ ] `14915` 轰炸纽约（德国）
- [ ] `14916` 佩内明德研发中心（德国）
- [ ] `14920` 铀工程（德国）
- [ ] `18415` 空袭达尔文港（日本）

### `attrition_deck,gain_score,play_prelude_top`（1 张）

- [ ] `18002` 反法西斯人民阵线（苏联） ⚠ R5

### `attrition_prelude`（8 张）

- [ ] `14906` 秃鹰军团（德国）
- [ ] `18401` 非暴力不合作运动（日本）
- [ ] `18408` 天津事变（日本）
- [ ] `18008` 西班牙志愿军（苏联）
- [ ] `11304` 空军军团（意大利）
- [ ] `11307` 西班牙志愿军（意大利）
- [ ] `17208` 南京保卫战（美国）
- [ ] `17209` 淞沪会战（美国）

### `attrition_prelude,end_neutrality,gain_score`（1 张）

- [ ] `17201` 隔离演说（美国）

### `attrition_prelude,gain_score`（1 张）

- [ ] `11302` 反共产国际协定（意大利）

### `attrition_prelude,lose_score`（1 张）

- [ ] `18305` 意大利煤炭禁运（英国）

### `battle`（7 张）

- [ ] `14909` 88mm 防空炮（德国）
- [ ] `14910` 俾斯麦级战列舰（德国）
- [ ] `14912` 滑翔机突击（德国）
- [ ] `14922` 古德里安（德国）
- [ ] `18417` 帝国海军航空队（日本）
- [ ] `18418` 联合舰队（日本）
- [ ] `17215` 国民革命军（美国）

### `battle,build`（1 张）

- [ ] `14924` 曼施坦因（德国）

### `battle,deploy_air`（1 张）

- [ ] `18016` 米格设计局（苏联） ⚠ R7

### `battle,recruit`（1 张）

- [ ] `14923` 隆美尔（德国）

### `build`（16 张）

- [ ] `18312` Z舰队（英国）
- [ ] `18313` 光辉号航空母舰（英国）
- [ ] `14904` 撕毁海军协定（德国）
- [ ] `14911` 合成橡胶（德国）
- [ ] `14921` 装甲掷弹兵（德国）
- [ ] `18414` 赤城号航空母舰（日本）
- [ ] `18007` 五年计划（苏联）
- [ ] `18017` 图拉兵工厂（苏联）
- [ ] `18018` 拖拉机厂（苏联）
- [ ] `18019` 乌拉尔工业区（苏联）
- [ ] `11311` 维托里奥·维内托（意大利）
- [ ] `11314` 黑衫军（意大利）
- [ ] `11317` 皇家殖民地部队（意大利）
- [ ] `17202` 两洋海军法案（美国）
- [ ] `17213` 企业号航空母舰（美国）
- [ ] `17217` 自由轮（美国）

### `build,eliminate`（3 张）

- [ ] `14913` 继续战争（德国）
- [ ] `18013` T-34坦克（苏联）
- [ ] `18014` 大纵深作战（苏联）

### `build,recruit`（1 张）

- [ ] `18009` 远东方面军（苏联）

### `deploy_air,eliminate`（1 张）

- [ ] `14914` 弗莱雅-维尔茨堡（德国）

### `deploy_air,gain_score`（3 张）

- [ ] `18315` 英联邦空军训练计划（英国）
- [ ] `14908` 作战指挥条令（德国）
- [ ] `18403` 帝国陆军航空队（日本）

### `deploy_air,recruit`（1 张）

- [ ] `18303` 妇女志愿服务团（英国）

### `discard,draw_cards`（1 张）

- [ ] `18411` 血盟团事件（日本）

### `discard,draw_cards,gain_score,play_response`（1 张）

- [ ] `18404` 黑龙会（日本）

### `discard,recruit`（1 张）

- [ ] `18316` 英镑区（英国）

### `draw_cards,execute_action_phase`（1 张）

- [ ] `18301` 不信任动议案（英国）

### `draw_cards,peek_and_play,peek_reorder`（1 张）

- [ ] `17207` 民间资源保护（美国）

### `eliminate`（6 张）

- [ ] `18310` 唯有荣誉（英国）
- [ ] `18314` 我们决不投降（英国）
- [ ] `18318` 越南独立同盟会（英国）
- [ ] `11312` 布雷舰（意大利）
- [ ] `11315` 罗马尼亚军团国（意大利）
- [ ] `17216` 花园口决堤（美国）

### `eliminate,recruit`（1 张）

- [ ] `18405` 卢沟桥事变（日本）

### `gain_score`（8 张）

- [ ] `18304` 一代人的和平（英国）
- [ ] `18409` 天羽声明（日本）
- [ ] `18413` 阿留申前进基地（日本）
- [ ] `18419` 莫尔兹比港前进基地（日本）
- [ ] `18420` 珍珠港前进基地（日本）
- [ ] `11305` 罗马梦（意大利）
- [ ] `11306` 美国优先（意大利）
- [ ] `17203` 美国中立法案（美国）

### `gain_score,peek_and_play,peek_reorder,play_prelude`（1 张）

- [ ] `17206` 炉边谈话（美国） ⚠ R5

### `gain_score,peek_reorder`（1 张）

- [ ] `11309` 西班牙政变（意大利） ⚠ R8

### `join_hand`（1 张）

- [ ] `18010` 征兵令（苏联）

### `join_hand,peek_and_play,peek_reorder`（1 张）

- [ ] `14907` 威廉皇帝学会（德国）

### `join_hand,peek_reorder,play_response`（1 张）

- [ ] `18412` 近卫文麿上台组阁（日本）

### `lose_score`（3 张）

- [ ] `18407` 日苏中立条约（日本） ⚠ R11
- [ ] `18005` 苏德互不侵犯条约（苏联）
- [ ] `18006` 苏日中立条约（苏联） ⚠ R11

### `peek_and_play,peek_reorder,play_prelude`（2 张）

- [ ] `14903` 进军莱茵兰（德国） ⚠ R5
- [ ] `17204` 振兴公共事业（美国） ⚠ R1/R4/R5

### `peek_and_play,peek_reorder,play_response`（1 张）

- [ ] `18004` 一国建成社会主义（苏联）

### `peek_reorder`（1 张）

- [ ] `14918` 替代物资（德国）

### `peek_reorder,play_prelude`（1 张）

- [ ] `14900` 德奥合并（德国） ⚠ R5

### `peek_reorder,play_prelude_top`（1 张）

- [ ] `18300` 军情五处（英国） ⚠ R5

### `play_prelude,play_prelude_top`（2 张）

- [ ] `18306` 战争迫近（英国） ⚠ R5
- [ ] `17200` 蒂泽德使团（美国） ⚠ R5

### `play_prelude,shuffle_into_deck`（2 张）

- [ ] `14902` 建设高速公路（德国） ⚠ R5
- [ ] `14905` 四年计划（德国） ⚠ R5

### `play_response`（1 张）

- [ ] `18416` 国家总动员法（日本）

### `recruit`（17 张）

- [ ] `18302` 斯卡帕湾打捞（英国）
- [ ] `18307` 殖民帝国（英国）
- [ ] `18309` 波兰动员（英国）
- [ ] `14917` 斯洛伐克军事化（德国）
- [ ] `18402` 撕毁海军条约（日本）
- [ ] `18421` 增援太平洋诸岛（日本）
- [ ] `18000` 吞并比萨拉比亚（苏联）
- [ ] `18001` 吞并波罗的海国家（苏联）
- [ ] `18003` 斯大林防线（苏联）
- [ ] `18020` 佐尔格特工（苏联）
- [ ] `18021` 敌后根据地（苏联）
- [ ] `11301` 入侵埃塞俄比亚（意大利）
- [ ] `11303` 十二群岛基地（意大利）
- [ ] `11308` 罗马协定（意大利）
- [ ] `11313` 第四海岸（意大利）
- [ ] `17211` 北卡罗来纳级（美国）
- [ ] `17212` 菲律宾侦察兵（美国）

## 五、已知挂起项（不在本清单里重复）

- `14900` 的 A 段 `play_prelude` 连锁打出第二张手牌时，两次 `prelude_resolve_card` 都写 `p.pending`，**前一个段窗口被覆盖丢失**（见 `docs/change-D1-P11-play-flow-b.md` §4）。
- 含战斗的多步 `defer` 军备卡续打（58 张实测全单段，当前无卡触发）。
- EVENT/ECON 正式牌留场语义、`order` 跨牌堆排序（无现有卡需求）。

## 六、验收后怎么修（归类批量，别逐卡打补丁）

1. 记录三件事：卡 id + 期望行为 + 实际行为（日志/截图）。
2. 按接线点归类：编译层规则 / op 参数 / 执行器映射 / 窗口 kind / `view` 字段 / UI —— 一类问题改一处配置或函数，一次覆盖同组所有卡。
3. 每类落一条编号真实测试 + 分层回归，**不**按卡 id 写 `if-else`、**不**改 `cards.js` 卡面。
4. 一轮只修一类；改完重跑本审计脚本，命中数应下降。

## 七、配套编号测试（分层回归基线）

```
node tools/_test_prelude_compiler.js
node tools/_test_prelude_diy.js
node tools/_real_test_P2_prelude_engine.js
node tools/_real_test_P3_prelude_ops.js
node tools/_real_test_P4_op_windows.js
node tools/_real_test_P5_armament_response_stack.js
node tools/_real_test_P6_semantics.js
node tools/_real_test_P7_inspect_chain.js
node tools/_real_test_P8_formal_play.js
node tools/_test_prelude_hand_zone.js
node tools/_real_test_P11_play_flow.js
node tools/_real_test_P12_visibility.js
node tools/_run_smoke_report.js   # 4 个基线未登记失败 = 零新增
```
