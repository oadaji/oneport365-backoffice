# SPEC.md — OnePort 365 Email-to-Quote Workspace

> Source of truth. If the codebase disagrees with this spec, the spec wins.

---

## 0. Context

OnePort 365 is a Nigerian freight forwarding company. This is a single-page workspace for sales ops: triage incoming shipping email, AI summarises each thread, structured RFQ details are extracted, a quote-readiness score is computed, and a draft quote is generated against rate pools.

**Known defects being fixed:**
1. The email inbox renders blank — empty/loading/error states missing.
2. The mail fetcher scans the entire inbox — must only pull shipping-related mail using server-side queries.

---

## 1. Tech stack

- **Backend:** Node 20, Express 5, TypeScript, Mongoose + MongoDB
- **Frontend:** React 18 (CRA), TypeScript, inline styles
- **Email:** Gmail via IMAP (app passwords) + Outlook via Microsoft Graph API (OAuth 2.0)
- **AI:** Anthropic Claude (claude-sonnet-4-6-20250514)
- **Deploy:** Railway

---

## 2. Email filter (critical)

**Rule:** never list a whole mailbox. Every IMAP SEARCH must carry shipping keyword filters.

### 2.1 Gmail IMAP SEARCH keywords

Search each keyword individually against IMAP server, merge UIDs:
```
RFQ, quote, freight, shipment, shipping, container, FCL, LCL,
booking, rates, EXW, FOB, CIF, bill of lading, BOL, quotation,
ETA, ETD, DAP
```
Restrict to `SINCE <60 days ago>`. Cap at 500 results.

### 2.2 Outlook (Phase 2 — Microsoft Graph)

Use `$search` (KQL) on `/me/mailFolders/inbox/messages`:
```
subject:RFQ OR subject:quote OR subject:freight OR subject:shipment ...
body:"20ft" OR body:"40ft" OR body:POL OR body:POD ...
from:maersk.com OR from:msc.com ...
```
Combined with `$filter` for `receivedDateTime ge <60 days>`.

### 2.3 Automated email filter

Skip emails matching:
- `list-unsubscribe` header present (catches all promotional emails)
- Sender patterns: noreply@, newsletter@, notifications@, etc.
- Subject patterns: security alert, verify email, password reset, etc.
- Blocked sender domains: gapfactory.com, waterdrop.com, amazon.com, etc.

### 2.4 Stage 2 classifier (Phase 3)

Score each thread 0-1: keyword density, sender-domain trust, attachment types.
- `>= 0.6` → surface in inbox
- `0.4-0.6` → Claude classifier
- `< 0.4` → drop

---

## 3. RFQ extraction

Fields to extract per thread:

| Field | Type | Required for readiness |
|-------|------|----------------------|
| Company | string | Yes |
| Contact | string | No |
| Email | string | No |
| Commodity | string | Yes |
| HS Code | string | No |
| Tonnage | number/null | Yes (or Volume) |
| Volume | number/null | Yes (or Tonnage) |
| POL | { name, code } | Yes |
| POD | { name, code } | Yes |
| Pick-up | string/null | No |
| Container | type + qty | Yes |
| Cargo class | GC/DG/RF | No |
| Incoterm | EXW/FOB/CIF/DAP/... | Yes |
| Target Price | number/null | No |
| Direction | Import/Export/Cross-Trade | Derived |

**Readiness** = count(present required fields) / count(required fields) x 10.
Required: Company, Commodity, POL, POD, Container, Incoterm, Volume or Tonnage.

---

## 4. Quote generation

Use the prompt from `quote_claude_prompt.txt` verbatim. Wire to `POST /api/quotes/generate/:rfqId`.

Pool selection:
- `oceanPool` = rates matching POL + POD + container type, cap 15
- `applicableCharges` = charges matching shipment direction, cap 30
- `haulagePool` = rates matching POD terminal, sorted by destination match, cap 15

---

## 5. UI layout

Three-pane layout:
- **Left (280px):** Inbox list — sender, subject preview, status pill, date
- **Center (flex):** Thread view — header, brief card, message body, reply bar
- **Right (300px):** Extracted details — type badges, readiness meter, field checklist, notes, Generate Quote button

### 5.1 Required render contract

```
if (loading) → skeleton/spinner
if (error)   → error message + retry button
if (empty)   → empty state + sync button
if (data)    → render list
```

No blank pane is ever acceptable.

### 5.2 Design tokens

- Nav: `#1a2d1c` background, accent `#7AB648`
- Surface: `#ffffff`, background: `#f0f4f0`
- Border: `#e4e8e4`
- Text: `#1a2e1a`, muted: `#8a9e8a`
- Badges: green `#dcfce7`, red `#fee2e2`, amber `#fef3c7`, blue `#dbeafe`
- Font: Inter

---

## 6. Endpoints

```
GET    /api/health
GET    /api/email-accounts
POST   /api/email-accounts
DELETE /api/email-accounts/:id
POST   /api/email-accounts/:id/test
POST   /api/email-accounts/test-credentials
POST   /api/gmail/sync
GET    /api/gmail/status
POST   /api/gmail/send
GET    /api/auth/microsoft
GET    /api/auth/microsoft/callback
GET    /api/rfqs
GET    /api/rfqs/:id
PATCH  /api/rfqs/:id
DELETE /api/rfqs/:id
POST   /api/rfqs/:id/send-followup
GET    /api/rfqs/:id/thread
POST   /api/rfqs/:id/re-extract
POST   /api/quotes/generate/:rfqId
GET    /api/quotes
GET    /api/quotes/:id
POST   /api/quotes
PATCH  /api/quotes/:id
DELETE /api/quotes/:id
GET    /api/companies
POST   /api/companies
GET    /api/contacts
POST   /api/contacts
GET    /api/rates/ocean
POST   /api/rates/ocean
GET    /api/rates/other-charges
GET    /api/rates/haulage-import
GET    /api/settings
PUT    /api/settings/:key
POST   /api/seed
POST   /api/clear
```

---

## 7. Out of scope (v1)

- WhatsApp tab (stub only)
- CRM tab (basic CRUD exists, no enhancements)
- Multi-user teams / auth
- Rate ingestion from PDFs
- Push notifications
- Mobile layout
- Google OAuth for Gmail (using app passwords instead)
