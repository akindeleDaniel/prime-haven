# Prime Haven Properties - AI Development Instructions

## 1. Authority and task boundary

Fictional Nigerian portfolio platform: Public Website, Agent Portal, Administration Portal. The owner controls product scope, major architecture changes, code review and acceptance. Work only on the assigned task and stop for review; never automatically begin the next roadmap task.

Read applicable nested AGENTS.md and relevant references:

- docs/PRIME_HAVEN_APPROVED_SCOPE_DECISIONS.md: explicit REV-001 through REV-038 approvals.
- docs/00_PROJECT_CHARTER_AND_SCOPE.md: scope and identity.
- docs/01_REQUIREMENTS_BASELINE_FRS_v1.2.md: current FRS and acceptance criteria.
- docs/02_TECHNICAL_ARCHITECTURE_AND_DECISIONS.md: architecture/history/gates.
- docs/03_DELIVERY_ROADMAP_AND_TRACEABILITY.md: requirement and REV coverage.
- docs/04_PROJECT_RISK_REGISTER.md: risks.
- docs/05_MASTER_IMPLEMENTATION_ROADMAP.md: canonical task IDs/dependencies/status.
- docs/06_BACKEND_DOMAIN_MODEL.md and docs/07_PHYSICAL_DATABASE_DESIGN.md: logical/physical design.

The existing FRS filename is retained; its internal version and changelog identify the current baseline. Use Git for prior tracked versions; do not create duplicate versions or history directories. Never revive superseded requirements or infer approval from an AI proposal. Report genuine conflicts. Make ordinary technical decisions independently using professional secure engineering; explain important trade-offs. Obtain approval for new features, significant business-rule changes, major architecture changes or alternative frameworks/providers. Avoid overengineering and unnecessary approval gates.

## 2. Model and context guidance

Before each task, briefly recommend an appropriate available model and reasoning effort, using this owner guidance where available:

| Task | Model / reasoning |
|---|---|
| Standard development / default | GPT-6.1 Sol Medium |
| Complex implementation or technical planning/review | GPT-6.1 Sol High |
| Critical engineering, difficult debugging, security | GPT-6 Astra High |
| Visual or screenshot tasks | GPT-6.1 Terra Medium |
| Simple edits/documentation | GPT-6 Luna Low or Medium |

Do not claim automatic switching or unverified availability. If unavailable, recommend the closest available model. Keep recommendations short for trivial tasks. Before substantial work recommend continuing or starting a new conversation according to scope/context; do not require a reset unnecessarily. Preserve accepted decisions, task boundary, progress, blockers and evidence during handoffs. Treat new messages as steering unless the owner replaces the task; do not repeat completed audits.

## 3. Approach, code quality and learning

Before implementation inspect the task, relevant requirements, code, dependencies and existing work. Explain understanding, proposed approach, expected files, risks/assumptions and verification plan before editing.

Use understandable typed code, meaningful names, appropriate modules and consistent organization. Avoid unnecessary dependencies/abstractions, duplicated logic, unjustified any types, hardcoded secrets, silent failures, unrelated refactors and unexplained configuration changes. Preserve useful instructions and existing work.

Explain unfamiliar concepts, important changes and trade-offs in plain English with project examples. Help the developer understand and maintain the code; generated code is not proof of correctness. Record significant technical choices in the appropriate project document without inventing requirements.

## 4. Architecture, frontend, backend and security

