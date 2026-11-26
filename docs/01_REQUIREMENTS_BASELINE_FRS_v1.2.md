# Prime Haven Properties — Requirements Baseline

**Document type:** Functional and non-functional requirements specification

**Requirements version:** FRS v1.3

**Status:** Current owner-approved requirements; implementation and acceptance evidence tracked separately

**Project:** Fictional Nigerian real-estate listings platform

## Source and version control

This FRS v1.3 retains unchanged v1.2 requirements and applies all REV-001 through REV-038 in [the approved scope record](PRIME_HAVEN_APPROVED_SCOPE_DECISIONS.md). That record is the explicit approval evidence for these changes. The original source PDF remains unchanged. Git preserves previous tracked versions; the version and changelog in this existing file identify the current baseline. The filename is retained for stable references. Historical statements are not active requirements or proof of earlier approval.

**Interpretation rule:** v1.3 is the active consolidated FRS. The approved scope record supersedes older conflicting requirements; do not infer new approvals from technical proposals. Preserve unchanged requirements. Architecture and ordinary implementation choices belong in DOC-02 and the detailed designs. This documentation update does not authorize implementation.

---

# Prime Haven Properties — Functional and Non-Functional Requirements (FRS v1.3)


## 1. Purpose and concept notice

Prime Haven Properties is a fictional estate-agency property listings platform in Nigeria. Visitors browse, search and filter properties for sale or rent and contact the agency. Agency staff manage listings through secure portals.

All listings, agents, prices and images must be fictional or properly licensed sample content. Display `Concept project: listings are fictional` in the footer and on every listing page.

## 2. Interfaces and roles

### 2.1 Interfaces
- Public Website
- Agent Portal
- Administration Portal

### 2.2 Roles
- **Visitor:** browse public listings, search/filter, save favourites on their device and submit inquiries/viewing requests. No account.
- **Agent:** manage own listings, images, inquiries and profile.
- **Administrator:** manage agents, moderate all listings, oversee inquiries, configure settings and review audit logs.

Every authenticated user has exactly one role. Only administrators assign roles. Users cannot change their own role. Server-side authorization is mandatory for every protected request.

## 3. Data and relational model requirements

The system uses PostgreSQL. Use relational terminology: tables, rows, columns, primary keys, foreign keys, constraints and indexes. The logical entities include Users, Properties, Property Images, Inquiries, Inquiry Notes, Sessions, Audit Log, Settings and any supporting entities justified during database design.

Relationships:
- Each property belongs to exactly one agent.
- An agent may own many properties.
- A property may receive many inquiries.
- An inquiry refers to zero or one property and stores a snapshot of the property's title, slug and reference.
- Each property image belongs to exactly one property.
- A property has at most 15 images and exactly one cover image when it has images; a listing must have a cover image before submission.
- Each audit entry references the acting user and the affected record where applicable.
- Sessions belong to a user and must support immediate revocation.

Visitors must never see non-public listings. Listings are archived rather than destroyed when historical inquiries or other records must remain meaningful.

## 4. Property listings

### 4.1 Common fields
Required on submission: title (10-120 characters), description (50-5,000 plain-text characters with line breaks), purpose (For Sale/For Rent), type (House, Apartment/Flat, Duplex, Terrace, Land, Commercial, Office, Shop), positive whole-naira price, negotiable yes/no, state (36 states or FCT), city/LGA, neighbourhood and one exact address containing house number/street/necessary details. Rentals require period (per year/per month); sale listings have no rent period.

Exact address is visible by default with an agent-controlled privacy toggle. Do not create redundant street/exact-address fields. When hidden, exclude the address from every public response, SSR output, metadata, structured data and cache. Draft completeness follows 6.4.

### 4.2 Type-specific fields
- Residential: bedrooms, bathrooms and toilets (each 0-20), furnishing (Unfurnished/Semi-furnished/Furnished) and non-negative parking spaces required; positive floor area optional.
- Land: positive plot size in square metres and non-empty validated title-document description text required; no controlled legal-title categories, floor-area requirement, document upload or legal verification.
- Commercial/Office/Shop: positive floor area in square metres and non-negative parking spaces required.
- Inapplicable fields are not required; clear them when type changes. Server validation follows the selected type. Supplied Draft values must be valid but may be incomplete.

