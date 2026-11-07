# Skill 库审计（只读）

> 生成：`node tools/_audit_skills.js`　日期：2026-11-07
> 口径：**描述** = 常驻上下文的成本；**正文** = 调用 `use_skill` 才进上下文的一次性成本

## 一、总览

```
本仓库相关 skill 数 = 32（用户级 30 / 项目级 2）
描述合计 = 1688 字符（≈ 675~1407 tokens，【每轮常驻】）
正文合计 = 304.4 KB（按需加载，加载后本会话常驻）
```

> 说明：系统提示里显示「38 of 42」，缺的 4 条是**内置 skill**（非本仓库的 32 个），
> 本仓库的 32 个描述全部可见，没有被截断。

## 二、按描述长度排序（常驻成本）

| # | skill | 归属 | 描述字数 | 正文 | 附件 | 域 | 标注 |
|---|---|---|---|---|---|---|---|
| 1 | `rtt-discard` | 用户级 | 292 | 8.1 KB/89 行 | 0 个/0 KB | rtt（军需官模块） |  |
| 2 | `rtt-server-ops` | 用户级 | 226 | 6.4 KB/113 行 | 0 个/0 KB | rtt（军需官模块） |  |
| 3 | `web-form-datepicker` | 用户级 | 94 | 8.9 KB/159 行 | 2 个/19.9 KB | web 表单填写 |  |
| 4 | `rtt-response-stack` | 项目级 | 77 | 18.2 KB/150 行 | 0 个/0 KB | rtt（军需官模块） | 正文大（慎加载） |
| 5 | `comp5703-week6-progress-2026-09` | 用户级 | 73 | 1.7 KB/32 行 | 1 个/2 KB | COMP5703 课程 |  |
| 6 | `rtt-pending-suspend` | 用户级 | 71 | 9.1 KB/127 行 | 4 个/9.6 KB | rtt（军需官模块） |  |
| 7 | `comp5703-api-ecosystem-context` | 用户级 | 70 | 4 KB/75 行 | 3 个/9.1 KB | COMP5703 课程 |  |
| 8 | `comp5703-week7-plan-2026-09` | 用户级 | 70 | 3.3 KB/62 行 | 0 个/0 KB | COMP5703 课程 |  |
| 9 | `web-form-dropdown` | 用户级 | 70 | 6.3 KB/112 行 | 5 个/33.1 KB | web 表单填写 |  |
| 10 | `rtt-atomic-operations` | 用户级 | 68 | 20 KB/347 行 | 0 个/0 KB | rtt（军需官模块） | 正文大（慎加载） |
| 11 | `rtt-client-server-contract` | 用户级 | 63 | 10 KB/181 行 | 0 个/0 KB | rtt（军需官模块） |  |
| 12 | `rtt-fix-workflow` | 用户级 | 63 | 7.6 KB/167 行 | 0 个/0 KB | rtt（军需官模块） |  |
| 13 | `rtt-docs-to-skill` | 用户级 | 60 | 6.9 KB/134 行 | 0 个/0 KB | rtt（军需官模块） |  |
| 14 | `rtt-release-packaging` | 用户级 | 60 | 9.1 KB/189 行 | 1 个/3.6 KB | rtt（军需官模块） |  |
| 15 | `comp5703-week-sprint-2026-09` | 用户级 | 59 | 6.5 KB/84 行 | 2 个/6.8 KB | COMP5703 课程 |  |
| 16 | `rtt-pending-whitelist-deadlock` | 用户级 | 59 | 6.4 KB/133 行 | 0 个/0 KB | rtt（军需官模块） |  |
| 17 | `rtt-handoff-authority` | 项目级 | 51 | 6.6 KB/64 行 | 1 个/6.3 KB | rtt（军需官模块） |  |
| 18 | `rtt-avoid-hardcode` | 用户级 | 50 | 9 KB/169 行 | 0 个/0 KB | rtt（军需官模块） |  |
| 19 | `rtt-event-card-framework` | 用户级 | 50 | 41.9 KB/609 行 | 0 个/0 KB | rtt（军需官模块） | 正文大（慎加载） |
| 20 | `chinahr-form-filler` | 用户级 | 44 | 7.7 KB/120 行 | 8 个/47.9 KB | web 表单填写 |  |
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
| `chinahr-form-filler` | 44 | 7.7 KB | 招聘网站表单填写（与 RTT 无关，低频） |
| `comp5703-api-ecosystem-context` | 70 | 4 KB | 课程作业上下文（一次性，与代码库无关） |
| `comp5703-week-sprint-2026-09` | 59 | 6.5 KB | 课程作业上下文（一次性，与代码库无关） |
| `comp5703-week6-progress-2026-09` | 73 | 1.7 KB | 课程作业上下文（一次性，与代码库无关） |
| `comp5703-week7-plan-2026-09` | 70 | 3.3 KB | 课程作业上下文（一次性，与代码库无关） |
| `web-form-datepicker` | 94 | 8.9 KB | 招聘网站表单填写（与 RTT 无关，低频） |
| `web-form-dropdown` | 70 | 6.3 KB | 招聘网站表单填写（与 RTT 无关，低频） |

