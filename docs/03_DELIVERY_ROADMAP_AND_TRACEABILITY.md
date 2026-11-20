# Prime Haven Properties — Delivery Roadmap and Requirements Traceability

**Document type:** Delivery planning and traceability register  
**Status:** Phase 1 complete; Phase 2 preparation only; implementation has not started  
**Project:** Fictional Nigerian real-estate listings platform  
**Requirements baseline:** FRS v1.2

This document describes planned work and planned verification. It is not evidence that a task, implementation, deployment or test has been completed. Phase and task status must be updated only when supported by reviewable evidence.

---

# 1. Development Roadmap

**Status:** Proposed roadmap; no implementation has started.  
**Rule:** Do not begin a milestone until its prerequisites and acceptance criteria are satisfied.

## Phase 1 — Requirements analysis and technical planning

**Current phase: Phase 1 complete; preparing Phase 2 — Project Setup and Deployment.**

Deliverables:
- Approved consolidated requirements baseline (FRS v1.2), based on the original FRS v1.0 plus approved planning clarifications and hosting change.
- Project overview.
- Technical architecture.
- Decision log.
- Requirements traceability.
- Risk register.
- Development roadmap.

Exit criteria:
- Major FRS contradictions and decisions are recorded.
- User understands and approves the architecture direction.
- Open technical validations are explicitly identified.
- Planning pack reviewed and accepted.

## Phase 2 — Project Setup and Deployment

Purpose: establish the project repository and deployment foundations through small, independently verifiable setup tasks. The first task validates only the minimal Next.js/Vercel path. Backend hosting, database connectivity and browser/API security integration remain separate subsequent tasks.

### PH-SETUP-001 — Next.js Setup and Vercel Deployment

**Objective:** Create and deploy a minimal Next.js + TypeScript foundation using Vercel's native Next.js integration. This is a setup/deployment smoke test, not a framework compatibility investigation or full product implementation.

**Prerequisites:** Before PH-SETUP-001 begins, establish the local project workspace, confirm the GitHub repository status and connect the repository to the local project. Record the actual workspace and repository details in the task execution notes; they are execution prerequisites, not permanent product requirements.

**Scope:**
1. Create a minimal Next.js + TypeScript application using the App Router.
2. Verify nested layouts.
3. Verify a dynamic `/properties/[slug]` route.
4. Verify server rendering and the rendered HTML.
5. Verify page metadata, canonical URL and Open Graph/Twitter metadata.
6. Connect the Git repository to Vercel and deploy using Vercel's native Next.js integration.
7. Verify deployed routes, build behaviour and environment-variable handling, ensuring secrets are not exposed to the browser.
8. Record Vercel plan eligibility, usage limits and portfolio/demo constraints.

**Explicit non-goals:** Express API implementation; PostgreSQL or Prisma integration; authentication or session implementation; cookie/CORS/CSRF integration; Cloudinary; ZeptoMail; and the full public website, Agent Portal or Administration Portal.

**Acceptance criteria:**
- A minimal Next.js + TypeScript App Router project installs, runs locally and builds successfully.
- Nested layouts render at the intended routes.
- `/properties/[slug]` resolves a dynamic slug and renders the expected smoke-test page.
- The route uses server rendering and the expected content is present in the returned HTML.
- Page title/metadata, canonical URL and Open Graph/Twitter metadata are present and correct in rendered output.
- The Git repository is connected to Vercel and a successful deployment uses Vercel's native Next.js integration; no Cloudflare Workers or vinext adapter/configuration is introduced.
- The deployed root and dynamic property route load successfully, and the deployment build completes.
- Environment variables are configured in the appropriate Vercel environment; secrets are not committed, included in client-exposed variables, or present in browser-delivered output.
- Vercel plan eligibility, current usage limits and relevant portfolio/demo constraints are recorded with the date checked.
- The task result, deployment URL, verification evidence, limitations and any follow-up issues are documented.

**Verification:** local install/dev/build checks; inspect rendered HTML and metadata; test the root and dynamic route locally and on the deployed URL; inspect the browser-delivered output for secret leakage; review Vercel deployment/build logs and environment-variable configuration; record plan/usage findings.

**Security/review notes:** no secrets in source control or client bundles; no database credentials or API secrets in Next.js public environment variables; user reviews the complete diff and asks for explanations of unfamiliar code before accepting the task.

