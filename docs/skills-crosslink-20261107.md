# Skill 互链：实现类 / 测试类加「入口与互补」（2026-11-07）

> 目的：1/2/3（实现三层）与 17/18（测试两段）职责**不重复**（实测卡 id Jaccard 0.03~0.09、标题交集 0），
> 但此前三者**没有写清"先看哪个"**，容易只加载一层。本次在每个 skill 的 H1 之后插入一段
> 「## 〇、入口与互补（先看这里）」，纯新增、不改原文。

## 1. 插入内容（摘要）

| skill | 定位 | 上游 → 下游 |
|---|---|---|
| `rtt-event-card-framework` | **判据层**：属哪一类、用哪些声明式字段 | 上游 `rtt-fix-workflow` → 下游 `rtt-effect-recipes`（抄哪张卡）、`rtt-atomic-operations`（用哪个原子） |
| `rtt-effect-recipes` | **配方索引**：效果 → 已有实现卡 → 代码位置 | 前置 `rtt-event-card-framework`；配合 `rtt-atomic-operations` |
| `rtt-atomic-operations` | **原子层**：建设/战斗/补给/计分等原语 | 前置 `rtt-event-card-framework`；找实例用 `rtt-effect-recipes` |
| `rtt-card-bug-repro` | **复现/定位**：忠实复现成 Node 脚本 | 完成后用 `rtt-realboard-test` 验收 |
| `rtt-realboard-test` | **验收/回归**：真盘面 + 三层断言 + 点击链 | 复现阶段先用 `rtt-card-bug-repro` |

关键句（写进每个文件）：

```
framework ：「本 skill 只判"属哪一类"，不给"抄哪张卡"」
recipes    ：「本表只给"抄谁"，不给"该不该属于这一类"」
atomic     ：「任何自己 for 循环遍历地区/部队再拼效果的写法都视为 bug」
repro      ：「本 skill 回答"是不是 bug、条件是什么"；realboard 回答"改完还对不对"」
realboard  ：「复现还没定性时，别直接写 20 项断言」
```

## 2. 校验

```
5 个文件：互链块各 1 处、H1 数量未变（realboard 原有的 4 个 H1 是历史遗留，本次未动）
体积增量：+233~321 字符/个（仅新增段落，正文原样）
frontmatter：未改动（描述保持 2026-11-07 瘦身后的版本）
```

## 3. 为什么没有合并 1/2/3 或 17/18

| 对比 | 卡 id 交集 | Jaccard | 标题交集 |
|---|---|---|---|
| event-card-framework ∩ effect-recipes | 3 | 0.03 | 0 |
| event-card-framework ∩ atomic-operations | 5 | 0.09 | 0 |
| effect-recipes ∩ atomic-operations | 2 | 0.04 | 0 |
| card-bug-repro ∩ realboard-test | 1 | 0.03 | 0 |

→ 是"三层/两段"分工，不是重复内容。合并只会得到 40 KB 巨文件（正是 `event-card-framework` 现在的问题）。

## 4. 下一步（未做）

1. **拆分 `rtt-event-card-framework`**（42.7 KB → SKILL.md ~10 KB + `references/paradigms.md`、`references/class-examples.md`）；
2. **拆分 `rtt-realboard-test`**（32.7 KB → SKILL.md ~8 KB + `references/{paradigms,midgame-limits,acceptance}.md`）；
3. 拆分时各跑一次"标题不丢 + 字节守恒"校验。

## 5. 脚本

```
tools/_add_skill_crosslinks.js    插入互链块（幂等：已存在则跳过）
tools/_fix_crosslink_pos.js       修正插入位置（H1 之后；首版误插在 H1 之前）
tools/_analyze_skill_overlap.js   重叠度量化（卡 id Jaccard / 标题交集）
```
