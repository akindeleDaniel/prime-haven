# Prime Haven Properties — AI Development Instructions

## 1. Project identity

Prime Haven Properties is a fictional Nigerian real-estate listings platform.

The project has three main interfaces:

1. Public Website
2. Agent Portal
3. Administration Portal

The project owner is responsible for product decisions, architecture approval, code review and task acceptance.

Codex is the primary coding assistant. It must work as an implementation assistant under the direction of the project owner.

## 2. Mandatory project references

Before implementing a task, inspect the relevant project documentation.

The following documents are the authoritative project references:

- `docs/00_PROJECT_CHARTER_AND_SCOPE.md`
- `docs/01_REQUIREMENTS_BASELINE_FRS_v1.2.md`
- `docs/02_TECHNICAL_ARCHITECTURE_AND_DECISIONS.md`
- `docs/03_DELIVERY_ROADMAP_AND_TRACEABILITY.md`
- `docs/04_PROJECT_RISK_REGISTER.md`
- `docs/05_MASTER_IMPLEMENTATION_ROADMAP.md`

If the documents are stored somewhere other than `docs/`, locate their actual paths before proceeding.

### Document authority

- The project charter defines the approved project scope.
- FRS v1.2 is the current functional and non-functional requirements baseline.
- The architecture document defines approved technical decisions and records unresolved decisions.
- The delivery roadmap defines the original delivery plan and traceability.
- The risk register identifies known risks and mitigations.
- The master implementation roadmap organizes the implementation sequence.

Do not silently change, reinterpret or override approved requirements.

If documents conflict or an important detail is missing, stop and report the conflict to the project owner.

## 3. Implementation scope

Work only on the task explicitly assigned by the project owner.

Do not independently implement future roadmap phases.

Do not expand the scope because an additional feature appears useful.

Before implementation:

1. Read the assigned task.
2. Inspect relevant requirements.
3. Inspect the existing codebase.
4. Identify dependencies and assumptions.
5. Present an implementation plan.
6. Identify expected files and tests.

If the task requires an unresolved architectural decision, report it instead of guessing.

## 4. Technology constraints

Follow the approved technology stack:

- Next.js and TypeScript for the frontend.
- Tailwind CSS for styling.
- Express and TypeScript for the backend.
- PostgreSQL for persistence.
- Prisma ORM and Prisma Migrate.
- Vercel for frontend hosting.
- Render for backend and database hosting.
- Cloudinary for image storage.
- ZeptoMail for transactional email.
- PostgreSQL-backed opaque sessions.

Do not introduce alternative frameworks, hosting providers, ORMs or architectural patterns without approval.

Cloudflare Workers and vinext are cancelled historical proposals. Do not revive them.

## 5. Architecture and security rules

- Express is authoritative for authentication, authorization, role checks, ownership checks and protected business operations.
- The browser must never connect directly to PostgreSQL.
- Never expose database credentials, private API keys or server secrets to frontend code.
- Validate untrusted input on the server.
- Enforce authorization on the backend, not only in the frontend.
- Enforce ownership checks for agent-owned resources.
- Use secure password hashing and approved session management.
- Follow the approved cookie, CORS and CSRF design once finalized.
- Never weaken security controls to make a feature work more easily.
- Do not log passwords, tokens, secrets or unnecessary personal information.

The browser-to-Express versus Next.js-server-mediated API request path is unresolved. Do not make assumptions about this decision when implementing authentication, cookies, CORS or CSRF.

## 6. Code quality

Write code that is:

- Understandable.
- Maintainable.
- Modular where appropriate.
- Consistent with the existing architecture.
- Properly typed.
- Easy to test.
- Secure by default.

Prefer simple solutions over unnecessary abstraction.

Use meaningful names and consistent file organization.

Avoid:

- Unnecessary dependencies.
- Duplicated business logic.
- Excessive component complexity.
- Unnecessary `any` types.
- Hardcoded secrets.
- Silent error handling.
- Large unrelated refactors.
- Unexplained configuration changes.

Do not modify unrelated files.

## 7. Frontend rules

- Use the Next.js App Router.
- Use TypeScript.
- Use Tailwind CSS as the primary styling approach.
- Keep components reusable where doing so improves maintainability.
- Keep server and client components appropriately separated.
- Use accessible semantic HTML.
- Provide responsive layouts.
- Handle loading, empty, error and unavailable states.
- Use Next.js image capabilities appropriately.
- Keep metadata and SEO requirements in view.

Do not assume backend response structures. Use approved API contracts.

## 8. Backend rules

- Use Express and TypeScript.
- Keep routes, controllers, services, validation and persistence responsibilities organized.
- Validate incoming requests.
- Use consistent response and error conventions.
- Enforce authentication, authorization and ownership.
- Keep business rules in appropriate backend layers.
- Avoid placing business logic directly inside route definitions.
- Never trust frontend-supplied role or ownership information.

## 9. Database rules

- Use PostgreSQL and Prisma.
- Use Prisma Migrate for schema changes.
- Preserve relational integrity.
- Define appropriate constraints and indexes.
- Avoid destructive schema changes without explicit approval.
- Never modify production data casually.
- Never commit database credentials.
- Explain migrations and their impact before applying risky changes.

## 10. Fictional content and licensing

All property, agent, pricing and image content must be fictional or properly licensed.

The exact notice:

"Concept project: listings are fictional"

must appear in the footer and on every listing page.

Never present fictional listings as genuine properties available for sale or rent.

## 11. Testing and verification

Every task must include appropriate verification.

Depending on the task, run:

- Relevant unit tests.
- Relevant integration tests.
- ESLint.
- TypeScript checks.
- Production build.
- Security-related tests.

Do not claim tests passed unless they were actually executed successfully.

If a test cannot be run, explain why.

Report existing failures separately from failures introduced by the task.

## 12. Required task workflow

### Before implementation

Provide:

- Understanding of the task.
- Relevant requirements.
- Proposed approach.
- Expected files to change.
- Dependencies.
- Risks.
- Verification plan.

### During implementation

- Work only within the approved scope.
- Keep changes focused.
- Avoid unnecessary refactoring.
- Explain significant implementation decisions.

### After implementation

Provide:

1. Summary of changes.
2. Files created, modified or deleted.
3. Important implementation decisions.
4. Commands executed.
5. Test, lint and build results.
6. Security considerations.
7. Outstanding issues.
8. Recommended next action.

Do not automatically begin the next roadmap task.

Wait for the project owner's review and approval.

## 13. Git discipline

Use small, meaningful commits.

Follow Conventional Commits where appropriate.

Examples:

- `chore(frontend): scaffold next.js application`
- `feat(auth): implement agent sign-in`
- `feat(listings): add listing submission workflow`
- `fix(inquiries): handle email delivery failures`
- `test(auth): verify session revocation`
- `docs: update deployment instructions`

Do not commit unrelated changes.

Do not push, merge, reset, rebase or delete branches without the project owner's instruction.

Never overwrite existing work without inspecting it first.

## 14. Human approval requirement

The project owner must understand and review significant implementation changes.

Do not treat AI-generated code as automatically correct.

Do not mark a task complete simply because code has been generated.

A task is complete only after its acceptance criteria have been verified and the project owner has accepted the result.

**Final rule: Read the project, understand the assigned task, implement only the approved scope, verify your work and report honestly.**