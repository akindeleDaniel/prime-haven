# Prime Haven Properties - Physical Database Design

**Authority:** [FRS v1.3](01_REQUIREMENTS_BASELINE_FRS_v1.2.md), [REV-001 through REV-038](PRIME_HAVEN_APPROVED_SCOPE_DECISIONS.md), DOC-02 and [DOC-06](06_BACKEND_DOMAIN_MODEL.md)

**Task:** PH-DESIGN-001; future implementation PH-DATA-001

**Status:** Synchronized documentation for owner review; proposed design, not implemented or verified.

**27 November 2026 implementation note:** The owner's bounded authentication tasks implement User, Session, Invitation and focused AuditLog events in additive migrations `20261127010000_auth_foundation` and `20261127020000_agent_invitations`; the applied empty initialization migration is preserved. Other models and general audit browsing remain proposed. Sign-in/session transport details are in DOC-08 Section 1.5 and invitation behavior in Section 1.6; actual local checks/status belong to DOC-05.

## 1. Scope and conventions

Express is authoritative for business/security operations. Use existing PostgreSQL/Prisma adapter/Migrate and DEC-027 BFF. Constraints supplement validation, not authorization. No image binaries, visitor accounts or favourites in PostgreSQL.

Inspection found Prisma configuration/adapter, an empty domain schema and the empty 20261120210932_init migration. Earlier notes report local migration application; this update ran no database command and does not verify local/shared/deployed history. Preserve applied migration history and use forward migrations after separate authorization.

Use UUID IDs/FKs, timestamptz UTC instants, createdAt defaults and service/Prisma updatedAt; whole-naira BigInt, numeric(12,2) areas and safe string serialization at JSON boundaries. Text is validated/bounded and rendered as plain text. All 36 Nigerian states plus FCT remain supported. Identity/timestamp/lock metadata are implementation support, not product additions.

Remove PropertyRevision and linked image/amenity/status/base snapshots/copy/retention/index machinery, unread state, strict visitor markers, stored imageCount and privileged counter functions, AccountSecurityGuard stored count, delivery-attempt history and elaborate workers. No mutable branding/notice/banner/Featured display-count setting. DOC-02 records superseded decisions; earlier proposals are not active approval.

## 2. Proposed model catalogue

Fields below describe intended structures, not implementation code. Unless nullable is stated, fields are required. Pair all Prisma relation fields/inverse names during implementation.

### 2.1 User

| Group | Fields / types |
|---|---|
| Identity/profile | id UUID; name/email/phone text; photoUrl/biography nullable text; createdAt/updatedAt timestamps |
| Credentials | passwordHash nullable text; passwordActivatedAt nullable timestamp |
| Account | role UserRole; accountStatus AccountStatus; deactivatedAt nullable timestamp |
| Lockout | failedLoginCount integer default 0; lockoutUntil nullable timestamp |

Unique trimmed/lowercase email with normalization CHECK; no competing CITEXT/expression uniqueness. Hash/activation time are both null before activation and both present after. No redundant activation enum. ACTIVE requires null deactivatedAt, DEACTIVATED non-null. Non-negative failures; User row serialization enforces five failures/15-minute lockout and resets expired failure state. Invitation acceptance never changes administrative status.

Bootstrap first active activated administrator through a controlled procedure, not public registration/default plaintext password. Serialize later admin eligibility changes with a transaction-scoped invariant lock, then count actual eligible User rows; never permit zero. No duplicated count/reconciliation table. Missing bootstrap is an operational failure. Temporary login lockout is not account deactivation. No routine account deletion/admin-triggered reset. Roles/owner eligibility are service checks; FKs only establish existence.

### 2.2 AccountInvitation and PasswordResetToken

**28 November implementation:** PasswordResetToken is implemented in additive migration `20261128010000_password_recovery`, with hashed tokens, 30-minute lifetime constraint and partial unique outstanding-user index. PASSWORD_RESET_REQUESTED/PASSWORD_RESET/PASSWORD_CHANGED extend the existing audit enum. Applied migration history is preserved.

