# Prime Haven Properties — Master Implementation Roadmap

**Status:** Approved sequence, implementation details subject to the existing project baselines  
**Requirements:** FRS v1.2  
**Purpose:** Coordinate the complete implementation of Prime Haven Properties.

## 1. Project objective

Build a professional fictional Nigerian real-estate listings platform with:

- Public Website
- Agent Portal
- Administration Portal

All property, agent and pricing information must be fictional or properly licensed.

The exact notice `Concept project: listings are fictional` must appear in the footer and on every listing page.

## 2. Approved technology stack

| Layer | Technology |
|---|---|
| Frontend | Next.js + TypeScript |
| Styling | Tailwind CSS |
| Frontend hosting | Vercel |
| Backend | Express + TypeScript |
| Backend hosting | Render |
| Database | PostgreSQL |
| ORM | Prisma |
| Migrations | Prisma Migrate |
| Image storage | Cloudinary |
| Transactional email | ZeptoMail |
| Sessions | PostgreSQL-backed opaque sessions |

Express remains authoritative for authentication, authorization, ownership checks and protected business operations.

The browser must never connect directly to PostgreSQL.

## 3. Implementation phases

### Phase 1 — Requirements and technical planning

**Status: Complete**

Reference documents:

- Project charter.
- FRS v1.2.
- Technical architecture and decisions.
- Delivery roadmap and traceability.
- Risk register.

### Phase 2 — Initial environment foundations

**Status: In progress**

**PH-SETUP-001 — Next.js local foundation and Vercel deployment**

- Create Next.js TypeScript application.
- Configure App Router and Tailwind.
- Establish initial frontend structure.
- Verify local development.
- Verify production build.
- Establish required layouts and dynamic routes.
- Verify metadata and rendering.
- Deploy to Vercel when explicitly authorized.

Current boundary: local setup and verification only. Deployment is pending.

**PH-SETUP-002 — Express local foundation and Render deployment**

- Create Express TypeScript application.
- Establish server structure.
- Configure environment variables.
- Configure logging and error handling.
- Add health endpoint.
- Verify local development.
- Verify production build.
- Deploy to Render when authorized.

**PH-SETUP-003 — PostgreSQL and Prisma foundation**

- Confirm database plan and region.
- Configure PostgreSQL.
- Configure Prisma.
- Establish initial schema.
- Configure migrations.
- Verify database connectivity.
- Document backups and restoration.

**PH-SETUP-004 — Frontend/backend communication design**

- Approved request path: browser application requests use same-origin Next.js route handlers; Next.js calls Express through a server-only HTTPS transport (DEC-027).
- Define final frontend/backend origins and API base URL configuration.
- Define communication and error conventions, including safe upstream status/error propagation.
- Design the cookie ownership/forwarding contract and CSRF/origin-validation controls before implementing authentication.
- Verify the BFF request flow over HTTPS. Browser CORS is not required for the normal same-origin path and does not protect Express from direct callers.
- Decide preview deployment policy and whether any infrastructure/network restrictions on direct Express access are required.

### Phase 3 — Backend domain and API design

**Objective:** establish the data structures, business rules and contracts before implementing major frontend features.

**PH-DESIGN-001 — Domain and database design**

- Users and roles.
- Agent profiles.
- Properties and property-specific attributes.
- Listing revisions.
- Images and upload metadata.
- Favourites where server persistence is required.
- Inquiries and inquiry history.
- Sessions.
- Audit records.
- Site settings.

**PH-DESIGN-002 — API contract design**

- Endpoint groups.
- HTTP methods and route conventions.
- Request and response schemas.
- Validation.
- Pagination.
- Filtering and sorting.
- Error responses.
- Authorization requirements.
- API documentation.

**PH-DESIGN-003 — Business workflow design**

- Authentication and session lifecycle.
- Listing creation and submission.
- Moderation and approval.
- Publishing and unpublishing.
- Agent activation and deactivation.
- Inquiry handling.
- Email notification workflow.
- Image upload lifecycle.
- Archival and retention.

