# Prime Haven Properties - Backend Domain Model

**Authority:** [FRS v1.3](01_REQUIREMENTS_BASELINE_FRS_v1.2.md), [REV-001 through REV-038](PRIME_HAVEN_APPROVED_SCOPE_DECISIONS.md), DOC-02

**Task:** PH-DESIGN-001 (logical and physical design together)

**Status:** Synchronized design for review; no domain implementation or verification claimed.

**27 November 2026 implementation note:** The owner subsequently authorized two bounded authentication slices: User/Session/Invitation relationships, bootstrap, sign-in/out/current-user, administrator agent invitation/resend/activation and focused lifecycle audit events. Other entities/workflows below remain designs. DOC-05 records implementation evidence; this note does not mark the full domain design accepted.

## 1. Scope and model boundaries

**28 November property implementation:** The first listing slice adds Property owner/verifier relationships, Amenity/PropertyAmenity and focused property audit events for manual Draft creation/edit/duplication. Other lifecycle, image, inquiry and public-discovery behavior remains designed. DOC-08 Section 1.8 records the bounded implementation and DOC-05 its evidence.

This logical model explains entities, relationships and business behaviour. DOC-07 translates it into PostgreSQL/Prisma structures. FRS defines product behaviour; technical metadata below supports that behaviour and is not a new feature. Current data is stored once on Property; there is no separate revision/history model. Browser favourites need no database table. Approximate views need no visitor identity or server session-marker records.

DOC-02 records superseded decisions. The approved scope and necessary design details are maintained in this existing file; superseded mechanisms are recorded in DOC-02. All 38 REV decisions are approved; old questions about reopening, Under Offer edits, title enums, zero Featured, separate revisions or trigger ownership are not active owner blockers.

## 2. Entity catalogue

### 2.1 User

An Agent or Administrator, with identity, unique normalized email, name/phone, password hash after activation, role, account status, password activation time, optional photo/biography, failure count/lockout time and lifecycle timestamps. Activation is distinct from administrative deactivation: accepting an old invitation never reactivates a deactivated user.

- Administrator creates/invites agents; invitation valid 48 hours. First administrator uses a controlled secure bootstrap, never a public registration route or plaintext seeded password.
- Self-service reset uses a single-use 30-minute link; password change requires current password. No admin-triggered reset feature or routine permanent account deletion.
- Password minimum 10 characters; salted Argon2id/bcrypt hash. Five failed sign-ins lock for 15 minutes, protected against concurrent failures.
- Sign-in requires active, activated account. Deactivation blocks sign-in and revokes all sessions immediately. Password reset/change revokes existing sessions; expired/revoked sessions cannot be revived.
- At least one active, activated Administrator remains, including concurrent account changes. Do not duplicate the count in an extra business entity.
- A user owns sessions, may own properties as Agent, author authorized notes and act in audit records. Only administrators assign roles; no self-service role changes.

### 2.2 AccountInvitation, PasswordResetToken and Session

**28 November implementation:** Self-service password recovery and current-password change now implement the existing rules below. Reset tokens are consumed/revoked under the User lock, and successful reset/change revokes all sessions atomically. DOC-08 Section 1.7 records transport, rate and mail-delivery choices.

Supporting security records, not extra product workflows. Invitation/reset records hold user, cryptographic token hash, creation/expiry and consumed/revoked times. Replacement revokes old unused tokens and creates a new one atomically; only one current unused/unrevoked token per user. Acceptance checks account eligibility/expiry and atomically consumes the token with password update/session revocation.

Session holds user, unique hash of a random opaque token, creation/activity, idle expiry, absolute expiry and revocation. Enforce 12-hour inactivity and seven-day absolute expiry; activity never extends the absolute boundary. Express checks current account/role/session on every protected request. DOC-02/PH-DESIGN-004 govern BFF cookies, forwarding, CSRF and origins; browser JavaScript cannot access the HttpOnly token.

### 2.3 Property

One listing with one owning Agent, unique reference, lifecycle state, current content, publication/submission times, stable slug after first publication, verification/Featured metadata and a lightweight concurrency version.

