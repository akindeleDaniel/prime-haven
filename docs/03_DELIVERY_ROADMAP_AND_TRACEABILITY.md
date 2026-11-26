# Prime Haven Properties - Delivery and Requirements Traceability

**Baseline:** [FRS v1.3](01_REQUIREMENTS_BASELINE_FRS_v1.2.md) / [approved scope record](PRIME_HAVEN_APPROVED_SCOPE_DECISIONS.md)

**Status:** Scope audit complete; synchronized documentation prepared for review. Entries below are planned coverage, not implementation/test evidence.

## 1. Delivery coordination

[DOC-05](05_MASTER_IMPLEMENTATION_ROADMAP.md) is the sole task/phase/status register. This file owns requirement IDs, REV coverage and planned verification. Preserve previous requirement IDs; update their meaning only for explicit approved supersession. Retired revision/unread/CSV/banner mechanisms have no active implementation tasks.

Canonical sequence: foundations -> domain/API/workflow/security design -> backend -> frontend -> integration -> quality -> release. API/workflow/security design can progress while deployment validation remains pending. Task-level dependencies in DOC-05 control execution; no automatic next task.

PH-DESIGN-001 covers DOC-06/07. PH-DESIGN-002 means API contracts; PH-DESIGN-003 means workflows; PH-DESIGN-004 means security. Future Prisma implementation is PH-DATA-001. Prior conflicting labels and original phase numbering remain only in history.

## 2. Requirement ID conventions and active coverage

FR-PUB/AGT/ADM/LST/INQ/AUTH/DATA identify functional requirements. NFR-SEC/PERF/A11Y/OPS/SEO identify quality requirements. References below use current FRS section numbers. Existing selective IDs are retained and supplemented; full acceptance is FRS Section 13, not just this table.

