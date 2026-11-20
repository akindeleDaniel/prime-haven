# Prime Haven Properties — Requirements Baseline

**Document type:** Functional and non-functional requirements specification  
**Requirements version:** FRS v1.2  
**Status:** Current consolidated baseline  
**Project:** Fictional Nigerian real-estate listings platform

## Source and version control

This consolidated FRS v1.2 is based on the original FRS v1.0 PDF dated 15 November 2026, approved planning clarifications consolidated in v1.1, and the approved frontend-hosting change recorded in v1.2. The original 16-page v1.0 PDF remains unchanged as historical source material. FRS v1.2 is the current requirements baseline in this Markdown document; it does not mean the PDF was edited.

**Interpretation rule:** Requirements marked as approved clarifications or changes supersede the corresponding v1.0 rule. Other v1.0 requirements remain in force unless explicitly changed here. Technical implementation choices not prescribed by the FRS belong in the architecture/decision register.

---

# Prime Haven Properties — Functional and Non-Functional Requirements (FRS v1.2)


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
- Title: required, 10–120 characters.
- Description: required, 50–5,000 characters; plain text with line breaks.
- Purpose: For Sale or For Rent.
- Type: House, Apartment/Flat, Duplex, Terrace, Land, Commercial, Office or Shop.
- Price: whole naira, required and greater than zero.
- Rent period: required for rentals; per year or per month.
- Negotiable: yes/no.
- Location: state (36 states or FCT), city/LGA and neighbourhood required.
- Street address: optional and hidden publicly by default.
- `Show exact address`: off by default.

### 4.2 Type-specific fields
- Residential (House, Apartment/Flat, Duplex, Terrace): bedrooms, bathrooms and toilets (each 0–20); optional floor area; furnishing (Unfurnished, Semi-furnished, Furnished); parking spaces.
- Land: plot size in square metres required; title document type required.
- Commercial, Office and Shop: floor area in square metres required; parking spaces.

### 4.3 Amenities
Amenities are multi-select. Initial examples include water supply, prepaid meter, gated estate, perimeter fence, security, borehole, generator, air conditioning, swimming pool, gym, CCTV, parking, boys' quarters, fitted kitchen and serviced property. Administrators can extend the list. Search by selected amenities requires a listing to contain **all** selected amenities.

### 4.4 Reference and slug
Each listing receives a unique reference such as `PH-000123`. The slug is generated from the title plus a short unique suffix. Slugs are unique and do not change after first publication, even if the title changes.

### 4.5 Images
- Minimum 3 images to submit for review; maximum 15.
- JPG, PNG and WebP; maximum 5 MB per image.
- Agents can reorder images and choose the cover.
- Alt text defaults to title plus image position and is editable.
- Upload authorization is generated server-side using short-lived signed Cloudinary parameters.
- Uploaded asset metadata must be verified before attachment.
- Removing an image or permanently deleting an eligible listing triggers Cloudinary asset deletion. Failure handling and orphan cleanup must be designed and tested.
- Upload signing expires within 10 minutes, is restricted to the properties folder, and constrains file type and size.

### 4.6 Listing statuses
- Draft
- Pending Review
- Published
- Under Offer
- Closed (Sold or Let)
- Archived

Only Published and Under Offer listings appear in public search. Closed listings are removed from search and show a no-longer-available page. Archived listings are hidden from public users and agents.

### 4.7 Allowed status transitions
**Agent, own listings only:**
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

### 4.8 Published listing revisions — approved change from v1.0
The original FRS said edits to a Published listing take effect immediately. This is superseded by the approved revision workflow:
1. An agent editing a Published listing creates or updates a separate draft revision.
2. The current published version remains visible to the public while the revision is pending.
3. The agent can preview the proposed revision.
4. The administrator reviews the revision.
5. Approval replaces the public version with the approved revision.
6. Rejection leaves the existing public version unchanged and supplies a reason to the agent.
7. Changes and decisions are recorded in the audit log.
8. A change to price, purpose, property type or location on a Verified listing removes the Verified badge from the approved public version until an administrator verifies it again.

The exact persistence strategy for revisions is a technical design decision, not prescribed here.

### 4.9 Publishing requirements
A listing can be submitted only when all required fields are valid, it has at least three images and a cover image is selected. The system must list every missing requirement. Frontend validation assists the user; backend validation is authoritative.

### 4.10 Verified and Featured
Only administrators can set Verified. It means the agency has checked the listing, not that an independent market valuation or title guarantee has been performed. Record who verified it and when. Only administrators can feature listings. The homepage shows no more than six featured listings, configurable in settings.