Separate tables: id UUID, userId UUID RESTRICT, tokenHash text unique, createdAt/expiresAt timestamps, consumedAt/revokedAt nullable timestamps. expiry > creation; forbid consumed and revoked together. Partial unique userId where both are null includes expired rows; expiry alone does not free the slot. Lifetimes: invitation 48h, reset 30m.

Issuance locks User first, revokes previous unused/unrevoked tokens including expired ones, inserts replacement atomically. Acceptance uses the same User-first lock order, rechecks active/eligible account and token expiry/state, conditionally consumes and commits password activation/reset plus session revocation together. No activation bypass by reset. Store only hashes; avoid account enumeration. Cleanup is bounded and never makes expired tokens usable.

### 2.3 Session

id UUID, userId UUID RESTRICT, tokenHash text unique, createdAt/lastActivityAt/idleExpiresAt/absoluteExpiresAt timestamps, revokedAt nullable. No raw tokens. Protected requests check current User role/status/activation and unrevoked/unexpired session. Monotonic activity update is conditional on still-valid state and capped at immutable seven-day absolute expiry; idle lifetime 12h. Delayed requests cannot revive expired/revoked state. Logout revokes current; deactivation/reset/password change revoke all; role changes revoke/revalidate. Synchronize authorization-sensitive writes with account changes. Runtime clock checks do not belong in permanent time-dependent CHECK/index predicates. Cookie/forwarding/CSRF contract remains PH-DESIGN-004 before auth implementation.

### 2.4 Property

| Group | Fields / types |
|---|---|
| Identity/control | id/ownerId UUID; reference text unique; status PropertyStatus default DRAFT; version integer default 1; createdAt/updatedAt |
| Partial content | title/description nullable text; purpose/propertyType nullable enums; priceNaira nullable BigInt; negotiable boolean default false |
| Location/privacy | state nullable NigerianState; city/neighbourhood/exactAddress nullable text; showExactAddress boolean default true |
| Conditional content | rentPeriod/furnishing nullable enums; bedrooms/bathrooms/toilets/parkingSpaces nullable integers; floorAreaSqm/plotSizeSqm nullable Decimal; titleDocumentType nullable text |
| Publication/review | slug nullable unique text; publishedAt/submittedAt/archivedAt nullable timestamps; rejectionReason nullable text |
| Badges | verified boolean default false; verifiedById UUID/verifiedAt timestamp nullable; featured boolean default false; featuredAt nullable timestamp |

Owner User FK RESTRICT. Service requires active activated Agent on creation/reassignment but permits emergency-inactive ownership until transfer; do not CHECK that every retained owner stays active. Verifier User FK RESTRICT and Administrator authorization on verification. Distinct owner/verifier relation names and inverse fields are necessary.

Sequence-backed reference (e.g. PH-000123) is unique, not gapless. Slug stays null until first publication then immutable with original publishedAt through review/rejection/archive/republication. Require both null or both present; PUBLISHED/UNDER_OFFER/CLOSED require publication identity. submittedAt updates on every submission and is required for Pending Review. Archived status and archivedAt are consistent.

Verified CHECK: true requires verifier/time; false clears both. Material price/purpose/type/location changes clear metadata atomically, including admin edits. Rejection/unpublish reasons are private business data, not automatically safe audit text.

Featured CHECK covers flag/time/public status; service also checks owner eligibility. A global transaction-scoped lock and count enforce maximum six selections, not a settings integer. Clear when returning to review/becoming ineligible; false clears featuredAt. Reassignment to an eligible owner alone preserves status and placement.

### 2.5 Partial Drafts and submission matrix

