# Auth 基础概念速查（面向本项目）

## 一、现有 24 列是什么

现有表 `business_apis` = **API 目录数据**（76 个真实电子发票 API），是"业务数据"，不是用户数据。

| 分组 | 字段 |
|---|---|
| 主键 | `id` |
| 描述信息 | `api_name`、`description`、`instructions` |
| 技术信息 | `api_endpoint`、`http_method`、`operation_name`、`authentication_method`、`network`、`input_formats`、`output_formats` |
| 归属与来源 | `company_name`、`website_url`、`documentation_url`、`category`、`business_rules`、`client_types` |
| 运行状态 | `is_active` |
| 治理（新增 6 列） | `collected_by`、`verified_by`、`verification_status`、`verified_at`、`http_method`、`operation_name` |
| 时间戳 | `created_at`、`updated_at` |

**关键点**：24 列里**没有 `owner_id` / `created_by`** —— 数据库不知道"这个 API 是谁提交的"，
因此"普通用户只能编辑自己创建的 API"当前无法实现，需新增归属字段。

## 二、为什么"有数据库"还要建 profiles

"有数据库" ≠ "有所有表"。数据库像图书馆，表是里面的不同册子：

| 表 | 存什么 | 状态 |
|---|---|---|
| `business_apis` | API 目录（像"书目清单"） | 已有，76 行 |
| `profiles` | 用户资料与角色（像"读者证信息"） | **本周要建** |
| `api_schemas` | API 输入输出结构 | 本周要建 |
| `flows` | 流程、节点、连线、坐标 | 本周要建（第 5 位） |

要做"真实登录"，就必须有一张存用户与角色的表。

## 三、profiles 表是什么

- `auth.users` 由 Supabase **内置管理**，只存邮箱、密码哈希等认证信息，**不要直接改结构**。
- `profiles` 是我们自己的业务表，通过 `id` 关联 `auth.users(id)`，用来放：
  `display_name`、`role`（analyst/admin）、`company_name` 等。
- 这就是"认证信息"与"业务信息"分离的标准做法。

## 四、RLS（Row Level Security，行级安全）

- 普通权限是**表级**（能不能查这张表）；RLS 是**行级**（能查哪些行）。
- 政策（policy）= 规则，由数据库在每条 SQL 上自动追加条件：
  - `using` —— 哪些行**可见/可改**
  - `with check` —— 改完后的值**是否被允许**（防自我提权）
- **为什么本项目必须开 RLS**：前端拿到的 anon key 是**公开的**（写在前端代码里，谁都能扒）。
  没有 RLS 时，任何人拿到 key 就能读写整张表。RLS 是最后一道防线。
- 本项目的策略：本人可读写自己的 profile；管理员可读全部；角色字段不允许自我修改。

## 四之二、collected_by 用户名区分大小写（重要）

`business_apis.collected_by` 取值分布（76 行实测）：

| 值 | 行数 |
|---|---|
| *(空)* | 46 |
| `yul` | 13 |
| `Yu` | 10 |
| `yao` | 7 |

**用户名区分大小写**：`yul` 与 `Yu` 是**两个不同用户**，不是同一人的两种写法。

由此产生两条硬性要求：

1. `owner_id` 回填必须用**精确比较**（`collected_by = split_part(email,'@',1)` 或 `= display_name`），
   **禁止**用 `lower()` 做忽略大小写匹配，否则会把两个用户错误合并，把权限判给错误的人。
2. `profiles` 里的 `display_name` / 邮箱前缀本身也**不应用作权限判断依据**，
   权限一律以 `owner_id`（uuid）与 `auth.uid()` 比较为准。

## 五、cookie session vs JWT

HTTP 无状态，每次请求都要证明"我是谁"，两种做法：

| | cookie session | JWT |
|---|---|---|
| 凭证 | 浏览器只存 session id | 服务端签发签名 token，内含用户 id 与过期时间 |
| 服务端 | 需保存会话状态（内存/表） | 无状态，只验签名，不查库 |
| 发送方式 | 浏览器自动带 cookie | 手动加 `Authorization: Bearer <token>` |
| 撤销 | 服务端删会话即刻失效 | 签发后难撤销，靠短有效期 + refresh |
| XSS 风险 | 可设 HttpOnly，较低 | 存 localStorage 有风险，需靠 SDK 管理 |
| 扩展 | 多实例需共享会话存储 | 天然易扩展 |
| 与 Supabase 配合 | 弱，需额外转换 | **原生**，RLS 的 `auth.uid()` 就是从 JWT 解析的 |

**本项目选 JWT 的理由**：Supabase 认证体系本身就是签发 JWT；
PostgREST 与 RLS（`auth.uid()`）都直接读 JWT；选 cookie 反而要多做一层转换。

### 刷新后恢复登录的原理

- `access_token` 有效期短（约 1 小时），`refresh_token` 有效期长。
- 刷新页面时前端用 refresh_token 换一个新的 access_token，再调 `/auth/me` 拿回用户信息。
- 所以 `/auth/me` 是"刷新后恢复登录"的关键接口。
