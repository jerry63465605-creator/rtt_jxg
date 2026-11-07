# Week 6 Meeting (Sep 12, 2026) — Key Points

## Client decisions (important, changes scope)

1. **BP Builder does NOT execute workflows.** The platform should not host/run the
   chained API workflow for users. Instead, users compose compatible APIs and the
   system generates a **deployable workflow definition**.

2. **Target output: AWS Step Functions-style YAML definition** generated from the
   connected APIs. Deployment details, combined API endpoint creation and exact
   output format are still **pending client documentation (PDF)**.

3. **Java is NOT mandatory.** The reference BP Builder project is Java, but the team
   may use Python/JavaScript as long as the compatibility-checking logic is reused
   and adapted.

4. **Priority**: BP Builder first; API Publisher backend later.

## Current state

- Auth: login / logout / authentication implemented and demonstrated.
- Repository: browse, category filter, search, view details.
- BP Builder: add API nodes, connect them; frontend validation includes
  input/output format check and graph validation (cycle + self-loop detection).
- Backend re-runs validation after submission (not trusting frontend).
- Schema compatibility logic largely implemented (field name + type, camelCase vs
  snake_case) but **not yet integrated** into the BP Builder validation pipeline.

## Next steps

- Integrate schema checking with format + graph checks into one pipeline.
- Test cycle / self-loop / valid non-cyclic workflows.
- Continue reusing reference-project logic, adapted to Python/JS.
- Wait for client PDF on workflow export format.

## Jianrui's own blockers (Auth)

- PR `feat/auth-user` awaiting merge into `develop`.
- No refresh-token mechanism yet: access token expires after 1 hour, then re-login.
- `business_apis` has no owner column, so "analyst may edit only own APIs" cannot be
  enforced yet (currently only admins can modify). Needs zheyu's decision.
- Reminder: the `Raza et al., 2026` citation in Section 4 could not be verified.
