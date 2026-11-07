# SUPP 逐国真实盘面测试 · 德国（6 张）

> 日期：2026-11-07　脚本：`tools/_real_test_supp_de.js`（18 项，全绿）
> 方法：`rtt-realboard-test` 路线 B（`debug_*` 布阵 + 真实 action + 服务端/view/日志三层断言 + 残留检查）
> 结论：**德国 6 张 SUPP 全部工作正常**，未发现功能性 bug。

## 1. 覆盖清单

| 卡 | 类型 | 结果 |
|---|---|---|
| 6600 伊朗加入轴心国 | EVENT | ✅ |
| 6601 大德意志帝国 | STATUS | ✅ |
| 14500 黄色方案 | EFFECT | ✅ |
| 14501 攻陷阿斯特拉罕 | ECON | ✅ |
| 14502 但泽或战争 | EVENT | ✅ |
| 14503 提尔比茨号 | EVENT（让权） | ✅ |

## 2. 逐卡验证与实测证据

### 6600《伊朗加入轴心国》（EVENT，二选一地区 + 标记）

```
布阵：德国陆军在<中东>；苏联陆军在<乌克兰>/<中亚>
驱动：play_card{card, spaces:[null, <乌克兰>]}   ← 多步卡要预选地区
日志：【德国】打出《伊朗加入轴心国》—— 在 中东 各增加 1 个计分标记；在 乌克兰 消灭 1 支敌方陆军
      【苏联】陆军 从 乌克兰 移除
断言：苏联陆军 3→2 ✓　<中东>标记 0→1 ✓　无 pending_event_step 残留 ✓
```

### 6601《大德意志帝国》（STATUS，标记 + 计分）

```
布阵：先 debug_remove 掉<西欧>开局的法国陆军，再在 西欧/德国/东欧 放德国陆军并 grant_supply
驱动：play_card{card}
日志：【德国】打出状态卡《大德意志帝国》—— 德国 增加 1 个计分标记
断言：<德国>标记 2→3 ✓
计分：debug_set_phase(scoring) → pending_scoring{德国:7} → next_phase 落账
      与"同盘面不放该卡"的基线对照：7 vs 5 → **+2**（标记 1 分 + 自动 1 分）✓
```

> 注意两条口径（写测试时容易踩）：
> ① `phase_scoring` **只暂存** `pending_scoring`，真正加分在 `scoring→discard` 边界（要 `next_phase`）；
> ② 标记本身在计分阶段也值 1 分，所以"标记+自动"合计 +2，不是 +1。

### 14500《黄色方案》（EFFECT，损耗 2 + 对<西欧>发起陆战）

```
驱动：play_card{card}（它没有 armed 配置，不是机会卡 → 出牌阶段直接打出）
日志：【德国】《黄色方案》已建立战斗预算：可进行 1 次对敌陆战…
      event_battle{target:<西欧>} → 【德国】在 西欧 进行陆战，移除敌方陆军（法国）
断言：牌库 -2 ✓；陆战成立（本次<西欧>是法国陆军且无空军 → 当场结算；有空军则停在 defend）✓
```

### 14501《攻陷阿斯特拉罕》（ECON）

```
布阵：德国陆军同时在<乌克兰>与<中亚>
驱动：play_card{card, target:'苏联'}
日志：【德国】打出《攻陷阿斯特拉罕》—— 乌克兰、中亚均被德国控制，苏联 损耗 4 张牌，德国获得 2 分
断言：苏联牌库 -4 ✓　axis 分数 +2 ✓
```

### 14502《但泽或战争》（EVENT，两步）

```
驱动：play_card{card} → 第 1/2 步；event_step_next{} → 第 2 步
日志：在 东欧 征召 1 支陆军（下一步：建设 1 支海军）→ 【德国】在 东欧 建设 1 支陆军
断言：东欧陆军 0→1 ✓　波罗的海海军 0→1 ✓（两步都必须点"下一步"）
```

### 14503《提尔比茨号》（EVENT，让权英国暗弃响应）

```
布阵：英国两张响应（15330/15334）经真实 play_card 暗置到桌面
日志：【德国】打出《提尔比茨号》 | 《提尔比茨号》：选择 1 张桌面上的英国响应暗牌弃置
断言：
  ① pending_script.kind = uk_facedown_discard ✓
  ② 候选只发给英国：query script_state(Allies) = ["15330#81","15334#82"]，Axis.pending_script = false ✓
  ③ 公共日志不含被弃卡名（暗牌语义）✓
  ④ 英国 resolve_script{pick:[id]} → 桌面暗置 2→1、让权结束 ✓
```

> 坑：候选**不在 `view.pending_script` 里**，而是走 `query 'script_state'`（客户端 `on_reply` 里赋给
> `script_state`，再由 `render_script_modal` 读 `candidates`）。只读 view 会误判为"候选人看不到"。

## 3. 测试手法沉淀（本轮踩到的 5 条）

| # | 坑 | 正确做法 |
|---|---|---|
| 1 | 事件卡多步只发 `play_card{card}` → 日志「需先选择目标地区」，什么都没发生 | `play_card{card, spaces:[null, <地区>]}` 预选；若仍停 `pending_event_step` 再 `event_step_next{}` |
| 2 | 计分断言在 `phase_scoring` 之后立刻读 `game.score` → 恒为 0 | 必须先 `next_phase`（边界落账），且与"无该卡"基线对照 |
| 3 | 标记分被漏算 | 标记在计分阶段本身计分（1 星=1 分），断言要算进去 |
| 4 | 把 `debug_place` 当"被友方控制" | 开局<西欧>等地区常有他国部队，`debug_place` 会**静默失败**；先 `debug_remove` 再放，并 `grant_supply` |
| 5 | 只读 `view.pending_script.candidates` 判"客户端点不到" | 脚本卡候选走 `query 'script_state'`；view 只有 stage/prompt 等元信息 |

## 4. 复跑

```bash
node tools/_real_test_supp_de.js      # 18 项，当前全绿
```

## 5. 下一步

按国家顺序继续：**日本**（8 张：7900-7905、8600、8601）→ 苏联（3）→ 意大利（4）→ 英国（4）→ 美国（12）。
