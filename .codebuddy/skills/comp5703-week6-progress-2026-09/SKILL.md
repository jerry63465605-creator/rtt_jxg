---
name: comp5703-week6-progress-2026-09
description: 查 COMP5703 第 6 周（2026-09-12~13）会议结论与个人进度（BP Builder 产 YAML、认证/repo 状态）时用。
---

# Week 6 Progress (Sep 12-13, 2026)

## Meeting outcomes

See `references/week6-meeting.md` for the full list.

Headline decisions:

- **BP Builder does not execute workflows** — it generates a deployable
  **AWS Step Functions-style YAML definition**.
- **Java is not mandatory** — reuse the reference project's logic, keep Python/JS.
- **Priority stays on BP Builder**; API Publisher comes later.
- Client will provide a **PDF** clarifying workflow generation and output format.

## Jianrui Zhou's delivered work this cycle

| Area | Deliverable |
|---|---|
| Proposal | Revised Section 4 Methodologies (4.1-4.5): aligned with the real 24-column `business_apis` schema, split compatibility into schema + format matching, compressed to word limits, added citations |
| Database | Created `public.profiles` with RLS policies, `is_admin()`, `updated_at` trigger, new-user provisioning trigger; renamed `display_name` to `name` to match the backend contract; provisioned an admin account |
| Auth backend | Implemented `POST /session` (login) and `DELETE /session` (logout) in FastAPI; Supabase Auth + JWT; HttpOnly cookie; role read from `profiles` on every request; fixed the 204 `status_code=None` crash; updated two 501 placeholder tests |
| Verification | Login → refresh restore → logout verified against real Supabase; 98 backend tests and ruff pass |
| Git | Pushed to `feat/auth-user` (commit `b573eac`), awaiting merge to `develop` |

## Open blockers for Jianrui

- PR not yet merged
- No refresh-token mechanism (1-hour expiry)
- No owner column on `business_apis`, so per-owner edit permission is unenforceable
- Unverified citation `Raza et al., 2026` in Section 4
