# 报告引用核查记录

> 核查时间：2026-09-08 ~ 09-10
> 适用：COMP5703 报告 Section 4 Methodologies 的内嵌引用

## Section 4 使用的 3 条引用

| 引用 | 位置 | 核查结论 | 可查看链接 |
|---|---|---|---|
| `(Schwaber & Sutherland, 2020)` | 4.1 Methods 首句末 | **真实** | https://scrumguides.org/scrum-guide.html |
| `(Serbout et al., 2022)` | 4.3 Compatibility analysis 段首句 | **真实** | https://eprints.cs.univie.ac.at/7461/ |
| `(Raza et al., 2026)` | 4.3 Semantic analysis 段末 | **无法核实，建议删除** | — |

## 1. Schwaber & Sutherland (2020) — 已确认

- 官方标题：The 2020 Scrum Guide™
- 作者：Ken Schwaber、Jeff Sutherland；版本日期 2020 年 11 月；CC BY-SA 4.0
- 链接：https://scrumguides.org/scrum-guide.html
- References 条目（APA）：
  > Schwaber, K., & Sutherland, J. (2020). *The 2020 Scrum Guide*. ScrumGuides. https://scrumguides.org/scrum-guide.html

## 2. Serbout et al. (2022) — 已确认

- 标题：How Composable is the Web? An Empirical Study on OpenAPI Data Model Compatibility
- 全名作者：Souhaila Serbout、Cesare Pautasso、Uwe Zdun
- 会议：2022 IEEE International Conference on Web Services (ICWS 2022)，Barcelona，2022-07-11~17，pp. 415–424，ISBN 978-1-6654-8143-4
- 论文原文确实表述"publicly available APIs are built independently of each other, developers often need to invest their efforts in message translation mappings"，与 4.3 论断直接对应
- 链接：
  - https://eprints.cs.univie.ac.at/7461/（免费 PDF）
  - https://www.semanticscholar.org/paper/2740682fdaecbcc6b35fe2c038b6df5f99d28ab5
  - https://design.inf.unisi.ch/publications/2022/icws
  - DOI 需在 IEEE Xplore 页面确认（**不要凭空编造 DOI**）
- References 条目（APA）：
  > Serbout, S., Pautasso, C., & Zdun, U. (2022). How composable is the Web? An empirical study on OpenAPI data model compatibility. In *2022 IEEE International Conference on Web Services (ICWS)* (pp. 415–424). IEEE. https://eprints.cs.univie.ac.at/7461/

## 3. Raza et al. (2026) — 无法核实

多次检索未找到任何可验证的 "Raza et al., 2026" 文献能支撑 4.3 语义分析段说法。建议：

- 从 4.3 Semantic 段删除 `(Raza et al., 2026)`，句子改为 `…results are ranked and remain advisory.`
- References 中不收录该条
- 除非用户提供确切论文出处（标题/作者/DOI）

## References 排序规则（尚未获得用户 References 列表）

- 若按**正文首次出现顺序**（numbered）：Schwaber（4.1）→ Serbout（4.3 Compatibility）→ Raza（4.3 Semantic，紧随其后）
- 若按**APA 字母序**：Raza（R）排在所有 S 条目之前；Schwaber 在 Serbout 之前（第 2 字母 c < e）
- 精确定位需用户粘贴当前 8. References 列表

## 待处理冲突（报告全文层面）

1. §6.1 称"包含 version and lifecycle status"——真实 24 列无 `version`，建议改为与实际列一致
2. References 缺失两处正文引用条目：`Buelthoff and Maleshkova (2019)`、`OpenAPI Initiative (n.d.)`
3. Abstract 的 "schema-based checks" 与 4.3 的 "schema + format" 措辞如需严格对齐，可改为 "schema- and format-based checks"
