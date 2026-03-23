# EdMgtWorkflows — Claude Code Reference

## Project Overview

A web application to administer and manage distribution of custom data collection/action forms
to administrative services and personnel for digitalization of education management workflows.

Built on **TypeScript** (monorepo) + **PostgreSQL**.

---

## Architecture Summary

### Two Core Graphs

The entire system is governed by two interdependent graph structures:

1. **Xedu Graph** — organizational DAG: ministry → regions → districts → schools → offices/units
   - True DAG (a node can have multiple parents)
   - Edge types: `hierarchical`, `peer`, `cross_functional`
   - Scale: thousands of nodes
   - Closure table maintained for fast ancestor/descendant traversal (hierarchical edges only)

2. **Workflow Graph** — process DAG: defines the routing of a form campaign
   - Steps: fill → review → approve → reject → forward → notify → end
   - Transitions triggered by: submit, approve, reject, forward, timeout
   - One campaign can use different workflows per target Xedu region

### Permission Model

Permissions sit at the intersection of: `Xedu Node` × `Role` × `Form Component` × `Workflow Step` × `Action`

Actions: `read | write | create | delete | approve | reject | forward`

Permission inheritance flows **down hierarchical edges only** (configurable per permission).

---

## Tech Stack

### Backend
- **Framework**: NestJS + TypeScript
- **ORM / Migrations**: Prisma
- **Database**: PostgreSQL 16 + PostGIS extension
- **Cache / Job Queues**: Redis 7 + BullMQ
- **Auth**: JWT (access token 15min) + Refresh tokens (7d, rotating) + TOTP MFA
- **File Storage**: AWS S3 (SSE-S3 encryption)
- **Email**: AWS SES
- **SMS**: AWS SNS
- **PDF Generation**: Puppeteer (ECS worker, async via BullMQ)
- **XLSX Export**: ExcelJS

### Frontend
- **Framework**: Next.js 14 (App Router) + TypeScript
- **UI**: Shadcn/ui + Tailwind CSS
- **Form Builder**: dnd-kit (drag-and-drop)
- **Workflow Designer**: React Flow
- **Offline Storage**: Dexie.js (IndexedDB)
- **Maps**: Leaflet + react-leaflet
- **i18n / RTL**: next-intl + CSS logical properties
- **Signature**: react-signature-canvas
- **Data Fetching**: TanStack Query

### Infrastructure (AWS)
- **Compute**: ECS Fargate (API + workers)
- **Database**: RDS PostgreSQL
- **Cache**: ElastiCache Redis
- **CDN**: CloudFront
- **IaC**: AWS CDK (TypeScript)
- **CI/CD**: GitHub Actions

---

## Monorepo Structure

