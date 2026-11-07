# Skill 库审计（只读）

> 生成：`node tools/_audit_skills.js`　日期：2026-11-07
> 口径：**描述** = 常驻上下文的成本；**正文** = 调用 `use_skill` 才进上下文的一次性成本

## 一、总览

```
本仓库相关 skill 数 = 32（用户级 30 / 项目级 2）
描述合计 = 9725 字符（≈ 3890~8104 tokens，【每轮常驻】）
正文合计 = 304.4 KB（按需加载，加载后本会话常驻）
```

> 说明：系统提示里显示「38 of 42」，缺的 4 条是**内置 skill**（非本仓库的 32 个），
> 本仓库的 32 个描述全部可见，没有被截断。

## 二、按描述长度排序（常驻成本）

| # | skill | 归属 | 描述字数 | 正文 | 附件 | 域 | 标注 |
|---|---|---|---|---|---|---|---|
| 1 | `web-form-datepicker` | 用户级 | 844 | 8.9 KB/159 行 | 2 个/19.9 KB | web 表单填写 | 描述过长，**建议重写** |
| 2 | `web-form-dropdown` | 用户级 | 705 | 6.3 KB/112 行 | 5 个/33.1 KB | web 表单填写 | 描述过长，**建议重写** |
| 3 | `chinahr-form-filler` | 用户级 | 630 | 7.7 KB/120 行 | 8 个/47.9 KB | web 表单填写 | 描述过长，**建议重写** |
| 4 | `rtt-fix-workflow` | 用户级 | 613 | 7.6 KB/167 行 | 0 个/0 KB | rtt（军需官模块） | 描述过长，**建议重写** |
| 5 | `rtt-event-card-framework` | 用户级 | 600 | 41.9 KB/609 行 | 0 个/0 KB | rtt（军需官模块） | 描述过长，**建议重写**，正文大（慎加载） |
| 6 | `comp5703-week6-progress-2026-09` | 用户级 | 592 | 1.7 KB/32 行 | 1 个/2 KB | COMP5703 课程 | 描述过长，**建议重写** |
| 7 | `rtt-response-stack` | 项目级 | 553 | 18.2 KB/150 行 | 0 个/0 KB | rtt（军需官模块） | 描述过长，**建议重写**，正文大（慎加载） |
| 8 | `rtt-release-packaging` | 用户级 | 547 | 9.1 KB/189 行 | 1 个/3.6 KB | rtt（军需官模块） | 描述过长，**建议重写** |
| 9 | `comp5703-api-ecosystem-context` | 用户级 | 464 | 4 KB/75 行 | 3 个/9.1 KB | COMP5703 课程 | 描述过长 |
| 10 | `rtt-pending-suspend` | 用户级 | 459 | 9.1 KB/127 行 | 4 个/9.6 KB | rtt（军需官模块） | 描述过长 |
| 11 | `rtt-handoff-authority` | 项目级 | 456 | 6.6 KB/64 行 | 1 个/6.3 KB | rtt（军需官模块） | 描述过长 |
| 12 | `rtt-atomic-operations` | 用户级 | 439 | 20 KB/347 行 | 0 个/0 KB | rtt（军需官模块） | 描述过长，正文大（慎加载） |
| 13 | `comp5703-week-sprint-2026-09` | 用户级 | 435 | 6.5 KB/84 行 | 2 个/6.8 KB | COMP5703 课程 | 描述过长 |
| 14 | `rtt-avoid-hardcode` | 用户级 | 395 | 9 KB/169 行 | 0 个/0 KB | rtt（军需官模块） | 描述过长 |
| 15 | `rtt-client-server-contract` | 用户级 | 387 | 10 KB/181 行 | 0 个/0 KB | rtt（军需官模块） | 描述过长 |
| 16 | `rtt-docs-to-skill` | 用户级 | 377 | 6.9 KB/134 行 | 0 个/0 KB | rtt（军需官模块） | 描述过长 |
| 17 | `rtt-pending-whitelist-deadlock` | 用户级 | 364 | 6.4 KB/133 行 | 0 个/0 KB | rtt（军需官模块） | 描述过长 |
| 18 | `comp5703-week7-plan-2026-09` | 用户级 | 329 | 3.3 KB/62 行 | 0 个/0 KB | COMP5703 课程 | 描述过长 |
| 19 | `rtt-discard` | 用户级 | 292 | 8.1 KB/89 行 | 0 个/0 KB | rtt（军需官模块） |  |
| 20 | `rtt-server-ops` | 用户级 | 226 | 6.4 KB/113 行 | 0 个/0 KB | rtt（军需官模块） |  |
| 21 | `rtt-card-bug-repro` | 用户级 | 2 | 8.9 KB/90 行 | 0 个/0 KB | rtt（军需官模块） |  |
| 22 | `rtt-card-id-face` | 用户级 | 2 | 3.4 KB/67 行 | 0 个/0 KB | rtt（军需官模块） |  |
| 23 | `rtt-delegate-flip` | 用户级 | 2 | 6.7 KB/104 行 | 0 个/0 KB | rtt（军需官模块） |  |
| 24 | `rtt-pending-clear-side` | 用户级 | 2 | 5.8 KB/66 行 | 0 个/0 KB | rtt（军需官模块） |  |
| 25 | `rtt-realboard-test` | 用户级 | 2 | 31.9 KB/448 行 | 0 个/0 KB | rtt（军需官模块） | 正文大（慎加载） |
| 26 | `rtt-starred-card-authority` | 用户级 | 2 | 2.9 KB/29 行 | 0 个/0 KB | rtt（军需官模块） |  |
| 27 | `rtt-effect-recipes` | 用户级 | 1 | 13.5 KB/140 行 | 0 个/0 KB | rtt（军需官模块） |  |
| 28 | `rtt-faction-case` | 用户级 | 1 | 6.9 KB/121 行 | 0 个/0 KB | rtt（军需官模块） |  |
| 29 | `rtt-national-skill-framework` | 用户级 | 1 | 7.9 KB/110 行 | 0 个/0 KB | rtt（军需官模块） |  |
| 30 | `rtt-places-and-params` | 用户级 | 1 | 5.4 KB/68 行 | 0 个/0 KB | rtt（军需官模块） |  |
| 31 | `rtt-play-quota-windows` | 用户级 | 1 | 8.7 KB/147 行 | 0 个/0 KB | rtt（军需官模块） |  |
| 32 | `rtt-turn-system` | 用户级 | 1 | 4.7 KB/69 行 | 0 个/0 KB | rtt（军需官模块） |  |