### 4.11 Deletion and archiving
A Draft that has never received an inquiry may be permanently deleted by its owner or an administrator. All other listings may only be archived. Permanent deletion must also remove Cloudinary assets, with failures logged and recoverable.

## 5. Public Website

### 5.1 Pages
Home, Listings, Listing Detail, Favourites, About, Contact, Privacy Policy, Terms and custom 404.

### 5.2 Home
Hero search (purpose, location, property type, maximum price), featured listings, eight most recent published listings and a short explanation of the agency's checking process.

### 5.3 Search and filters
Filters: purpose, state, city/neighbourhood, property type, min/max price, minimum bedrooms, minimum bathrooms, amenities (all selected amenities must match), keyword (title, description, neighbourhood) and Verified only. Sort: Newest (default), Price low to high, Price high to low. Show 12 results per page with pagination and total count. Filters, sorting and page number persist in the URL query string. Empty results suggest specific filters to relax. Only Published and Under Offer are returned.

PostgreSQL search implementation should be selected during technical design. Evaluate full-text search and trigram matching where appropriate; do not prescribe a MongoDB text index.

### 5.4 Listing cards and details
Cards show cover image, price and rental period where applicable, title, neighbourhood/city, key facts and applicable badges. A heart control saves the listing to local favourites.

Detail pages show gallery (touch swipe, keyboard navigation and lightbox), title, price, rent period, negotiable label, badges, reference, publication date, key facts, description, amenities, public location, optional exact address only when enabled, agent card, inquiry form, WhatsApp action, share actions and up to four similar listings (same type and city). A view counter increments at most once per visitor session and stores no personal data. Display the concept notice.

### 5.5 Closed/unavailable listings
Closed, Archived and unpublished listings show a no-longer-available page with similar listings where appropriate. These pages are excluded from search indexing. Draft and Pending Review listings must not be reachable by visitors.

### 5.6 Favourites
Visitors can save up to 100 listings without an account using browser local storage. Storage access is wrapped in error handling. The site remains usable when storage is unavailable. The Favourites page displays still-available listings and quietly removes unavailable ones.

### 5.7 Inquiry and viewing request
Fields: name (required), phone (required), email (optional), message (required, 10–1,000 characters), inquiry type (General inquiry or Request a viewing), preferred viewing date and time slot (for viewing requests; date within the next 60 days) and required consent checkbox. Accept Nigerian local or international phone input and store normalized international format.

On submission:
1. Validate server-side.
2. Persist the inquiry.
3. Attempt to email the owning agent and copy the administrator.
4. Show visitor confirmation.
5. If the visitor supplied an email, attempt visitor confirmation.
6. If email delivery fails, retain the inquiry and log delivery failure.

Anti-spam controls: honeypot, rate limiting and rejection of identical messages from the same sender within 10 minutes.

**Viewing request clarification:** submission is a request, not a confirmed appointment. The agent contacts the visitor to agree availability. Only after agreement does the agent set `Viewing Scheduled`. No automated calendar booking is included in Version 1.

### 5.8 Notifications
Every new inquiry sends a notification to the owning agent and administrator. If an email address is supplied, send visitor confirmation. Do not email every inquiry status change in Version 1. Persist inquiry before attempting email. Track delivery failures and provide a controlled retry mechanism. Exact implementation (for example, persisted delivery status or transactional outbox) is a technical design decision.

### 5.9 WhatsApp and Contact
WhatsApp opens a `wa.me` link to the agent number or agency number from settings with a prefilled message containing listing title and URL. Contact page shows agency address, phone, email and WhatsApp number; general contact inquiries are stored without a property and routed to the administrator.

### 5.10 SEO and sharing
Every page is server-rendered with unique title, meta description and canonical URL. Listing pages include Open Graph and Twitter card metadata with a 1200×630 cover image. Listing URLs use `/properties/{slug}`. Generate sitemap.xml for published listings and robots.txt. Listing pages include JSON-LD describing property and price. Unavailable listing pages are noindex.

## 6. Agent Portal

### 6.1 Authentication
Email/password sign-in. Password minimum 10 characters; store salted password hashes using Argon2id or bcrypt. Lock account for 15 minutes after five failed attempts. Sessions use HTTP-only, Secure and SameSite cookies; expire after 12 hours of inactivity or seven days absolute; logout immediately revokes the session. Password reset uses a single-use emailed link valid 30 minutes. Password change requires current password.