Nullable content permits incomplete new Drafts. Trim/normalize omitted/blank values consistently; validate supplied ranges/formats without requiring missing Draft values. Complete requirements apply on submission and PENDING_REVIEW/PUBLISHED/UNDER_OFFER, not every Draft. Explicit IS NOT NULL checks are required: SQL UNKNOWN must not accidentally pass completeness.

| Submission rule | Requirement |
|---|---|
| Common | Title 10-120, description 50-5,000 plain text, purpose/type, positive whole-naira price, state/city/neighbourhood/one exact address |
| Rental | FOR_RENT needs PER_YEAR/PER_MONTH; FOR_SALE rentPeriod null |
| Residential | Counts 0-20, furnishing and parking >=0 required; floorArea optional positive |
| Land | plotSize >0 and validated non-empty plain-text titleDocumentType; no title enum/upload/verification or floor-area requirement |
| Commercial/Office/Shop | floorArea >0 and parking >=0 required |
| Gallery | 3-15 verified authorized images, exactly one cover, captions and meaningful alt text |

Clear irrelevant fields on type change; Land has no residential/parking/furnishing/floor-area requirement, commercial no residential/plot/title/furnishing requirements. Range checks allow null Draft values. Cross-row gallery/asset validity is service-transaction enforced. Closed/Archived retain history; they do not permit publishing incomplete records. Existing public edits cannot persist incomplete replacement content. Candidate image uploads stay unattached; public gallery add/remove/reorder/cover/caption changes commit only with valid complete submission or validated administrator direct edit, never merely on form interaction.

### 2.6 PropertyImage

id UUID; propertyId UUID CASCADE; assetId UUID unique RESTRICT; position positive integer; isCover boolean; caption/altText non-empty text; createdAt/updatedAt. Unique(propertyId, position); partial unique propertyId where isCover enforces at most one. Service requires exactly one for non-empty gallery and submission minimum. Photos are not decorative; descriptive caption can default meaningful editable alt.

Each asset attaches once, to one property; no duplicate/revision sharing. Presentation belongs to PropertyImage; verified provider identity/metadata to CloudinaryAsset. All attachment/reorder/cover/removal mutations lock Property then affected Assets in stable order and validate before commit. Swaps use a temporary position range or deferred position uniqueness. Ownership is immutable; no cross-listing FK move.

### 2.7 CloudinaryAsset

id UUID; propertyId nullable UUID SET NULL on eligible property deletion; uploadedById UUID User RESTRICT; cloudinaryPublicId unique text; lifecycle AssetState; createdAt/updatedAt. Nullable deliveryUrl/mimeType/format/byteSize/width/height/verifiedAt; deleteAfter/deletedAt timestamps; lastErrorCode sanitized text. Property scope + uploader are authorization evidence, not permanent access for a former owner. A current new owner may manage legitimate scoped assets; unrelated properties cannot attach them.

States: UPLOADING, READY, DELETE_PENDING, DELETED. Failed deletion remains DELETE_PENDING with error/next eligibility. READY requires verified JPEG/PNG/WebP actual content/valid structure, allowed image resource, 1..5,000,000 bytes and positive dimensions. Metadata/URL derive from authoritative provider verification, not browser claims. DELETED rejects attachment. Record never-reused signed public ID before upload so unverified orphans remain discoverable.

Signing checks current owner/admin, <=10-minute expiry, properties folder and type/size limits. Attachment rechecks current authorization, property scope, metadata and READY; knowing an asset ID is insufficient. No delete-claim fleet or lease renewal/attempt-history platform. Cleanup details are in Section 5.4.

### 2.8 Amenity / PropertyAmenity

Amenity: id UUID, name unique text, isActive boolean, createdAt/updatedAt. PropertyAmenity: propertyId/amenityId UUID composite PK, Property CASCADE, Amenity RESTRICT. Select active options; deactivation preserves referenced labels/associations. Avoid changing referenced meaning: deactivate/recreate where needed, not version history. No Settings FK. All-selected-amenity search uses the join.

### 2.9 Inquiry