| Field group | Rules |
|---|---|
| Identity/ownership | Required identity/reference/owner; owner role and active/activated eligibility checked on creation/reassignment. An emergency-deactivated owner can remain referenced until reassignment. |
| Common content | Title 10-120, description 50-5,000 plain text, purpose/type, positive whole-naira price, negotiable, state/city-LGA/neighbourhood, one exact address required on submission. Rentals require period; sales have none. |
| Address privacy | Visible by default; optional agent privacy toggle. Hidden exact address is excluded from all public representations, including structured metadata/caches. No redundant street-address field. |
| Residential | Bedrooms/bathrooms/toilets 0-20, furnishing and non-negative parking required on submission; positive floor area optional. |
| Land | Positive plot size and validated non-empty title-document description text; no legal enum/upload/verification or floor-area requirement. |
| Commercial/Office/Shop | Positive floor area and non-negative parking required on submission. Inapplicable fields cleared, not required. |
| Drafts | New Drafts may lack content; validate supplied values. Only complete content enters review/public states. Existing public listing edits cannot persist incomplete replacement content. |
| Workflow | Draft, Pending Review, Published, Under Offer, Closed, Archived. submittedAt orders current review submissions; publishedAt is original first publication and is never reset. |
| Badges | Admin-controlled Verified with actor/time; material price/purpose/type/location change clears it. Featured only for eligible public listings, global 0-6; clear when entering review/becoming ineligible. |
| Reasons/history | Required rejection/unpublish reason, concise significant-event audit; no full snapshots or revision history. |

Duplicate copies property information and amenity selections into a new Draft/reference. Reset slug/publication/submission/approval state, badges/views and history; copy no image references or inquiries. Private preview is an authorized presentation, not another state.

### 2.4 PropertyImage and CloudinaryAsset

PropertyImage is an attachment with one property, one verified asset, position, cover flag, short visible caption and meaningful alt text (descriptive caption may default it). Maximum 15; exactly one cover when non-empty; minimum three on submission/publication. Captions/alt remain editable and reordered atomically. On existing public listings, gallery changes are part of complete submission (or validated admin direct edit); candidate uploads remain unattached and live gallery references are unchanged until that transaction.

CloudinaryAsset tracks a backend-authorized upload intent, uploader/property scope, unique never-reused public ID, verified metadata, lifecycle and recoverable cleanup. It exists before attachment so abandoned unverified uploads are discoverable. A property owns its gallery; images are not shared across listings or duplicated listings.

Allow JPEG/JPG, PNG, WebP only, <=5,000,000 bytes; verify actual format/valid structure and provider metadata, not extension/browser MIME. Signed parameters expire within 10 minutes and constrain folder/type/size. Current property ownership or administrator authorization is checked when signing and attaching, including after reassignment. Knowing an asset ID does not confer attachment rights.

Removal detaches the gallery row and schedules external deletion. Cleanup checks references and excludes attachment before remote calls; no database transaction spans Cloudinary requests. Remote failures remain retryable and visible in operational logs without PII. Include verified and unverified orphans with a grace interval that cannot race legitimate uploads. Retired IDs never become attachable again. DOC-07 defines the simpler lifecycle.

### 2.5 Amenity and PropertyAmenity

An administrator-maintained unique named option; active options are selectable, existing selections survive deactivation. PropertyAmenity is a many-to-many join, not JSON/duplicated labels. Initial examples remain in FRS 4.3. Public amenity filtering requires all selected amenities. No Settings-to-Amenity foreign key is needed; administrators manage both independently. Renames must preserve existing meaning; deactivate/recreate where necessary rather than adding version history.

### 2.6 Inquiry and InquiryDuplicateGuard

Inquiry stores a general contact message or viewing request. On creation require name, normalized international phone, valid email, plain-text message 10-1,000, consent and type. Property inquiry has a property plus title/slug/reference snapshots; general contact has no property. Viewing requests add preferred date/time within the next 60 days; they are not appointments.

Current property ownership determines staff access and notification responsibility, not the original submitting agent or a permanent agent snapshot. New owner sees existing inquiries and notes; old owner loses access. Administrators retain global oversight; agents cannot edit visitor details or delete inquiries. No unread indicator or read-state entity; New means unprocessed.

Inquiry status, created/updated and anonymisation metadata support handling and retention. Submission-required personal fields become nullable after cleanup, including message text; do not let initial minimum-length validation prevent anonymisation.

InquiryDuplicateGuard is the sole short-lived keyed fingerprint store for rejecting identical messages from the same normalized sender within ten minutes. Acquire/reclaim uniquely and create the inquiry in one transaction. Store keyed HMACs rather than raw contacts/plain predictable hashes; expire/reclaim safely. Key rotation must compare still-live old-key guards or drain submission processing for the full window; merely changing keys bypasses duplicate protection. No stable visitor identity is introduced.

### 2.7 InquiryNote

Private text, inquiry, staff author and creation time. Current owning agent or authorized administrator may add/view notes. No editing UI is introduced. Ordinary notes are append-only; controlled retention/verified deletion must still clear identifying text. Keep author attribution without copying note contents into audit/logs.

### 2.8 InquiryNotification

