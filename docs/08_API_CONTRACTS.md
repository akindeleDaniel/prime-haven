# Prime Haven Properties - Version 1 API Contracts

**Task:** PH-DESIGN-002 - API Contract Design

**Date:** 27 November 2026

**Status:** Contracts designed for owner review. A01-A07, U02 and U04 have bounded local implementations and automated tests as of 28 November 2026; other endpoints remain designed, not implemented. See Sections 1.5-1.7 and DOC-05 for implementation limits; owner acceptance/deployment are separate.

**Authority:** [FRS v1.3](01_REQUIREMENTS_BASELINE_FRS_v1.2.md), [approved REV-001 through REV-038](PRIME_HAVEN_APPROVED_SCOPE_DECISIONS.md), [architecture/DEC-027](02_TECHNICAL_ARCHITECTURE_AND_DECISIONS.md), [domain model](06_BACKEND_DOMAIN_MODEL.md), [physical design](07_PHYSICAL_DATABASE_DESIGN.md). [DOC-03](03_DELIVERY_ROADMAP_AND_TRACEABILITY.md) owns requirement traceability; [DOC-05](05_MASTER_IMPLEMENTATION_ROADMAP.md) owns task status. This document adds technical contracts within approved scope, not new product requirements.

## 1. Boundaries and conventions

### 1.1 Transport, authentication and permissions

- Express resource paths below have base `/api/v1`. Browser calls use the corresponding explicitly implemented same-origin Next.js `/api/v1/...` route handler. Next.js SSR may call the same Express contracts through server-only transport. No arbitrary-target proxy, browser database access or browser-to-Express application flow.
- Express independently validates input, session/account eligibility, current role/ownership and business rules, including direct callers. Never trust browser-supplied actor/owner/role, forwarded asset claims or BFF presence. Role-specific path prefixes do not confer permission.
- `Public` needs no account. `Agent` means active, password-activated AGENT; `Admin` means active, password-activated ADMINISTRATOR. `Staff` means either. `Owner` means current owning Agent, checked again inside the transaction. Agent record requests outside current ownership, including inquiry/note/upload access after reassignment, return `404 NOT_FOUND`; wrong role for a route returns `403 FORBIDDEN`. Invalid/expired/revoked sessions return `401 UNAUTHENTICATED`.
- PostgreSQL opaque sessions: only token hashes stored; 12h idle and 7d absolute expiry, immediate logout/deactivation revocation, all existing sessions revoked after password reset/change. No JWT or session token in browser-visible JSON/local storage. Express authenticates the server-forwarded credential; Next.js applies the reviewed cookie contract.
- All session-bearing state changes, sign-in/token acceptance and public form submission require CSRF/origin controls. Section 1.5 specifies the implemented sign-in/out/current-user slice. Remaining flows must extend its reviewed controls in PH-DESIGN-004. BFF handlers must not blindly relay upstream Set-Cookie or caller-controlled forwarding headers. Both layers enforce the contract; CORS is not authorization.
- Protected, preview and authentication responses use `Cache-Control: private, no-store`; public API reads initially use `no-store` until safe invalidation is demonstrated. Visibility/privacy changes must take effect immediately in protected data access and across SSR/metadata, not merely hide UI controls. Approval becomes discoverable within one minute (FRS 13.6).
- HTTPS in deployed environments. Sign-in/reset/inquiry/upload signing and view increments are abuse-limited; `429` supplies `Retry-After`. Numerical limits and trusted client-IP derivation are PH-DESIGN-004 engineering work. Request/log IDs must contain no PII.

### 1.2 Wire types and validation

- JSON UTF-8 and camelCase fields; JSON bodies only unless an endpoint explicitly declares multipart. Reject unsupported media types (`415`), oversized requests (`413`), malformed JSON/query/IDs (`400`), unknown fields/query keys and structured keys starting `$` or containing `.` recursively (`400`). These restrictions do not reject punctuation in ordinary text values. Use safe ORM/parameterized SQL and plain-text rendering.
- IDs are UUID strings; instants are ISO 8601 UTC; dates are `YYYY-MM-DD`. Enums use the exact uppercase values in DOC-07 Section 3. `priceNaira` and `viewCount` are decimal integer **strings** to avoid JavaScript precision loss; positive whole-naira prices fit PostgreSQL signed BigInt. Areas are positive decimal strings with at most two fractional digits and numeric(12,2) bounds. Counts are JSON integers.
- Trim outer whitespace on text; preserve description/message line breaks. Normalize email to trimmed lowercase; phones to E.164 (Nigerian local input accepted). Reject invalid values, not silently coerce strings into booleans/counts. Query numeric values must parse strictly; booleans are `true`/`false`. Repeated scalar parameters are invalid; array parameters repeat, e.g. `amenityId=x&amenityId=y`.
- `PATCH` omission means unchanged; `null` clears only nullable/optional fields. Explicit null on a submission-required field fails completeness. Empty optional Draft text normalizes to null. Required booleans/defaults are explicit in the normalized stored representation. All output uses explicit allowlists, never raw Prisma rows.
- Bounds not prescribed in the FRS are technical limits for review: name/city/neighbourhood/titleDocumentType/amenity name 1-120 characters; exact/contact address 1-300; biography 0-1,000; caption/alt text 1-200; moderation reason 1-1,000; private note 1-2,000; search keyword 1-120; time-slot text 1-80; HTTP(S) URL at most 2,048. These limits do not introduce legal title categories, markup or a booking calendar. Implemented password policy is Section 1.5; future password flows must reuse it without silent truncation.

### 1.3 Responses, errors and concurrency

Single success: `{ "data": Resource }`. Collection: `{ "data": [Resource], "pagination": { "page": 1, "pageSize": 12, "total": 24, "totalPages": 2 } }`. `201` creates a resource and supplies its Location; `202` accepts a persisted email/retry operation without claiming delivery; `204` has no body. An empty page returns `200`, `data:[]`; no-results is not an error.

Error shape (same at Express and BFF, with no stacks/provider payloads/PII):

```json
{
  "error": {
    "status": 422,
    "code": "VALIDATION_FAILED",
    "message": "The listing is incomplete.",
    "fields": [
      { "path": "content.title", "code": "REQUIRED", "message": "Title is required." },
      { "path": "gallery", "code": "MIN_IMAGES", "message": "At least 3 images are required." }
    ],
    "requestId": "opaque-request-id"
  }
}
```

`fields` is an array (empty when inapplicable); include every detected missing/invalid submission requirement without echoing submitted secrets or values. Stable machine codes drive UI, safe messages explain the issue.

