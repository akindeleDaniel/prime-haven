# Prime Haven Properties — Project Risk Register

**Document type:** Project risk register

**Status:** Initial planning risk baseline; risks have not been closed through implementation evidence

**Project:** Fictional Nigerian real-estate listings platform

**Requirements baseline:** [FRS v1.3](01_REQUIREMENTS_BASELINE_FRS_v1.2.md), REV-001 through REV-038

Likelihood and impact values are qualitative planning estimates, not measured probabilities. Review them as provider plans, architecture and implementation become concrete.

---

# 1. Risk Register

**Status:** Initial planning risk baseline

| ID | Risk | Likelihood | Impact | Mitigation / response | Trigger / review |
|---|---|---|---|---|---|
| R-001 | Vercel plan eligibility, usage limits or pricing do not fit the intended portfolio/demo use | Medium | Medium | Confirm current plan terms, included usage and project eligibility before deployment; monitor usage; prioritize free/low-cost approved hosting, require owner approval before purchases; do not assume free hosting is suitable for commercial use | Before deployment and before public portfolio release |
| R-002 | Frontend/API domain or origin configuration is incorrect, disrupting the approved BFF path or exposing unintended browser/API access | Medium | High | Decide final hostnames and origins; verify browser requests use same-origin Next.js routes and Next.js-to-Express uses HTTPS. Browser CORS is not required for the normal BFF path and is not an authorization boundary. If a separate direct browser/API consumer is approved, use an explicit origin allowlist, never wildcard origins with credentials, and validate that flow independently. | During frontend/API deployment and transport validation |
| R-003 | Render API sleep, availability or cold-start limitations disrupt the demo | Provider-dependent; verify | Medium | Check actual current sleep/availability limits; test cold/warm requests; document limits; purchase only with owner approval | Before public demo |
| R-004 | Render PostgreSQL availability, connection limits or plan constraints affect the demo | Medium | Medium/High | Confirm current plan limits; configure connection handling/timeouts; monitor database availability and connection usage; test recovery behaviour | Backend integration and before launch |
| R-005 | Render PostgreSQL backup or restore capability is insufficient for recovery needs | Medium | High | Verify provider backup/restore options; maintain independent exports; document and test restoration | Before database integration and every major migration |
| R-006 | Database data loss or destructive migration | Low/Medium | High | Independent exports, pre-migration backup, migration review, restore drills | Every major migration; before acceptance |
| R-007 | Database/API region mismatch increases latency | Medium | Medium | Place the Render API and Render PostgreSQL database in the same or compatible region where possible; measure end-to-end latency | Deployment design |
| R-008 | Session-cookie handling across the BFF or CSRF enforcement is misconfigured, causing session failures or enabling cross-site request forgery | Medium | High | Define one reviewed cookie creation/forwarding/refresh/rotation/revocation contract for the final origins; do not blindly forward Express `Set-Cookie` across origins. Select cookie Domain, Path, Secure, HttpOnly and SameSite attributes; define CSRF and origin-validation strategy and test legitimate and hostile requests. Same-origin BFF routing does not eliminate CSRF risk. | Session/authentication implementation and security testing |
| R-009 | Cross-agent data exposure | Medium | Critical | Centralized ownership checks in Express; deny-by-default; negative API tests | Every protected endpoint |
| R-010 | Email provider outage causes lost inquiries | Medium | High | Commit inquiry and simple per-recipient pending notification state first; admin manual retry; guard concurrent sends, recover uncertain outcomes and avoid former-owner recipients | Inquiry implementation |
| R-011 | Cloudinary asset deletion fails and leaves orphaned files | Medium | Low/Medium | Track owned uploads including unverified orphans; parent/asset locking; recover remote cleanup failures; never reuse retired asset IDs | Image lifecycle implementation |
| R-012 | Fake sample listings mistaken for genuine properties | Medium | High | Fictional/licensed content only; exact concept notice in footer and listing pages; clear portfolio framing | Content review |
| R-013 | Manual moderation becomes bottleneck | Medium | Medium | Keep scope bounded for demo; moderation queue filters and clear review criteria; document future risk-based model | Demo population grows |
| R-014 | Admin approval interpreted as property valuation | Medium | High | Explicit review standard; distinguish approval from Verified; avoid valuation claims | Admin UX/content review |
| R-015 | PII leaks through logs, audit summaries or notes | Medium | High | Log redaction; avoid storing PII in summaries; no CSV export; include free text, notes and delivery data in anonymisation; cancel pending sends; test logs and privacy races | Security review |
| R-016 | 24-month anonymisation fails or removes too much | Medium | High | Bounded idempotent 24-month cleanup of contact/text/note/delivery data; deterministic removal rather than claimed perfect PII detection; non-identifying audit; reconcile restored backups and interrupted sends | Before production acceptance |
| R-017 | AI-generated code is accepted without sufficient understanding/review | Medium | High | Small scoped tasks; user reviews diffs; explain architecture; tests and security review before merge | Every Codex task |
| R-018 | Performance targets are not met on Nigerian mobile networks | Medium | High | Mobile-first design, optimized Cloudinary images, caching, query tuning, real-device/network testing | Performance milestone |
| R-019 | Free-tier hosting limits interrupt demo availability | Medium | Medium | Document limitations; monitor usage; prefer free/low-cost approved plans, record limitations; obtain approval for purchases or provider changes | Before portfolio presentation |
| R-020 | BFF implementation or deployed request flow fails to follow the approved topology, leading to inconsistent credential, cookie or CSRF handling | Medium | High | Architectural ambiguity is resolved by DEC-027. Implement only same-origin Next.js route handling for browser application requests and server-only HTTPS transport to Express; retain Express authentication/authorization. Define dependent cookie and CSRF contracts and validate the deployed flow. Do not treat BFF routing or CORS as a security boundary or assume Express is unreachable directly. | BFF implementation, authentication/security testing and deployed-flow validation |
| R-021 | Old revision/CSV/unread/settings rules are implemented from historical documents | Medium | High | Active FRS v1.3 + consolidated REV authority; canonical IDs in DOC-05; superseded rules clearly marked; scope tests and diff review | Every task; PH-DESIGN-001 through 004 |
| R-022 | Partial Draft constraints prevent saving or allow invalid publication | Medium | High | Nullable content, supplied-value validation and complete status-gated submission; atomic public edit; no persisted partial replacement of public content | PH-DATA-001 / PH-LIST-001 |
| R-023 | Concurrent edits/approval/reassignment overwrite content or expose former-owner data | Medium | Critical | Lock property and recheck current owner/status/version inside mutation; notification resolves current owner; stale agent requests fail after transfer | PH-LIST-001 / PH-ADMIN-001 / PH-INQ-001 |
| R-024 | Gallery/cover or six-Featured limit fails under concurrency | Medium | High | Consistent parent locks and post-lock gallery checks; partial unique cover; serialize Featured selection and last-admin count; verify on actual PostgreSQL | PH-DATA-001 / PH-LIST-001 / PH-ADMIN-001 |
| R-025 | Cached SSR/API/metadata leaks hidden address, pending edits or deactivated-owner content | Medium | Critical | One visibility predicate + explicit safe projections, private no-store preview, coordinated cache invalidation, direct-ID/metadata/sitemap tests | PH-PUBLIC-001, PH-PUBLIC-002 / PH-INT-001 |
| R-026 | Duplicate or stale-recipient email after timeout/manual retry/reassignment | Medium | High | Simple sending guard/token, bounded timeout, interrupted-send UNKNOWN state; current-owner recheck; no exactly-once claim; provider idempotency only if verified | PH-INQ-001 / PH-ADMIN-002 |
| R-027 | Permanent deletion loses historical business records or cleanup loses audit meaning | Low/Medium | High | Never-published eligibility + restrictive business FKs, property-lock delete/create serialization, non-PII audit subject reference; images use recoverable cleanup | PH-LIST-001 / PH-DATA-001 |
| R-028 | Routine reassignment blocks urgent security revocation | Medium | Critical | Separate normal versus urgent action; emergency deactivation revokes immediately and unpublishes unmanaged public listings; retain private history/admin access | PH-AUTH-001 / PH-ADMIN-001 |