### 4.3 Amenities
Amenities are multi-select. Initial examples include water supply, prepaid meter, gated estate, perimeter fence, security, borehole, generator, air conditioning, swimming pool, gym, CCTV, parking, boys' quarters, fitted kitchen and serviced property. Administrators can extend the list. Search by selected amenities requires a listing to contain **all** selected amenities.

### 4.4 Reference and slug
Each listing receives a unique reference such as `PH-000123`. The slug is generated from the title plus a short unique suffix. Slugs are unique and do not change after first publication, even if the title changes.

### 4.5 Images
- Minimum 3 images before submission; maximum 15; exactly one cover whenever images exist. Agents can reorder and choose the cover.
- JPEG/JPG, PNG and WebP only, maximum **5,000,000 bytes** each. Reject unsupported, invalid or corrupt content; verify actual type/structure, not extension or browser MIME alone.
- Every image requires a short visible caption and meaningful editable alt text. A descriptive caption may default the alt text.
- Backend issues short-lived signed Cloudinary upload authorization (expiry within 10 minutes) restricted to the properties folder and allowed file type/size. Check role and ownership before signing.
- Verify Cloudinary metadata and upload ownership/authorized attachment scope before attachment. Never accept arbitrary browser-supplied asset identifiers or delivery URLs as evidence.
- Removing images or deleting eligible listings schedules recoverable Cloudinary cleanup. Include abandoned verified and unverified uploads; serialize attachment against cleanup. Do not share image references during duplication.

### 4.6 Listing statuses
- Draft
- Pending Review
- Published
- Under Offer
- Closed (Sold or Let)
- Archived

Only Published and Under Offer listings with an active, activated owning agent are public. Previously public unavailable URLs follow 5.5; Archived listings are hidden from agents and public listing content. Administrators retain oversight.

### 4.7 Allowed status transitions
**Agent, own listings only:**
- Published or Under Offer -> Pending Review (submit complete valid edited content; Section 4.8)
- Draft → Pending Review (submit)
- Pending Review → Draft (withdraw)
- Published ↔ Under Offer
- Published or Under Offer → Closed
- Draft or Closed → Archived

**Administrator, any listing:**
- Pending Review → Published (approve)
- Pending Review → Draft (reject; reason required)
- Published or Under Offer → Draft (unpublish; reason required)
- Any status → Archived
- Archived → Draft

No other transitions are allowed unless a formally approved requirements change is recorded.

### 4.8 Editing public listings (REV-008, 027, 028, 032, 037)
Opening/editing a form does not change the public record. Agent edits to Published and Under Offer listings must be complete and valid before submission; invalid submissions leave the stored content and public availability unchanged. Do not persist incomplete replacement content or a separate revision for an existing public listing.

One transaction applies valid content, images and amenities, sets Pending Review and submission time, clears Featured, removes Verified for material price/purpose/type/location changes, and records a concise audit event. The listing then becomes unavailable until administrator approval. Approval publishes the current reviewed record; rejection returns it to Draft with a reason and does not restore an earlier public version. There is no separate revision/history system.

Preserve the unique slug and original first-publication date through review, rejection and republication. Administrator direct edits are complete, validated, audited and invalidate Verified on the same material changes; they do not require an extra agent-submission workflow. Stale requests must not overwrite newer content or ownership.

Public gallery edits follow the same atomic submission boundary: new uploads remain unattached until valid submission; removing/reordering/replacing public images must not change live content merely while editing the form.

### 4.9 Publishing requirements
A listing can be submitted only when all required fields are valid, it has at least three images and a cover image is selected. The system must list every missing requirement. Frontend validation assists the user; backend validation is authoritative.

### 4.10 Verified and Featured
Only administrators set Verified or Featured. Verified represents simulated additional agency checks, separate from publication approval, and is not an independent valuation or title guarantee. Record verifier and time; clear all current verification metadata when removing the badge. Material price, purpose, property type or location changes require reverification, including administrator edits.

Select zero to six eligible public listings globally as Featured. Display all selected eligible listings; hide the section at zero. Unfeature a listing before selecting a seventh. There is no configurable display-count setting. Clear Featured when returning to review and whenever a listing becomes ineligible; enforce the cap under concurrent administration.

