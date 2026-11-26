# Prime Haven Properties - Project Charter and Scope

**Baseline:** [FRS v1.3](01_REQUIREMENTS_BASELINE_FRS_v1.2.md)

**Authority:** [REV-001 through REV-038](PRIME_HAVEN_APPROVED_SCOPE_DECISIONS.md), approved 26 November 2026

**Status:** Scope audit complete; documentation synchronized for owner review. Implementation is not authorized by this update.

## 1. Purpose and integrity

A fictional Nigerian estate-agency listings platform and single-developer portfolio project. Demonstrate secure full-stack engineering, mobile property discovery, SSR/SEO, role/ownership isolation, moderation, reliable inquiries, testing and recovery. The developer must be able to explain and maintain the result.

Use fictional or properly licensed sample listings, agents, prices and images. Display the exact notice "Concept project: listings are fictional" in the footer and every listing page. Never imply genuine properties are available.

## 2. Interfaces and roles

| Interface / role | Scope |
|---|---|
| Public Website / Visitor | Home, search, details/gallery, up to 100 local favourites, About, Contact, Privacy, Terms, 404 and unavailable pages; inquiries/viewing requests; no visitor account |
| Agent Portal / Agent | Own dashboard, listings/images, manual drafts, private preview, submission, permitted statuses, inquiries/notes and profile |
| Administration Portal / Administrator | Agent invitations/deactivation/reassignment, moderation, Verified/Featured, inquiry oversight/manual email retry, contact/social/amenity settings and audit browsing |

Each authenticated user has exactly one role. Express authorizes current ownership and role on every protected operation.

## 3. Approved Version 1 rules

- Complete valid agent edits to Published/Under Offer listings enter Pending Review atomically and become unavailable; opening the form or invalid submission leaves public content unchanged. No separate listing revisions. Administrator direct edits are validated and audited.
- Manual Save Draft allows incomplete new Drafts with valid supplied values and an unsaved-change warning. Duplication creates a new Draft/reference without images, history, approval, badges or views.
- Required exact address is visible by default with a privacy toggle; separate state/city-LGA/neighbourhood. Hidden addresses never leak through public responses, SSR, metadata or caches.
- Image captions and meaningful alt text; JPEG/PNG/WebP only; actual-content/metadata/ownership verification; maximum 5,000,000 bytes; 3-15 images on submission and exactly one cover whenever images exist. Recoverable removal/orphan cleanup.
- Type-specific completeness follows FRS 4.2. Land title-document type is validated text; no document upload or legal verification.
- Verified is separate simulated checking, not valuation/title assurance; material changes require reverification. Select 0-6 eligible Featured properties globally; display all, hide section at zero, clear Featured on review. Preserve original publication date/slug.
- Only eligible Published/Under Offer listings with active, activated owners are public. Previously public unavailable URLs show generic noindex pages; never-public private records return 404. Favourites remove unavailable listings. Views are approximate using browser repeat prevention and an atomic server count.
- Reassign before normal deactivation; urgent security deactivation revokes immediately and unpublishes unmanaged public listings. Reassignment alone does not require publication approval and transfers existing inquiries/future notifications.
- Persist inquiries before email; require name, phone, email, message and consent. Property inquiries notify current agent/admin/visitor; general inquiries admin/visitor. Simple persisted delivery and authorized admin manual retry; no status-change email.
- Inquiry states: New, Contacted, Viewing Scheduled, Closed. Close from any state, reopen to Contacted, add private notes. Scheduling requires agreement; no automatic booking, messaging or unread tracking.
- Permanent deletion only for never-published listings without dependent business records; clean images and preserve relevant non-identifying audit. Automatically anonymise identifying inquiry contact/text/note/delivery data at 24 months and support controlled verified deletion.
- Secure first-admin bootstrap, invitations and self-service password reset; retain at least one active administrator. No admin-triggered reset/routine account deletion. Mutable settings are contacts/social links/amenities; branding and concept notice are fixed.

Detailed rules and acceptance criteria remain in the FRS; this charter is an orientation, not a replacement.

## 4. Architecture and quality

Next.js App Router/TypeScript/Tailwind on Vercel; Express/TypeScript on Render; Render PostgreSQL and Prisma/Migrate; Cloudinary; ZeptoMail; PostgreSQL opaque sessions. DEC-027: browser -> same-origin Next.js BFF -> server-only HTTPS Express -> PostgreSQL. Express owns authentication, authorization and business rules. No browser database access or client secrets. Cloudflare/vinext remain cancelled history.

Preserve CSRF protection, secure hashing/sessions, server validation, safe SQL, ownership checks, rate limits, safe uploads, user-immutable audit, public SSR/SEO, accessibility/mobile performance, independent backups and restore verification. Prioritize free/low-cost approved providers; verify actual limits before deployment and obtain approval before purchases.

## 5. Non-goals and deferred work

No visitor accounts, saved-search alerts, payments/deposits/booking fees, map search/geolocation, calculators, chat/messaging, automated booking, tours/video, document uploads/title verification, ratings/reviews, multiple agencies, subscriptions or additional languages. CSV export and announcement banners are deferred. No server favourites, full listing history, strict visitor markers or elaborate email job platform.

## 6. Status and document authority

Frontend/Express scaffolds and Prisma configuration exist; domain schema is empty. Presence and commits do not establish successful builds, connectivity, deployment or acceptance. DOC-05 is the canonical task/status register; DOC-03 owns requirements/REV traceability; DOC-04 owns risks; DOC-02 owns architecture; DOC-06/07 comprise PH-DESIGN-001.

The owner approved all 38 scope decisions. Documentation changes still require review; no next implementation task starts automatically. The original source PDF remains unchanged; Git preserves previous tracked document versions. Update existing numbered files in place, recording FRS version changes inside the FRS. This update does not independently verify the PDF's version or earlier approvals.

New features/major architecture changes require approval and synchronized records. Ordinary secure implementation choices can be handled and explained professionally. Distinguish proposed, implemented, verified and owner-accepted work.