### Subsequent, separately scoped Phase 2 tasks
- **Express on Render:** create and deploy a minimal Express + TypeScript service; verify service health, build/start behaviour, environment-variable handling and logs.
- **Render PostgreSQL and Prisma:** confirm database plan, region, connection limits and backup/restore capabilities; configure Prisma Client and Prisma Migrate; verify connectivity and migration workflow.
- **Frontend/API transport and browser security:** confirm intended frontend/API domain arrangement and origins; configure and verify CORS transport, then separately validate session-cookie attributes and CSRF enforcement when the session design is implemented.
- Measure relevant API/database latency and document cold-start, region and service-availability behaviour as part of the appropriate hosting validation tasks.

These later tasks are not prerequisites or acceptance criteria for PH-SETUP-001. Each must receive its own bounded task ID, scope, dependencies, acceptance criteria and verification plan before implementation.

**PH-SETUP-001 exit gate:** the minimal Next.js application is deployed successfully through Vercel's native integration; the routes, nested layouts, server-rendered HTML and metadata are verified; environment-variable handling is reviewed; Vercel plan/usage constraints are documented; and the user has reviewed and accepted the evidence. Completion of PH-SETUP-001 does not mean the Express API, PostgreSQL/Prisma connectivity or frontend/API security integration has been validated.

## Phase 3 — Detailed design

Deliverables:
- User flows and route map.
- Data model and entity relationships.
- API contract and error format.
- Authentication/session lifecycle design.
- Listing state-transition model.
- Published revision workflow design.
- Inquiry and notification workflow.
- Cloudinary upload/deletion lifecycle.
- Threat model and security controls.
- Test strategy and seed-data plan.

Exit criteria:
- Design maps to requirement IDs.
- Data ownership and role rules are explicit.
- Migrations and backup approach are defined.
- No unresolved design issue blocks implementation.

## Phase 4 — Foundation and authentication

Potential task groups:
- Repository structure and tooling.
- TypeScript configuration and lint/format/test setup.
- Environment configuration and secret handling.
- PostgreSQL connection and migrations.
- Health checks and structured error handling.
- User model and password hashing.
- PostgreSQL-backed sessions.
- Sign-in, lockout, sign-out, invitation and reset flows.
- Role and ownership middleware.

Exit criteria:
- Authentication tests pass.
- Session idle/absolute expiry and revocation are verified.
- Unauthorized and cross-agent access tests pass.
- No secrets appear in client bundle or repository.

## Phase 5 — Listing domain and agent portal

Potential task groups:
- Listing fields and conditional validation.
- Listing references and stable slugs.
- Listing CRUD and status transition service.
- Cloudinary signed uploads and asset verification.
- Agent dashboard and listing management.
- Draft preview and autosave.
- Published listing revision workflow.
- Agent profile.

Exit criteria:
- Required/type-specific validation passes.
- Image limits and cover rules pass.
- Only allowed transitions work.
- Agent ownership isolation passes.
- Published version remains live until revised version approval.

## Phase 6 — Administration and moderation

Potential task groups:
- Agent creation and invitations.
- Agent deactivation/reactivation and session revocation.
- Automatic unpublishing on deactivation.
- Moderation queue and review actions.
- Verification and featured controls.
- Reassignment and archival.
- Site settings.
- Immutable audit log.

Exit criteria:
- Admin-only actions are protected.
- At least one active admin invariant is enforced.
- Moderation and audit tests pass.
- Deactivation preserves historical records and unpublishes active listings.

## Phase 7 — Public website and search

Potential task groups:
- Home and public layout.
- Listings search and filter query.
- URL-persisted filters/sorting/pagination.
- Listing detail and gallery.
- Favourites/local storage resilience.
- Similar listings.
- SEO metadata, sitemap, robots and JSON-LD.
- Concept notice and unavailable pages.
- WhatsApp and share actions.

Exit criteria:
- Public users cannot access non-public listings.
- Search/filter requirements pass.
- SEO and social metadata are verified from rendered HTML.
- Mobile and accessibility checks meet targets.

## Phase 8 — Inquiries and email