id UUID; propertyId nullable UUID RESTRICT; propertyTitleSnapshot/propertySlugSnapshot/propertyReferenceSnapshot nullable text; name/phone/email/message nullable text; inquiryType enum; preferredViewingDate nullable date; preferredViewingTimeSlot nullable text; consentAcceptedAt timestamp; status enum default NEW; anonymizedAt nullable timestamp; createdAt/updatedAt.

Creation requires name/phone/email/message/consent; physical nullability enables cleanup. Normalize phone E.164 (Nigeria default for local input), validate explicit international input, discard raw form. Normalize valid email. Message 10-1,000 at submission, nullable after cleanup. General contact has no property; property inquiry has matching server-copied snapshots. Recheck public eligibility/lock Property on creation against deletion/reassignment races; browser supplies no agent recipient.

Viewing preferred date/time is within next 60 days by server clock, not a confirmed appointment. VIEWING_SCHEDULED requires agreement; no calendar entity. No unread field/index or permanent inquiry.agentId; access derives from current property owner. Privacy cleanup also removes identifying snapshots.

### 2.10 InquiryDuplicateGuard

id UUID; senderHmac/messageHmac text; createdAt/expiresAt; unique(senderHmac, messageHmac). Server-secret HMAC of normalized phone and canonical message; no raw contacts/plain predictable hashes, optional email or property scope. Rejection window is global same-sender/same-message for ten minutes. expiry > creation and <=ten minutes from acquisition.

Acquire via unique insert or conditional expired-row reclaim inside inquiry/notification transaction; live conflict commits no inquiry/notifications. Bounded expired cleanup is not a correctness dependency. Rotation must compare live retiring-key guards or pause submissions to drain the whole window; merely changing key bypasses protection. No stable visitor identity is introduced.

### 2.11 InquiryNote

id UUID; inquiryId UUID RESTRICT; authorId UUID User RESTRICT; body nullable text; createdAt. New body required non-empty plain text; normal add/read only, no edit/delete UI. Controlled anonymisation may clear body/remove eligible child data. Access follows current owner/admin, not merely authorship; audit never copies note body.

### 2.12 InquiryNotification

id UUID; inquiryId UUID RESTRICT; recipientKind enum; status enum; nullable sendToken text, startedAt/sentAt timestamps, lastErrorCode sanitized text; createdAt/updatedAt. Unique(inquiryId, recipientKind). Optional attemptCount >=0 only if operationally useful; no separate attempt table, retry schedule, full email body or permanent recipient snapshot.

Kinds: OWNING_AGENT, ADMINISTRATOR, VISITOR. Resolve current owner account, approved server contact setting and required inquiry email at dispatch; general contact has no owner-agent row. PENDING commits with Inquiry. Guarded dispatch checks privacy/current recipient and sets SENDING/token/startedAt before commit; provider call runs outside DB transaction. Completion matches current SENDING/token, sets SENT or FAILED and clears token. SENT requires sentAt; other states clear it; only SENDING has active token. Stale completion cannot override cancellation/new sends.

After bounded recovery timeout beyond request/processing allowance, interrupted SENDING becomes UNKNOWN, not proven failure. Admin may deliberately retry FAILED/UNKNOWN or recover interrupted PENDING, protected against concurrent sends and resolving current recipients. Bounded startup/maintenance recovery is enough; no automatic retry scheduler or elaborate worker claims. Verify provider idempotency before relying on it; uncertain acceptance can cause duplicate delivery.

Dispatch linearizes at the guarded SENDING transition, serialized against Property reassignment: later dispatch uses new owner, already dispatched mail cannot be recalled. Privacy cleanup sets non-sent notification records CANCELLED and clears sendToken, fences stale completion and removes identifying data; do not promise to withdraw an in-flight provider request. Never log bodies/recipients/raw responses. Invitations/resets remain their own token-flow email, not extra inquiry kinds.