```
EdMgtWorkflows/
├── apps/
│   ├── api/                    # NestJS backend
│   │   └── src/
│   │       ├── auth/           # JWT, MFA (TOTP), guards, decorators
│   │       ├── xedu/           # Org graph: nodes, edges, closure table
│   │       ├── users/          # Users, role assignments
│   │       ├── permissions/    # Graph-aware permission resolution engine
│   │       ├── forms/          # Templates, versions, components
│   │       ├── workflows/      # Definitions, steps, transitions
│   │       ├── campaigns/      # Campaign management, per-region workflows
│   │       ├── assignments/    # Assignment resolution + BullMQ scheduling
│   │       ├── submissions/    # Fill, draft, submit, offline sync
│   │       ├── approvals/      # Approval chain + escalation processor
│   │       ├── notifications/  # BullMQ producers: email, SMS, in-app
│   │       ├── geo/            # PostGIS queries, map data endpoints
│   │       ├── pdf/            # Puppeteer PDF generation worker
│   │       ├── reports/        # Analytics queries, XLSX/CSV/PDF export
│   │       ├── audit/          # Immutable log interceptor + archival
│   │       ├── i18n/           # Locale middleware
│   │       └── common/         # Decorators, pipes, filters, pagination
│   │
│   └── web/                    # Next.js 14 frontend
│       └── src/
│           ├── app/
│           │   ├── (auth)/             # Login, MFA setup/verify
│           │   ├── (portal)/           # Staff: assignments, fill, drafts
│           │   ├── (admin)/
│           │   │   ├── forms/          # Form builder UI
│           │   │   ├── workflows/      # Workflow designer (React Flow)
│           │   │   ├── campaigns/      # Campaign management
│           │   │   ├── xedu/           # Org graph editor
│           │   │   └── users/          # User / role management
│           │   └── (dashboard)/
│           │       ├── analytics/      # Charts: completion, overdue, turnaround
│           │       └── map/            # Geo submissions map (Leaflet)
│           └── lib/
│               ├── form-renderer/      # Schema → React components (RTL-aware)
│               ├── form-builder/       # dnd-kit drag-and-drop builder
│               ├── workflow-designer/  # React Flow workflow editor
│               ├── offline/            # Dexie.js, sync manager, conflict UI
│               ├── signature/          # Canvas + typed signature + SHA-256 hash
│               ├── i18n/               # next-intl, RTL, locales
│               └── api/                # TanStack Query + typed API client
│
├── packages/
│   ├── database/               # Prisma schema + migrations + seed scripts
│   ├── shared-types/           # DTOs, enums shared between apps
│   └── form-schema/            # Form JSON schema validator (Zod)
│
├── infrastructure/             # AWS CDK stack
└── .github/workflows/          # CI/CD pipelines
```

---

## Database Schema

### Key Design Principles
- All primary keys are UUID
- All user-visible strings stored as `JSONB` with shape `{en, ar, fr, es}` for multilingual support
- `audit_log` is append-only, partitioned by year, 5-year retention
- PostGIS `GEOMETRY(Point, 4326)` for geo fields
- Form schemas stored as JSONB snapshot in `form_versions.schema`

### Core Tables

#### Xedu Graph
```sql
xedu_nodes        id, code, node_type, name(JSONB), metadata(JSONB), is_active
xedu_edges        id, from_node_id, to_node_id, edge_type(hierarchical|peer|cross_functional)
xedu_closure      ancestor_id, descendant_id, depth   -- materialized, rebuilt on graph changes
```

#### Users & Roles
```sql
users                 id, email, phone, password_hash, mfa_secret, mfa_enabled, preferred_lang
roles                 id, code, name(JSONB), description(JSONB)
user_role_assignments id, user_id, role_id, xedu_node_id, granted_by, valid_from, valid_until
component_permissions id, role_id, xedu_node_id, form_template_id, component_id,
                       workflow_step_id, can_read, can_write, can_create, can_delete,
                       can_approve, can_reject, can_forward, inherits_to_children
```

#### Forms & Versioning
```sql
form_templates    id, code, title(JSONB), owner_node_id, current_version_id
form_versions     id, template_id, version_number, schema(JSONB), is_draft, published_at
form_components   id, version_id, parent_id, order_index, component_type, key,
                  label(JSONB), placeholder(JSONB), help_text(JSONB), validation(JSONB),
                  options(JSONB), table_schema(JSONB), conditions(JSONB), is_required
```

**Component types**: `text | number | date | datetime | dropdown | multi_select | file_upload | signature | geo_coordinates | table | section | conditional_group`

**Table schema shape**:
```json
{
  "allow_add_rows": true,
  "max_rows": 50,
  "columns": [
    { "key": "col1", "label": {"en":"...", "ar":"..."}, "type": "text|date|dropdown|...", "required": true }
  ]
}
```

**Signature**: Supports drawn (canvas) + typed name. Cryptographically bound via SHA-256 hash of deterministic submission JSON + signature image bytes, stored in `submissions.signature_hash`.

