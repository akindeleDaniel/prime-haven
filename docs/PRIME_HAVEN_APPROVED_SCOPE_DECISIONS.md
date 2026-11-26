# Prime Haven Properties — Final Scope Review and Decision Record
Date: 26 November 2026
Status: REV-001–REV-038 approved by the product owner; documentation synchronization authorized; implementation not yet authorized.

## Authority and context
This consolidates the Stage 1 decision record and subsequent explicit approvals in the scope review. Where a REV decision conflicts with FRS v1.2 or older planning/design decisions, the latest approved REV decision supersedes the older requirement. Preserve all unchanged requirements. Maintain historical source material and record supersession; do not rewrite history or add new features. This is not a complete replacement FRS or an authorization to implement code.

## Approved product and scope decisions

| ID | Decision | Rationale, alternatives and implications |
|---|---|---|
| REV-001 | Show exact addresses to prospective customers. | Supports self-directed location checks; use responsible fictional/sample addresses. |
| REV-002 | One required exact-address field, publicly visible by default with agent-controlled privacy toggle; separate state, city/LGA and neighbourhood. | Avoid redundant street/exact address fields. Hidden details must not leak via public APIs, SSR, metadata or caches. |
| REV-003 | Each property photo has a short visible caption. | Identifies the room or feature shown. |
| REV-004 | Keep meaningful alt text, with descriptive caption as default where appropriate. | Accessibility; avoids duplicate entry. Retain gallery order and cover selection. |
| REV-005 | Authorized private preview for owner agent and administrator. | Reuse property presentation; preview is not a status; protect routes server-side. |
| REV-006 | Maximum six eligible Featured selections, minimum zero; no separate display-count setting. | Display all selected eligible listings, hide section at zero, require unfeaturing before selecting a seventh. Simpler than selecting more and ordering a subset. |
| REV-007 | Required visitor email in addition to existing required inquiry contact fields. | Confirm every inquiry by email without requiring visitor account or OTP. Inquiry persistence is independent of delivery. |
| REV-008 | Published listing edits return to Pending Review on submission; no staged separate revision architecture. Validated administrator direct edits are audited. | Chosen over immediate public edits and maintaining two concurrent versions; accepts temporary public unavailability. Coordinate REV-027, 028, 032, 037. |
| REV-009 | Retain a separate administrator-controlled Verified badge. | Chosen over removing or automatically granting it. Represents simulated additional checks, not independent valuation or title guarantees. Retain reverification after material changes to price, purpose, type or location. |
| REV-010 | Manual Save Draft, incomplete drafts permitted; warn of unsaved changes. | Simpler than autosave. Validate supplied fields; enforce completeness before review. Existing public listings follow REV-028. |
| REV-011 | Dynamic property forms and type-specific backend validation. | Residential: bedrooms, bathrooms, toilets, furnishing and parking required; floor area optional. Land: plot size and title-document type required; no floor-area requirement. Commercial/Office/Shop: floor area and parking required. Inapplicable fields not required. REV-038 defines land text field. |
| REV-012 | Reassign properties to another active agent before normal deactivation. | Chosen for continuity over automatic unpublication. Preserve history, revoke sessions at deactivation. Emergency exception REV-030. |
| REV-013 | Previously public unavailable URLs display generic unavailable page; never-published private listings return 404. | Preserve links without leaking private content. |
| REV-014 | Keep New, Contacted, Viewing Scheduled, Closed; reopening and private notes. | Practical lightweight inquiry management; no in-app messaging or automated booking. REV-034 clarifies transitions. |
| REV-015 | Remove separate unread tracking. | New means unprocessed, not literal unread state. |
| REV-016 | Persist inquiries first, keep essential notifications and simple persisted controlled retry. | Property inquiry: agent, administrator, visitor; general contact: administrator and visitor; invitations/password resets as applicable. No status-change emails. Avoid complex job/attempt infrastructure. |
| REV-017 | Approximate session-based property view counts. | Chosen over raw refresh counting, advanced tracking and deferral. Browser repeat prevention plus server-controlled atomic counter; not exact unique-visitor analytics. Avoid fingerprinting or dedicated server visitor markers. |
| REV-018 | Permanent deletion only for never-published listings without dependent business records; otherwise archive. | Preserve historic listings, simplify deletion eligibility. REV-033 clarifies dependents. |
| REV-019 | Automatic anonymisation of inquiry personal information after 24 months, plus controlled verified deletion. | Preserve non-identifying records where appropriate; remove identifying contact information, free text, notes and delivery data. Chosen over full default deletion, manual-only retention or indefinite retention. No claim of legal compliance. |
| REV-020 | Defer inquiry CSV export. | Reduce personal-data exposure and maintenance; portal provides access. |
| REV-021 | Simplify account management. | Secure first-admin initialization, admin invitations, self-service password reset, deactivate/reactivate. No admin-triggered reset or routine permanent account deletion. At least one active administrator must remain. |
| REV-022 | Simplify site settings. | Configurable contact details, social links and amenities; fixed branding/name/tagline/concept notice; remove featured count setting and defer announcement banner. |
| REV-023 | Duplicate property information without images. | New Draft and reference; do not share/copy images, inquiries, audit history, approvals, Verified/Featured flags or views. Simpler than asset copying or sharing. |
| REV-024 | Simple audit logging of significant events. | No complete version history or unnecessary snapshots; avoid personal data and secrets in logs. |
| REV-025 | Simplify no-results messaging and image cleanup. | Clear Filters instead of elaborate suggestions; retain upload authorization, actual-format validation, metadata/ownership checks, recoverable deletion and orphan cleanup. |
| REV-026 | Minor implementation clarifications. | README completion later; 5,000,000-byte image limit; sort public newest by publication date and review oldest by submission date; public rendering/SEO and eligible sitemap; reproducible performance testing later. |
| REV-027 | Existing public listing becomes unavailable when agent submits valid edited content for review, not when opening edit form. | Atomic update plus review status; no separate persistent revision mechanism. |
| REV-028 | Existing public listing edits must be complete and valid before submission. | Incomplete new Drafts remain allowed; invalid submitted edits cannot replace public content or cause unpublication. |
| REV-029 | Reassignment does not itself require another publication approval. | Ownership changes, not approved listing content. Preserve current listing status subject to other approved rules. |
| REV-030 | Emergency deactivation permitted immediately, with unmanaged public listings unpublished and reassignment later. | Security and lack of replacement must not block access revocation; normal workflow REV-012 remains. |
| REV-031 | New owner agent assumes responsibility for the property's existing inquiries and future notifications. | Use current ownership for authorized access and notification recipients; old agent must lose access, including stale requests. Avoid retrying sensitive notifications to former owner. |
| REV-032 | Clear Featured status when a listing returns to review; retain baseline favourites behaviour and original publication date. | Featured slots become available; browser favourites remove unavailable properties per baseline; stable publication identity and ordering. |
| REV-033 | Dependent business records such as inquiries prevent permanent deletion; clean up images and preserve relevant audit records. | Images/audit records alone should not make eligible Draft deletion impossible. Use safe restrictive relationships and historical references. |
| REV-034 | Inquiry may close from any status; reopen to Contacted; allow adding private notes; Viewing Scheduled only after agreement. | No automatic appointments or messaging. |
| REV-035 | Prefer free or low-cost hosting; verify actual provider limits before deployment; no purchase without approval. | Avoid unverified pricing/availability promises. |
| REV-036 | Authorized admins can manually retry failed notifications. | Simple persisted delivery status and bounded safe sending; no elaborate job platform. |
| REV-037 | Apply the same complete-submission and return-to-review workflow to Published and Under Offer listings. | Consistent moderation, temporary unavailable page, no separate staged revision system. |
| REV-038 | Land title-document type is validated text, no document upload or legal verification. | Chosen over maintaining controlled Nigerian legal title categories. Agent supplies the description; no unsupported verification claim. |