### 4.11 Deletion and archiving
Only a Draft that has never been published and has no dependent business records (including inquiries) qualifies for permanent deletion by its owner or an administrator. All others use archival. Images and audit records alone must not prevent eligible deletion: remove attachment metadata, schedule recoverable external cleanup and preserve relevant non-identifying audit references. Do not add lifetime inquiry tracking solely to decide deletion eligibility.

## 5. Public Website

### 5.1 Pages
Home, Listings, Listing Detail, Favourites, About, Contact, Privacy Policy, Terms and custom 404.

### 5.2 Home
Hero search (purpose, location, property type, maximum price), featured listings, eight most recent eligible public listings by original publication date and a short explanation of the agency's checking process.

### 5.3 Search and filters
Filters: purpose, state, city/neighbourhood, property type, min/max price, minimum bedrooms, minimum bathrooms, amenities (all selected amenities must match), keyword (title, description, neighbourhood) and Verified only. Sort: Newest by original publication date (default), Price low to high, Price high to low. Show 12 results per page with pagination and total count. Filters, sorting and page number persist in the URL query string. Empty results show a clear no-results message and Clear Filters action; no smart suggestions. Only Published and Under Offer are returned.

PostgreSQL search implementation should be selected during technical design. Evaluate full-text search and trigram matching where appropriate; do not prescribe a MongoDB text index.

### 5.4 Listing cards and details
Cards show cover image, price and rental period where applicable, title, neighbourhood/city, key facts and applicable badges. A heart control saves the listing to local favourites.

Detail pages show gallery (touch swipe, keyboard navigation and lightbox), title, price, rent period, negotiable label, badges, reference, publication date, key facts, description, amenities, public location, required exact address shown unless privacy is enabled, agent card, inquiry form, WhatsApp action, share actions and up to four similar listings (same type and city). An approximate view counter uses browser session repeat prevention and a server-controlled atomic increment. It is not exact unique-visitor analytics; do not add server visitor-marker tables, fingerprinting or personal tracking. Display the concept notice.

### 5.5 Closed/unavailable listings
Previously public listings that are now Closed, Archived, unpublished or Pending Review display a generic unavailable page, excluded from indexing. Do not disclose stored private content, hidden addresses or pending edits; public similar listings may be shown where appropriate. Never-published private records return 404, including direct-ID and slug attempts. Authorized owner/admin preview is separate and private.

### 5.6 Favourites
Visitors can save up to 100 listings without an account using browser local storage. Storage access is wrapped in error handling. The site remains usable when storage is unavailable. The Favourites page displays still-available listings and quietly removes unavailable ones.

### 5.7 Inquiry and viewing request
Fields: name (required), phone (required), email (required), message (required, 10–1,000 characters), inquiry type (General inquiry or Request a viewing), preferred viewing date and time slot (for viewing requests; date within the next 60 days) and required consent checkbox. Accept Nigerian local or international phone input and store normalized international format.

On submission:
1. Validate server-side.
2. Persist the inquiry.
3. Attempt notifications to the current owning agent and configured administrator for a property inquiry; general inquiries notify the administrator.
4. Show visitor confirmation.
5. Attempt visitor confirmation to the required valid submission email.
6. If email delivery fails, retain the inquiry and log delivery failure.

Anti-spam controls: honeypot, rate limiting and rejection of identical messages from the same sender within 10 minutes.

**Viewing request clarification:** submission is a request, not a confirmed appointment. The agent contacts the visitor to agree availability. Only after agreement does the agent set `Viewing Scheduled`. No automated calendar booking is included in Version 1.

### 5.8 Notifications
Property inquiries notify the current owner agent, administrator and visitor; general inquiries notify administrator and visitor. Administrator recipient comes from approved server configuration/contact settings, never browser input. Retain invitation and self-service password-reset emails. No routine inquiry status-change emails.

Commit inquiry and simple pending notification records before sending. Track per-recipient status and sanitized errors; authorized administrators can manually retry failed notifications. Resolve agent recipients using current property ownership, including after reassignment, and prevent simultaneous sends. Recover interrupted sends without claiming exactly-once delivery; uncertain provider outcomes may cause duplicates. No elaborate job platform, automatic retry scheduler or immutable per-attempt history. Cancel pending sends and remove identifying delivery data during privacy cleanup.