## 三、同域碎片（建议合并）

- **web 表单填写**（3 个）：`chinahr-form-filler`、`web-form-datepicker`、`web-form-dropdown`
- **COMP5703 课程**（4 个）：`comp5703-api-ecosystem-context`、`comp5703-week-sprint-2026-09`、`comp5703-week6-progress-2026-09`、`comp5703-week7-plan-2026-09`
- **rtt（军需官模块）**（25 个）：`rtt-atomic-operations`、`rtt-avoid-hardcode`、`rtt-card-bug-repro`、`rtt-card-id-face`、`rtt-client-server-contract`、`rtt-delegate-flip`、`rtt-discard`、`rtt-docs-to-skill`、`rtt-effect-recipes`、`rtt-event-card-framework`、`rtt-faction-case`、`rtt-fix-workflow`、`rtt-national-skill-framework`、`rtt-pending-clear-side`、`rtt-pending-suspend`、`rtt-pending-whitelist-deadlock`、`rtt-places-and-params`、`rtt-play-quota-windows`、`rtt-realboard-test`、`rtt-release-packaging`、`rtt-server-ops`、`rtt-starred-card-authority`、`rtt-turn-system`、`rtt-handoff-authority`、`rtt-response-stack`

## 四、正文体积 Top 8（一次加载即几万字符）

1. `rtt-event-card-framework` — 41.9 KB / 609 行
2. `rtt-realboard-test` — 31.9 KB / 448 行
3. `rtt-atomic-operations` — 20 KB / 347 行
4. `rtt-response-stack` — 18.2 KB / 150 行
5. `rtt-effect-recipes` — 13.5 KB / 140 行
6. `rtt-client-server-contract` — 10 KB / 181 行
7. `rtt-pending-suspend` — 9.1 KB / 127 行
8. `rtt-release-packaging` — 9.1 KB / 189 行

## 五、低频 / 一次性（可迁出用户级）

| skill | 描述字数 | 正文 | 理由 |
|---|---|---|---|
| `chinahr-form-filler` | 630 | 7.7 KB | 招聘网站表单填写（与 RTT 无关，低频） |
| `comp5703-api-ecosystem-context` | 464 | 4 KB | 课程作业上下文（一次性，与代码库无关） |
| `comp5703-week-sprint-2026-09` | 435 | 6.5 KB | 课程作业上下文（一次性，与代码库无关） |
| `comp5703-week6-progress-2026-09` | 592 | 1.7 KB | 课程作业上下文（一次性，与代码库无关） |
| `comp5703-week7-plan-2026-09` | 329 | 3.3 KB | 课程作业上下文（一次性，与代码库无关） |
| `web-form-datepicker` | 844 | 8.9 KB | 招聘网站表单填写（与 RTT 无关，低频） |
| `web-form-dropdown` | 705 | 6.3 KB | 招聘网站表单填写（与 RTT 无关，低频） |