### Confirmed upload allowlist
JPEG/JPG, PNG and WebP only. Reject unsupported, invalid or corrupt content; verify actual file type/structure through backend-controlled validation, not extension or browser MIME alone. Maximum 5,000,000 bytes per image, minimum 3 before submission, maximum 15, exactly one cover when images exist. Preserve signed upload authorization, ownership and metadata verification. PDF/DOCX and land-title document uploads remain out of scope.

## Previously approved architecture (not reopened by scope review)
- Next.js and TypeScript frontend; Express and TypeScript backend; PostgreSQL on Render; Prisma ORM and migrations; Vercel frontend; Render API; Cloudinary media; ZeptoMail email.
- Next.js BFF request path per DEC-027: browser -> Next.js -> Express -> PostgreSQL; Express remains authoritative for auth, permissions, business rules and persistence.
- PostgreSQL-backed opaque session cookies, hashed tokens, idle/absolute expiry, revocation, secure password hashing, validated input, safe SQL, CSRF protections, role and ownership enforcement.
- No visitor account; no real payments, live chat, map search, document verification or other unchanged out-of-scope features.
- Preserve public SEO, accessibility, mobile-first performance, fictional content and exact concept notice, tests, recoverable backups. Validate actual hosting feasibility and cookie/CSRF transport before deployment rather than assuming successful deployment.

