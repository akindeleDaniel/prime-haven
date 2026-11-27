# Prime Haven Properties - Master Implementation Roadmap

**Baseline:** [FRS v1.3](01_REQUIREMENTS_BASELINE_FRS_v1.2.md) and [38 approved REV decisions](PRIME_HAVEN_APPROVED_SCOPE_DECISIONS.md)

**Updated:** 27 November 2026

**Authority:** Canonical task IDs, dependencies and status. DOC-03 maps requirements to these tasks; it does not maintain another competing phase sequence.

## 1. Current execution status and evidence

The scope audit is complete. This documentation synchronization is prepared for owner review. Existing foundations are present; detailed API/workflow/security design remains before domain implementation. This is planning authorization only.

| Work | Observed evidence | Status / limits |
|---|---|---|
| Repository | Git history and working tree inspected | Established; existing untracked documents preserved |
| PH-SETUP-001 frontend | frontend/src/app, package/config files; initialization commit 250e826 | Scaffold present; local check/acceptance and Vercel deployment evidence not established by this update |
| PH-SETUP-002 backend | Express app/server/config/health route; commit 2607774 | Foundation present; health is process liveness, not database readiness; Render deployment unverified |
| PH-SETUP-003 database tooling | Existing Prisma adapter and preserved empty initial migration; User/Session slice added 27 November | Local connectivity/additive migration verified for the slice below; independent restore/provider limits remain unverified |
| PH-SETUP-004 transport | DEC-027; commit a453c8f documents approval | BFF topology approved; implementation and deployed cookie/CSRF evidence pending |
| PH-DESIGN-001 | DOC-06 and DOC-07 synchronized to scope | Documentation prepared for review; no domain schema/migration implemented |
| PH-DESIGN-002 | DOC-08 API contracts | Prepared for owner review; A01-A03 transport details resolved by the authorized authentication slice |
| PH-DESIGN-003, PH-DESIGN-004 | Remaining workflow/security design deliverables below | Authentication subset resolved in DOC-08 Section 1.5; other scoped work remains |
| Domain features/integration/quality/release | User/Session/Invitation plus focused account-lifecycle audit events; property/inquiry/etc. models absent | Remaining work planned; local slice verification below does not establish release/owner acceptance |

A file or commit proves presence, not passing tests, deployment or owner acceptance. Do not recreate existing foundations or mark them accepted from this table alone.

### First authentication slice - 27 November 2026

The owner's subsequent instruction explicitly authorizes a bounded subset of PH-DATA-001, PH-BE-001, PH-AUTH-001 and PH-SETUP-004, including resolving the necessary technical security details within implementation. It does not authorize remaining authentication/domain features or imply acceptance of all earlier design documents.