#### Workflows
```sql
workflow_definitions  id, name(JSONB), owner_node_id, created_by, is_published
workflow_steps        id, workflow_id, name(JSONB), step_type, assignee_role_id,
                      assignee_node_id, assignee_node_rel(absolute|parent|ancestor|peer|custom),
                      deadline_offset_hours, escalation_step_id,
                      escalation_role_id, escalation_node_rel, escalation_node_id,
                      order_index
workflow_transitions  id, from_step_id, to_step_id, trigger_action, conditions(JSONB)
```

Escalation: creates a **new `submissions_assignment`** for the escalation target + sends notification.

#### Campaigns & Assignments
```sql
form_campaigns               id, form_template_id, form_version_id, title(JSONB),
                              owner_node_id, status(draft|active|paused|recalled|closed),
                              global_deadline
campaign_workflow_assignments id, campaign_id, target_node_id, workflow_id, deadline_override
submissions_assignments       id, campaign_id, workflow_step_id, assigned_to, assigned_node_id,
                               status(pending|in_progress|submitted|approved|rejected|
                                      forwarded|expired|flagged), deadline
```

#### Submissions
```sql
submissions       id, assignment_id, form_version_id, submitted_by, status,
                  offline_flag, conflict_reason, signature_hash, submitted_at
submission_values id, submission_id, component_id, value_text, value_number,
                  value_date, value_json, value_file_key
submission_geo_points  id, submission_id, component_id, location(GEOMETRY), accuracy_meters,
                        capture_method(gps|map_selection), captured_at
```

#### Approvals & Audit
```sql
approval_events   id, submission_id, assignment_id, workflow_step_id, actor_id,
                  action(submit|approve|reject|forward|request_correction), comment
audit_log         id, entity_type, entity_id, actor_id, actor_node_id, action,
                  before_state(JSONB), after_state(JSONB), ip_address, user_agent, created_at
                  -- PARTITIONED BY YEAR, 5-year retention, archived to S3 after year 1
sync_queue        id, device_id, user_id, payload(JSONB), status, conflict_details(JSONB)
```

---

## Key Architectural Patterns

### Permission Resolution (runtime)
```
Request: User U, Action A, Component C, Submission S

1. Resolve user's active role(s) + xedu_node(s) (from user_role_assignments)
2. Resolve current workflow_step for submission S
3. Query component_permissions WHERE:
     role IN user_roles
     AND xedu_node IN (user_nodes + ancestors via xedu_closure, hierarchical only)
     AND (form_component = C OR component IS NULL)
     AND (workflow_step = current_step OR step IS NULL)
     AND action_column = true
4. Grant if any row matches, deny otherwise
```

### Offline Sync Flow
```
1. Device serializes draft → sync_queue (IndexedDB)
2. On connectivity: Background Sync API fires
3. POST /sync/submissions → server validates:
   a. JWT valid
   b. Campaign status = active (if recalled → flag)
   c. Deadline not passed (if passed → flag)
   d. Form version matches (if mismatch → flag with details)
4. Flagged submissions: stored with status='flagged', routed to manual review queue
5. Response includes {status, flags[], submission_id}
```

### Form Versioning Rule
- Open assignments on older versions remain on that version
- New assignments always get `form_campaigns.form_version_id` (latest published)
- `submission_values` always reference the `component_id` from the version used at fill time

### Audit Log Rule
- `AuditInterceptor` wraps every mutating endpoint automatically
- Writes are fire-and-forget (non-blocking) via BullMQ
- Table is **append-only** — no UPDATE or DELETE ever runs on it
- pg_cron job archives partitions older than 1 year to S3, drops after 5 years

---

## Localization

| Locale | Code | Direction |
|--------|------|-----------|
| English | `en` | LTR |
| Arabic | `ar` | RTL |
| French | `fr` | LTR |
| Spanish | `es` | LTR |

- All user-visible strings (form labels, options, names) stored as `JSONB {en, ar, fr, es}`
- Frontend uses `next-intl` with per-locale layout direction
- CSS uses logical properties (`margin-inline-start` not `margin-left`) throughout
- RTL toggled via `<html dir="rtl">` based on active locale