## Accepted technical audit corrections (not new product features)
- Remove PropertyRevision and linked revision images/amenities/statuses, retention, copy procedures and indexes; remove unread state and strict server visitor markers.
- Use simple persisted notifications, sanitized errors, admin retry, concurrency protection, interrupted-send recovery and acknowledge potential duplicates after uncertain provider outcome. Resolve recipients according to current ownership; cancel pending sends and coordinate privacy cleanup before anonymisation/deletion.
- Replace unnecessary image counters and privileged counter/reconciliation machinery with transactional gallery validation and consistent parent-row locking, narrow useful constraints and cover uniqueness. Serialize active-admin invariant and global Featured cap. Retain lightweight stale-write/approval protections and test concurrency.
- Allow nullable/partial typed Draft fields; enforce required/type-specific completeness only on submission; revise address privacy, caption and size validation. Required email on submission can be anonymised later.
- Set submittedAt for moderation ordering; atomically validate and update edited content, images, amenities, Pending Review status, Featured flag, relevant Verified removal and audit event. Preserve slug and original publication date.
- Verify upload ownership or equivalent authorized attachment scope, including abandoned unverified asset cleanup. No duplication image references. Restrict deletion of dependent inquiries, keep historical audit references.
- Correct at least one active admin; align all status transitions, diagrams, entity definitions, indexes, API expectations, tests, requirements references and task IDs. One shared visibility rule across public API, SSR, sitemap, metadata and caching.

## Documentation synchronization and acceptance
Update the existing project charter, FRS baseline (new version with history), architecture/decision register, risk register, delivery traceability, master implementation roadmap, domain model, physical database design and root AGENTS.md as applicable. Retain existing original PDF and historical records. Reconcile roadmap IDs: PH-DESIGN-001 domain/database, PH-DESIGN-002 API contracts, PH-DESIGN-003 workflows and PH-DESIGN-004 security. Do not claim foundation/deployment/testing verification without evidence. Keep remaining technical design/verification gates explicit rather than manufacturing new owner decisions. Consolidate redundant documentation where sensible without deleting records or violating reference limits. No application/schema changes, migrations, new dependencies, commits, pushes or deployment authorized by this record.

AGENTS.md should recommend an available model/effort at the start of each task, drawing from the owner's previously discussed choices (GPT-6.1 Sol Medium routine, High complex planning/review; GPT-6 Astra High difficult/security work; GPT-6.1 Terra Medium visual tasks; GPT-6 Luna Low/Medium simple tasks, if present). Do not claim automatic model switching or availability. Scope tasks, explain reasoning, identify changes, test/verify honestly, preserve unrelated work, avoid redundant audits, require approval for new product features or major architecture changes, and provide proposed Conventional Commit messages when relevant. Stop at task boundary and distinguish planned, implemented, verified and owner-accepted work.

## Final audit provenance
The owner approved REV-001–007, initially selected 13 of REV-008–026 and later explicitly resolved the other six (009, 012, 014, 017, 019, 023). The owner approved all ten further decisions REV-027–036 and the last two REV-037–038. The owner also confirmed the image allowlist. This record supersedes the earlier Stage 1 checkpoint and is the consolidated change record, not a claim that the older original FRS was independently verified.