**PH-DESIGN-004 — Security design**

- Authentication and authorization.
- Ownership isolation.
- Session security.
- CSRF controls.
- CORS only if required for a separately approved direct browser/API consumer; never as an authorization boundary.
- Rate limiting.
- Upload restrictions.
- Data retention.
- Audit logging.

Exit criteria: the database model, business workflows and API contracts are sufficiently defined for implementation.

### Phase 4 — Backend implementation

**PH-BE-001 — Backend application foundation**

- Shared utilities.
- Validation conventions.
- Error handling.
- Logging.
- Database access conventions.

**PH-AUTH-001 — Authentication and sessions**

- Password hashing.
- Sign-in.
- Sign-out.
- Current-user endpoint.
- Invitation and acceptance.
- Password reset.
- Failed-login lockout.
- Session expiry and revocation.
- Role and ownership middleware.

**PH-LIST-001 — Listing domain**

- Property creation and retrieval.
- Property updates.
- Listing references and slugs.
- Listing validation.
- Draft and submission workflows.
- Status transitions.
- Published revisions.
- Archival.

**PH-AGENT-001 — Agent operations**

- Agent profile.
- Agent listing management.
- Listing submission.
- Image management.
- Agent-specific inquiry access.

**PH-ADMIN-001 — Administration operations**

- Agent management.
- Moderation.
- Approval and rejection.
- Verification.
- Featured listings.
- Reassignment.
- Site settings.
- Inquiry oversight.
- CSV export.
- Audit logs.

**PH-PUBLIC-001 — Public API**

- Public listing retrieval.
- Search.
- Filtering.
- Sorting.
- Pagination.
- Property detail retrieval.
- Featured properties.
- Similar properties.
- Public settings.
- Sitemap data.

**PH-INQ-001 — Inquiry and email operations**

- General inquiries.
- Viewing requests.
- Persistence.
- Notifications.
- Email delivery.
- Retry handling.
- Rate limiting.
- Duplicate-message protection.
- Retention and anonymisation.

Exit criteria: required backend workflows and API contracts are implemented and tested.

### Phase 5 — Frontend architecture and implementation

**PH-FE-001 — Frontend application structure**

- Public site layout.
- Agent Portal layout.
- Administration Portal layout.
- Route organization.
- Shared components.
- Design system.
- Navigation.
- Responsive foundations.
- Loading, empty and error states.

**PH-PUBLIC-002 — Public Website**

- Homepage.
- Property search.
- Filters.
- Listing cards.
- Property details.
- Property gallery and lightbox.
- Favourites.
- About.
- Contact.
- Privacy Policy.
- Terms.
- Error and unavailable pages.
- Sharing and WhatsApp actions.
- Similar properties.

**PH-AGENT-002 — Agent Portal**

- Dashboard.
- Listing overview.
- Listing creation.
- Listing editing.
- Image uploader.
- Draft preview.
- Submission.
- Listing status.
- Agent profile.
- Inquiry management.

**PH-ADMIN-002 — Administration Portal**

- Dashboard.
- Agent management.
- Agent details.
- Moderation queue.
- Listing review.
- Approval and rejection.
- Verification.
- Featured listing controls.
- Inquiry oversight.
- Site settings.
- Audit log viewer.

**PH-AUTH-002 — Authentication interface**

- Sign-in.
- Invitation acceptance.
- Password reset.
- Session-aware navigation.
- Protected portal access.
- Expired-session handling.

**PH-INQ-002 — Inquiry interface**

- General inquiry forms.
- Viewing request forms.
- Confirmation states.
- Agent inquiry management.
- Administration inquiry management.

Exit criteria: all required interfaces are implemented against the agreed backend contracts.

### Phase 6 — Full-stack integration

- Connect frontend to Express.
- Implement shared API request handling.
- Verify session behaviour.
- Verify authorization.
- Verify property workflows.
- Verify image uploads.
- Verify inquiry delivery.
- Verify email failure handling.
- Verify all portal boundaries.
- Verify public data restrictions.