**Approved session architecture:** PostgreSQL-backed server-managed sessions using cryptographically random opaque tokens. Store only a hash of the session token. Enforce idle and absolute expiry server-side. Revoke sessions on logout, password/security events as specified, and agent deactivation. Never log raw session tokens. Cookie domain, SameSite mode, CSRF protections and cross-origin configuration must be finalized in technical design.

### 6.2 Account activation
Administrator creates the agent account. Agent receives an invitation email with a set-password link valid 48 hours. Account is inactive until password is set.

### 6.3 Dashboard
Show own listing counts by status, latest inquiries and rejected listings requiring changes with rejection reason.

### 6.4 Listing management
Create, edit, duplicate, preview, submit, withdraw, mark Under Offer or Closed, and archive own listings. Draft preview should resemble public page. Autosave changes as draft and warn before leaving with unsaved changes. Agent cannot view, edit or list another agent's listings; unauthorized attempts return not found. For Published listings, edits follow the staged revision workflow in Section 4.8.

### 6.5 Inquiry management
List inquiries for own listings; filter by status, listing and date; show unread indicator. Statuses: New, Contacted, Viewing Scheduled, Closed. Agents may add private notes but cannot edit visitor details or delete inquiries.

### 6.6 Agent profile
Name, WhatsApp-capable phone, photo and short biography displayed on listing agent cards.

## 7. Administration Portal

### 7.1 Agent management
Create agents (name, email, phone), resend invitations, trigger password resets, deactivate/reactivate accounts. Deactivation invalidates all sessions immediately and blocks sign-in. Agents with listings cannot be deleted; they may only be deactivated. At least one active administrator must always exist; last administrator cannot deactivate themselves.

**Approved change from v1.0:** deactivating an agent automatically unpublishes their Published and Under Offer listings. Preserve historical listing and inquiry records. Record the action and resulting listing status changes in the audit log. Administrators may later reassign listings to another active agent and review them for republication.

### 7.2 Moderation queue
Pending Review listings appear oldest first. Administrator can approve, reject with required reason, unpublish, verify, feature, edit, archive and reassign any listing. For revised Published listings, review the proposed revision while the current public version remains live.

**Version 1 moderation policy:** every new listing is manually reviewed by an administrator. Review covers completeness, platform policy, image suitability and suspicious/inconsistent information. The agent remains responsible for supplied property details and asking price. Approval is not a professional valuation. A future production direction may use automated validation and risk-based human review; it is not in Version 1.

### 7.3 Inquiry oversight
View all inquiries, including general contact messages. Filter by agent, listing, status and date. Support CSV export.

### 7.4 Site settings
Agency name/tagline, contact email, phone, WhatsApp, address, social links, featured listing count, footer notice, amenity list and optional site-wide banner.

### 7.5 Audit log
Record agent creation/deactivation/reactivation; sign-in lockouts; listing status changes and edit summaries; verify/feature changes; reassignments; inquiry status changes and deletions; settings changes; and significant revision decisions. Store actor, action, affected record, summary and timestamp. Entries cannot be edited or deleted by users and are retained at least 12 months. Administrators can browse/filter.

## 8. API requirements

Route groups:
- Public: list properties with filters, get property by slug, submit inquiry, get public settings, sitemap.
- Authentication: sign in/out, current user, forgot/reset password, accept invitation.
- Agent: own listings (list/create/read/update/status/delete eligible draft), signed upload parameters, own inquiries (list/update status/add note), own profile.
- Administrator: users, listings (approve/reject/unpublish/verify/feature/reassign/edit), inquiries (list/export/delete on verified request), settings and audit log.

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
Signed upload parameters expire within 10 minutes, restricted to properties folder, with file type/size constraints. Verify uploaded asset metadata before attaching it to a listing.

### 9.5 Secrets and transport
Keep database URL, Cloudinary secret, email key and session secrets in environment variables, never in repository or client bundle. HTTPS only, HSTS and security headers including CSP, X-Content-Type-Options, referrer policy and frame restrictions.

### 9.6 Personal data
Collect minimum necessary data with consent checkbox and privacy policy. Inquiries contain names, phone and optional email. Logs must not contain personal data.

**Approved retention change:** anonymise inquiry personal data after 24 months rather than treating deletion and anonymisation as interchangeable defaults. Preserve non-identifying records where appropriate. Handle verified deletion requests separately, subject to applicable legal obligations. Audit records must not unnecessarily reproduce the personal data being removed.