Potential task groups:
- Inquiry schema and phone normalization.
- Consent, honeypot, rate limiting and duplicate-message protection.
- General contact inquiry.
- Viewing request workflow.
- Agent inquiry management and notes.
- Admin inquiry oversight and CSV export.
- ZeptoMail notification and visitor confirmation.
- Delivery status and retry handling.
- 24-month anonymisation process.

Exit criteria:
- Inquiry persists during simulated email outage.
- Viewing request is not treated as confirmed until agent agreement.
- Agent sees only own inquiries.
- PII retention/anonymisation tests pass.

## Phase 9 — Quality, security and performance

- Unit, integration, API and E2E tests.
- Authorization negative tests.
- Dependency and secret scans.
- CSRF, rate-limit and upload-security tests.
- Accessibility review (keyboard and screen reader plus automated checks).
- Lighthouse performance/SEO/accessibility.
- 4G/mobile testing.
- Database backup and restore drill.
- Error handling and observability review.

Exit criteria:
- Acceptance criteria have evidence.
- Critical/high security issues resolved.
- Performance targets measured and results documented.
- Restore procedure successfully tested.

## Phase 10 — Deployment and portfolio release

- Configure production environment variables.
- Deploy frontend and API.
- Configure domain, HTTPS, cookies, CORS and security headers.
- Configure Cloudinary and ZeptoMail production credentials.
- Run migrations and seed fictional demo content safely.
- Verify concept notices and fictional content.
- Smoke-test all three interfaces.
- Prepare README, architecture diagram, screenshots and demo walkthrough.
- Record known limitations and free-tier behaviour.

Exit criteria:
- Public demo works.
- Admin and agent access are controlled.
- No real personal/property data is presented as genuine.
- Deployment and recovery notes are complete.

## Work management rules

Each task receives an ID, scope, requirement IDs, acceptance criteria, dependencies, test plan and review checklist. Codex receives one bounded task at a time. The developer reviews the diff, runs tests, asks for explanations of unfamiliar code and confirms the result before the next task. Do not let Codex silently change architecture or requirements.

---

# 2. Requirements Traceability

**Purpose:** Trace each requirement from the FRS through design, implementation and verification.  
**Status:** Initial, selective traceability baseline; implementation and test references are not yet assigned. This register is not a claim that every FRS requirement has already been mapped.

## 1. Requirement ID convention

- `FR-PUB-###` — Public website
- `FR-AGT-###` — Agent Portal
- `FR-ADM-###` — Administration Portal
- `FR-LST-###` — Listings and lifecycle
- `FR-INQ-###` — Inquiries and notifications
- `FR-AUTH-###` — Authentication and sessions
- `FR-DATA-###` — Data model and persistence
- `NFR-SEC-###` — Security and privacy
- `NFR-PERF-###` — Performance
- `NFR-A11Y-###` — Accessibility
- `NFR-OPS-###` — Operations, backup and observability
- `NFR-SEO-###` — SEO and discoverability

## 2. Initial traceability register