Exit criteria: the frontend and backend work together without violating the approved architecture.

### Phase 7 — Quality assurance and security

**PH-TEST-001 — Automated testing**

- Unit tests.
- API integration tests.
- Authentication tests.
- Authorization tests.
- Ownership tests.
- Listing workflow tests.
- Inquiry tests.
- Frontend component tests.
- End-to-end tests.

**PH-SEC-001 — Security verification**

- Session security.
- CSRF.
- CORS only for any separately approved direct browser/API consumer; verify that it is not treated as an authorization boundary.
- Input validation.
- Authorization.
- Upload restrictions.
- Rate limiting.
- Secret handling.
- Audit logs.
- Dependency vulnerabilities.

**PH-TEST-002 — Quality and usability**

- Responsive design.
- Accessibility.
- Keyboard navigation.
- SEO.
- Performance.
- Error and empty states.
- Slow-network behaviour.
- Backup and restore testing.

Exit criteria: acceptance criteria are verified, critical security issues are resolved and evidence is recorded.

### Phase 8 — Production release

**PH-RELEASE-001 — Production configuration**

- Vercel frontend.
- Render backend.
- PostgreSQL production database.
- Environment variables.
- HTTPS.
- Approved domain arrangement.
- Cloudinary.
- ZeptoMail.
- Production migrations.
- Fictional demonstration data.

**PH-RELEASE-002 — Final verification**

- Public Website.
- Agent Portal.
- Administration Portal.
- Authentication.
- Listings.
- Search.
- Inquiries.
- Email delivery.
- Concept notices.
- SEO and sitemap.
- Error monitoring.
- Backup and recovery.

**PH-RELEASE-003 — Portfolio documentation**

- README.
- Architecture diagram.
- Database diagram.
- API documentation.
- Screenshots.
- Deployment links.
- Demonstration guide.
- Known limitations.
- Future improvements.

## 4. Task execution rules

Every task must have:

- A unique task ID.
- A clear objective.
- Scope and non-goals.
- Dependencies.
- Relevant requirements.
- Expected deliverables.
- Acceptance criteria.
- Verification steps.

Codex must work on one explicitly assigned task at a time.

The workflow is:

1. Inspect.
2. Explain the plan.
3. Obtain approval where required.
4. Implement.
5. Test.
6. Review the diff.
7. Report.
8. Obtain project-owner acceptance.
9. Commit and push when approved.
10. Move to the next task.

## 5. Architecture decisions that must remain visible

The browser-to-Express versus Next.js-server-mediated request-path choice is resolved by DEC-027 in favour of Next.js server-mediated communication (BFF). Implementation, final origins and dependent cookie/CSRF settings remain to be designed and validated.

Other dependent decisions include:

- Frontend and backend origins.
- Cookie configuration.
- CORS only if required for a separately approved direct browser/API consumer.
- CSRF.
- Database plan and region.
- Connection pooling.
- Backup strategy.
- Email retry implementation.

Consult the technical architecture and decision register before implementing affected functionality.

## 6. Current execution status

| Work item | Status |
|---|---|
| Requirements and technical planning | Complete |
| Local Git repository | Complete |
| Next.js scaffolding | Complete |
| Local development server verification | Complete |
| Core frontend file inspection | In progress |
| Frontend local foundation acceptance | Pending |
| Vercel deployment | Pending |
| Express foundation | Not started |
| PostgreSQL and Prisma | Not started |
| Backend domain/API design | Not started |
| Feature implementation | Not started |
| Full-stack integration | Not started |
| Quality assurance | Not started |
| Production release | Not started |

## 7. Completion principle

The project is complete only when the approved FRS v1.2 requirements have been implemented or formally deferred, all three interfaces work, security and ownership controls are verified, integrations operate reliably, deployment is stable and the project owner has accepted the evidence.

This roadmap is a coordination document, not permission for autonomous bulk implementation. Codex must execute one approved task at a time.