---

## Notifications

| Trigger | Channels | Recipients |
|---------|----------|-----------|
| Assignment created | In-app + Email + SMS | Assigned user |
| Deadline approaching (24h) | In-app + Email | Assigned user |
| Deadline passed (escalation) | In-app + Email + SMS | Escalation target |
| Submission received | In-app + Email | Reviewer/approver at next step |
| Approved | In-app + Email | Submitter |
| Rejected | In-app + Email + SMS | Submitter |
| Campaign recalled | In-app + Email | All assigned users |

All notifications are processed asynchronously via BullMQ workers.

---

## Dashboard & Reporting

Visibility: any user with an authorized role can see reports **scoped to their Xedu subtree**.

| Report | Description |
|--------|-------------|
| Submission completion rate | % submitted per node, drillable by subtree |
| Overdue counts | Assignments past deadline, grouped by node |
| Approval turnaround time | Average time from submission to final decision |
| Form fill duration | Time from first open to submission |
| Geo submissions map | Leaflet map with PostGIS-powered clustering |
| Content consolidation | All submission values for a campaign → CSV / XLSX / PDF |

---

## Development Phases

| Phase | Scope |
|-------|-------|
| 1 — Foundation | Monorepo (pnpm workspaces), Prisma schema, DB migrations, NestJS skeleton, JWT + MFA auth |
| 2 — Xedu + Permissions | Node/edge CRUD, closure table maintenance, permission engine |
| 3 — Form Builder | Template/version/component API + frontend dnd-kit builder |
| 4 — Workflows | Workflow definition API + React Flow designer |
| 5 — Campaigns & Assignments | Campaign deployment, per-region workflow assignment |
| 6 — Submissions | Fill flow, drafts, offline sync, signature binding, file upload |
| 7 — Approval Chain | Approve/reject/forward, escalation BullMQ jobs |
| 8 — Notifications | Email (SES), SMS (SNS), in-app notification center |
| 9 — Reports & Geo | Dashboard analytics, geo map, export (CSV/XLSX/PDF) |
| 10 — Infra & CI/CD | AWS CDK stack, ECS deployment, CloudFront, GitHub Actions |

---

## Environment Variables (required)

```bash
# Database
DATABASE_URL=postgresql://user:pass@host:5432/edmgt
REDIS_URL=redis://host:6379

# Auth
JWT_ACCESS_SECRET=
JWT_REFRESH_SECRET=
JWT_ACCESS_EXPIRES_IN=15m
JWT_REFRESH_EXPIRES_IN=7d

# AWS
AWS_REGION=
AWS_ACCESS_KEY_ID=
AWS_SECRET_ACCESS_KEY=
S3_BUCKET_FILES=
S3_BUCKET_PDFS=
SES_FROM_ADDRESS=
SNS_SMS_SENDER_ID=

# App
NODE_ENV=development
API_PORT=3000
WEB_PORT=3001
FRONTEND_URL=http://localhost:3001
```

---

## Code Conventions

- **All API responses** use a standard envelope: `{ data, meta?, error? }`
- **Pagination**: cursor-based for large datasets, offset for reports
- **DTOs**: validated with class-validator + class-transformer on all inputs
- **Errors**: custom `AppException` extends `HttpException`, always includes `code` + `i18n_key`
- **Dates**: always stored and transmitted as UTC ISO 8601
- **File keys**: `{entity}/{uuid}/{timestamp}-{originalname}` pattern in S3
- **Tests**: unit tests co-located (`*.spec.ts`), e2e tests in `apps/api/test/`
- **Branching**: feature branches from `main`, PRs required for merge

---

## Future Enhancements (out of scope now)

- SSO / SAML 2.0 / OIDC integration (ministry identity provider)
- External student/staff database API integration
- Mobile native apps (React Native)
- Advanced analytics with dedicated OLAP store