| ID | Active requirement / FRS source | Implementation task(s) | Planned verification |
|---|---|---|---|
| FR-PUB-001 | Eligible public listings; unavailable/private distinction; 4.6, 5.3-5.5 | PH-PUBLIC-001, PH-PUBLIC-002 | Search/detail/direct-ID/SSR/sitemap/metadata/cache negative checks |
| FR-PUB-002 | Filters, all-selected amenities, keyword, sort, 12/page, total, URL/back, Clear Filters; 4.3, 5.3 | PH-PUBLIC-001, PH-PUBLIC-002 | Query-builder/API/browser tests with stable ordering |
| FR-PUB-003 | Detail/gallery/captions/facts/agent/WhatsApp/share/similar/notice; 5.4, 5.9 | PH-PUBLIC-002 | Component/E2E/keyboard/social preview inspection |
| FR-PUB-004 | Local favourites <=100, graceful storage failures, remove unavailable; 5.6 | PH-PUBLIC-002 | Disabled storage/cap/unavailable browser checks |
| FR-PUB-005 | Approximate session views without visitor-marker persistence; 5.4 | PH-PUBLIC-001, PH-PUBLIC-002 | Browser repeat prevention and concurrent atomic increments |
| FR-LST-001 | Fields/address privacy/type-specific completeness; 4.1-4.3 | PH-LIST-001 | Partial Draft versus submission, conditional/type-change tests |
| FR-LST-002 | Unique reference/first-publication slug/date stability; 4.4, 4.8 | PH-LIST-001 | Concurrent creation and publication/edit/republication checks |
| FR-LST-003 | Image content/type/5,000,000 bytes/count/cover/caption/alt/signing/ownership/cleanup; 4.5, 9.4 | PH-LIST-001 | Boundary/corrupt/spoofed upload, cross-owner, orphan and concurrent gallery/cleanup tests |
| FR-LST-004 | Allowed transitions and stale-write protection; 4.6-4.8 | PH-LIST-001, PH-ADMIN-001 | Transition matrix and competing edit/approve/reassign tests |
| FR-LST-005 | Submit complete content + 3-15 verified images/cover; 4.9 | PH-LIST-001, PH-AGENT-002 | Missing-requirements response and atomic submission tests |
| FR-LST-006 | Admin-only Verified and global 0-6 Featured; 4.10 | PH-ADMIN-001, PH-ADMIN-002 | Role, cross-field metadata, seventh-selection race, zero/eligibility tests |
| FR-LST-007 | Valid Published/Under Offer agent edits enter review/unavailable; no separate revisions; 4.8 | PH-LIST-001, PH-AGENT-002, PH-ADMIN-001 | Form/invalid input unchanged; valid submit atomic; no earlier-content restoration on rejection |
| FR-LST-008 | Normal reassignment, urgent deactivation, current inquiry ownership; 7.1 | PH-ADMIN-001, PH-AUTH-001, PH-INQ-001 | Revocation, stale access/recipient tests, status/history preservation |
| FR-LST-009 | Manual partial Draft, private preview, duplicate without images; 6.4 | PH-LIST-001, PH-AGENT-002 | Invalid supplied values, unsaved warning, private cache and clean-duplicate assertions |
| FR-LST-010 | Never-published/no-dependent-business permanent deletion; 4.11 | PH-LIST-001 | Restrictive inquiry FK, delete/create race, audit preservation and cleanup recovery |
| FR-INQ-001 | Required contact/email/message/consent, phone normalization, viewing window, anti-spam; 5.7 | PH-INQ-001, PH-INQ-002 | Validation/rate/honeypot/10-minute duplicate concurrency tests |
| FR-INQ-002 | Persist inquiry independent of email; 5.7-5.8 | PH-INQ-001 | Outage and post-commit interrupted-send tests |
| FR-INQ-003 | Close any status, reopen Contacted, Viewing Scheduled by agreement, private notes; 6.5 | PH-INQ-001, PH-INQ-002 | Transition/ownership/notes tests; no unread state |
| FR-INQ-004 | Current agent/admin/visitor recipients, simple status/admin retry; 5.8 | PH-INQ-001, PH-ADMIN-002 | General/property recipients, no former-owner retry, concurrent retries and uncertain outcome |
| FR-AGT-001 | Current owner only for listings/inquiries/notes/profile; 6.3-6.6 | PH-AGENT-001, PH-AGENT-002 | Cross-agent/stale request negative tests; dashboard/profile checks |
| FR-ADM-001 | Agent management/moderation/reassignment; 7.1-7.2 | PH-ADMIN-001, PH-ADMIN-002 | Oldest submittedAt queue, validated direct edit, deactivation/admin invariant |
| FR-ADM-002 | Simple significant audit/user immutability >=12 months; 7.5 | PH-ADMIN-001, PH-ADMIN-002 | Event/reference/PII checks and update/delete denial |
| FR-ADM-003 | Inquiry oversight and limited settings; 7.3-7.4 | PH-ADMIN-001, PH-ADMIN-002 | Filters, public settings projection, fixed-branding rejection; no CSV/banner |
| FR-AUTH-001 | Five failures/15-minute lockout; 6.1 | PH-AUTH-001, PH-AUTH-002 | Concurrent failures and controlled-clock lockout |
| FR-AUTH-002 | Opaque hashed sessions, 12h idle/7d absolute, immediate revocation; 6.1 | PH-AUTH-001, PH-SETUP-004 | Expiry, delayed requests, cookie/CSRF and deactivation tests |
| FR-AUTH-003 | Bootstrap/invite 48h/reset 30m/password change/self-service; 6.1-6.2, 7.1 | PH-AUTH-001, PH-AUTH-002 | Single-use/resend/token races, enumeration protection, password reset revocation |
| FR-DATA-001 | Relational entities/FKs/transactions/forward migrations; 3, 8 | PH-DATA-001 | SQL/migration review and integrity checks, preserve applied history |
| NFR-SEC-001 | Server authorization/current ownership; 8, 9.1 | PH-AUTH-001, PH-SEC-001 | Negative checks for every route, direct Express and BFF |
| NFR-SEC-002 | Unexpected/$/dot structured keys rejected; safe SQL/plain text; 8, 9.2 | PH-BE-001, PH-SEC-001 | Schemas, parameterization and safe rendering review; allow normal text punctuation |
| NFR-SEC-003 | Secrets/transport/headers/dependencies; 9.5-9.6 | PH-SEC-001, PH-RELEASE-001 | Client/build/log secret inspection, HTTPS/CSP/HSTS and dependency review |
| NFR-SEC-004 | BFF cookie/CSRF, rate limits and safe uploads; 9.3-9.4 | PH-DESIGN-004, PH-SETUP-004, PH-SEC-001 | Legitimate/hostile-origin requests, forwarding and abuse tests |
| NFR-SEC-005 | 24-month contact/text/note/delivery anonymisation, verified deletion; 9.6 | PH-INQ-001 | Cleanup/send/reassignment/restore races and non-identifying audit |
| NFR-OPS-001 | Independent backups and tested restoration; 10 | PH-SETUP-003, PH-TEST-002 | Dated restore drill, access restrictions, privacy/notification reconciliation |
| NFR-OPS-002 | Errors/logs without PII/secrets; 10 | PH-BE-001, PH-SEC-001 | Sanitized logs/provider errors; recovery visibility |
| NFR-OPS-003 | Low-cost hosting, verified limitations/no purchase; 10 | PH-SETUP-001, PH-SETUP-002, PH-SETUP-003, PH-RELEASE-001 | Dated provider evidence and explicit purchase approval if needed |
| NFR-PERF-001 | LCP <=2.5s, Lighthouse mobile >=90, initial ~1MB; 10 | PH-TEST-002 | Reproducible mobile/4G method, device, data and cold/warm results |
| NFR-PERF-002 | 12-result response <=500ms p95; 10 | PH-PUBLIC-001, PH-TEST-002 | Documented dataset/load and end-to-end boundary |
| NFR-A11Y-001 | WCAG 2.1 AA target, Lighthouse accessibility >=95, mobile/browser support; 10 | PH-FE-001, PH-TEST-002 | 360px, keyboard/screen reader, browser and automated checks |
| NFR-SEO-001 | Public SSR/meta/canonical/OG/Twitter/JSON-LD/sitemap/robots, SEO >=95; 5.10, 10 | PH-PUBLIC-002, PH-TEST-002 | Rendered HTML/crawler/social checks, private exclusion |
| FR-DATA-002 | Fictional/licensed content, notice, ~24 listings/4 cities/all types/3 agents/1 admin/~30 inquiries; 1, 10 | PH-RELEASE-001, PH-RELEASE-003 | Seed/license/notice inspection and demo review |