## 六、建议动作（按性价比）

| # | 动作 | 影响 | 预估收益 |
|---|---|---|---|
| 1 | 重写 >300 字的描述（只改 frontmatter，不动正文） | 0 个 | 常驻可降 ~40% |
| 2 | 合并 `rtt-pending-*`（4 个）为 1 个「挂起/让权总纲」 | 4 → 1 | 条目 -3，撞车减少 |
| 3 | 合并 `web-form-*` + `chinahr` 为 1 个「中文招聘表单」 | 3 → 1 | 条目 -2 |
| 4 | `comp5703-*`（4 个）迁到项目级或归档 | 用户级 -4 | 换项目不再污染 |
| 5 | 大正文（>20 KB）在描述里明写「只在 X 场景加载」 | 3 个 | 避免误加载 43 KB |

## 七、明细（每条描述首句）

### `rtt-discard`（用户级，描述 292 字）

- 描述首句：RTT 模块 quartermaster-sub-wars 的【弃牌(discard) 与 损耗(attrition) 术语铁律 + 标准实现范式】手册
- 正文：8.1 KB / 89 行；附件 0 个（0 KB）

### `rtt-server-ops`（用户级，描述 226 字）

- 描述首句：操作 RTT（rally-the-troops）本地服务器的运维技能，覆盖军需官·次要战场（quartermaster-sub-wars）模块的对局服务器 server.js 与卡牌预览静态服务器 p
- 正文：6.4 KB / 113 行；附件 0 个（0 KB）

### `web-form-datepicker`（用户级，描述 94 字）

- 描述首句：日期/年月选择器填不动时用（Element-UI .el-date-editor、AntD .ant-calendar-picker）：点了没反应、面板停在年视图、单元格点不动、无法提交
- 正文：8.9 KB / 159 行；附件 2 个（19.9 KB）

### `rtt-response-stack`（项目级，描述 77 字）

- 描述首句：RTT 响应栈机制：request_responses 压栈、栈顶两阶段判定、trigger/pass/resolve、响应让权与 deferred 帧
- 正文：18.2 KB / 150 行；附件 0 个（0 KB）

### `comp5703-week6-progress-2026-09`（用户级，描述 73 字）

- 描述首句：查 COMP5703 第 6 周（2026-09-12~13）会议结论与个人进度（BP Builder 产 YAML、认证/repo 状态）时用
- 正文：1.7 KB / 32 行；附件 1 个（2 KB）

### `rtt-pending-suspend`（用户级，描述 71 字）

- 描述首句：RTT 挂起（pending/让权/委派）机制：build_actions 守卫、active 翻转还原、跨 action 状态落盘、让权链
- 正文：9.1 KB / 127 行；附件 4 个（9.6 KB）

### `comp5703-api-ecosystem-context`（用户级，描述 70 字）

