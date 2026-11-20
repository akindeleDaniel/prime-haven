# Prime Haven Properties — Project Charter and Product Scope

**Document type:** Project-level product reference  
**Project:** Prime Haven Properties  
**Product concept:** Fictional Nigerian real-estate listings platform  
**Current requirements baseline:** FRS v1.2  
**Source history:** Original FRS v1.0 (15 November 2026), approved planning clarifications consolidated in v1.1, and approved frontend-hosting change in v1.2

## 1. Product purpose

Prime Haven Properties is a fictional estate-agency property listings platform. Visitors can discover properties for sale or rent, inspect listing details, save favourites locally and contact the agency. Agents manage their own listings and inquiries through a secure portal. Administrators manage agents, moderate listings, oversee inquiries, configure site settings and review audit records.

The project is a portfolio demonstration of professional full-stack engineering practices, including server-side rendering, search, role-based access control, listing lifecycle management, secure inquiry handling, database design, testing, deployment and operational documentation.

## 2. Concept-project integrity

All property listings, agents, prices and images shown in the project must be fictional or properly licensed sample content. The exact notice below must appear in the site footer and on every listing page:

> Concept project: listings are fictional

The product must not imply that fictional listings are genuine properties available for purchase or rent.

## 3. Product interfaces

### 3.1 Public Website

Home, property search/listings, property detail, favourites, About, Contact, Privacy Policy, Terms and a custom not-found page. Visitors can browse public listings, search and filter, inspect property information, save up to 100 favourites in browser storage and submit general inquiries or viewing requests. Visitors do not have accounts in Version 1.

### 3.2 Agent Portal

Agents authenticate and manage only their own listings, listing images, inquiries and profile. They can create and maintain drafts, submit listings for review, manage permitted listing status changes, respond to inquiries and add private inquiry notes.

### 3.3 Administration Portal

Administrators manage agent accounts, moderate listings, oversee inquiries, configure site settings and review the audit log. Administrative and ownership rules are enforced by the backend, not by interface visibility alone.

## 4. User roles and access principles

| Role | Product access |
|---|---|
| Visitor | Public pages, search, local favourites and inquiry submission; no account |
| Agent | Own listings, own inquiries and own profile |
| Administrator | Global administration and moderation |

Every authenticated user has exactly one role. Only administrators assign roles; users cannot change their own role. Express is authoritative for authentication, role checks, ownership checks and protected business operations.

## 5. Product objectives

- Deliver a responsive, mobile-first property discovery experience.
- Enforce authorization and ownership rules on the server.
- Support a controlled listing lifecycle with manual administrator moderation in Version 1.
- Preserve inquiries even when email delivery fails.
- Provide useful SEO and social-sharing metadata for public listing pages.
- Demonstrate reliable validation, testing, deployment and recovery practices.
- Keep demo hosting costs controlled while documenting provider limits and trade-offs.
- Maintain a codebase the developer can explain, review and independently maintain.

## 6. Approved Version 1 product rules

- New listings require manual administrator approval before becoming public.
- Edits to a published listing are staged as a draft revision; the current public version remains visible until an administrator approves the revision.
- A viewing request is not a confirmed appointment. The agent contacts the visitor and records `Viewing Scheduled` only after agreement.
- New inquiries notify the owning agent and administrator. A visitor confirmation is sent when an email address was supplied. Routine status-change emails are not required initially.
- An inquiry is persisted before email delivery is attempted. Email failure must not lose the inquiry.
- Agent deactivation immediately revokes sessions and automatically unpublishes that agent's Published and Under Offer listings while preserving historical records.
- Inquiry personal data is anonymised after 24 months, subject to applicable retention obligations and separately handled verified deletion requests.
- Only administrators can set Verified or Featured. Verified means the agency has checked the listing; it is not an independent valuation or title guarantee.
- Public users see only Published and Under Offer listings.

The detailed, testable requirements and exceptions are defined in **`01_REQUIREMENTS_BASELINE_FRS_v1.2.md`**. This charter is an orientation document, not a replacement for the FRS.

## 7. Approved technology direction

| Layer | Approved technology | Responsibility |
|---|---|---|
| Frontend | Next.js + TypeScript | Public website and portals; server rendering and metadata |
| Frontend hosting | Vercel | Host the Next.js application using native platform integration |
| Backend | Express + TypeScript | REST API, business rules, authentication and authorization |
| Backend hosting | Render | Host the Express service |
| Database | PostgreSQL on Render | Persistent relational data |
| ORM and migrations | Prisma ORM + Prisma Migrate | Type-safe data access and schema migrations |
| Image storage | Cloudinary | Signed image uploads, storage and delivery |
| Transactional email | ZeptoMail | Invitations, password reset and inquiry notifications |
| Sessions | PostgreSQL-backed server-managed opaque sessions | Server-side validation and revocation |

The browser must never connect directly to PostgreSQL or receive database credentials. The approved frontend/backend boundary and open transport decisions are documented in **`02_TECHNICAL_ARCHITECTURE_AND_DECISIONS.md`**.

## 8. Version 1 non-goals

Visitor accounts, saved searches, email alerts, online payments, deposits, booking fees, map-based search, geolocation, mortgage/rent calculators, live chat, in-app messaging, virtual tours, video uploads, online title-document verification, reviews, ratings, multiple agencies, agent subscription plans and languages other than English.

## 9. Success outcomes

The FRS acceptance criteria are authoritative. Key outcomes include a visitor finding and inquiring about a suitable property on a phone in under two minutes; search state being shareable through URLs; prevention of unauthorized cross-agent access; publication only after approval; inquiry persistence during email outages; and achievement of the specified mobile performance and accessibility targets.

## 10. Document hierarchy and change control

1. The original **FRS v1.0 PDF** is immutable historical source material and must remain unchanged.
2. **FRS v1.2** is the current consolidated requirements baseline. It incorporates approved clarifications and the Vercel hosting change; it does not claim the original PDF was edited.
3. The architecture/decision register records approved technical decisions and unresolved technical choices.
4. The roadmap/traceability register plans delivery and maps selected requirements to verification. A traceability entry is not proof of implementation or test completion.
5. The risk register tracks uncertainty and mitigations; risks close only when evidence supports closure.

A proposal is not an approval. Changes to requirements or architecture require explicit approval and an auditable record of the old position, new position, rationale and downstream impact. Keep all affected documents synchronized.

## 11. Historical hosting note

The earlier Cloudflare Workers + vinext proposal was cancelled before implementation. Vercel is the approved Next.js host and its native Next.js integration is the approved deployment path. Do not revive the cancelled proposal or create a vinext compatibility task.