Simple per-inquiry/per-recipient status: pending, sending, sent, failed, unknown or cancelled, plus sanitized failure/timestamps and bounded concurrency metadata. One logical notification each for current owner agent/admin/visitor as applicable. No separate immutable attempts, automated retry scheduler, outbox platform or stored full email bodies.

- Create inquiry and pending rows in one transaction. First send runs after commit; a recovery scan can expose interrupted pending work without losing it.
- Property inquiry: current agent/admin/visitor. General contact: admin/visitor. Administrator address is trusted server configuration/contact settings; visitor email is required at submission. Invitations/resets use their own token flows.
- Administrator can manually retry failed/uncertain notifications. Authorize retries, prevent concurrent sends, resolve current ownership and recheck privacy state. A send interrupted around provider acceptance is uncertain, not proven failed; expose this limitation and possible duplicates.
- Reassignment redirects future/unsent agent delivery; it cannot recall a message already dispatched. Cancellation/cleanup fences stale completion writes and removes delivery PII; do not promise withdrawal of an already in-flight provider request.

### 2.9 AuditLog

Record significant account/security, listing/edit/status/moderation, badge, reassignment, inquiry status/deletion and settings actions. Each event has its own identity, optional authenticated actor, action, time, concise safe summary and relevant typed entity links where useful.

Keep event identity separate from subject identity: stable non-PII subject reference remains if an eligible entity is removed and its FK becomes null. Use opaque IDs or property reference, never names/contact details/address/copied title/text. No full version history or mandatory snapshot of every field. Users cannot edit/delete audit; retain at least 12 months. Controlled maintenance after retention is separate from ordinary application APIs.

### 2.10 SiteSettings and aggregate views

One effective SiteSettings row stores mutable contact email, phone, WhatsApp, agency address and validated social links, with updater/time. Branding/name/tagline/concept notice are fixed application content; no featured display-count or banner field. Amenities have their own table.

PropertyViewAggregate is zero or one row per property with non-negative count/time. Browser session storage suppresses repeat increments, backend increments atomically for eligible public properties. Treat as approximate; storage loss/disabled JavaScript/storage and deliberate requests affect accuracy. No fingerprints, strict visitor guarantee or dedicated visitor markers.

## 3. Relationships

| Parent / related entities | Cardinality / deletion behaviour |
|---|---|
| Agent -> Property | One-to-many; exactly one required owner; role eligibility is server-enforced, not proven by FK |
| User -> invitation/reset/session/note | One-to-many; normal account deletion prohibited |
| Property -> PropertyImage | One-to-many; eligible property deletion removes attachments and schedules assets separately |
| Property -> CloudinaryAsset | Upload scope; retained cleanup metadata may outlive deleted property |
| Property <-> Amenity | Many-to-many through PropertyAmenity |
| Property -> Inquiry | One-to-many; general inquiry has no property; dependent inquiry prevents permanent property deletion |
| Inquiry -> InquiryNote/InquiryNotification | One-to-many; controlled privacy/deletion handles child data explicitly |
| Property -> PropertyViewAggregate | Zero or one aggregate; no visitor relationship |
| Audit -> actor/affected entities | Optional typed links and persistent non-PII subject reference; audit survives eligible deletion |
| SiteSettings -> updater | Optional bootstrap/admin user; no amenity ownership relationship |