## 3. Complete approved-decision coverage

All rows below are product-owner approvals from the consolidated record. Engineering details are proposals within that scope; mapped tests remain planned.

| Decision | Current FRS section | Requirement IDs | Task focus |
|---|---|---|---|
| REV-001 | 4.1, 5.4 | FR-LST-001 | Listing fields/public detail |
| REV-002 | 4.1, 9.1, 13 | FR-LST-001, FR-PUB-001 | Address privacy across all public projections |
| REV-003 | 4.5 | FR-LST-003, FR-PUB-003 | Visible captions |
| REV-004 | 4.5, 10 | FR-LST-003, NFR-A11Y-001 | Meaningful alt/caption default |
| REV-005 | 5.5, 6.4 | FR-LST-009 | Authorized private preview |
| REV-006 | 4.10 | FR-LST-006 | Global 0-6 selection; no display setting |
| REV-007 | 5.7-5.8 | FR-INQ-001, FR-INQ-004 | Required inquiry email |
| REV-008 | 4.8, 7.2 | FR-LST-007 | One listing review workflow/admin direct edit |
| REV-009 | 4.8, 4.10 | FR-LST-006, FR-LST-007 | Separate Verified/material-change reset |
| REV-010 | 6.4 | FR-LST-009 | Manual partial Draft/unsaved warning |
| REV-011 | 4.2 | FR-LST-001 | Conditional fields |
| REV-012 | 7.1 | FR-LST-008 | Reassign before normal deactivation |
| REV-013 | 5.5 | FR-PUB-001 | Previously public unavailable vs private 404 |
| REV-014 | 6.5 | FR-INQ-003 | Statuses/reopening/private notes |
| REV-015 | 6.5 | FR-INQ-003 | No unread persistence/UI |
| REV-016 | 5.8 | FR-INQ-002, FR-INQ-004 | Required simple notifications |
| REV-017 | 5.4 | FR-PUB-005 | Approximate browser/session count |
| REV-018 | 4.11 | FR-LST-010 | Never-published deletion eligibility |
| REV-019 | 9.6 | NFR-SEC-005 | Full identifying-data cleanup |
| REV-020 | 7.3, 12 | FR-ADM-003 | CSV deferred |
| REV-021 | 6.1-6.2, 7.1 | FR-AUTH-003, FR-ADM-001 | Simplified accounts/last admin |
| REV-022 | 7.4, 12 | FR-ADM-003 | Limited settings/banner deferred |
| REV-023 | 6.4 | FR-LST-009 | Duplicate information only |
| REV-024 | 7.5 | FR-ADM-002 | Simple significant audit |
| REV-025 | 4.5, 5.3 | FR-LST-003, FR-PUB-002 | Clear Filters/safe media cleanup |
| REV-026 | 4.5, 5.2-5.3, 5.10, 7.2, 10 | FR-LST-002, FR-LST-003, FR-ADM-001, NFR-PERF-001, NFR-PERF-002, NFR-SEO-001 | Exact bytes/order/SEO; README at release |
| REV-027 | 4.8 | FR-LST-007 | Unavailable on valid submission only |
| REV-028 | 4.8, 6.4 | FR-LST-005, FR-LST-007 | Complete existing public edits |
| REV-029 | 7.1 | FR-LST-008 | Reassignment alone preserves status |
| REV-030 | 7.1 | FR-LST-008, FR-AUTH-002 | Urgent access revocation/unpublication |
| REV-031 | 5.8, 6.5, 7.1 | FR-LST-008, FR-INQ-004, FR-AGT-001 | New owner inquiry/recipient responsibility |
| REV-032 | 4.8, 4.10, 5.6 | FR-LST-002, FR-LST-006, FR-LST-007, FR-PUB-004 | Featured/favourites/original publication date |
| REV-033 | 4.11, 7.5 | FR-LST-010, FR-ADM-002 | Restrictive business deps, cleanup/audit survival |
| REV-034 | 6.5 | FR-INQ-003 | Close/reopen/agreed viewing |
| REV-035 | 10 | NFR-OPS-003 | Verify low-cost providers/no purchases |
| REV-036 | 5.8 | FR-INQ-004 | Authorized manual retry |
| REV-037 | 4.8 | FR-LST-007 | Same Under Offer edit review |
| REV-038 | 4.2 | FR-LST-001 | Validated text Land title description |

## 4. Evidence and task template

Each task records ID/objective; relevant FRS sections/requirement IDs/REV approvals; scope/non-goals; dependencies; expected files; approach/risks; acceptance criteria; verification plan; and actual commands/results/reviewer outcome.

Progress: planned -> designed -> in progress -> implemented -> verified -> owner-accepted. Deferred/rejected require scope authority; blocked requires a specific blocker. Neither a traceability row, generated code, a commit nor a planned test counts as verification. Security needs negative tests, not only happy paths. No implementation/test references are invented by this update.

## 5. History and change control

Git preserves earlier tracked DOC-03 versions; DOC-05 records task/phase reconciliation. Update this coverage, active FRS, DOC-02, risks and canonical tasks together for approved changes. Do not rewrite Git history or create duplicate planning versions/directories. No implementation, migration, deployment, commit or push is authorized here.
