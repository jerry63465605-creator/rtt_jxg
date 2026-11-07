---
name: comp5703-api-ecosystem-context
description: 做 COMP5703 CS-9 项目时用：Supabase 数据、business_apis 表、报告写作约定、PowerShell 踩坑。
---

# COMP5703 Business API Ecosystem — 项目上下文

## 目的

为 COMP5703-Tut17-G03 的「Business API Ecosystem」项目提供**已核实的环境事实与可复用操作知识**，避免每次对话重复查询 Supabase、重复确认表结构、重复踩 PowerShell 的坑。

## 何时使用

- 用户提到 COMP5703、CS-9、Business API Ecosystem、`business_apis` 表、Supabase 数据项目。
- 需要查看/导出 Supabase 数据，或确认项目 ref / 组织 / 表结构。
- 编辑项目报告，特别是 Section 4 Methodologies（4.1–4.5）与 References。
- 对比本地与 GitHub 仓库状态、管理分支。
- 在 Windows PowerShell 下调用外部 API（curl 别名、编码、输出捕获等踩坑）。

## 核心事实（已核实，2026-09-10）

### Supabase 环境

- **组织**：`bwwiddkkjadzhensdzav`（名称 `CLoud11y's Org`），dashboard：`https://supabase.com/dashboard/org/bwwiddkkjadzhensdzav`
- **项目 ref**：`imwptiicwdzjyawpysss`（名称 `CLoud11y's Project`）
- **区域 / 状态**：`ap-southeast-2` / `ACTIVE_HEALTHY`
- **数据库**：PostgreSQL 17.6.1.165，host `db.imwptiicwdzjyawpysss.supabase.co`
- **数据表**：`business_apis`（复数）
- **规模**：76 行，24 列
- **PAT（Management API）**：存放于工作区 `.local/supabase-token.md`（私有，勿提交）
- **注意**：README 中记录的 `uetlyejxqniqtuiesdzv` **不是**实际使用项目（其表 `business_api` 为单数且为空），勿混淆。

详细表结构与取数方法见 `references/supabase-data.md`。

### 报告写作约定

- 本地草稿：`docs/section4_draft.md`（Methodologies 4.1–4.5 最终稿）
- 字数约束：4.1/4.2/4.3/4.5 ≤ 200 词，4.4 ≤ 100 词
- 当前词数：4.1=181、4.2=176、4.3=196、4.4=92、4.5=152（合计 797）
- 引用格式：APA，正文 `(Author, Year)`，文末 8. References 按顺序列出
- 已核实的引用见 `references/citations.md`
- `docs/` 为本地私有目录，**不提交 git**

### Git 约定

- 仓库：`https://github.sydney.edu.au/COMP5703-Tut17-G03/1.git`（remote `origin`）
- 本地 `main` 已与 `origin/main` 同步（2026-09-10 快进更新至 `12127aa`）
- 以下 5 项**永不要** `git add`/`commit`/`push`：`.local/`、`.venv/`、`9900-w13c-Bread/`、`business_apis_full_export.csv`、`docs/`
- 用户未明确要求"提交/推送"时，只改不推

## 操作流程

### 读取 Supabase 数据

1. 从 `.local/supabase-token.md` 取 PAT。
2. `GET https://api.supabase.com/v1/projects/{ref}/api-keys` 取 `service_role` 密钥。
3. 用 PostgREST 读表：`https://{ref}.supabase.co/rest/v1/business_apis`，请求头带 `apikey` 与 `Authorization: Bearer <service_role>`。
4. 统计行数用 `Prefer: count=exact` + `Range` 头，读 `content-range` 响应头。

关键：**必须带浏览器 User-Agent**，否则 Cloudflare 返回 `403 error code: 1010`。

### 统计章节字数

编写临时 Python 脚本按 `## 4.x` 分节后 `len(body.split())`，脚本用完即删，勿留在工作区。

## Windows / PowerShell 踩坑

- `curl` 是 `Invoke-WebRequest` 的别名，`curl -s -o file` 会报 `SessionVariable` 参数错误 → 改用 Python `urllib.request`。
- 调用 `api.supabase.com` 不带 `User-Agent` 会被 Cloudflare 拦截（403 / error 1010）。
- `Get-Content` 不带 `-Encoding` 读取 UTF-8 可能被拦截（Craft 规则）→ 用 `read_file` 工具读取文件。
- 部分情况下 stdout 未被捕获 → 把输出写入文件再用 `read_file` 读取，或用 `python -X utf8 script.py` 直接执行。
- 临时脚本不要写在 `.local/`（曾出现写入为空的情况），写在项目根目录并在用完后 `delete_file` 清理。

## 参考资源

- `references/supabase-data.md` — 表 24 列完整结构、数据获取步骤、导出 CSV 记录
- `references/citations.md` — 报告引用核查结果（已验证真实 / 无法核实）
- `scripts/query_business_apis.py` — 用 PAT + service_role 查询表行数与列的可复用脚本