## 六、建议动作（按性价比）

| # | 动作 | 影响 | 预估收益 |
|---|---|---|---|
| 1 | 重写 >300 字的描述（只改 frontmatter，不动正文） | 18 个 | 常驻可降 ~40% |
| 2 | 合并 `rtt-pending-*`（4 个）为 1 个「挂起/让权总纲」 | 4 → 1 | 条目 -3，撞车减少 |
| 3 | 合并 `web-form-*` + `chinahr` 为 1 个「中文招聘表单」 | 3 → 1 | 条目 -2 |
| 4 | `comp5703-*`（4 个）迁到项目级或归档 | 用户级 -4 | 换项目不再污染 |
| 5 | 大正文（>20 KB）在描述里明写「只在 X 场景加载」 | 3 个 | 避免误加载 43 KB |

## 七、明细（每条描述首句）

### `web-form-datepicker`（用户级，描述 844 字）

- 描述首句：Fill date / month / year pickers (Element-UI `.el-date-editor`, Ant Design `.ant-calendar-picker`) i
- 正文：8.9 KB / 159 行；附件 2 个（19.9 KB）

### `web-form-dropdown`（用户级，描述 705 字）

- 描述首句：Fill Ant Design / Element-UI dropdowns, cascaders and date pickers in Chinese recruiting-site resume
- 正文：6.3 KB / 112 行；附件 5 个（33.1 KB）

### `chinahr-form-filler`（用户级，描述 630 字）