## Hosting decision update

On 2026-11-19, the user approved Vercel as the Next.js frontend host, replacing the earlier Cloudflare Workers + vinext proposal. The vinext compatibility spike was cancelled before implementation. On 2026-11-21, DEC-027 resolved the request-path choice in favour of Next.js server-mediated communication (BFF). R-001 reflects Vercel plan eligibility and usage; R-002 covers final origins and correct BFF transport (and any separately approved direct browser consumer); R-008 covers cookie and CSRF design; R-020 tracks implementation and deployed-flow validation, not an unresolved architectural choice. No Cloudflare/vinext work is planned.

## Risk scoring note

Likelihood and impact are qualitative planning estimates, not measured probabilities. Reassess as providers, plans, architecture and implementation become concrete. A risk is not closed merely because a mitigation is written; record evidence that the mitigation works.

## Scope synchronization and evidence - 26 November 2026

All risks R-001 through R-028 remain open planning risks; written mitigations are not proof of successful controls. DOC-05 owns current task status. Existing scaffolds/configuration do not prove deployment, connectivity, security or recovery. REV-001 through REV-038 close scope choices, not these engineering verification gates.

Original tracked scoring/mitigations are available through Git history. Review likelihood/impact from actual tests and provider evidence, record result/date/task and owner review before closing a risk. No new product features or paid services are selected here.