### 5.9 WhatsApp and Contact
WhatsApp opens a `wa.me` link to the agent number or agency number from settings with a prefilled message containing listing title and URL. Contact page shows agency address, phone, email and WhatsApp number; general contact inquiries are stored without a property and routed to the administrator.

### 5.10 SEO and sharing
Every page is server-rendered with unique title, meta description and canonical URL. Listing pages include Open Graph and Twitter card metadata with a 1200×630 cover image. Listing URLs use `/properties/{slug}`. Generate sitemap.xml for eligible public listings and robots.txt. Apply the same visibility/address policy to SSR, direct lookups, metadata, similar/Featured results and caching; coordinate cache invalidation with visibility/privacy changes rather than serving stale private content. Listing pages include JSON-LD describing property and price. Unavailable listing pages are noindex.

## 6. Agent Portal

### 6.1 Authentication
Email/password sign-in. Password minimum 10 characters; store salted password hashes using Argon2id or bcrypt. Lock account for 15 minutes after five failed attempts. Sessions use HTTP-only, Secure and SameSite cookies; expire after 12 hours of inactivity or seven days absolute; logout immediately revokes the session. Password reset uses a single-use emailed link valid 30 minutes. Password change requires current password.

**Approved session architecture:** PostgreSQL-backed server-managed sessions using cryptographically random opaque tokens. Store only a hash of the session token. Enforce idle and absolute expiry server-side. Revoke sessions on logout, password/security events as specified, and agent deactivation. Never log raw session tokens. Cookie domain, SameSite mode, CSRF protections and cross-origin configuration must be finalized in technical design.

### 6.2 Account activation
Administrator creates the agent account. Agent receives an invitation email with a set-password link valid 48 hours. Account cannot sign in until password activation completes. This is separate from administrator-controlled deactivation; invitation acceptance cannot reactivate a deactivated account.

### 6.3 Dashboard
Show own listing counts by status, latest inquiries and rejected listings requiring changes with rejection reason.

### 6.4 Listing management
Create, edit, duplicate, preview, submit, withdraw, mark Under Offer/Closed and archive own listings. Manual Save Draft allows incomplete new Drafts; validate supplied values and warn before leaving with unsaved changes. No autosave. Existing public listing edits follow 4.8 and cannot be saved as incomplete replacement content.

Owner agents and administrators may privately preview using the public presentation where sensible; preview is not a status and must be authorized server-side and excluded from public caching/indexing. Agents cannot view/edit/list another agent's listings; unauthorized attempts return not found.

Duplication copies property information into a new Draft with a new reference. Copy no images/references, inquiries, audit history, approvals, Verified/Featured flags or view counts; no publication slug/date is inherited.

### 6.5 Inquiry management
List inquiries for currently owned properties; filter by status, listing and date. New means unprocessed; no separate unread tracking. States: New, Contacted, Viewing Scheduled, Closed. Close from any status; reopen Closed to Contacted. Viewing Scheduled requires an agreed appointment, including after reopening. Agents may add private notes but cannot edit visitor details or delete inquiries; administrators retain oversight. No note editing UI, messaging or automatic booking is introduced.

On reassignment, the new owner gains existing inquiries/notes and future notification responsibility; the former owner loses access, including through stale requests.

### 6.6 Agent profile
Name, WhatsApp-capable phone, photo and short biography displayed on listing agent cards.

## 7. Administration Portal

### 7.1 Agent management
Securely initialize the first administrator. Administrators create/invite agents (name/email/phone), resend invitations and deactivate/reactivate accounts. Password reset is ordinary self-service; no administrator-triggered reset feature or routine permanent account deletion. Always retain at least one active, activated administrator, including under concurrent changes.

Before normal deactivation, reassign the agent's properties to another active, activated agent. Deactivation blocks sign-in and immediately revokes all sessions. For urgent security needs, deactivate immediately even without a replacement; unpublish unmanaged public listings and reassign later. Preserve ownership/history until reassignment, keep private records available to administrators and audit the action.