### 2.13 AuditLog

id UUID; actorId nullable UUID; action allowlist; subjectType enum; subjectReference non-empty non-PII text; propertyId/affectedUserId/inquiryId nullable UUID; settingsId nullable integer; summary text; createdAt. Actor/subject FKs SET NULL on eligible deletion, settings RESTRICT. User actor/affected-user relations need separate names/inverses.

Event id identifies the event; subjectReference preserves historical entity identity after FK removal (property reference or opaque ID). Significant account/security, listing/edit/status/moderation, badge/reassignment, inquiry status/deletion/privacy and settings actions only; no full snapshots/version history. Summaries use allowlisted field names/statuses/reason categories; do not copy free-text rejection reasons, addresses/titles, contact/message/note data, credentials or tokens. User-immutable, >=12 months retention; safe deletion/anonymisation references needed for restore must survive the full restorable-backup horizon.

### 2.14 SiteSettings and PropertyViewAggregate

SiteSettings: singleton integer PK id=1, contactEmail/phone/whatsappNumber/address text, nullable validated socialLinks JSON, updatedById nullable UUID User RESTRICT, updatedAt. Validate bounded shape/URLs, reject unknown fields/unsafe schemes. Seed approved sample contacts; null updater only bootstrap. Missing settings is configuration failure, not permission to invent contacts. Fixed branding/name/tagline/notice are application content, not mutable settings; no featured count/banner or amenity FK.

PropertyViewAggregate: propertyId UUID PK/FK CASCADE, viewCount non-negative BigInt, updatedAt. Zero/one row per property; atomic upsert handles first/increment races. Eligible public views only; browser session repeat prevention, no caller-supplied total. No visitor markers/fingerprints/tracking identity or exact dedup promise. Storage failures must not break the page; counts remain approximate.

## 3. Enums and relationship integrity

| Enum | Values |
|---|---|
| UserRole / AccountStatus | AGENT, ADMINISTRATOR / ACTIVE, DEACTIVATED |
| PropertyPurpose | FOR_SALE, FOR_RENT |
| PropertyType | HOUSE, APARTMENT_FLAT, DUPLEX, TERRACE, LAND, COMMERCIAL, OFFICE, SHOP |
| RentPeriod / Furnishing | PER_YEAR, PER_MONTH / UNFURNISHED, SEMI_FURNISHED, FURNISHED |
| PropertyStatus | DRAFT, PENDING_REVIEW, PUBLISHED, UNDER_OFFER, CLOSED, ARCHIVED |
| InquiryType / InquiryStatus | GENERAL, VIEWING_REQUEST / NEW, CONTACTED, VIEWING_SCHEDULED, CLOSED |
| AssetState | UPLOADING, READY, DELETE_PENDING, DELETED |
| NotificationRecipient | OWNING_AGENT, ADMINISTRATOR, VISITOR |
| NotificationStatus | PENDING, SENDING, SENT, FAILED, UNKNOWN, CANCELLED |
| NigerianState | All 36 states plus FCT with one consistent validated spelling/mapping |

DOC-06 Section 3 supplies the common relationship diagram. Match FK UUID types; settingsId is integer. Property inquiry FK RESTRICT (nullable for general inquiries), not SET NULL that defeats business-dependency blocking. Property image/amenity/aggregate children CASCADE only after service eligibility; asset scope SET NULL preserves external cleanup identity; attached asset RESTRICT. Inquiry children use controlled privacy/deletion, not casual cascades. No normal User deletion, shared images or Settings-to-Amenity relationship. Relevant audit links SET NULL without deleting event/subject reference.

## 4. Constraints, indexes and queries

### 4.1 Narrow constraints

Use the PK/FK/unique/check rules from Section 2 once, avoiding duplicate indexes. Supplied non-null content obeys ranges; complete cross-field submission requirements are status-gated with explicit null checks. Verification triad, Featured flag/time/status, publication slug/date pair, archived/time and Pending Review/submittedAt combinations must be consistent.