- 描述首句：Fill job-application / resume forms on Chinese recruiting sites (中华英才网 applyjob.chinahr.com and simi
- 正文：7.7 KB / 120 行；附件 8 个（47.9 KB）

### `rtt-fix-workflow`（用户级，描述 613 字）

- 描述首句：RTT（rally-the-troops）quartermaster-sub-wars 模块「从登记待办到提交推送」的标准修复流程 SOP：逐条编号登记（B 编号）→ 只读探针定性 → 给方案待确认 
- 正文：7.6 KB / 167 行；附件 0 个（0 KB）

### `rtt-event-card-framework`（用户级，描述 600 字）

- 描述首句：RTT 模块 quartermaster-sub-wars「事件卡（EVENT/ECHO）/ 增强卡（EFFECT）/ armed 触发卡按实现方式分类并落地」的方法论与框架手册
- 正文：41.9 KB / 609 行；附件 0 个（0 KB）

### `comp5703-week6-progress-2026-09`（用户级，描述 592 字）

- 描述首句：COMP5703 CS-9 Week 6 (Sep 12-13, 2026) meeting outcomes and Jianrui Zhou's individual progress repor
- 正文：1.7 KB / 32 行；附件 1 个（2 KB）

### `rtt-response-stack`（项目级，描述 553 字）

- 描述首句：RTT quartermaster-sub-wars 模块【响应栈（response stack）】机制手册——涵盖 request_responses 压栈、栈顶帧两阶段判定（待发动 candida
- 正文：18.2 KB / 150 行；附件 0 个（0 KB）

### `rtt-release-packaging`（用户级，描述 547 字）

- 描述首句：RTT（rally-the-troops）quartermaster-sub-wars 模块出测试分发包与部署上线的 SOP，覆盖普通版 / full 版两个出包口径、排除清单（cards_tts 原
- 正文：9.1 KB / 189 行；附件 1 个（3.6 KB）

### `comp5703-api-ecosystem-context`（用户级，描述 464 字）

- 描述首句：COMP5703 Capstone CS-9「Business API Ecosystem」项目的环境事实与操作知识库，覆盖 Supabase 数据项目（项目 ref、组织、business_apis
- 正文：4 KB / 75 行；附件 3 个（9.1 KB）

### `rtt-pending-suspend`（用户级，描述 459 字）

- 描述首句：RTT 模块 quartermaster-sub-wars（server-official/public/quartermaster-sub-wars/）的「挂起（pending / 让权 / 委派）
- 正文：9.1 KB / 127 行；附件 4 个（9.6 KB）

### `rtt-handoff-authority`（项目级，描述 456 字）

- 描述首句：RTT quartermaster-sub-wars 模块【让权/挂起给另一国执行】的范式手册
- 正文：6.6 KB / 64 行；附件 1 个（6.3 KB）

### `rtt-atomic-operations`（用户级，描述 439 字）

- 描述首句：RTT 模块 quartermaster-sub-wars 的【原子操作与可复用函数手册】
- 正文：20 KB / 347 行；附件 0 个（0 KB）

### `comp5703-week-sprint-2026-09`（用户级，描述 435 字）

- 描述首句：COMP5703 CS-9 团队 2026-09-07~09-13 本周冲刺分工与验收知识库，含 8 人角色职责与验收标准、周健睿（用户）的 Auth/User 任务范围、本周最终验收链路（登录→列表
- 正文：6.5 KB / 84 行；附件 2 个（6.8 KB）

### `rtt-avoid-hardcode`（用户级，描述 395 字）

- 描述首句：RTT 模块 quartermaster-sub-wars 的【反硬编码清单】
- 正文：9 KB / 169 行；附件 0 个（0 KB）

### `rtt-client-server-contract`（用户级，描述 387 字）

- 描述首句：RTT 模块 quartermaster-sub-wars 的【客户端/服务端契约与同步改动清单】
- 正文：10 KB / 181 行；附件 0 个（0 KB）

### `rtt-docs-to-skill`（用户级，描述 377 字）

- 描述首句：【元技能】如何从项目文档中总结、提炼并创建 CodeBuddy Skill
- 正文：6.9 KB / 134 行；附件 0 个（0 KB）

### `rtt-pending-whitelist-deadlock`（用户级，描述 364 字）

- 描述首句：RTT 模块 quartermaster-sub-wars 的【挂起状态 × 动作白名单 死锁】排查与预防手册，含【服务器访问判据】（端口须现场判定不可凭记忆、IPv6-only 必须用 localh
- 正文：6.4 KB / 133 行；附件 0 个（0 KB）

### `comp5703-week7-plan-2026-09`（用户级，描述 329 字）

- 描述首句：COMP5703 CS-9 第 7 周（2026-09-15 起）8 人分工计划「BPBuilder 字段级校验与 API Publisher」的要点、依赖与风险
- 正文：3.3 KB / 62 行；附件 0 个（0 KB）

### `rtt-discard`（用户级，描述 292 字）

- 描述首句：RTT 模块 quartermaster-sub-wars 的【弃牌(discard) 与 损耗(attrition) 术语铁律 + 标准实现范式】手册
- 正文：8.1 KB / 89 行；附件 0 个（0 KB）

### `rtt-server-ops`（用户级，描述 226 字）

- 描述首句：操作 RTT（rally-the-troops）本地服务器的运维技能，覆盖军需官·次要战场（quartermaster-sub-wars）模块的对局服务器 server.js 与卡牌预览静态服务器 p
- 正文：6.4 KB / 113 行；附件 0 个（0 KB）

### `rtt-card-bug-repro`（用户级，描述 2 字）

- 描述首句：>-
- 正文：8.9 KB / 90 行；附件 0 个（0 KB）

### `rtt-card-id-face`（用户级，描述 2 字）

- 描述首句：>-
- 正文：3.4 KB / 67 行；附件 0 个（0 KB）

### `rtt-delegate-flip`（用户级，描述 2 字）

- 描述首句：>-
- 正文：6.7 KB / 104 行；附件 0 个（0 KB）

### `rtt-pending-clear-side`（用户级，描述 2 字）

- 描述首句：>-
- 正文：5.8 KB / 66 行；附件 0 个（0 KB）

### `rtt-realboard-test`（用户级，描述 2 字）

- 描述首句：>-
- 正文：31.9 KB / 448 行；附件 0 个（0 KB）

### `rtt-starred-card-authority`（用户级，描述 2 字）

- 描述首句：>-
- 正文：2.9 KB / 29 行；附件 0 个（0 KB）

### `rtt-effect-recipes`（用户级，描述 1 字）

- 描述首句：>
- 正文：13.5 KB / 140 行；附件 0 个（0 KB）

### `rtt-faction-case`（用户级，描述 1 字）

- 描述首句：>
- 正文：6.9 KB / 121 行；附件 0 个（0 KB）

### `rtt-national-skill-framework`（用户级，描述 1 字）

- 描述首句：>
- 正文：7.9 KB / 110 行；附件 0 个（0 KB）

### `rtt-places-and-params`（用户级，描述 1 字）

- 描述首句：>
- 正文：5.4 KB / 68 行；附件 0 个（0 KB）

### `rtt-play-quota-windows`（用户级，描述 1 字）

- 描述首句：>
- 正文：8.7 KB / 147 行；附件 0 个（0 KB）

### `rtt-turn-system`（用户级，描述 1 字）

- 描述首句：>
- 正文：4.7 KB / 69 行；附件 0 个（0 KB）