The design takes the Nigeria Data Protection Act 2023 into account but, as a concept project, makes no claim of legal compliance. Dependencies are version-pinned and checked for known vulnerabilities.

## 10. Non-functional requirements

- **Performance:** LCP ≤2.5 seconds on Home and Listing pages on a mid-range phone over 4G; Lighthouse mobile performance ≥90; initial page weight approximately ≤1 MB; images lazy-loaded, responsive and modern format through Cloudinary; page of 12 list results returned within 500 ms for 95% of requests.
- **Mobile-first:** design from 360 px width; usable on slow/intermittent connections.
- **Accessibility:** target WCAG 2.1 AA; keyboard-operable gallery/lightbox, labelled forms, sufficient contrast and meaningful alt text; Lighthouse accessibility and SEO ≥95.
- **Browser support:** latest two versions of Chrome, Edge, Firefox and Safari; iOS 16+.
- **Reliability:** custom error pages; inquiry storage must not depend on email delivery.
- **Backups:** documented backup and restoration strategy; independent database exports outside primary database provider; documented frequency and retention; restore test before production acceptance. Demo proposal: weekly independent export and export before major migrations. Production should use stronger automated daily backups and suitable point-in-time recovery where available.
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
7. Changes to price, purpose, type or location on a Verified listing remove the badge from the approved version until reverified.
8. Inquiries are stored even when email fails.
9. Prices are whole naira, displayed with ₦ and thousands separators; rentals show rent period.
10. Visitors cannot alter submitted inquiries; agents cannot delete them.
11. At least one active administrator always exists.
12. Audit records are immutable to application users.
13. Closed listings do not appear in search.
14. Concept notice is visible.
15. Secrets are never exposed to browser or repository.
16. Published edits are staged and reviewed; existing public version remains live until approval.
17. Agent deactivation unpublishes active listings and revokes sessions.
18. Viewing requests are not confirmed appointments until agent and visitor agree.

## 12. Out of scope and future enhancements

Out of scope: visitor accounts, saved searches, email alerts, online payments/deposits/booking fees, map search/geolocation, mortgage/rent calculators, live chat/in-app messaging, virtual tours/video uploads, online title-document uploads or verification, reviews/ratings, multiple agencies, agent subscription plans and languages other than English.

Possible future enhancements: OpenStreetMap view, saved-search alerts, mortgage/rent calculator and multiple agency branches. A production moderation workflow may introduce automated validation and risk-based review.

## 13. Acceptance criteria

1. Visitor on phone can find a three-bedroom flat for rent in chosen city under a price, open it and submit inquiry in under two minutes.
2. Filters update URL; opening URL in new tab reproduces results; back button restores prior filter state.
3. Draft/Pending Review listings never appear in search, home or sitemap and are not reachable by visitors at direct URL.
4. Agent guessing another agent's listing ID/URL receives not found and cannot read/change it.
5. Listing with fewer than three images cannot be submitted; missing requirements are shown.
6. After submission and approval, listing appears in search and sitemap within one minute.
7. Editing price of a Verified listing through an approved revision removes its Verified badge and is audited.
8. Inquiry is stored and visitor sees confirmation even when email provider is unavailable.
9. Five failed sign-ins lock account for 15 minutes.
10. Deactivated agent's session stops working immediately.
11. WhatsApp sharing shows title, description and cover preview.
12. Lighthouse mobile targets are met on Home and Listing pages.
13. Deactivating an agent unpublishes their Published and Under Offer listings and preserves historical inquiries.
14. A viewing request remains unconfirmed until the agent records an agreed viewing.
15. Published listing revision does not replace public content before approval.

## 14. Change history

| Version | Change |
|---|---|
| v1.0 | Original FRS dated 15 November 2026. Retain unchanged as historical baseline. |
| v1.1 | Planning-approved clarifications: Next.js/Cloudflare/Express/Render/Render PostgreSQL architecture direction; Prisma ORM and Prisma Migrate selected; relational terminology; staged published-listing revisions; viewing request confirmation; agent deactivation unpublishes active listings; inquiry anonymisation after 24 months; PostgreSQL-backed sessions; backup language corrected; PostgreSQL search terminology clarified; `$`/dot structured-key validation clarified; manual moderation standard documented. |
| v1.2 | Current consolidated baseline: retains the approved requirements clarifications recorded in v1.1 and records the approved hosting change: Vercel replaces Cloudflare Workers as the Next.js frontend host; vinext is removed from the deployment direction. Backend, database, ORM, image, email and session decisions remain unchanged. The original v1.0 PDF remains unmodified. |

---
