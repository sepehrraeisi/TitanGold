# DataHub Advanced — Access Control API Contract

> Subtab: `dataHub.advanced.access` · UI: `AccessControlPanel.tsx` (permissions scope v3.0)

## Scope v3.0

| In scope | Out of scope (placeholder UI removed) |
|----------|----------------------------------------|
| Per-source ACL (`source_access_controls`) | Roles matrix (fake built-in roles) |
| List + configure + reset | API keys / IP allowlist tabs |
| Audit via existing `dataHub.logs` | Duplicate access log in panel |

## API — `/api/v1/data-hub/access-control`

| Method | Path | Auth | Body |
|--------|------|------|------|
| `GET` | `/` | JWT | — → `{ rules: AccessControlRule[] }` |
| `GET` | `/:sourceId` | JWT | — → single rule (or defaults) |
| `POST` | `/:sourceId` | JWT + admin/trader | `accessControlSchema` |
| `DELETE` | `/:sourceId` | JWT + admin/trader | reset ACL |

### Rule shape (API snake_case → UI camelCase)

- `allowed_agents`, `blocked_agents`, `allowed_data_types`, `blocked_data_types`
- `require_auth`, `max_requests_per_minute`, `max_requests_per_day`

## DB

`source_access_controls` — migration `021_create_source_access_control.sql`

## Design

Full pass per `DESIGN_SYSTEM_DATAHUB.md` in same PR as wiring (GAP-022).

## Done

- [ ] List API + React Query
- [ ] Permissions UI redesigned (slate cards, modals §10)
- [ ] i18n keys en/fa
- [ ] Demos in `DataHub_DEMOS.md`
- [ ] SSOT: Implemented (backend + design)