- Approved stack: Next.js App Router/TypeScript/Tailwind on Vercel; Express/TypeScript on Render; Render PostgreSQL; Prisma/Migrate; Cloudinary; ZeptoMail; PostgreSQL opaque sessions. Cloudflare/vinext are cancelled.
- DEC-027: browser -> same-origin Next.js route handlers -> server-only HTTPS Express. No unrestricted generic proxy. Express independently owns authentication, role/current ownership and business rules, including direct API calls. BFF/CORS are not authorization boundaries.
- Never expose database access, credentials or private keys to frontend code. Validate untrusted input and reject unexpected fields server-side. Use parameterized queries/safe ORM; distrust browser role, ownership and asset claims.
- Follow reviewed cookie/forwarding/CSRF design before authentication. Retain secure password hashing, expiry/revocation, rate limits and content/metadata/ownership checks for uploads. Never weaken protections for convenience or log credentials/tokens/unnecessary PII.
- Keep routes/controllers/services/validation/persistence responsibilities clear, business rules out of route definitions, errors consistent and untrusted content plain text. Recheck current ownership on sensitive operations and reassignment races.
- Frontend: accessible semantic HTML, responsive layouts, reusable components where useful, appropriate server/client separation, loading/empty/error/unavailable states, image optimization and public metadata/SEO. Use reviewed API contracts rather than assumed response shapes.
- Database: preserve integrity, appropriate constraints/indexes, transactions and applied migration history. Review migration effects and back up before risk; no destructive operations without approval, no casual production edits or committed credentials. Use least-privileged application access.
- Fictional/licensed content only. Exact notice "Concept project: listings are fictional" appears in footer and every listing page.
- Prefer free/low-cost hosting, verify provider limits before deployment and never purchase without approval.

## Mandatory Figma-First Frontend Workflow

Every user-facing page, interface, dashboard and significant UI component must follow this process:

### Step 1 — Understand requirements

Review the approved requirements, target users, functionality and relevant API contracts.

### Step 2 — Design in Figma

Use the Figma plugin to create a professional, editable design before writing frontend UI code.

Consider:

- Desktop and mobile layouts.
- Visual hierarchy and typography.
- Consistent colours and components.
- Accessibility and responsiveness.
- Loading, empty, error and success states where applicable.

### Step 3 — Product-owner review

Present the Figma design link and briefly explain the design choices.

Stop and wait for explicit product-owner approval.

### Step 4 — Design refinement

Apply requested corrections in Figma and obtain approval before implementation.

### Step 5 — Implementation

Only after approval:

- Translate the approved Figma design into Next.js and TypeScript.
- Reuse existing shared components.
- Integrate the required backend APIs.
- Preserve the approved design and functionality.

### Step 6 — Verification

Compare the implemented interface against the approved Figma design. Verify responsiveness, accessibility, functionality and visual consistency.

### Mandatory restrictions

- Never implement an unapproved frontend design.
- Never generate an entire frontend without individual page or clearly scoped page-group approval.
- Do not make significant visual changes to approved designs without permission.
- If the Figma plugin is unavailable, do not bypass the approval process.
- Backend implementation and non-visual server-side integration may proceed independently.
- Do not create additional planning documents for this workflow.

This rule applies throughout the entire Prime Haven project, including the Public Website, Agent Portal and Administration Portal.

## 5. Verification, documentation and reporting

Verify assigned acceptance criteria and inspect the diff; run task-relevant checks when requested/authorized. Choose unit/integration/security tests, lint, type checks/build according to scope. Documentation work needs consistency/reference checks, not unrelated application execution. Never claim planned tests passed, code is proven or work is owner-accepted without evidence.

Report changes/files, significant decisions, commands/checks and actual results, security effects, existing versus new failures, unverified assumptions/blockers and the smallest next action. Explain unavailable checks. Distinguish planned, implemented, verified and owner-accepted work; final acceptance belongs to the owner. Update affected requirements/decisions/risks/traceability/status when authorized changes require it.

## 6. Git discipline

Suggest focused Conventional Commit messages when relevant, for example feat(auth): implement session revocation or docs: synchronize approved scope. Preserve unrelated work and historical records.

**Never commit or push without explicit authorization.** Do not merge, reset, rebase or delete branches without instruction. Deployment, purchases and risky migrations need appropriate authorization. Stop at the assigned task boundary.
