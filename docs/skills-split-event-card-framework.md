# 拆分 `rtt-event-card-framework`（42.5 KB → 8.4 KB + 4 份 references）

> 日期：2026-11-07　动机：一次加载 42.5 KB 太大（11 节全塞进上下文），而实际一次只需 1~2 节
> 原则：**正文逐字搬移**，只在 references 顶部加 2 行「来源」注；SKILL.md 留判据 + 索引
> 备份：`tmp/skill-split/event-card-framework.before.md`（可整体还原）

## 1. 拆分结果

| 去向 | 内容 | 体积 |
|---|---|---|
| **SKILL.md** | 前言、〇入口与互补、一总原则、二六类分类判据、三配置字段速查、四改动清单、六常用命令 + **细则索引** | **8.4 KB** |
| `references/paradigms.md` | 五之三 ⚠ 分步原子范式（15226 式）—— 战斗/建设一律走它 | 7.9 KB |
| `references/effect-carriers.md` | 五之四 增强卡（EFFECT）三种载体 | 21.3 KB |
| `references/national-skill.md` | 五之二 国家技能（每国一个，德国已实现） | 3.0 KB |
| `references/pitfalls.md` | 五 踩坑清单（本框架相关） | 3.0 KB |

合计 8.4 + 35.2 = 43.6 KB（原 42.5 KB，差额 = 4 份「来源」注 + 索引表）

## 2. SKILL.md 末尾新增的索引（按需读）

```markdown
## 细则索引（按需读，别一次全读）
| 文件 | 覆盖章节 | 体积 |
|---|---|---|
| references/paradigms.md        | 五之三 ⚠ 分步原子范式（15226 式）—— 战斗/建设一律走它 | 7.9 KB |
| references/effect-carriers.md  | 五之四 增强卡（EFFECT）也按这套 —— 三种载体 | 21.3 KB |
| references/national-skill.md   | 五之二 国家技能（每国一个，德国已实现） | 3.0 KB |
| references/pitfalls.md         | 五 踩坑清单（本框架相关） | 3.0 KB |
```

## 3. 校验（`tools/_verify_split.js`）

```
原正文 42.5 KB ／ 现 SKILL.md 8.4 KB + references 4 份
原章节 10 个 ／ 现（含 references）11 个（+1 = 新增的"细则索引"）
✓ 章节一个不少        ✓ 无重复章节
字节：43,492 → 44,459（差额 = 来源注 + 索引表）
frontmatter：逐行比对【完全一致】（name / description 未变）
```

## 4. 加载成本对比

| 场景 | 拆分前 | 拆分后 |
|---|---|---|
| 只想判"这卡属哪一类" | 42.5 KB | **8.4 KB**（−80%） |
| 要写增强卡的三种载体 | 42.5 KB | 8.4 + 21.3 = 29.7 KB |
| 要分步原子范式 | 42.5 KB | 8.4 + 7.9 = 16.3 KB |
| 要国家技能写法 | 42.5 KB | 8.4 + 3.0 = 11.4 KB |

## 5. 还原

```powershell
Copy-Item tmp/skill-split/event-card-framework.before.md `
  "$env:USERPROFILE\.codebuddy\skills\rtt-event-card-framework\SKILL.md" -Force
Remove-Item "$env:USERPROFILE\.codebuddy\skills\rtt-event-card-framework\references" -Recurse -Force
```

## 6. 工具

```
tools/_split_skill_helper.js   list <skill>  列章节+体积（决定怎么分组）
                               apply <skill> <plan.json>  按标题前缀剪出到 references（逐字）
tools/_verify_split.js         <skill> <before.md>  校验"章节不丢不重 + frontmatter 未变"
```

## 7. 未做

- `rtt-realboard-test`（32.7 KB / 29 节）同样可拆成
  `SKILL.md + references/{paradigms,midgame-limits,acceptance}.md`，待确认后再做。