- Implemented User/Session models and additive migration `20261127010000_auth_foundation`; the existing empty initialization migration is unchanged. Applied only to confirmed loopback `prime_haven_dev`, after an independent local `pg_dump` backup; no reset or production access.
- Implemented controlled interactive local first-admin initialization, bcrypt hashing, A01 sign-in/A02 sign-out/A03 current user, hashed opaque PostgreSQL sessions, expiry/revocation, current-account/role middleware and the corresponding three explicit Next.js BFF handlers. [DOC-08 Section 1.5](08_API_CONTRACTS.md#15-implemented-authentication-transport-slice) records cookie/CSRF/transport choices; README records local commands.
- Local verification: 13 automated tests passed against real PostgreSQL in a temporary isolated `auth_test_*` schema and a built Next.js server; schema removed after tests. Covers concurrent bootstrap/lockout, safe tokens/projections, 12h/7d expiry, revocation races, active/activated accounts, role denial, validation/abuse controls and BFF cookie/CSRF/header handling. Backend/source/tool/test TypeScript, backend build, Prisma validation, frontend lint/TypeScript/production build passed.
- Real development administrator is not initialized automatically: owner supplies the hidden password through `npm run admin:init`. Ignored local environment files contain matching generated server-only transport configuration; no credential is committed.
- Invitation/activation, reset/change-password, account deactivation workflows, general audit browsing/event coverage, other domain models, full authentication UI and deployment remain unimplemented. The coarse per-process request limiter is not a distributed limiter; deployed proxy/HTTPS/cookie/abuse/provider evidence remains required. Full PH-AUTH-001/PH-DATA-001/PH-SETUP-004 and owner acceptance remain pending.

### Agent invitation and activation slice - 27 November 2026

The owner explicitly authorized administrator agent creation, resend, single-use 48-hour invitation acceptance, ZeptoMail delivery integration and same-origin Next.js BFF handlers. This is a bounded implementation, not completion of all PH-AUTH-001 account administration.

- Added additive migration `20261127020000_agent_invitations` for hashed Invitation records, delivery state, relationships and the three account lifecycle AuditLog events. Applied only to confirmed loopback `prime_haven_dev` using `db:migrate:local`, which created a pre-migration backup. No data reset or real account creation was performed.
- Administrator-only `POST /admin/agents` creates an AGENT with no password hash/activation timestamp, persists account and invitation before email delivery, and reports delivery state. Although administratively ACTIVE, the account cannot sign in until activated; it remains distinct from a deactivated account. `POST /admin/agents/{id}/invitations` atomically revokes prior links before issuing a replacement. Public `POST /auth/invitation-acceptances` verifies and consumes one link, sets the bcrypt password/activation timestamp and records a safe audit event in one transaction; it does not sign the agent in.
- ZeptoMail uses a fixed provider endpoint and server-only credentials. Automated tests inject a mock transport; no real email was sent. Provider credentials/domain readiness and live delivery remain unverified. Activation UI is not implemented.
- Verification: 17 auth/invitation tests passed using PostgreSQL in a fresh temporary `auth_test_*` schema and a built Next.js server; schema cleanup is test-scoped. Backend build/type checks, Prisma validation, frontend lint/type check/production build passed. This does not establish full PH-AUTH-001 acceptance.
- Password recovery, agent deactivation/reactivation, general audit endpoints and remaining account-management behavior remain for their assigned scope.

## 2. ID reconciliation and phase ownership

Keep these approved task meanings:

| Canonical ID | Meaning | Retired conversation alias |
|---|---|---|
| PH-DESIGN-001 | Domain and physical database design: DOC-06/07 together | Earlier domain-only PH-DESIGN-001 plus physical-design PH-DESIGN-002 |
| PH-DESIGN-002 | API contracts | Never use for physical database design again |
| PH-DESIGN-003 | Business workflows | Earlier proposed Prisma-schema PH-DESIGN-003 is retired |
| PH-DESIGN-004 | Security design | Security contracts and threat/negative-test planning |
| PH-DATA-001 | Future domain Prisma schema and forward migration implementation | New unambiguous implementation task; not authorized by this update |

Original DOC-03 used ten phases; DOC-05 used eight. The eight phases below are canonical. Earlier Phase 5/6 listing/admin work maps to phase 4 backend and phase 5 portals; earlier Phase 7 public work maps to phases 4/5; earlier Phase 8 inquiries maps to phases 4/5; earlier Phase 9 quality maps to phase 7; earlier Phase 10 release maps to phase 8. Git preserves the earlier tracked roadmaps; maintain this reconciliation in place.

## 3. Canonical phases and tasks

### Phase 1 - Scope and architecture

Approved REV-001 through REV-038, FRS v1.3 and retained stack/BFF. Audit complete; owner review of synchronized documents pending. No new product decisions are manufactured from routine engineering work.

### Phase 2 - Existing foundation completion and deployment validation

| Task | Dependencies | Bounded deliverables and acceptance evidence |
|---|---|---|
| PH-SETUP-001 | Existing frontend/repository inspection | Verify local App Router/layouts/dynamic property smoke route, SSR/metadata, build/env handling; when authorized deploy Vercel natively, record URL/date/provider limits and secret-output review. Do not claim complete from scaffold. |
| PH-SETUP-002 | Existing backend inspection | Verify Express build/start/health/errors/env/logging; when authorized deploy Render and record plan/region/cold starts/HTTPS. Distinguish liveness from readiness. |
| PH-SETUP-003 | Existing Prisma/migration inspection | Verify connectivity, migration history, connection/pooling limits and safe repeatable commands; independent backup/restore procedure. Preserve applied empty migration. No domain model implementation here. |
| PH-SETUP-004 | DEC-027, PH-DESIGN-002, PH-DESIGN-004 | Implement bounded Next.js BFF routes/server-only transport and error propagation; verify credential/cookie handling, origins, hostile requests and direct Express authorization. No generic proxy. |

Local design can continue while deployment gates remain pending. Do not require paid/custom-domain deployment to finish domain planning; verify actual provider feasibility before release. No purchases without approval.

### Phase 3 - Detailed design

| Task | Dependencies | Deliverables / acceptance |
|---|---|---|
| PH-DESIGN-001 | FRS v1.3 and REV record | Review DOC-06/07 entities, partial Drafts, lifecycle/ownership, simple notifications, privacy, constraints/indexes and planned concurrency evidence; no revisions/unread/visitor markers/counters. Owner accepts documentation separately from implementation. |
| PH-DESIGN-002 | Reviewed PH-DESIGN-001 | API endpoint/method/schema/error/pagination contracts for all FRS route groups. Include current-owner inquiry access, private preview, duplication without images, manual retry, conditional Draft/submission validation and safe public projections. Map every route to role and acceptance tests. |
| PH-DESIGN-003 | PH-DESIGN-001, PH-DESIGN-002 | Reuse DOC-06/07 workflows; specify atomic operations, stale requests, reassignment/deactivation, inquiry transitions, safe upload/remove/cleanup, manual notification retry/uncertain results, anonymisation/verified deletion and cache invalidation. No separate revision system. |
| PH-DESIGN-004 | DEC-027, PH-DESIGN-002, PH-DESIGN-003 | Cookie/CSRF/origin/forwarding contract, session expiry/revocation, reset/invitation atomicity, rate limits/proxy trust, safe uploads, least privilege, PII/backup recovery, threat scenarios and negative tests. |

Next proposed bounded task: PH-DESIGN-002 after review/acceptance of this synchronization. Complete relevant workflow/security gates before domain implementation; do not start these tasks automatically.

### Phase 4 - Backend implementation

All tasks require their reviewed contracts and focused test/evidence plan. These are planned, not started by this documentation change.

| Task | Dependencies | Scope / acceptance focus |
|---|---|---|
| PH-BE-001 | Reviewed API/security conventions; setup foundations | Reuse foundation; consistent validation/errors/logging/env/database access; no PII/secrets; readiness distinguishes dependencies. |
| PH-DATA-001 | Accepted PH-DESIGN-001 through 004; PH-SETUP-003 | Implement reviewed Prisma domain models and forward migration; inspect SQL/FKs/checks/indexes, safe Draft nullability, uniqueness, deletion/retention and privileges; verify relevant constraints/concurrency on actual PostgreSQL. Never rewrite applied migration. |
| PH-AUTH-001 | PH-BE-001, PH-DATA-001, transport/security contract | Secure bootstrap/invitation, self-service reset/change, sign-in/lockout/logout/current-user, opaque sessions, role/ownership. Prove 12h/7d expiry, immediate revocation, atomic token use and last-active-admin concurrency. |
| PH-LIST-001 | PH-AUTH-001, PH-DATA-001 | Conditional fields/manual Drafts, reference/slug, complete edited-content review, image captions/alt/upload ownership and cleanup, allowed transitions, duplicate without images and eligible deletion. Prove stale-write, gallery/cover and edit-submit races. |
| PH-AGENT-001 | PH-LIST-001, PH-AUTH-001 | Own dashboard/listing/profile and current-owner inquiry operations; preview/private resource isolation. |
| PH-ADMIN-001 | PH-LIST-001, PH-AUTH-001 | Moderation by submittedAt, direct validated edits, Verified, global six-Featured cap, reassignment, normal/emergency deactivation, archive, contact/social/amenity settings and audit. Verify concurrency and no reassignment approval requirement. |
| PH-PUBLIC-001 | PH-LIST-001, admin visibility rules | Eligible public search/detail/direct-ID/similar/Featured/settings/sitemap projections, filters/all amenities/stable pagination, privacy/cache rules, generic unavailable pages and approximate atomic views. |
| PH-INQ-001 | PH-AUTH-001, PH-LIST-001, workflow/privacy design | Required contact/consent, normalization/anti-spam/duplicate guard, general/viewing inquiries, transitions/notes, per-recipient persisted email/admin retry, current-owner access, 24-month anonymisation/verified deletion. Persist during outage; prove cleanup/send/reassignment races. |

### Phase 5 - Frontend implementation

| Task | Dependencies | Scope / acceptance focus |
|---|---|---|
| PH-FE-001 | Reviewed API/transport; existing Next scaffold | Public/agent/admin layouts/navigation and simple reusable UI; responsive accessible states and correct server/client boundaries. No unnecessary design-system abstraction. |
| PH-AUTH-002 | PH-AUTH-001, PH-FE-001, PH-SETUP-004 | Sign-in/invitation/self-service reset/change/session navigation; expiry and server access checks. |
| PH-PUBLIC-002 | PH-PUBLIC-001, PH-FE-001 | All public pages/gallery/captions/alt/lightbox, URL search, local favourites/clear filters, WhatsApp/share, similar listings, SSR/metadata/canonical/JSON-LD/sitemap/robots and concept notice. |
| PH-AGENT-002 | PH-AGENT-001, PH-AUTH-002, PH-FE-001 | Own dashboard/manual Drafts/conditional forms, unsaved warning, preview, complete public-edit submit, duplicate without images, uploader/profile/status/inquiry UI. |
| PH-ADMIN-002 | PH-ADMIN-001, PH-INQ-001, PH-AUTH-002 | Review, account/reassignment/emergency actions, Verified/Featured, inquiry oversight/manual retry, limited settings and audit viewer; no CSV/banner/admin reset. |
| PH-INQ-002 | PH-INQ-001, PH-FE-001 | General/viewing forms, required email/consent, success/failure states, staff statuses/notes, close/reopen/agreement; no unread tracking or booking. |

### Phase 6 - Full-stack integration

Use task ID PH-INT-001. Depends on relevant phase 4/5 tasks. Verify BFF/auth/cookies/CSRF, all portal boundaries, image and inquiry failure handling, ownership transfer, visibility/cache/metadata consistency and complete edit-review flows. Record deployed integration separately from local checks.

### Phase 7 - Quality and security

| Task | Scope / exit evidence |
|---|---|
| PH-TEST-001 | Validation/search unit tests, API/ownership/workflow/privacy/concurrency integration tests, frontend components and search-to-inquiry/create-submit-approve E2E; requirement references and actual results. |
| PH-SEC-001 | Session/CSRF/direct Express access, authorization/stale requests, upload actual-content/ownership, rate limits, secrets/dependencies, audit/PII and recovery checks. CORS only for separately approved direct consumers. |
| PH-TEST-002 | Mobile 360px/slow network, keyboard/screen reader/WCAG target, reproducible FRS performance/SEO thresholds, error/storage failures and independent backup restore drill. |

Tasks depend on the relevant implementation, but focused verification belongs with each task rather than waiting until this phase. Exit: FRS acceptance evidence, no unresolved critical/high security issue, owner review.

### Phase 8 - Release and portfolio

| Task | Scope / exit evidence |
|---|---|
| PH-RELEASE-001 | Authorized Vercel/Render configuration/deployment, verified low-cost limits, HTTPS/origins/env, provider credentials, reviewed forward migrations and fictional seed data. No purchase without approval. |
| PH-RELEASE-002 | Deployed smoke/security/SEO/inquiry/email/recovery verification across all interfaces, concept notices, limitations and owner acceptance. |
| PH-RELEASE-003 | README, architecture/database diagrams, API reference, screenshots, links/demo guide, known limitations and future ideas clearly outside V1. |

## 4. Execution and completion rules

For each assigned task state ID, requirements/REV references, objective/scope/non-goals, dependencies, expected files, risks, acceptance criteria and planned checks before editing. Afterward report actual evidence, failures/blockers, diff and proposed Conventional Commit message. The owner accepts work; commits/pushes/deployment require authorization.

Use distinct states: planned, prepared for review, implemented, verified, owner-accepted, deferred or blocked with evidence. A written mitigation/test plan is not a passed test. Whole-project completion requires implemented or formally deferred FRS requirements, functioning three interfaces, security/recovery/performance evidence and owner acceptance.