| Status | Meaning / representative codes |
|---|---|
| 400 | Malformed input, unexpected fields, invalid query/ID: `INVALID_REQUEST` |
| 401 / 403 / 404 | `UNAUTHENTICATED`, `FORBIDDEN` or `CSRF_REJECTED`, `NOT_FOUND`; no record-existence leaks |
| 409 | State/invariant conflict: `INVALID_TRANSITION`, `FEATURED_LIMIT`, `DEPENDENT_RECORDS`, `PROPERTIES_REQUIRE_REASSIGNMENT`, `DUPLICATE_INQUIRY`, `SEND_IN_PROGRESS`, `ASSET_UNAVAILABLE`, `PRIVACY_RESTRICTED` |
| 412 / 428 | `STALE_RESOURCE` / `PRECONDITION_REQUIRED` |
| 413 / 415 / 422 | `PAYLOAD_TOO_LARGE`, `UNSUPPORTED_MEDIA_TYPE`, semantic `VALIDATION_FAILED` (including complete missing-field list) |
| 429 | `RATE_LIMITED`; request-level sign-in/reset throttling applies without revealing account existence; account lockout itself uses generic sign-in failure |
| 500 / 502 / 503 / 504 | Sanitized `INTERNAL_ERROR`, `UPSTREAM_ERROR`, `SERVICE_UNAVAILABLE`, `UPSTREAM_TIMEOUT`; never claim a failed inquiry when persistence already committed |

All endpoints inherit applicable parsing, authentication, ownership, CSRF, validation, rate-limit and dependency failures above. Tables list success and operation-specific failures. Missing preconditions apply only where stated.

Private property reads/writes return an opaque `ETag` tied to Property.version. Require `If-Match` for update, submit, status/moderation/badge/reassign/gallery/delete; absent `428`, stale `412`. Every content/gallery/amenity/owner/status/badge mutation advances version; views/inquiries do not. Authorize current ownership before revealing a stale-version result. Version comparison and business checks happen under the same lock/transaction; approval cannot approve content different from the version reviewed.

Other mutable resources use opaque ETags backed by exact updatedAt/current field state (no new version columns required): profile/settings/amenity/account changes and inquiry status/privacy deletion require `If-Match`. Inquiry note append and retry use current authorization plus privacy/state/send guards, not a caller-supplied version. Return the new ETag on successful mutation; list entries expose `etag` for row actions. Clients re-read after `412`; no blind retry of mutations or uncertain external side effects.

### 1.4 Pagination, filters and sorting

- All ordinary list endpoints accept `page` (default 1, integer >=1) and `pageSize` (default 20, 1-50). Public property search is fixed at 12/page (`pageSize`, if sent, must be 12). Count includes the same permission/filter predicate as data. No arbitrary SQL field/order parameters.
- Every sort ends with unique `id` in the same direction as the primary sort; the first listed sort is the default unless a row states otherwise. `updated_desc`/`created_desc`/`created_asc`/`name_asc` mean the corresponding updatedAt/createdAt/name ordering. Numbered pagination is deterministic for unchanged data, not a snapshot guarantee while listings change.
- `from`/`to` are UTC instants filtering `createdAt` with inclusive `from`, exclusive `to`; reject reversed ranges. Public newest uses original `publishedAt`; review oldest uses latest `submittedAt`. Store filter/sort/page in frontend URL queries.
- Small bounded projections (Featured <=6, similar <=4, dashboard latest inquiries <=5, notification slots <=3) are embedded/capped values, not unbounded lists. Public sitemap is paginated internally; notes and audit browsing are paginated.

### 1.5 Implemented authentication transport slice

The owner's 27 November 2026 implementation instruction authorizes resolving these details for A01-A03, without starting invitations/reset/listing features:

- Browser session cookie is `__Host-ph-session` on HTTPS: HttpOnly, Secure, SameSite=Strict, Path=/, no Domain. Expires is the session's immutable seven-day absolute expiry; Express separately enforces twelve-hour idle expiry. Explicit `AUTH_ALLOW_LOCAL_HTTP=true` permits only HTTP loopback development origins and uses `ph-session` without Secure. No remote HTTP exception.
- Both apps use exact configured `APP_ORIGIN`; frontend server-only `API_BASE_URL` names a fixed backend origin. State-changing calls require exact Origin, JSON and `X-Prime-Haven-CSRF: 1`. BFF also rejects hostile Sec-Fetch-Site when present. No permissive CORS, generic forwarding or CSRF-token endpoint. A custom header plus exact origin checks supplies the CSRF protection; SameSite is additional protection ([OWASP guidance](https://cheatsheetseries.owasp.org/cheatsheets/Cross-Site_Request_Forgery_Prevention_Cheat_Sheet.html)).
- Next reads only its named session cookie; duplicate named cookies are rejected. It constructs `Authorization: Bearer <opaque token>` and server-only `X-BFF-Key` from configuration (at least 32 random bytes, matching Express), never from browser headers. Express requires this transport key and still independently checks the PostgreSQL session, current role and active/password-activated account. Browser Cookie, Authorization and forwarding headers are not blindly relayed. Express parses no browser cookie and emits no Set-Cookie.
- Successful Express sign-in returns Me JSON plus internal `X-Session-Token`/`X-Session-Expires` headers. Next validates and removes these headers, constructs its cookie and returns only Me. New login generates a fresh 256-bit opaque token; the previous same-user session presented by the BFF is revoked on successful replacement. No periodic token rotation is implemented; activity never extends absolute expiry. Logout revokes before clearing the cookie; expiry/current-user 401 clears a stale cookie. Dependency failure retains the cookie so a revocation attempt can be retried.
- Session storage contains only SHA-256 hashes of random tokens. User-first transaction locking serializes login failures, activity and revocation; locked/unknown/inactive/unactivated accounts have the same generic 401 sign-in response. Bcrypt cost 12; new passwords require 10 Unicode characters minimum, at most 72 UTF-8 bytes, no NUL; reject oversized passwords instead of truncation ([bcrypt documentation](https://github.com/dcodeIO/bcrypt.js)).
- Coarse sign-in limit: 30/minute per actual backend socket address per process; BFF clients share a bucket. Never trust arbitrary forwarded client-IP headers. Persistent five-failure/15-minute account lockout is PostgreSQL-wide. Distributed request throttling/provider proxy trust still needs deployment verification; this implementation does not claim a shared limiter across replicas.
- Strict Zod body schemas, no extra query keys, 8 KiB body cap, safe error envelope and no-store responses. Explicit route handlers exist only for sign-in, sign-out and me. Password/token values never enter security event logs. Current role middleware is available for later routes, without adding administrative features.
- First administrator uses a local guarded interactive CLI, hidden password confirmation, normalized input and the same hashing policy. A database invariant lock serializes bootstrap; it refuses when any Administrator exists, never replaces credentials or revives an inactive administrator. No default credentials/public bootstrap endpoint. Future administrator mutations must reuse the invariant lock and preserve at least one active activated administrator.

### 1.6 Implemented agent invitation slice

- A06, U02 and U04 use explicit Express routes behind matching same-origin Next.js BFF handlers. Express authenticates the session and requires the current Administrator role for agent creation/resend; invitation acceptance is public through the bounded BFF transport.
- New Agent rows are administratively ACTIVE but have no password hash or activation time, so the existing sign-in eligibility check rejects them. This keeps invitation activation distinct from DEACTIVATED status; an invitation cannot reactivate a deactivated account.
- Invitation rows hold a SHA-256 hash of a random 256-bit opaque token, a 48-hour expiry, consumed/revoked timestamps and delivery state. Account plus first invitation and the non-PII AGENT_CREATED/INVITATION_ISSUED audit events commit before email dispatch. ZeptoMail sends afterward; delivery failure is recorded and does not remove the account. Resend locks the user, revokes every prior unused invitation and inserts a new one atomically.
- Acceptance hashes the new password with the existing bcrypt policy before its transaction, locks the User first, rechecks account and invitation state, conditionally consumes the token, sets activation/password and appends PASSWORD_ACTIVATED in one transaction. Reused, expired, replaced or deactivated-account links receive generic `422 INVALID_OR_EXPIRED_TOKEN`; acceptance does not sign in.
- ZeptoMail uses the fixed `https://api.zeptomail.com/v1.1/email` send API and server-only `ZEPTOMAIL_API_TOKEN`, `ZEPTOMAIL_FROM_EMAIL` and optional `ZEPTOMAIL_FROM_NAME`. The trusted configured APP_ORIGIN constructs the `/activate?token=...` link. The activation page/UI is not implemented. Tests inject a mocked mailer; no real messages are sent in local verification.
- Invitation audit persistence covers the three account lifecycle actions above; Section 1.7 extends password-event coverage. Browsing/general audit features remain unimplemented. Invitation delivery is synchronous with a bounded timeout after commit; failed or interrupted delivery leaves an unactivated account for administrator resend.

### 1.7 Implemented password recovery/change slice

- A04/A05/A07 use explicit matching BFF handlers and existing origin/custom-header CSRF checks. A07 is PUT and requires an active, activated Staff session. Express revalidates that session inside the User-locked password mutation transaction; a revoked or expired session cannot perform a delayed change.
- PasswordResetToken holds only a SHA-256 hash of a random 256-bit token, 30-minute expiry and consumed/revoked timestamps. A partial unique index enforces one outstanding token per user, including expired rows until revoked. Issuance locks the User, revokes prior unused tokens and inserts the replacement atomically. A persistent 60-second per-account cooldown silently suppresses duplicate requests; it never locks accounts or reveals eligibility.
- A04 returns the exact same 202 message for valid known/unknown/deactivated/unactivated/throttled emails. A uniform minimum 250 ms processing window reduces database timing differences; provider latency is excluded by in-process asynchronous delivery after commit. This is not a guarantee of identical network timing. Pending mail can be lost on restart; the user may request again after cooldown. No durable queue or automatic retry is claimed. Provider failure logs only PASSWORD_RESET_EMAIL_FAILED, without addresses, tokens or raw error details.
- A05 conditionally consumes a still-valid token under the User lock and commits the new bcrypt hash, login-lockout reset, revocation of outstanding reset tokens/all sessions and PASSWORD_RESET audit event together. Invalid/expired/consumed/revoked/ineligible links fail generically. A07 requires the current password against the locked current user and commits the same revocations plus PASSWORD_CHANGED. Incorrect current passwords leave credentials/tokens/sessions unchanged.
- Password-reset requests, completion and password changes each reuse the existing coarse 30/minute per-socket per-process limiter, with Retry-After and no forwarded-IP trust. BFF clients share a socket bucket; distributed provider/proxy abuse controls remain deployment work. Eligible requests persist PASSWORD_RESET_REQUESTED using an opaque affected-user reference and no attempted email. Security audit summaries contain no passwords, token hashes, raw tokens or contact data.
- Reset emails reuse ZeptoMail's fixed API, credentials and trusted APP_ORIGIN, targeting /reset-password?token=...; no reset UI is implemented. Successful reset/change returns 204, clears the BFF session cookie and never automatically signs in. Tests inject mocked email delivery and mock provider HTTP requests.

## 2. Shared resource schemas

These named projections define the response structures used in endpoint tables. Nullability is explicit; omitted public fields are not null placeholders for private data.

| Projection | Allowlisted fields |
|---|---|
| `Me` | `id, role, name, email, phone, photoUrl:null\|string, biography:null\|string` |
| `AgentAccount` (Admin only) | Me fields plus `accountStatus, passwordActivatedAt:null\|instant, invitation:{expiresAt:null\|instant,status:NONE\|PENDING\|EXPIRED\|ACCEPTED}, createdAt, updatedAt, etag`; no hashes/tokens/security counters |
| `PublicAgent` | `name, phone, photoUrl, biography`; never account email/status/security metadata |
| `Image` | `id, url, width, height, position, isCover, caption, altText`; provider-verified delivery URL/dimensions, no signing secret/internal public ID |
| `PropertyCard` | `id, reference, slug, title, purpose, propertyType, priceNaira, rentPeriod:null\|enum, negotiable, state, city, neighbourhood, bedrooms/bathrooms/toilets/furnishing/parkingSpaces/floorAreaSqm/plotSizeSqm` as applicable, `status` (public states only), `verified, featured, publishedAt, coverImage:Image` |
| `PropertyDetail` | Card plus `description, images:Image[], amenities:{id,name}[], titleDocumentType` when applicable, conditional `exactAddress`, `agent:PublicAgent, viewCount, conceptNotice:"Concept project: listings are fictional"`. No ownerId or private review metadata. |
| `PrivateProperty` | `id, ownerId, reference, version, etag, status, content:PropertyContent, gallery:PrivateImage[], amenityIds, amenities:{id,name,isActive}[], slug:null\|string, publishedAt/submittedAt/archivedAt:null\|instant, rejectionReason:null\|string, verified, verifiedById:null\|UUID, verifiedAt:null\|instant, featured, featuredAt:null\|instant, viewCount, createdAt, updatedAt, missingRequirements:FieldError[]`. PrivateImage adds `assetId` to Image. |
| `Preview` | `status, isPreview:true, content:PropertyContent, gallery:Image[], amenities:{id,name}[], agent:PublicAgent, reference, conceptNotice`; nullable partial Draft data retained and identified as preview. No public cache/indexing. |
| `Inquiry` (authorized staff) | `id, propertyId:null\|UUID, propertySnapshot:null\|{title,slug,reference}, name/phone/email/message:null\|string, inquiryType, preferredViewingDate/TimeSlot:null\|string, consentAcceptedAt, status, anonymizedAt:null\|instant, createdAt, updatedAt, etag`. Cleared fields stay null after privacy cleanup. |
| `Note` / `Notification` | Note: `id, author:{id,name}, body:null\|string, createdAt`. Admin-only Notification: `id, recipientKind, status, startedAt/sentAt:null\|instant, lastErrorCode:null\|string, updatedAt`; no raw recipient/body/provider response/send token. |
| `Settings` / `Amenity` | Settings: `contactEmail, phone, whatsappNumber, address, socialLinks:[{label,url}], updatedAt` (Admin adds `updatedById, etag`). Amenity: `id,name,isActive,updatedAt` (Admin adds `etag`). |
| `AuditEvent` | `id, actorId:null\|UUID, action, subjectType, subjectReference, summary, createdAt`; safe opaque/property references and allowlisted summary, never copied free text/contacts/credentials |

### 2.1 Property writes

`PropertyContent` fields:

```text
title, description, purpose, propertyType, priceNaira, negotiable,
state, city, neighbourhood, exactAddress, showExactAddress,
rentPeriod, bedrooms, bathrooms, toilets, furnishing, parkingSpaces,
floorAreaSqm, plotSizeSqm, titleDocumentType
```

Identity/owner/status/slug/publication/review/badge/views/audit fields are never writable through content. `amenityIds` is a unique UUID array; existing inactive selections may be retained, but new selections must be active. `state` accepts the canonical full names of all 36 Nigerian states plus `FCT` through one shared mapping (no arbitrary locations as states).

- Common submission requirements: title 10-120; description 50-5,000 plain-text characters; purpose/type; positive whole-naira price; negotiable boolean; state/city/neighbourhood/exactAddress; address shown by default. FOR_RENT requires PER_YEAR/PER_MONTH; FOR_SALE clears rentPeriod.
- HOUSE/APARTMENT_FLAT/DUPLEX/TERRACE: bedrooms/bathrooms/toilets integer 0-20, furnishing, parkingSpaces integer >=0; positive floorAreaSqm optional. LAND: positive plotSizeSqm, bounded non-empty plain-text titleDocumentType, no legal-title enum/document upload. COMMERCIAL/OFFICE/SHOP: positive floorAreaSqm and parkingSpaces >=0. Clear inapplicable fields on type changes; reject contradictory non-null fields in the same payload rather than retain them.
- Draft saves allow missing values, but all supplied non-null values obey type/range/length rules. Create defaults status DRAFT, negotiable false, showExactAddress true. Complete validation applies on submission and edits in Pending Review/Published/Under Offer/Closed. Archived records cannot regain a public state without complete submission/approval; an archived incomplete Draft remains possible.
- `GalleryInput` is a complete ordered array of `{assetId,caption,altText?,isCover}`. Array order defines positions 1..n; assets unique, verified READY, scoped to the listing and currently authorized. Missing altText may default to a descriptive caption; supplied blank/meaningless alt fails. At most 15; exactly one cover whenever non-empty; at least 3 for review/publication. Never accept delivery URLs/public IDs as authority.
- `CompleteSubmission` is `{content:PropertyContent, amenityIds:UUID[], gallery:GalleryInput}` with every applicable required content field and the full intended gallery/amenity state. It replaces these groups atomically; no client-writable status/owner. Validation returns all missing requirements; invalid/stale/unauthorized submission changes nothing.

## 3. Authentication and own account

FRS 6.1-6.2, 6.6, 7.1, 8-9; REV-021, 030; FR-AUTH-001..003, FR-AGT-001. No visitor signup, public admin bootstrap, admin-triggered reset or routine account deletion.

| ID / method and path | Purpose / permission | Request | Success / specific failures | Planned acceptance check |
|---|---|---|---|---|
| A01 `POST /auth/sign-in` | Sign in; Public | `{email,password}` | `200 {data:Me}` plus session establishment via reviewed server-only transport/BFF cookie handling; generic `401 INVALID_CREDENTIALS` for unknown/inactive/unactivated/locked/wrong password; request-level `429` without account disclosure | Five concurrent failures lock 15m; no account enumeration; no browser-visible token |
| A02 `POST /auth/sign-out` | Revoke current session; session credential if present | Empty body | `204`; idempotently clears cookie even if session absent/expired; valid session revoked server-side | Replay revoked token fails immediately |
| A03 `GET /me` | Current user/profile; Staff | None | `200 Me` + ETag | Session expiry/role/account rechecked, not browser claims |
| A04 `POST /auth/password-reset-requests` | Self-service reset; Public | `{email}` | Always generic `202 {data:{message:"If eligible, password reset instructions will be sent."}}`; eligible active activated account receives one current single-use 30m token; provider failures logged safely | Known/unknown/deactivated responses equivalent; resend atomically invalidates previous token; no activation bypass |
| A05 `POST /auth/password-resets` | Consume reset; Public with valid token | `{token,newPassword}` | `204`, no auto sign-in; revoke all sessions, clear caller cookie; `422 INVALID_OR_EXPIRED_TOKEN` generically for expired/used/ineligible token | Concurrent use succeeds once, 30m expiry, revoked sessions stay revoked |
| A06 `POST /auth/invitation-acceptances` | Activate password; Public with valid invitation | `{token,password}` | `204`, no auto sign-in; single-use 48h link; generic `422 INVALID_OR_EXPIRED_TOKEN` | Old/replaced links unusable; deactivated account cannot reactivate by invitation |
| A07 `PUT /me/password` | Password change; Staff | `{currentPassword,newPassword}` | `204`, revoke all sessions/clear cookie; `422 CURRENT_PASSWORD_INVALID` | Current password required; existing sessions fail after commit |
| A08 `PATCH /me` | Own profile; Staff (agent card consumes agent fields) | If-Match; `{name?,phone?,biography?,photoUrl?:null}`; photoUrl accepts only null to remove photo | `200 Me` + ETag; reject email/role/status or arbitrary photo URLs | Profile update cannot elevate role or attach foreign URL; removal schedules recoverable old-photo cleanup |
| A09 `PUT /me/photo` | Own profile image; Staff | If-Match; multipart `file` only | `200 Me` + ETag; `413/415/422` for oversized/unsupported/corrupt image; `503` provider unavailable | Backend validates actual JPEG/PNG/WebP <=5,000,000 bytes, uploads with server credentials, stores only verified own photo URL; external failure leaves old photo unchanged |

Profile-photo upload is bounded server-mediated multipart because DOC-07 stores a user photo URL, not a property gallery attachment. Never repurpose a property asset for a profile or accept arbitrary remote URLs. Track failed/abandoned replacement cleanup through existing media lifecycle/operational recovery; no new public media-management feature. Invitation/reset URLs use configured trusted frontend origin, not Host/user input; token fields are redacted from all logs. Token emails have no GET mutation/token-validation endpoint. First administrator is an authenticated operational bootstrap procedure outside the HTTP API; all later account mutations preserve at least one active activated administrator. No generic role-management endpoint is implied by the role enum.

## 4. Public discovery

FRS 4.3, 4.6, 5.1-5.6, 5.9-5.10; REV-001..006, 013, 017, 026, 032; FR-PUB-001..005, NFR-SEO-001.

Shared eligibility: PUBLISHED or UNDER_OFFER, active activated owning Agent, valid slug/original publishedAt. Shared public projection omits hidden exactAddress entirely. Private status/rejection/pending content must not leak through any search, ID filter, Featured/similar, sitemap, SSR, JSON-LD or social metadata.

| ID / method and path | Purpose / permission | Query/body | Success / specific failures | Planned acceptance check |
|---|---|---|---|---|
| P01 `GET /public/properties` | Search/home/favourites; Public | `page,pageSize=12,purpose,state,location,propertyType,minPriceNaira,maxPriceNaira,minBedrooms,minBathrooms,amenityId[],q,verifiedOnly,featuredOnly,id[],sort` | `200` paginated PropertyCard; `422` inconsistent price/range/filter values | All amenities match; total has same eligibility; stable newest/price ordering; unavailable IDs omitted |
| P02 `GET /public/properties/{slug}` | Detail; Public | Encoded single slug | `200 PropertyDetail`; formerly public but ineligible: `200 {data:{availability:"UNAVAILABLE",noindex:true,message:"This property is unavailable."}}`; never-public/private/unknown `404` | Generic unavailable payload contains no stored title/address/images/status/owner/pending edits; noindex reaches page |
| P03 `GET /public/properties/{slug}/similar` | Up to four similar listings; Public | None | `200 {data:PropertyCard[]}` max4, same type+city, exclude source; unknown/private `404`; unavailable source returns empty array | Only eligible targets; unavailable source reveals no private matching context |
| P04 `POST /public/properties/{slug}/views` | Approximate view increment; Public | Empty JSON object; no caller count/identity | `200 {data:{viewCount:string}}`; ineligible/private/unknown `404` | Atomic increments, client session repeat suppression, no visitor-marker records/fingerprinting |
| P05 `GET /public/settings` | Contact/WhatsApp/social values; Public | None | `200 Settings`; missing configuration `503` | No secret/admin-only/fixed-branding fields |
| P06 `GET /public/amenities` | Search and listing option labels; Public | `page,pageSize` | `200` paginated `{id,name,isActive}`; active options plus labels of inactive amenities still selected by eligible public listings; name asc,id asc | Deactivation removes new selection eligibility without losing existing public labels |
| P07 `GET /public/sitemap` | Backend feed for Next.js sitemap; Public | `page,pageSize` | `200` paginated `{slug,updatedAt}` sorted slug asc,id asc | Excludes private/inactive-owner listings; Next builds canonical URLs from trusted origin |

P01: `location` case-insensitive literal match across city/neighbourhood; `q` across title/description/neighbourhood, no raw SQL/regex syntax. Purpose/type/state use canonical enums/mapping. Integer minBedrooms/minBathrooms 0-20; a listing without the relevant residential facts cannot match those minimums. Price bounds positive whole-naira strings, min<=max. `sort=newest` default publishedAt desc,id desc; `price_asc` price asc,id asc; `price_desc` price desc,id desc. `amenityId[]` means repeated `amenityId`; deduplicate valid IDs, reject unknown filters rather than broaden results. Up to 50 unique `id` filters per request; favourites (max100 in browser) use bounded paginated batches and quietly drop unavailable IDs. No server favourites endpoint/account/table. `featuredOnly=true` yields all selected eligible cards (<=6); home reads default newest and displays the first eight. No separate home/Featured-count endpoint. Similar uses newest ordering among matches.

P02 returns a safe projection used for pages and metadata, not HTML. Next owns HTML SSR, canonical/meta/OG/Twitter/JSON-LD and actual sitemap.xml/robots.txt routes, with the exact concept notice in footer/detail. No API for About/Privacy/Terms/fixed branding or WhatsApp/share links; frontend constructs links from allowed public values. Direct-ID attempts either use P01's visibility-filtered IDs or return route 404; never add an unrestricted database-by-ID fallback. Public responses and metadata never reuse private preview payloads. P04 does not promise unique visitors and is not required for successful page rendering.

## 5. Agent listings and private preview

FRS 4.1-4.11, 6.3-6.4; REV-005, 008..011, 018, 023, 027..028, 032..033, 037..038; FR-LST-001..010, FR-AGT-001.

| ID / method and path | Purpose / permission | Request | Success / specific failures | Planned acceptance check |
|---|---|---|---|---|
| L01 `GET /agent/dashboard` | Own counts/rejections/latest inquiries; Agent | None | `200 {data:{listingCounts:{DRAFT,PENDING_REVIEW,PUBLISHED,UNDER_OFFER,CLOSED},latestInquiries:Inquiry[],rejectedListingCount}}`; latest max5 by createdAt desc,id desc | Count/latest data derived only from current ownership; rejected rows fetched through L02 |
| L02 `GET /agent/properties` | Own listing inventory; Agent | Pagination; `status` except ARCHIVED, `rejectedOnly`, `sort=updated_desc\|created_desc` | `200` paginated PrivateProperty; archived filter `422` | Other/archived properties absent; rejected filter uses current rejectionReason |
| L03 `POST /agent/properties` | Manual new Draft; Agent | `{content?:Partial<PropertyContent>,amenityIds?:UUID[]}` (empty object allowed) | `201 PrivateProperty` + ETag; new reference/owner, null slug/publication, empty gallery | Incomplete valid Draft saves; invalid supplied fields fail, no client-selected owner/status |
| L04 `GET /agent/properties/{id}` | Read own editable data; Owner | UUID | `200 PrivateProperty` + ETag; archived `404` | Cross-agent/direct/stale former-owner access is 404 |
| L05 `PATCH /agent/properties/{id}` | Save manual Draft or non-public retained content; Owner | If-Match; `{content?:Partial<PropertyContent>,amenityIds?:UUID[]}` | `200 PrivateProperty` + ETag; Published/Under Offer/Pending Review `409 INVALID_TRANSITION`; Archived `404`; Closed requires merged complete content | Public edits cannot be saved partially; Pending Review must be withdrawn before agent editing |
| L06 `POST /agent/properties/{id}/submissions` | Draft submission or complete public edit; Owner | If-Match; CompleteSubmission | `200 PrivateProperty` + ETag; source DRAFT/PUBLISHED/UNDER_OFFER only; `422` all completeness errors, `409` invalid source | Atomic content/gallery/amenities + Pending Review/submittedAt + Featured clearing + material Verified clearing + audit; original slug/date retained |
| L07 `PATCH /agent/properties/{id}/status` | Own permitted lifecycle action; Owner | If-Match; `{status}` | `200 PrivateProperty` + ETag; only Pending Review->Draft, Published<->Under Offer, Published/Under Offer->Closed, Draft/Closed->Archived; `409` otherwise | Full transition matrix, cannot self-publish; archive response is minimal `{id,status:"ARCHIVED"}` then future agent reads 404 |
| L08 `POST /agent/properties/{id}/duplicates` | Copy own non-archived property information; Owner | Empty object (read source under lock) | `201 PrivateProperty` + ETag, fresh Draft/reference | Copies content/amenities only; no images/inquiries/audit/badges/views/publication/submission identity |
| L09 `DELETE /agent/properties/{id}` | Eligible permanent Draft removal; Owner | If-Match; no body | `204`; `409 DEPENDENT_RECORDS` or `INVALID_TRANSITION` | Only never-published DRAFT without dependent business records; images alone do not block, safe audit survives/cleanup scheduled |
| L10 `GET /properties/{id}/preview` | Explicit private presentation; Owner or Admin | UUID | `200 Preview`, private/no-store + `X-Robots-Tag: noindex, nofollow`; Agent archived `404` | Current ownership, partial Draft identified, never cached/indexed or exposed by public endpoint |

L07 status changes do not perform content edits. Under Offer/public transitions revalidate full gallery/content/owner eligibility. Close is retained CLOSED (Sold for sale, Let for rent inferred from purpose), not a new status or caller-selected sale label. Archived is hidden from agents; Admin retains access. Rejection reason is private and displayed only on authorized portal records. Public edit form reads/invalid submission do not mutate anything. Slug and publishedAt are created only on first approval and never reset.

## 6. Administrator listings and agent administration

FRS 4.6-4.11, 7.1-7.2; REV-006, 008..009, 012, 018, 021, 024, 026..033, 037; FR-ADM-001, FR-LST-004..010, FR-AUTH-003.

| ID / method and path | Purpose / permission | Request | Success / specific failures | Planned acceptance check |
|---|---|---|---|---|
| M01 `GET /admin/properties` | Inventory/review queue; Admin | Pagination; `status,ownerId,verified,featured,sort=updated_desc\|submitted_asc` | `200` paginated PrivateProperty; status=PENDING_REVIEW defaults submitted_asc, otherwise updated_desc | Oldest latest-submission first (id asc ties), not creation date; includes Archived |
| M02 `GET /admin/properties/{id}` | Read any listing; Admin | UUID | `200 PrivateProperty` + ETag | No agent authorization shortcut; current version reviewed |
| M03 `PATCH /admin/properties/{id}` | Validated direct edit; Admin | If-Match; `{content?:Partial<PropertyContent>,amenityIds?:UUID[],gallery?:GalleryInput}` | `200 PrivateProperty` + ETag; merged required completeness by status; `422` invalid content/gallery | No extra agent review; same material Verified clearing, audit, public cache invalidation; gallery atomic |
| M04 `PATCH /admin/properties/{id}/status` | Moderate/archive/restore; Admin | If-Match; `{status,reason?}` | `200 PrivateProperty` + ETag; Pending Review->Published approval; Pending Review->Draft rejection reason required; Published/Under Offer->Draft unpublish reason required; any non-Archived->Archived; Archived->Draft; `409` other transitions | Stale approval rejected; valid first publication identity generated; reject keeps current content, archive clears Featured |
| M05 `PATCH /admin/properties/{id}/badges` | Verified/Featured control; Admin | If-Match; `{verified?:boolean,featured?:boolean}`, at least one | `200 PrivateProperty` + ETag; `409 FEATURED_LIMIT` at seventh, `409 INVALID_TRANSITION` when featuring ineligible record | Verified stores actor/time or clears all metadata; independent of approval; global <=6 under concurrency |
| M06 `PATCH /admin/properties/{id}/owner` | Reassign one listing; Admin | If-Match; `{ownerId}` | `200 PrivateProperty` + ETag; `422` target not active activated Agent | Preserves status/slug/date/badges where eligible; version invalidates stale edits; inquiry/notes/future notification access follows new owner |
| M07 `DELETE /admin/properties/{id}` | Eligible permanent Draft removal; Admin | If-Match | `204`; same `409` rules as L09 | No override for published/business-dependent history |
| U01 `GET /admin/agents` | Agent roster/assignment options; Admin | Pagination; `accountStatus,activated:boolean,sort=created_desc\|name_asc` | `200` paginated AgentAccount | Includes only AGENT accounts; no secrets/token values |
| U02 `POST /admin/agents` | Create and invite Agent; Admin | `{name,email,phone}` | `201 {data:{agent:AgentAccount,invitationDelivery:"PENDING"\|"SENT"\|"FAILED"}}`; `409 EMAIL_IN_USE` | Account + single-use 48h invitation persisted before send; failure doesn't erase account; role fixed AGENT |
| U03 `GET /admin/agents/{id}` | Agent details; Admin | UUID of AGENT | `200 AgentAccount` + ETag | Administrator UUID is not an agent resource |
| U04 `POST /admin/agents/{id}/invitations` | Resend invitation; Admin | If-Match; empty object | `202 {data:{agentId,delivery:"PENDING"\|"SENT"\|"FAILED"}}`; `409` if activated/deactivated | Replacement revokes previous invitation atomically; never an admin password reset |
| U05 `PATCH /admin/agents/{id}/account-status` | Normal/emergency deactivation or reactivation; Admin | If-Match; `{accountStatus,mode?:"NORMAL"\|"EMERGENCY",reason?}` | `200 AgentAccount` + ETag; mode required for deactivation, emergency reason required; normal `409 PROPERTIES_REQUIRE_REASSIGNMENT` if any owned property remains | Lock/recheck assignments; revoke all sessions immediately; emergency moves owned public statuses to Draft with safe reason/cleared Featured; reactivation does not republish |

All routes preserve last-active-activated-admin invariant; agent-only paths cannot mutate an administrator. No additional admin-account creation/role-switch endpoint is required by Version 1; bootstrap and any controlled account maintenance must enforce the invariant independently. Agent contact/profile edits are self-service A08; no unnecessary general user CRUD. Reassign individually before normal deactivation (including retained Archived properties), without a new bulk-transfer feature. Already-deactivated status request may return current state if precondition matches; emergency effects remain atomic/audited. Reassignment is never implicit approval and cannot undo emergency unpublication.

M05 Verified denotes simulated additional checks, not valuation/title assurance. Verification does not publish a listing, bypass completeness validation or require Featured. A subsequent material change to price/purpose/type/location (including exact address) clears verified/verifier/time in the same transaction. Featured requires eligible public status, max six globally; false clears featuredAt. Returning to review, archive, unpublish, close or owner ineligibility clears Featured. Feature-only requests do not change publication time or create configurable display-count/order settings.

## 7. Property image uploads and gallery management

FRS 4.5, 4.8-4.9, 9.4; REV-003..004, 023, 025..028, 037; FR-LST-003, FR-LST-005..007. `propertyId` below identifies the authoritative listing scope; Agent Archived access is 404. Staff must have Owner or Admin authority at every signing/verification/attachment step.

| ID / method and path | Purpose / permission | Request | Success / specific failures | Planned acceptance check |
|---|---|---|---|---|
| I01 `POST /properties/{id}/uploads` | Create scoped intent and sign Cloudinary upload; Owner or Admin | `{fileName,byteSize,mimeType}`; allowlisted declared format, bytes 1..5,000,000; filename display/validation only | `201 {data:{assetId,uploadUrl,expiresAt,parameters:{...allowlistedSignedFields}}}`; `413/415/422` invalid declaration | Record unique never-reused ID before signature; expires within 10m, fixed properties folder/type/size, no arbitrary destination/signing input |
| I02 `POST /properties/{id}/uploads/{assetId}/verification` | Verify received upload, leave unattached; Owner or Admin | Empty object; never caller metadata/URL/publicId | `200 {data:{assetId,state:"READY",url,width,height,mimeType,byteSize}}`; `409` upload not ready/retired/attached elsewhere, `422` invalid content, `503` provider unavailable | Fetch/inspect authoritative provider metadata and actual decodable structure, reject corrupt/spoofed/oversized content; scope+ownership rechecked |
| I03 `PUT /properties/{id}/images` | Replace non-public gallery or admin direct gallery edit; Owner or Admin | If-Match property; `{gallery:GalleryInput}` full desired gallery | `200 PrivateProperty` + ETag; Agent only DRAFT (Closed allowed only with complete merged content); public/Pending Review Agent change `409`; `422` count/cover/content failures | Add/remove/reorder/cover/caption/alt in one transaction; READY scope, current ownership, count/cover locks; Admin public changes require full merged completeness |

Upload authorization is only a narrow Cloudinary upload capability, never a database credential or general Cloudinary signing endpoint. Parameters are generated server-side, with provider-supported restrictions validated in PH-DESIGN-004; declarations alone never prove content/size. Browser may send image bytes directly to Cloudinary with this capability; all application intent/verification/attachment calls use the BFF. If Cloudinary cannot enforce a required pre-upload restriction, the reviewed implementation must bound upload handling and reject/clean invalid assets before READY; no acceptance based solely on a signature.

Public gallery editing is local form state: new READY uploads remain unattached until L06 complete submission (Agent) or M03/I03 validated direct edit (Admin). I03 must never remove/reorder/edit a live gallery for an Agent. Removed attachments schedule recoverable cleanup after commit; preserve remaining cover/minimums. Unused verified and unverified intents are cleaned by bounded maintenance with grace/expiry and attach-versus-cleanup serialization per DOC-07, not a browser arbitrary-publicId delete or manual cleanup UI. An upload verification may safely repeat for the same scoped READY asset; DELETE_PENDING/DELETED never become READY again. No image sharing on duplicate or cross-listing moves. A09 profile photo is separate from property gallery scope.

## 8. Inquiries, notes, notifications and controlled privacy deletion

FRS 5.7-5.8, 6.5, 7.3, 8-9; REV-007, 012, 014..016, 019..020, 030..031, 034, 036; FR-INQ-001..004, NFR-SEC-005.

| ID / method and path | Purpose / permission | Request | Success / specific failures | Planned acceptance check |
|---|---|---|---|---|
| Q01 `POST /public/inquiries` | Submit general/property inquiry; Public | `InquiryInput` below | `201 {data:{id,status:"NEW",message:"Your inquiry has been received."}}` after durable commit; `409 DUPLICATE_INQUIRY`, `404` unavailable property; no delivery status/recipient exposure | Persist inquiry + notification slots before sends; provider outage still returns success; duplicate race creates one |
| Q02 `GET /agent/inquiries` | Current-property inquiries; Agent | Pagination; `status,propertyId,from,to,sort=created_desc\|created_asc` | `200` paginated Inquiry; inaccessible property filter `404` | New owner sees history, former owner loses it; general contacts absent |
| Q03 `GET /admin/inquiries` | Oversight, including general; Admin | Same plus `agentId,inquiryType`; optional `propertyId` | `200` paginated Inquiry | Agent filter derives current property owner; totals don't retain former ownership |
| Q04 `GET /inquiries/{id}` | Read inquiry; current Owner or Admin | UUID | `200 Inquiry` + ETag | Direct-ID/former-owner denied; no delivery PII/internal state |
| Q05 `PATCH /inquiries/{id}/status` | Handle/close/reopen; current Owner or Admin | If-Match; `{status,viewingAgreed?:true}` | `200 Inquiry` + ETag; `409 INVALID_TRANSITION/PRIVACY_RESTRICTED` | New->Contacted, New/Contacted->Viewing Scheduled only with agreement; any->Closed; Closed->Contacted; no reset to New/status emails |
| Q06 `GET /inquiries/{id}/notes` | Read private notes; current Owner or Admin | Pagination; fixed createdAt asc,id asc | `200` paginated Note | Auth follows current property ownership, not note author |
| Q07 `POST /inquiries/{id}/notes` | Append private note; current Owner or Admin | `{body}` | `201 Note`; `409 PRIVACY_RESTRICTED` after/due anonymisation | Append only, no note-edit/delete API; stale owner and late PII writes blocked |
| Q08 `GET /admin/inquiries/{id}/notifications` | View simple per-recipient delivery status; Admin | None | `200 {data:Notification[]}` max3 | Pending/failed/unknown visible; sanitized errors, no immutable attempt history |
| Q09 `POST /admin/inquiries/{id}/notifications/{notificationId}/retries` | Manual controlled send/recovery; Admin | `{acknowledgePossibleDuplicate?:true}`; required true for UNKNOWN | `202 {data:Notification}` after guarded claim; `409 SEND_IN_PROGRESS/INVALID_TRANSITION/PRIVACY_RESTRICTED` | FAILED/UNKNOWN or stranded PENDING only, not SENT/CANCELLED/current SENDING; serialize retries, resolve current owner, fence cleanup/stale completion |
| Q10 `DELETE /admin/inquiries/{id}` | Controlled verified data-subject deletion; Admin after verification | If-Match; `{verification:{confirmed:true,reference:string}}` (opaque non-PII operational verification reference) | `204`; `422` absent/invalid verification, `409` active privacy/transaction conflict | No casual delete/agent delete; verify authority outside request checkbox, remove inquiry/child identifying data, cancel/fence sends, preserve safe audit/restore references |

`InquiryInput`:

```text
{ propertyId?:UUID, name, phone, email, message, inquiryType,
  preferredViewingDate?:date, preferredViewingTimeSlot?:string,
  consent:true, website?:"" }
```

Name/phone/email/message are required; message 10-1,000; consent must be true. `website` is an empty honeypot; non-empty returns generic `422 INVALID_SUBMISSION` with no inquiry/email side effect. Visitor cannot supply status/owner/agent/notification recipient/snapshots. GENERAL permits null property (Contact) or an eligible property; VIEWING_REQUEST requires an eligible property, preferred date/time slot, date strictly after today's date and no later than 60 days ahead using Africa/Lagos server date. GENERAL rejects preferred viewing fields. Time slot is a bounded preference, not availability or a confirmed booking.

Express copies property title/slug/reference snapshots under lock. Duplicate rejection is identical normalized sender phone + canonical message within ten minutes globally, implemented by the short-lived HMAC guard; not a lifetime sender/visitor identity. Concurrent property deletion/visibility/reassignment must be checked before commit. Property inquiries create current-owner/admin/visitor slots; general inquiries admin/visitor. Recipients are resolved from current ownership, trusted configured admin contact and validated inquiry email, never request fields. `201` confirms storage only; initial bounded send happens after commit without changing storage success into email failure. Missing recipient/provider configuration is surfaced operationally; persisted inquiry is retained.

Q05 `viewingAgreed:true` is required only on entry to VIEWING_SCHEDULED, based on real agent/visitor agreement. This is an auditable staff assertion, not a browser-supplied appointment record/calendar integration. Close from any state; reopening always CONTACTED, even if formerly scheduled; scheduling again requires agreement. Repeating the current state is a no-op with valid precondition and cannot bypass agreement. General inquiries are managed by Admin. No staff visitor-detail edit, unread state, CSV, status-change email or messaging endpoint.

Q09 acknowledges possible duplicate delivery after uncertain provider acceptance; no exactly-once claim. Guarded dispatch linearizes against reassignment; future/unsent mail uses new owner, already-dispatched mail cannot be recalled. A bounded recovery process turns timed-out SENDING into UNKNOWN and exposes interrupted PENDING for manual recovery; no automatic retry scheduler. Privacy cleanup cancels/fences pending sends and removes identifying delivery data.

At 24 months from creation, automatic bounded anonymisation clears contact fields, message/note bodies and identifying snapshots/delivery data; retain only permitted non-identifying context. Reads expose nulls, and due/anonymized inquiries reject new notes/retries (`409 PRIVACY_RESTRICTED`) and changes that could recreate PII. Q10 is a verified deletion path, not automatic deletion instead of retention; `confirmed:true` alone is not proof of requester identity. PH-DESIGN-003/004 must define authorized verification procedure and retention obligations before enabling it. No identity-document upload feature. Restore must reconcile safe deletion/anonymisation references before serving/sending restored data.

## 9. Settings, amenities and audit

FRS 4.3, 7.4-7.5, 8-9; REV-020, 022, 024; FR-ADM-002..003.

| ID / method and path | Purpose / permission | Request | Success / specific failures | Planned acceptance check |
|---|---|---|---|---|
| S01 `GET /admin/settings` | Read mutable settings; Admin | None | `200 Settings` + ETag; missing singleton `503` | No invented fallback contacts/secrets |
| S02 `PATCH /admin/settings` | Update approved values; Admin | If-Match; any of `{contactEmail,phone,whatsappNumber,address,socialLinks:[{label,url}]}` | `200 Settings` + ETag; `422` bad contacts/unsafe URL | Bounded array max10 unique labels; http/https URLs only, no javascript/data/userinfo; reject branding/notice/banner/featuredCount; audit safely |
| S03 `GET /admin/amenities` | All options including inactive; Admin | Pagination; `isActive`; name asc,id asc | `200` paginated Amenity | Existing inactive selections retained |
| S04 `POST /admin/amenities` | Extend selectable list; Admin | `{name}` | `201 Amenity` + ETag; `409 NAME_IN_USE` | Trimmed case-insensitive uniqueness; no duplicate semantic labels |
| S05 `PATCH /admin/amenities/{id}` | Rename without meaning change or deactivate/reactivate; Admin | If-Match; `{name?,isActive?}` | `200 Amenity` + ETag; `409 NAME_IN_USE` | New selections use active only; old selections survive; changed meaning requires deactivate/create, no delete cascade/history feature |
| S06 `GET /admin/audit-logs` | Browse/filter immutable events; Admin | Pagination; `actorId,action,subjectType,subjectReference,from,to,sort=created_desc\|created_asc` | `200` paginated AuditEvent | Action/type allowlists; safe summaries, opaque historical references survive deletion; no edit/delete route |

Social labels are plain text 1-40 characters; URLs are configuration, never server-fetch targets. Audit retains at least 12 months and excludes inquiry/contact/note/reason bodies, hidden addresses, copied titles and secrets; summaries name changed fields/actions, not their sensitive values. Notification email settings may change future recipients only through validated trusted configuration. Branding, tagline and concept notice remain fixed application content.

S06 action filter allowlist: `SIGN_IN_SUCCEEDED, SIGN_IN_FAILED, SIGNED_OUT, AGENT_CREATED, INVITATION_ISSUED, PASSWORD_ACTIVATED, PASSWORD_RESET_REQUESTED, PASSWORD_RESET, PASSWORD_CHANGED, ACCOUNT_DEACTIVATED, ACCOUNT_REACTIVATED, PROFILE_UPDATED, PROPERTY_CREATED, PROPERTY_EDITED, PROPERTY_SUBMITTED, PROPERTY_STATUS_CHANGED, PROPERTY_BADGES_CHANGED, PROPERTY_REASSIGNED, PROPERTY_DUPLICATED, PROPERTY_DELETED, INQUIRY_STATUS_CHANGED, INQUIRY_ANONYMIZED, INQUIRY_DELETED, SETTINGS_UPDATED, AMENITY_CREATED, AMENITY_UPDATED`. Subject types: `USER, PROPERTY, INQUIRY, SETTINGS, AMENITY, SECURITY`. Unknown-account security events use null actor and a safe opaque security reference, never attempted email. Status/badge changes are distinguished by safe old/new enum/boolean summaries, not full record snapshots. This is an API enum for significant events, not an additional history system.

## 10. Coverage, review and remaining gates

Each route's ID, role, request/projection, status/rules and planned acceptance check above is its contract traceability; group references map to FRS/REV and DOC-03 IDs. Checks for unimplemented routes remain **planned**. DOC-05 records the actual local test evidence for the bounded A01-A03 authentication slice; it does not verify the other endpoints.

| Scope | Contract coverage / planned evidence |
|---|---|
| Authentication/account/profile | A01-A09, U01-U05; FRS 13.9, 13.10, 13.18; session/token/last-admin concurrency and no browser secrets |
| Public discovery/SEO/favourites/views | P01-P07; FRS 13.1-3, 13.6, 13.11, 13.15; visibility/address projection on every path, stable filters and SSR metadata |
| Drafts/content/submission/preview/duplicate/delete | L01-L10; FRS 13.4-7, 13.14-15; partial-vs-complete validation, atomicity, stale writes, no old-version restoration |
| Moderation/badges/ownership/deactivation | M01-M07, U01-U05; FRS 13.7, 13.10, 13.14, 13.18; sixth/seventh-feature races, current ownership and revocation |
| Images/profile photos | I01-I03, A09, L06/M03; FRS 13.5, 13.7, 13.16; boundary bytes, corrupt/spoofed content, orphan/attach/delete/cover races |
| Inquiries/notes/privacy/notifications | Q01-Q10; FRS 13.8, 13.13, 13.17; outage persists, former-owner denial, send/retry/cleanup/restore races |
| Limited settings/audit | S01-S06; FRS 13.18; unknown/fixed-setting rejection, safe immutable audit |

No genuine approved-scope conflict was found. DOC-06/07 are synchronized designs awaiting owner acceptance; this contract uses them without claiming acceptance. The owner's subsequent bounded authentication implementation resolves A01-A03 details in Section 1.5; it does not accept the entire design/roadmap. PH-DESIGN-003/004 still cover remaining workflows/security, provider proxy/abuse configuration, privacy and upload restrictions. Verify provider capabilities before deployment; no provider feature, limit or exactly-once delivery promise is assumed here.

The initial PH-DESIGN-002 task created only this contract. Subsequent authentication implementation covers User/Session/Invitation/PasswordResetToken, bootstrap, A01-A07, U02/U04, focused account audit events and their tests/transport. Existing `/health` remains process liveness outside the versioned domain API; readiness belongs to assigned setup/backend work. No extra CRUD for supporting token/session/asset/duplicate-guard tables, retention jobs or audit mutation is exposed. Remaining implementation requires its separate roadmap authorization; no deployment or whole-task acceptance is claimed.