Partial unique cover enforces at most one; service checks enforce exactly one non-empty-gallery cover and submission minimum. No image counters/privileged counter trigger graph. Lightweight version >0 protects stale writes; a narrow first-publication slug/date freeze trigger is reasonable in the future migration. No time-dependent expiry CHECK/index predicates. Lifecycle checks reject invalid metadata/deletion combinations. Direct maintenance must use guarded paths or explicit validated procedures; service-only cross-row checks cannot promise protection from arbitrary SQL bypasses.

### 4.2 Initial index candidates

Add only indexes supporting actual query patterns; unique/PK constraints already create indexes. Final order/extra indexes are engineering choices based on representative EXPLAIN plans, not product approvals.

| Access pattern | Candidate / existing coverage |
|---|---|
| Sign-in/security tokens | Unique normalized email and tokenHash |
| Owner/dashboard | Property(ownerId, status, updatedAt, id) |
| Public newest/price | Property(status, publishedAt, id); Property(status, priceNaira, id) |
| Public purpose/location/type | Measured equality/range indexes; always retain owner eligibility predicate |
| Oldest review | Property(status, submittedAt, id), not createdAt |
| Reference/slug | Existing unique indexes |
| Gallery | Unique(propertyId, position), unique assetId, partial cover |
| Amenities | PK(propertyId, amenityId), reverse(amenityId, propertyId) |
| Property inquiries | Inquiry(propertyId, status, createdAt, id) |
| Admin inquiries | Inquiry(status, createdAt, id); date/type indexes only if useful |
| Retention | Inquiry(createdAt, anonymizedAt); scans/writers also handle late identifying child data |
| Notes | InquiryNote(inquiryId, createdAt, id) |
| Notifications | Unique(inquiryId, recipientKind); (status, startedAt) if recovery needs it |
| Session revocation/cleanup | Session(userId, revokedAt); expiry indexes as needed |
| Invitation/reset | Partial active user uniqueness; expiry cleanup as needed |
| Media cleanup | CloudinaryAsset(propertyId), (lifecycle, deleteAfter), unique publicId |
| Duplicate guard | Unique(senderHmac, messageHmac); expiresAt |
| Audit filters | createdAt; actor/property/inquiry with createdAt as actual query needs |

Use id tie-breakers for stable sorting/pagination. Implement full FRS keyword search using safe PostgreSQL predicates; evaluate full-text/trigram only from measured need. No speculative huge index solves every filter, and no external search/cache service is selected.

## 5. Transactions and concurrency

### 5.1 Common discipline

Keep one consistent workflow lock order: invariant advisory locks before User rows; sorted User IDs before related sorted Property rows; then Inquiry/Notification; then Asset/gallery/amenity children in stable order. Session/token children follow locked User. Never reverse that order in maintenance/another endpoint. Bounded retry handles transient deadlock/serialization errors without replaying external side effects. Keep transactions short and provider calls outside them.

Under READ COMMITTED, after waiting for parent lock perform child count/eligibility in subsequent statements so committed competing changes are visible. Recheck session/account/current owner/status/version before protected mutations. All gallery changes, parent status transitions, deletion, inquiry creation and reassignment must use the guarded path; frontend controls cannot serialize them.

### 5.2 Submission, approval and direct edits

- Lock/revalidate account and Property/current owner/status/version. Stale requests fail rather than overwrite newer content or ownership.
- New Draft save validates supplied values only. Existing public form opening does nothing; incomplete/invalid submissions leave stored content/availability unchanged.
- Valid submission atomically applies complete content/gallery/amenities, checks 3-15 READY scoped images/cover/caption/alt, sets PENDING_REVIEW/submittedAt, clears Featured/material-change Verified, increments version once and appends concise audit.
- Approval locks current PENDING_REVIEW/version and rechecks completeness/gallery; publishes and generates slug/publishedAt only if never published. Rejection returns current content to Draft with reason, not an older public snapshot.
- Admin direct edits enforce applicable completeness/badges/audit atomically, without agent review workflow. Increment version for content/image/amenity/owner/status changes, not inquiry traffic/views.
- Validate gallery both on image changes and submission/publication/Under Offer parent transitions when no image changed. Stage reorder/cover swaps inside one locked transaction; narrow cover uniqueness alone is insufficient.