- 描述首句：做 COMP5703 CS-9 项目时用：Supabase 数据、business_apis 表、报告写作约定、PowerShell 踩坑
- 正文：4 KB / 75 行；附件 3 个（9.1 KB）

### `comp5703-week7-plan-2026-09`（用户级，描述 70 字）

- 描述首句：查 COMP5703 第 7 周（2026-09-15 起）分工（BPBuilder 字段级校验、API Publisher）与里程碑时用
- 正文：3.3 KB / 62 行；附件 0 个（0 KB）

### `web-form-dropdown`（用户级，描述 70 字）

- 描述首句：AntD/Element 下拉、级联、日期面板"点了不生效/打开错的下拉/选了不回填"时用
- 正文：6.3 KB / 112 行；附件 5 个（33.1 KB）

### `rtt-atomic-operations`（用户级，描述 68 字）

- 描述首句：实现/修任何卡牌效果或规则前查此表：rules.js 经 _internal 导出的建设/战斗/补给/计分原子与用法，禁止自己重写遍历
- 正文：20 KB / 347 行；附件 0 个（0 KB）

### `rtt-client-server-contract`（用户级，描述 63 字）

- 描述首句：排查"点了没反应/看得见点不中/高亮但无效/客户端与服务端判定不一致"时用：action 白名单、query 只读、判定同源
- 正文：10 KB / 181 行；附件 0 个（0 KB）

### `rtt-fix-workflow`（用户级，描述 63 字）

- 描述首句：RTT 军需官模块"从登记待办到提交推送"的标准修复流程：只读探针定性→给方案→最小改动→编号测试→分层回归→文档→单条提交
- 正文：7.6 KB / 167 行；附件 0 个（0 KB）

### `rtt-docs-to-skill`（用户级，描述 60 字）

- 描述首句：要把项目文档沉淀成 Skill，或判断某知识该进 skill/docs/memory 哪一处时用：写法规范与五步提炼法
- 正文：6.9 KB / 134 行；附件 0 个（0 KB）

### `rtt-release-packaging`（用户级，描述 60 字）

- 描述首句：RTT 出包/上线时用：普通版与 full 版口径、排除清单、版本串 bump、ZipFile 打包、体积自检与已知坑
- 正文：9.1 KB / 189 行；附件 1 个（3.6 KB）

### `comp5703-week-sprint-2026-09`（用户级，描述 59 字）

- 描述首句：查 COMP5703 2026-09-07 周冲刺分工、Auth/User 任务范围、分支与 commit 约定时用
- 正文：6.5 KB / 84 行；附件 2 个（6.8 KB）

### `rtt-pending-whitelist-deadlock`（用户级，描述 59 字）

- 描述首句：排查"点了没反应/某张牌打不出/清挂起要先清挂起"时用
- 正文：6.4 KB / 133 行；附件 0 个（0 KB）

### `rtt-handoff-authority`（项目级，描述 51 字）

- 描述首句：RTT 让权/委托（让另一国执行建设、征召、出牌、弃牌、结算）时用：两级主体模型与同/跨阵营两种范式
- 正文：6.6 KB / 64 行；附件 1 个（6.3 KB）

### `rtt-avoid-hardcode`（用户级，描述 50 字）

- 描述首句：新增国家技能/卡效果/阶段钩子/UI 文案，或怀疑某处硬编码了国家名、阶段名、卡 id、地区名时用
- 正文：9 KB / 169 行；附件 0 个（0 KB）

### `rtt-event-card-framework`（用户级，描述 50 字）

- 描述首句：实现/排查 RTT 卡牌效果时先查此表：事件/增强/触发卡的声明式字段、六类分类判据、分步原子范式
- 正文：41.9 KB / 609 行；附件 0 个（0 KB）

### `chinahr-form-filler`（用户级，描述 44 字）

- 描述首句：在中华英才网等中文招聘站自动填简历/申请表时用（含分段表单续填、JS 注入、字段定位）
- 正文：7.7 KB / 120 行；附件 8 个（47.9 KB）

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