| ID | Requirement summary | Source area | Planned verification |
|---|---|---|---|
| FR-PUB-001 | Public users can browse only Published and Under Offer listings | FRS 2.3, 3.6, 4.3, 11 | API integration tests for every public listing endpoint |
| FR-PUB-002 | Search filters, sorting, pagination and URL persistence work | FRS 4.3 | API tests and browser E2E tests including back button/new tab |
| FR-PUB-003 | Listing detail includes required facts, agent/contact actions and concept notice | FRS 4.5 | Component/integration and E2E tests |
| FR-PUB-004 | Favourites support up to 100 and tolerate unavailable local storage | FRS 4.7 | Unit and browser tests with storage disabled |
| FR-LST-001 | Listing fields and type-specific validation are enforced | FRS 3.1–3.2 | Schema unit tests and API validation tests |
| FR-LST-002 | Listing reference and slug are unique; published slug remains stable | FRS 3.4 | Database constraint and service tests |
| FR-LST-003 | Images obey format, size, count, cover and signed-upload rules | FRS 3.5, 9.4 | Upload integration tests and negative tests |
| FR-LST-004 | Only allowed status transitions are possible | FRS 3.6–3.7 | Transition matrix unit/API tests |
| FR-LST-005 | Publishing requires valid fields, three images and a cover | FRS 3.8 | Validation tests including complete missing-requirement response |
| FR-LST-006 | Verified and Featured are admin-only | FRS 3.9 | Authorization negative tests |
| FR-LST-007 | Published edits remain staged until admin approval | Approved v1.1 change | Revision workflow E2E test; assert old public version remains visible |
| FR-LST-008 | Agent deactivation unpublishes active listings and preserves history | Approved v1.1 change | Admin E2E test and database assertions |
| FR-INQ-001 | Inquiry fields, phone normalization and consent are validated | FRS 4.8 | Schema/API tests |
| FR-INQ-002 | Inquiry is persisted even if email fails | FRS 4.8, 11 | Fault-injection integration test |
| FR-INQ-003 | Viewing request is not scheduled until agent confirms | Approved v1.1 clarification | E2E workflow test |
| FR-INQ-004 | New inquiry notifications go to agent/admin and visitor if email supplied | Approved planning decision | Email-provider mock/integration tests |
| FR-AGT-001 | Agents can access only own listings and inquiries | FRS 1.5, 5.4–5.5 | Cross-agent API negative tests |
| FR-ADM-001 | Admin can manage agents and moderate listings | FRS 6.1–6.2 | Admin API and E2E tests |
| FR-ADM-002 | Audit log records significant actions and is immutable to users | FRS 6.5 | Audit assertions and authorization tests |
| FR-AUTH-001 | Five failed sign-ins lock account for 15 minutes | FRS 5.1 | Authentication tests with controlled clock |
| FR-AUTH-002 | Sessions expire after 12h idle or 7d absolute and revoke immediately | FRS 5.1, approved session decision | Session service tests and deactivation E2E test |
| NFR-SEC-001 | Protected operations enforce role and ownership on server | FRS 2.3, 8.2, 9.1 | Negative API tests for each protected route group |
| NFR-SEC-002 | Structured input rejects unexpected fields and `$`/dot keys; SQL access is parameterized | FRS 8.2, 9.2, approved clarification | Validation tests and code/security review |
| NFR-SEC-003 | Secrets are not exposed to browser or repository | FRS 9.5, 11 | Build inspection, secret scan and deployment config review |
| NFR-OPS-001 | Independent backup and tested restore procedure exist | Revised FRS 10 | Restore drill with recorded result |
| NFR-OPS-002 | Logs contain no personal data or secrets | FRS 9.6, 10 | Log inspection and automated redaction tests where feasible |
| NFR-PERF-001 | Home/listing LCP ≤2.5s on defined mobile/4G target | FRS 10 | Reproducible Lighthouse/performance test |
| NFR-PERF-002 | 12-item listing response ≤500ms at p95 | FRS 10 | Load/performance test against seeded dataset |
| NFR-A11Y-001 | WCAG 2.1 AA target and Lighthouse accessibility ≥95 | FRS 10 | Automated accessibility checks plus manual keyboard/screen-reader review |
| NFR-SEO-001 | SSR metadata, canonical, sitemap, robots and JSON-LD | FRS 4.11 | HTML/source inspection and crawler/SEO validation |

## 3. Traceability lifecycle

Each requirement progresses through:
`Not started → Analysed → Designed → In progress → Implemented → Testing → Passed`

Additional statuses: `Blocked`, `Deferred`, `Rejected` (only with approved change).

A requirement is not Passed merely because code exists. It needs:
- implementation reference (PR/commit/module);
- test reference;
- observed result or evidence;
- reviewer acceptance.

Security requirements require negative tests (prove unauthorized behaviour is rejected), not just successful-path tests.

## 4. Implementation task template

Every task should include:
1. Task ID and title.
2. Requirement IDs covered.
3. Scope and explicit non-goals.
4. Relevant architecture/decision references.
5. Preconditions and dependencies.
6. Acceptance criteria.
7. Tests to run.
8. Security and privacy checks.
9. Expected files/modules changed.
10. Review notes and evidence.

## 5. Change control

When a requirement changes:
- Record approval and rationale in the architecture/decision register.
- Update `01_REQUIREMENTS_BASELINE_FRS_v1.2.md` and its version/change history as appropriate.
- Update affected IDs and acceptance tests here.
- Update risks and roadmap if schedule or architecture changes.
- Preserve original FRS v1.0 for historical comparison.

---