~~~mermaid
erDiagram
    USER ||--o{ PROPERTY : owns
    USER ||--o{ SESSION : has
    USER ||--o{ ACCOUNT_INVITATION : receives
    USER ||--o{ PASSWORD_RESET_TOKEN : receives
    USER ||--o{ INQUIRY_NOTE : authors
    USER o|--o{ AUDIT_LOG : acts_in
    USER o|--o{ SITE_SETTINGS : updates
    PROPERTY ||--o{ PROPERTY_IMAGE : has
    PROPERTY o|--o{ CLOUDINARY_ASSET : scopes_upload
    CLOUDINARY_ASSET ||--o| PROPERTY_IMAGE : attaches_once
    PROPERTY ||--o{ PROPERTY_AMENITY : selects
    AMENITY ||--o{ PROPERTY_AMENITY : offers
    PROPERTY o|--o{ INQUIRY : concerns
    PROPERTY ||--o| PROPERTY_VIEW_AGGREGATE : counts
    INQUIRY ||--o{ INQUIRY_NOTE : has
    INQUIRY ||--o{ INQUIRY_NOTIFICATION : notifies
~~~

## 4. Workflows and authoritative boundaries

### 4.1 Listing transitions and edits

| Actor | Allowed transition |
|---|---|
| Owner agent | Draft -> Pending Review; Pending Review -> Draft (withdraw) |
| Owner agent | Published/Under Offer -> Pending Review on complete valid edited-content submission |
| Owner agent | Published <-> Under Offer; Published/Under Offer -> Closed; Draft/Closed -> Archived |
| Administrator | Pending Review -> Published (approve); Pending Review -> Draft (reject, reason) |
| Administrator | Published/Under Offer -> Draft (unpublish, reason); any -> Archived; Archived -> Draft |

No new state is added. Opening edit form and invalid submission do not mutate public content. Valid edited-content submission changes content/images/amenities, status/submittedAt, Featured, material-change Verified and audit in one transaction. Rejection retains the current submitted data as Draft, never reconstructs an old public version. Administrator direct edits validate all public completeness and invalidate material-change Verified without another agent submission. Version/status/current-owner checks reject stale writes and approvals. Preserve original publishedAt/slug; generate them only on first publication.

### 4.2 Reassignment and deactivation

Normal deactivation requires reassignment of owned properties to another active, activated Agent first; check again in the deactivation transaction so concurrent creation/reassignment cannot leave unmanaged properties. Reassignment alone preserves current status, does not require approval, invalidates stale edits and immediately transfers inquiry/notes authorization and future notification responsibility. Do not change historical note authorship/audit actors.

Urgent security deactivation cannot wait for a replacement. Atomically deactivate/revoke sessions and unpublish Published/Under Offer properties using the existing Draft state with an audited security reason, clearing Featured. Retain owner FK until reassignment and preserve publication identity/history. Reactivation/reassignment does not silently undo this separate unpublication; existing explicit submit/approve rules apply. Other private statuses remain private and administratively accessible.

### 4.3 Public visibility, private preview and caching

Public content requires Published/Under Offer, active activated owner and valid publication identity. Apply one shared predicate/projection to search, ID/slug, Featured/similar, SSR, metadata, JSON-LD and sitemap. Omit hidden exact address everywhere. Previously public unavailable URLs get only generic noindex content; never-public private requests return 404. Preview checks current owner/admin, uses private no-store responses and never populates public caches. Coordinate invalidation when availability/privacy/content changes; frontend hiding is not authorization.

### 4.4 Inquiries and privacy

Normal handling progresses New -> Contacted -> Viewing Scheduled after agreement. Any status can close; Closed reopens to Contacted. A direct New -> Viewing Scheduled requires the same actual agreement; no automatic appointment or extra calendar feature. Status changes/notes require current ownership or administrator authority; no reset to New or other new workflow is implied.

At 24 months automatically remove identifying contact fields, message/note text and delivery data, cancel pending sends, and mark anonymised. A simple safe implementation clears whole free-text bodies rather than claiming perfect automated PII detection. Preserve only permitted non-identifying status/date/property context; discard snapshots if they contain identifying content. Controlled verified deletion is separate and removes eligible child PII/records while retaining safe audit context. Reconcile restored backups before serving data or resuming notifications. No legal-compliance claim or new export feature.

### 4.5 Integrity, deletion and operational recovery

Only Drafts that were never published and have no dependent business records qualify for permanent deletion; previously published Drafts are ineligible. Lock property for deletion and inquiry creation/other competing changes; restrict business FKs, retain audit context and schedule image cleanup outside the transaction. Do not add a lifetime inquiry flag.

Serialize global six-Featured selection and at-least-one active administrator. All gallery mutations lock the property, then validate count/cover and owned verified assets before commit; use narrow useful database constraints. No image-count column/privileged trigger/reconciliation platform. Keep an operation-wide consistent lock order and bounded transaction retry for deadlocks.

## 5. Traceability and implementation gates

| Topic | FRS v1.3 | REV authority |
|---|---|---|
| Accounts/sessions | 6.1-6.2, 7.1, 9 | 021, 030; retained DEC-014, DEC-027 |
| Fields/images/drafts/duplicate/preview | 4.1-4.5, 6.4 | 001-005, 010-011, 023, 025-026, 028, 038 |
| Review/badges/status/public visibility | 4.6-4.10, 5.4-5.6 | 006, 008-009, 013, 017, 027-029, 032, 037 |
| Deletion/audit | 4.11, 7.5 | 018, 024, 033 |
| Inquiry/notification/ownership/privacy | 5.7-5.8, 6.5, 7.1, 9.6 | 007, 012, 014-016, 019, 030-031, 034, 036 |
| Settings/non-goals/operations | 7.3-7.4, 10, 12 | 020, 022, 035; unchanged quality/backup requirements |

DOC-03 supplies the complete per-REV matrix. Remaining work is technical contracts and evidence: PH-DESIGN-002 API, 003 workflows, 004 security, then separately authorized PH-DATA-001. Provider capabilities, cookie/CSRF transport and concurrency/retention/recovery checks remain unverified; this model does not claim they work.