Reassignment alone preserves listing status and does not require another publication approval. It transfers existing inquiry responsibility and future notifications. Emergency unpublication is a separate action and must not be silently reversed by reactivation or reassignment; use the existing explicit publication workflow.

### 7.2 Moderation queue
Pending Review listings appear oldest by latest submission time first. Administrator can approve, reject with required reason, unpublish, verify, feature, edit, archive and reassign any listing. Public-listing edits submitted by agents follow 4.8: the current stored listing is reviewed while unavailable.

**Version 1 moderation policy:** every new listing is manually reviewed by an administrator. Review covers completeness, platform policy, image suitability and suspicious/inconsistent information. The agent remains responsible for supplied property details and asking price. Approval is not a professional valuation. A future production direction may use automated validation and risk-based human review; it is not in Version 1.

### 7.3 Inquiry oversight
View all inquiries, including general contact messages. Filter by agent, listing, status and date. CSV export is deferred.

### 7.4 Site settings
Administrators configure contact email, phone, WhatsApp, address, social links and amenities. Agency name, tagline, branding and exact fictional notice are fixed content. No featured display-count setting; site-wide announcement banner is deferred.

### 7.5 Audit log
Record significant agent/account security, listing status/edit/moderation, verification/Featured, reassignment, inquiry status/deletion and settings events. Store actor where applicable, action, stable non-identifying affected-record reference, concise summary and time. Do not store full version history, inquiry text/contact data, private note bodies, hidden addresses, credentials or tokens. Retain at least 12 months; users cannot edit/delete entries. Administrators can browse/filter. Preserve historical audit subject references after eligible entity deletion.

## 8. API requirements

Route groups:
- Public: list properties with filters, get property by slug, submit inquiry, get public settings, sitemap.
- Authentication: sign in/out, current user, forgot/reset password, accept invitation.
- Agent: own listings (list/create/read/update/status/delete eligible draft), signed upload parameters, own inquiries (list/update status/add note), own profile.
- Administrator: users, listings (approve/reject/unpublish/verify/feature/reassign/edit), inquiries (list/delete on verified request), manual failed-notification retry, settings and audit log.

Rules:
1. Every route validates input with a schema (Zod in the original FRS) and rejects unexpected fields.
2. Every protected route checks session, role and ownership on the server.
3. Errors use one consistent format with status, message and field-level errors.
4. List routes are paginated; maximum limit 50.
5. Public list routes never return non-public listings regardless of supplied filters.
6. Frontend validation is for usability; backend validation is authoritative.
7. Business rules must not depend on frontend button visibility.

## 9. Security and privacy

### 9.1 Access control
Enforce role and ownership checks on every protected request. Return not found for records the user is not authorized to access where required to avoid revealing existence.

### 9.2 Input handling
Validate and sanitize all inputs. Reject unexpected structured-object fields. As an additional defensive validation rule, reject structured request-object keys beginning with `$` or containing `.`. Do not reject ordinary text values solely because they contain those characters. This rule is not SQL injection protection. SQL injection protection relies on parameterized queries and safe ORM/database access. Render descriptions/messages as plain text; never render user-supplied HTML.

### 9.3 CSRF and abuse
Protect state-changing requests against CSRF using appropriate SameSite cookie settings and origin checks. Rate-limit sign-in, password reset, inquiry submission and upload signing. Public forms use a honeypot. CAPTCHA may be added later if spam appears.

### 9.4 Upload security
Signed upload parameters expire within 10 minutes, restricted to properties folder, with file type/size constraints. Verify actual allowed content, asset metadata and ownership before attaching it to a listing.

### 9.5 Secrets and transport
Keep database URL, Cloudinary secret, email key and session secrets in environment variables, never in repository or client bundle. HTTPS only, HSTS and security headers including CSP, X-Content-Type-Options, referrer policy and frame restrictions.

### 9.6 Personal data
Collect minimum necessary data with consent checkbox and privacy policy. Inquiries require name, phone and email on submission; these are nullable after privacy cleanup. Logs must not contain personal data.

