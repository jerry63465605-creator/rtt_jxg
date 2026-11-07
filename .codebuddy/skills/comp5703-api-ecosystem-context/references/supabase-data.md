# Supabase 数据项目参考

> 核实时间：2026-09-10（2026-09-08 首次导出）
> 适用项目：COMP5703 CS-9 Business API Ecosystem

## 项目与组织

| 项 | 值 |
|---|---|
| 组织 ID / slug | `bwwiddkkjadzhensdzav` |
| 组织名称 | CLoud11y's Org |
| 组织 dashboard | https://supabase.com/dashboard/org/bwwiddkkjadzhensdzav |
| 项目 ref | `imwptiicwdzjyawpysss` |
| 项目名称 | CLoud11y's Project |
| 区域 | `ap-southeast-2` |
| 状态 | `ACTIVE_HEALTHY` |
| 创建时间 | 2026-08-26T16:52:00Z |
| DB host | `db.imwptiicwdzjyawpysss.supabase.co` |
| DB 版本 | PostgreSQL 17.6.1.165（postgres_engine 17，ga） |
| REST 端点 | `https://imwptiicwdzjyawpysss.supabase.co/rest/v1/` |
| PAT 位置 | 工作区 `.local/supabase-token.md`（私有，勿提交 git） |

**该组织下只有这 1 个项目。**

## 数据表 `business_apis`

- 名称是**复数** `business_apis`
- 行数：**76**（2026-09-10 复核仍为 76）
- 列数：**24**

### 24 列完整清单

```
id, api_name, description, api_endpoint, instructions, company_name,
website_url, documentation_url, category, authentication_method, network,
is_active, created_at, updated_at, input_formats, output_formats,
business_rules, client_types, collected_by, verified_by,
verification_status, verified_at, http_method, operation_name
```

### 关键事实

- 管理类字段中，`verification_status` 的值均为 `pending`。
- **不存在 `version` 列**（报告 §6.1 若写"包含 version 字段"即为错误，与真实结构冲突）。
- 多值字段（`input_formats`、`output_formats`、`business_rules`、`client_types`）以 **JSON 数组**存储，供兼容性检查使用。
- 相对旧版 18 列，`bd` 文件仍为 18 列 DDL（未同步）；新增 6 列为：
  `collected_by, verified_by, verification_status, verified_at, http_method, operation_name`。

## 数据获取步骤

1. 读取 PAT：`.local/supabase-token.md` 中的 `sbp_...`
2. 取 service_role 密钥：
   `GET https://api.supabase.com/v1/projects/imwptiicwdzjyawpysss/api-keys`
   请求头：`Authorization: Bearer <PAT>`、浏览器 `User-Agent`
   取 `name == "service_role"` 的 `api_key`
3. 读表（PostgREST）：
   `GET https://imwptiicwdzjyawpysss.supabase.co/rest/v1/business_apis`
   请求头：`apikey: <service_role>`、`Authorization: Bearer <service_role>`、`User-Agent`
4. 统计行数：加 `Prefer: count=exact` 与 `Range: 0-0`，读响应头 `content-range`（形如 `0-0/76`）。

### 注意事项

- **必须带浏览器 User-Agent**，否则 Cloudflare 返回 `403 error code: 1010`。
- `/rest/v1/` 清单端点需 secret key（publishable key 只能看到 RLS 允许的行）。
- `PGRST205` / `403` 无法区分"空表"与"RLS 限制"，需用 service_role 确认。
- Management API 的 `/database/query` 在 PowerShell 下 POST body 易被转义导致 403 → 改用本地 Python 脚本。

## 已导出产物

- CSV：`business_apis_full_export.csv`（UTF-8 BOM，76 行 24 列，置于工作区根目录，属本地私有、不提交 git）

## 易混淆点

- README 中记录的 `uetlyejxqniqtuiesdzv` **不是**实际使用项目，不在本组织内；其 `business_api`（单数）为空表。