### 5.3 Global invariants, reassignment and deactivation

Separate well-known transaction-scoped locks serialize global Featured selections and active-administrator eligibility. Every path affecting an invariant takes its lock before row locks, counts actual rows and enforces <=6 or >=1. Bootstrap creates the first eligible administrator atomically. Deactivation clears now-ineligible Featured selections; eligibility changes cannot produce a seventh selection.

Normal deactivation locks target User/owned properties, rechecks no properties remain assigned, revokes sessions/changes account status/audits atomically. Creation/reassignment also lock/check owner eligibility, preventing new assignments to a concurrently deactivated owner. Reassignment locks old/new User and Property in stable order, requires active activated Agent, preserves current listing status, increments version and audits; existing inquiry/notes permissions follow current owner. Do not rewrite historical authorship. Future/unsent notifications resolve the new owner.

Urgent security deactivation never waits for replacement: revoke/deactivate immediately and move owned PUBLISHED/UNDER_OFFER to existing DRAFT with security-unpublish reason, clearing Featured and retaining original slug/publication/owner history. Reassignment itself is not an approval event, but cannot undo this separate unpublication. Explicit existing submit/approve workflow restores public status. No new suspension state or nullable owner is needed. Other retained private statuses remain private/admin-accessible.

### 5.4 Permanent deletion and media lifecycle

Delete only an eligible DRAFT with publishedAt null and no dependent business records, under Property lock. Inquiry RESTRICT independently protects dependents. Remove attachment/amenity/count children, preserve audit event/non-PII subject reference and mark relevant assets DELETE_PENDING before deleting eligible Property; all metadata operations commit or roll back together. Cloudinary success is separate. Do not add lifetime hasInquiry tracking.

Attach locks Property then Asset and checks current ownership/scope/READY before insert. Removal/cleanup use the same order, recheck references, validate remaining cover/count and retire attachability before any network request. Once DELETE_PENDING, public ID never returns READY or gets reused. Repeated remote delete/absent reconciliation is safe; errors remain pending/recoverable. No database transaction spans Cloudinary calls; no browser-selected arbitrary publicId deletion.

Include UPLOADING and READY orphans. Initial engineering grace proposal: 24h after creation/verification, plus confirmed signature expiry/provider propagation/in-flight allowance; validate against real upload workflow before enabling. Lock and recheck attachment at cleanup. A delay/timeout does not prove in-flight upload processing stopped: keep uncertain/late-upload reconciliation and tombstones recoverable. Bounded maintenance retries are sufficient; no job platform required.

### 5.5 Public reads, caching and approximate views

One backend predicate requires PUBLISHED/UNDER_OFFER, active activated Agent owner and publication identity. Apply to search, slug/direct-ID, Featured/similar, SSR, sitemap and metadata data access. Return explicit safe fields; omit exactAddress if hidden rather than serializing private data then hiding it in UI. Previously public unavailable URLs get generic noindex content; never-public private gets 404. Owner/admin preview is authenticated, private/no-store and excluded from sitemap.

No private caching. Prefer uncached dynamic public reads until bounded public caching has demonstrated invalidation for privacy, submission, deactivation and other availability/content changes. Browser session repeat prevention + server atomic upsert gives approximate views; reject caller totals and retain abuse controls. No dedicated visitor identity or exact-session dedup promise.

## 6. Privacy, retention and recovery