**Approved retention rule:** automatically anonymise identifying contact fields, inquiry free text, private notes and delivery data after 24 months; retain non-identifying status/date/history where appropriate. Controlled verified deletion remains separate, subject to applicable obligations. Coordinate cleanup with pending/in-flight notifications and asset/data restoration; audit records must not reproduce removed information. Operational cleanup intervals and secure redaction mechanics are engineering decisions, not new features.

The design takes the Nigeria Data Protection Act 2023 into account but, as a concept project, makes no claim of legal compliance. Dependencies are version-pinned and checked for known vulnerabilities.

Approved request path remains DEC-027: browser -> same-origin Next.js BFF -> server-only HTTPS Express -> PostgreSQL. Express authorizes every operation. Detailed cookie forwarding, CSRF and deployed-origin validation remain implementation gates.

## 10. Non-functional requirements

- **Performance:** LCP ≤2.5 seconds on Home and Listing pages on a mid-range phone over 4G; Lighthouse mobile performance ≥90; initial page weight approximately ≤1 MB; images lazy-loaded, responsive and modern format through Cloudinary; page of 12 list results returned within 500 ms for 95% of requests.
- **Mobile-first:** design from 360 px width; usable on slow/intermittent connections.
- **Accessibility:** target WCAG 2.1 AA; keyboard-operable gallery/lightbox, labelled forms, sufficient contrast and meaningful alt text; Lighthouse accessibility and SEO ≥95.
- **Browser support:** latest two versions of Chrome, Edge, Firefox and Safari; iOS 16+.
- **Reliability:** custom error pages; inquiry storage must not depend on email delivery.
- **Backups:** documented backup and restoration strategy; independent database exports outside primary database provider; documented frequency and retention; restore test before production acceptance. Demo proposal: weekly independent export and export before major migrations. Production should use stronger automated daily backups and suitable point-in-time recovery where available.
- **Hosting cost:** prioritize free/low-cost approved providers; check actual current limitations before deployment; no purchases without owner approval.
- **Observability:** log server errors without personal data.
- **Testing:** unit tests for validation schemas and search query builder; API tests proving visitors cannot see non-public listings and agents cannot access other agents' listings; end-to-end tests for search-to-inquiry and agent-create/submit/admin-approve/public-visibility.
- **Seed data:** approximately 24 fictional listings across at least four cities and every property type, three agents, one administrator and approximately 30 sample inquiries.

## 11. General system rules

1. Only Published and Under Offer listings appear publicly.
2. Slugs are unique and immutable after first publication.
3. Roles and ownership are enforced server-side.
4. Agents access only their own listings and inquiries.
5. A new listing becomes public only after administrator approval.
6. Only administrators can verify or feature listings.
7. Material changes to price, purpose, type or location remove Verified until administrator reverification.
8. Inquiries are stored even when email fails.
9. Prices are whole naira, displayed with ₦ and thousands separators; rentals show rent period.
10. Visitors cannot alter submitted inquiries; agents cannot delete them.
11. At least one active administrator always exists.
12. Audit records are immutable to application users.
13. Closed listings do not appear in search.
14. Concept notice is visible.
15. Secrets are never exposed to browser or repository.
16. Valid agent edits to Published/Under Offer replace stored content and enter review atomically; opening a form or invalid submission leaves public content unchanged.
17. Normal deactivation follows reassignment; urgent security deactivation revokes immediately and unpublishes unmanaged listings.
18. Viewing requests are not confirmed appointments until agent and visitor agree.

## 12. Out of scope and future enhancements

Out of scope: visitor accounts, saved searches, email alerts, online payments/deposits/booking fees, map search/geolocation, mortgage/rent calculators, live chat/in-app messaging, virtual tours/video uploads, online title-document uploads or verification, reviews/ratings, multiple agencies, agent subscription plans and languages other than English.

Deferred by approved scope review: inquiry CSV export and site-wide announcement banners. Neither is part of Version 1 implementation.

Possible future enhancements: OpenStreetMap view, saved-search alerts, mortgage/rent calculator and multiple agency branches. A production moderation workflow may introduce automated validation and risk-based review.

## 13. Acceptance criteria
These are planned acceptance checks, not verification evidence.

