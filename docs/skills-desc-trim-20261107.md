# Skill 描述瘦身（2026-11-07）

> 范围：只改 `SKILL.md` 的 frontmatter `description`，**正文一字未动**（已逐文件与备份比对，18/18 正文一致）
> 备份：`tmp/skills-backup-20261107/<skill>/SKILL.md`（可整体还原）
> 效果：描述常驻从 **9,725 → 1,688 字符**（省 8,037，**−83%**）；`>300 字` 的条目 **18 → 0**

## 1. 逐条对照

| skill | 改前 | 改后 |
|---|---|---|
| web-form-datepicker | 844 | 94 |
| web-form-dropdown | 705 | 70 |
| chinahr-form-filler | 630 | 44 |
| rtt-fix-workflow | 613 | 63 |
| rtt-event-card-framework | 600 | 50 |
| comp5703-week6-progress-2026-09 | 592 | 73 |
| rtt-response-stack | 553 | 77 |
| rtt-release-packaging | 547 | 60 |
| comp5703-api-ecosystem-context | 464 | 70 |
| rtt-pending-suspend | 459 | 71 |
| rtt-handoff-authority | 456 | 51 |
| rtt-atomic-operations | 439 | 68 |
| comp5703-week-sprint-2026-09 | 435 | 59 |
| rtt-avoid-hardcode | 395 | 50 |
| rtt-client-server-contract | 387 | 63 |
| rtt-docs-to-skill | 377 | 60 |
| rtt-pending-whitelist-deadlock | 364 | 59 |
| comp5703-week7-plan-2026-09 | 329 | 70 |

写法统一为：**第一句 = 什么时候用**（触发词前置），后接必要的边界/包含项，全部 ≤150 字。

## 2. 新描述全文（可直接粘贴）

```yaml
web-form-datepicker: 日期/年月选择器填不动时用（Element-UI .el-date-editor、AntD .ant-calendar-picker）：点了没反应、面板停在年视图、单元格点不动、无法提交。
web-form-dropdown: AntD/Element 下拉、级联、日期面板"点了不生效/打开错的下拉/选了不回填"时用；含 agent-browser 驱动与提交校验。
chinahr-form-filler: 在中华英才网等中文招聘站自动填简历/申请表时用（含分段表单续填、JS 注入、字段定位）。
rtt-fix-workflow: RTT 军需官模块"从登记待办到提交推送"的标准修复流程：只读探针定性→给方案→最小改动→编号测试→分层回归→文档→单条提交。
rtt-event-card-framework: 实现/排查 RTT 卡牌效果时先查此表：事件/增强/触发卡的声明式字段、六类分类判据、分步原子范式。
rtt-response-stack: RTT 响应栈机制：request_responses 压栈、栈顶两阶段判定、trigger/pass/resolve、响应让权与 deferred 帧。
rtt-release-packaging: RTT 出包/上线时用：普通版与 full 版口径、排除清单、版本串 bump、ZipFile 打包、体积自检与已知坑。
rtt-pending-suspend: RTT 挂起（pending/让权/委派）机制：build_actions 守卫、active 翻转还原、跨 action 状态落盘、让权链。
rtt-handoff-authority: RTT 让权/委托（让另一国执行建设、征召、出牌、弃牌、结算）时用：两级主体模型与同/跨阵营两种范式。
rtt-atomic-operations: 实现/修任何卡牌效果或规则前查此表：rules.js 经 _internal 导出的建设/战斗/补给/计分原子与用法，禁止自己重写遍历。
rtt-avoid-hardcode: 新增国家技能/卡效果/阶段钩子/UI 文案，或怀疑某处硬编码了国家名、阶段名、卡 id、地区名时用。
rtt-client-server-contract: 排查"点了没反应/看得见点不中/高亮但无效/客户端与服务端判定不一致"时用：action 白名单、query 只读、判定同源。
rtt-docs-to-skill: 要把项目文档沉淀成 Skill，或判断某知识该进 skill/docs/memory 哪一处时用：写法规范与五步提炼法。
rtt-pending-whitelist-deadlock: 排查"点了没反应/某张牌打不出/清挂起要先清挂起"时用；也用于任何访问 RTT 服务器 URL 前的端口与主机名判据。
comp5703-api-ecosystem-context: 做 COMP5703 CS-9 项目时用：Supabase 数据、business_apis 表、报告写作约定、PowerShell 踩坑。
comp5703-week-sprint-2026-09: 查 COMP5703 2026-09-07 周冲刺分工、Auth/User 任务范围、分支与 commit 约定时用。
comp5703-week6-progress-2026-09: 查 COMP5703 第 6 周（2026-09-12~13）会议结论与个人进度（BP Builder 产 YAML、认证/repo 状态）时用。
comp5703-week7-plan-2026-09: 查 COMP5703 第 7 周（2026-09-15 起）分工（BPBuilder 字段级校验、API Publisher）与里程碑时用。
```

## 3. 校验

```
描述合计        9,725 → 1,688 字符
描述 >300 字    18 → 0
正文合计        304.4 KB（未变）
正文逐文件比对   18/18 完全一致（只动了 frontmatter）
```

复跑：`node tools/_audit_skills.js`（重算并重生成 `docs/skills-audit.md`）

## 4. 还原方式

```powershell
# 整体还原 18 个描述
Copy-Item tmp/skills-backup-20261107/* "$env:USERPROFILE\.codebuddy\skills\" -Recurse -Force
```

## 5. 后续（未做）

- 合并 `rtt-pending-*` 4 → 1、`web-form-*`+`chinahr` 3 → 1（需人工确认合并后的正文组织）
- `comp5703-*` 4 个迁到项目级（换项目不污染）