At 24 months from creation, bounded idempotent cleanup cancels pending notifications, fences stale completions and clears name/phone/email/message, identifying note text and identifying snapshots/delivery fields, then sets anonymizedAt. Nullability/constraints permit it. Clearing entire free-text bodies is simpler and safer than promising perfect automated PII detection. Retain permitted non-identifying status/date/context. Writer paths also enforce due/privacy state so late notes/child writes/retries cannot repopulate identifying data.

Controlled verified deletion separately verifies request/authority and handles inquiry/children explicitly under locks, retaining safe audit references. Staff have no casual contact-edit/inquiry-delete API. No CSV export. Already dispatched mail cannot be recalled; cancellation fences database state and future sends, not remote history. App/provider/maintenance logs contain safe codes/opaque IDs, no bodies/recipients/tokens/raw HMAC input. Business rejection text is not automatically safe audit content.

Audit is user-immutable and retained >=12 months. Non-identifying deletion/anonymisation references needed for restore persist through the full restorable-backup horizon. Independent weekly development exports plus pre-major-migration exports remain required; protected storage outside primary DB service, documented frequency/retention, restore drill before deployment acceptance. Provider backup/PITR is unverified until checked. Production daily/PITR remains conditional recommendation, not purchased scope.

Restore into isolation; replay deletion/anonymisation references, run due cleanup and reconcile media/notification state before serving data or sending restored notifications. Never assume restoration alone preserves privacy. No legal-compliance claim.

## 7. Migration, privilege and operational plan

PH-DATA-001 later implements reviewed models/forward migrations after PH-DESIGN-001 through 004 acceptance and PH-SETUP-003 verification. Check actual migration history; never rewrite applied empty migration. Review generated SQL for nullable Drafts, enums/FKs/referential actions/checks/partial indexes/inverse relation names; back up before risk and keep deployment recoverable. No schema/migration changes here.

Separate least-privileged runtime from schema-owner/migration tooling. Runtime cannot DDL or casually update/delete audit and is not table owner. Narrow authorized maintenance handles retention; shadow-database/migration privileges do not belong to web credentials. No bespoke image-counter column grants/security-definer functions. Validate role/pooling/connection/provider capabilities and low-cost limits before deployment; no assumed feature availability/purchase.

## 8. Planned verification and readiness

| Area | Implementation evidence required |
|---|---|
| Fields/Drafts | Partial save vs invalid supplied values, null-aware conditional checks, complete submission failures |
| Public edits | Published/Under Offer form/invalid/valid submit; atomic content/gallery/badges/submittedAt/audit; original date/slug; rejection and stale approval |
| Concurrency | Independent connections race final gallery slot/cover, seventh Featured, last admin, edit/reassign/approve, delete/inquiry and cleanup/attach |
| Security | Cross-agent preview/inquiry/note/upload, stale former-owner access, direct Express/BFF/CSRF, single-use tokens, expiry/revocation/revival |
| Email | Outage, stranded pending, double manual retry, crash before/after acceptance, UNKNOWN visibility/current-owner/privacy cancellation |
| Images | 5,000,000/5,000,001 boundaries, corrupt/spoofed types, verified/unverified orphans, late upload/timeout/absent delete/retired ID safety |
| Privacy/recovery | Contact/text/note/delivery removal, late writes, dependent delete denial, safe audit survival and isolated restore reconciliation |
| Public queries | Every visibility/address path, private no-store/cache invalidation, stable sorting/query plans and approximate counters |
| Operations | Actual provider limits/region/connections, least privilege, migration history and independent restore |

These are proposed mechanisms and planned checks, not proof. This documentation update changed no application, Prisma schema, migration or dependency and ran no database command. All 38 scope decisions are resolved; remaining technical contracts/verification are ordinary engineering work. Documentation is ready for owner review, not a declaration of tested implementation or permission to start PH-DATA-001. Next PH-DESIGN-002, PH-DESIGN-003, PH-DESIGN-004 tasks require separate authorization.