1. Visitor on phone finds a three-bedroom rental in a chosen city/price and submits an inquiry in under two minutes.
2. URL reproduces filters/sort/page; browser back restores state; empty results offer Clear Filters.
3. All public paths exclude private/ineligible content and hidden addresses. Never-public records return 404; previously public unavailable URLs show generic noindex content. Private preview checks role/current ownership and bypasses public caches.
4. Cross-agent listing/inquiry/note access, including stale requests after reassignment, returns not found and cannot mutate data.
5. Incomplete new Draft saves valid supplied values; invalid supplied values fail. Submission lists missing requirements; requires complete type-specific fields, exact address, 3-15 verified owned images, captions, meaningful alt text and one cover.
6. Valid approval exposes eligible listings in search/sitemap within one minute. Availability/privacy changes invalidate affected public caches; protected reads enforce current visibility immediately.
7. Published/Under Offer edit forms and invalid submissions leave public content unchanged. Valid agent submissions atomically save content/gallery/amenities, enter review, clear Featured, invalidate material-change Verified, set submittedAt and audit; preserve original publication date/slug. Rejection does not restore old content. Administrator direct edits remain validated/audited.
8. Inquiry and visitor success response survive email outage; all required recipients have persisted status; admin manual retry is authorized, concurrency-safe and uses current owner. Interrupted sends are visible/recoverable; no exactly-once claim.
9. Five failed sign-ins lock for 15 minutes; expired/revoked sessions and consumed invitation/reset links cannot be reused, including concurrently.
10. Normal deactivation requires reassignment; urgent deactivation revokes sessions and hides unmanaged public listings without waiting. Reassignment does not itself trigger approval; emergency unpublication requires explicit restoration through existing workflow.
11. WhatsApp/share actions contain the title and URL; social previews show appropriate description/cover without private information.
12. Meet Section 10 performance/accessibility/SEO targets using documented device/network/dataset/method; record cold/warm provider behaviour separately.
13. Close inquiries from any status; reopen to Contacted; Viewing Scheduled only after agreement; private notes remain authorized; no unread mechanism.
14. Concurrent feature selection cannot exceed six eligible selections; zero hides the section. Draft deletion rejects previously published/dependent-business records, preserves audit references and schedules image cleanup.
15. Duplicate produces a fresh Draft/reference without images, history, approval, badges or views. Approximate views use browser repeat prevention and atomic server increments without visitor markers.
16. Signed uploads reject corrupt/unsupported/oversized content, including 5,000,001 bytes; verify ownership, gallery limits and attachment/cleanup races. Orphan and remote-deletion failures recover safely.
17. Automatic 24-month anonymisation and verified deletion remove identifying contact/text/note/delivery data, cancel pending sends and preserve permitted non-identifying history; restored backups do not reactivate removed data or notifications.
18. Settings expose only approved mutable values; audit remains user-immutable and PII-free; concurrent admin changes cannot remove the last active administrator.
19. Deployment records current provider limits/eligibility, recovery evidence, concept notices and approved cost; no purchase without owner approval.

## 14. Change history

| Version | Change |
|---|---|
| v1.0 | Original FRS dated 15 November 2026. Retain unchanged as historical baseline. |
| v1.1 | Planning-approved clarifications: Next.js/Cloudflare/Express/Render/Render PostgreSQL architecture direction; Prisma ORM and Prisma Migrate selected; relational terminology; staged published-listing revisions; viewing request confirmation; agent deactivation unpublishes active listings; inquiry anonymisation after 24 months; PostgreSQL-backed sessions; backup language corrected; PostgreSQL search terminology clarified; `$`/dot structured-key validation clarified; manual moderation standard documented. |
| v1.2 | Previous consolidated baseline: retains the approved requirements clarifications recorded in v1.1 and records the approved hosting change: Vercel replaces Cloudflare Workers as the Next.js frontend host; vinext is removed from the deployment direction. Backend, database, ORM, image, email and session decisions remain unchanged. The original v1.0 PDF remains unmodified. |
| v1.3 | 26 November 2026: applies owner-approved REV-001 through REV-038 and confirmed upload allowlist. Simplifies editing/drafts, accounts, notifications, settings, views and audit; resolves reassignment/emergency deactivation, privacy, deletion, field/image rules and scope exclusions. Retains unchanged requirements and approved stack/BFF; see the consolidated scope record and DOC-03 coverage matrix. |
