# CLAUDE.md — Session Protocol for OnePort 365 Backoffice

> Read this fully before every session. This is the source of truth for how to work.

---

## 1. Session-start protocol

1. Re-read `CLAUDE.md`, `SPEC.md`, and `PROGRESS.md` in full.
2. Run baseline checks:
```bash
cd /Users/okpanachi/oneport365-backoffice
npx tsc --noEmit
cd client && npx tsc --noEmit
curl -s https://oneport365-backoffice-production.up.railway.app/api/health
curl -s https://oneport365-backoffice-production.up.railway.app/api/health/claude
```
3. Report back — do not write code until confirmed:
```
Last session: [task #] done — [one-line proof].
Open: [task #] status.
I propose: [task #] — [what + acceptance check].
OK to proceed?
```

---

## 2. Rules

- SPEC.md is the source of truth for what to build. Do not invent features.
- Do not rewrite the quote prompt in `quote_claude_prompt.txt`.
- Never scan a full mailbox. Every IMAP SEARCH must carry keyword filters.
- Never return a blank pane. Handle loading, error, and empty states.
- One Claude call per thread, not per message.
- Update PROGRESS.md at end of every session.
- Commit with the task number: `Task 5: Add Outlook Graph API sync`.

---

## 3. Tech stack

| Layer | Technology |
|-------|-----------|
| Backend | Node 20, Express 5, TypeScript, Mongoose + MongoDB |
| Frontend | React 18 (CRA), TypeScript, inline styles |
| Email | Gmail via IMAP (app password) + Outlook via Microsoft Graph OAuth |
| AI | Anthropic Claude `claude-haiku-4-5-20251001` |
| Deploy | Railway (often needs manual redeploy) |

---

## 4. Environment variables

**Local (.env, gitignored):**
```
PORT=5001
MONGODB_URI=mongodb://localhost:27017/oneport365
ANTHROPIC_API_KEY=sk-ant-...
MICROSOFT_CLIENT_ID=
MICROSOFT_CLIENT_SECRET=
MICROSOFT_REDIRECT_URI=http://localhost:5001/api/auth/microsoft/callback
```

**Railway (set via Raw Editor):**
```
CLAUDE_API_KEY       — NOT ANTHROPIC_API_KEY (Railway won't inject it)
MONGODB_URI          — Railway MongoDB public URL
NIXPACKS_NO_CACHE    — 1
```

Gmail app passwords are stored in DB via Email Monitoring UI — no env vars.

---

## 5. Key files

| Area | Files |
|------|-------|
| Email sync (IMAP) | `src/routes/gmail.ts` |
| Email filters | `src/lib/email-filters.ts` |
| AI extraction | `src/lib/ai-extract.ts` |
| AI quote gen | `src/lib/ai-quote.ts` |
| Models | `src/models/*.ts` |
| Routes index | `src/routes/index.ts` |
| Frontend inbox | `client/src/pages/RfqInbox.tsx` |
| Frontend quotes | `client/src/pages/Quotes.tsx` |
| CSS tokens | `client/src/index.css` |
| Health + Claude test | `src/routes/health.ts` |
| Microsoft OAuth | `src/routes/microsoft-auth.ts`, `src/lib/microsoft-oauth.ts` |

---

## 6. Hard-won lessons (DO NOT RELEARN)

### Railway
1. Use `CLAUDE_API_KEY` not `ANTHROPIC_API_KEY` — Railway silently drops the latter.
2. dotenv must NOT run in production — server.ts has no dotenv import. Dev uses `-r dotenv/config`.
3. Auto-deploy is unreliable — use `git commit --allow-empty -m "Trigger deploy" && git push` or manual redeploy.
4. Port: app reads `process.env.PORT` (Railway sets 8080). Networking config must match.
5. Express 5 catch-all: `"/{*splat}"` not `"*"`.
6. CI treats ESLint warnings as errors — no unused imports/variables.

### Claude API
7. Working model: `claude-haiku-4-5-20251001`. All other IDs return 404 on this key.
8. Always test with `GET /api/health/claude` after deploy before syncing.
9. If extraction fails silently (only Customer + Email returned), check model ID and API key first.

### Email sync
10. `list-unsubscribe`: mailparser headers are a `Map` — use `.has()`, not bracket notation.
11. IMAP SEARCH: ImapFlow `or` doesn't support arrays. Search each keyword individually, merge UIDs.
12. "free shipping" false positives: Claude classification is the final filter. Prompt must say retail shipping ≠ freight.
13. CRM pollution: never call `resolveContact()` before Claude confirms freight RFQ.

### Frontend
14. Claude returns `"Customer"` not "Contact", `"Weight"` not "Tonnage". QUOTE_REQUIRED must match exactly.
15. Sync button must call `POST /api/gmail/sync`, not just reload RFQs.

---

## 7. Extraction pipeline

### Flow
```
IMAP SEARCH (shipping keywords, 60-day, cap 500)
  → Automated filter (list-unsubscribe, blocked senders/subjects)
    → Already ingested? (uid check) → skip
      → Threading? (inReplyTo / subject fallback) → re-extract existing RFQ
        → extractWithClaude() → classifies + extracts 14 fields
          → customer-rfq / internal-rfq / rate-reply → ACCEPT
          → promotional / irrelevant / outbound → SKIP
            → resolveContact() (only for accepted)
              → Create Email + RFQ documents
```

### Claude call triggers

| Trigger | Endpoint | Function |
|---------|----------|----------|
| Sync button | `POST /api/gmail/sync` | `extractWithClaude()` per email |
| Email with replies opened | `POST /api/rfqs/:id/re-extract` | `extractWithClaude()` on full thread |
| Generate/Convert/Regenerate Quote | `POST /api/quotes/generate/:rfqId` | Quote generation prompt |

### 14 extraction fields (EXACT keys Claude returns)

```
Customer, Company, Freight Mode, POL, POD, Commodity, HS Code,
Weight, Volume, Pick-up, Container, Cargo class, Incoterm, Target Price
```

### Email type classification (in Claude prompt)

```
customer-rfq  — actual cargo needing physical shipping between ports/countries
rate-reply    — carrier/shipping line providing rates
internal-rfq  — internal team forwarding customer request
outbound      — email sent BY OnePort
promotional   — marketing, retail, e-commerce ("free shipping" ≠ freight)
irrelevant    — personal, social, financial, unrelated
```

### Port code mappings (in Claude prompt)

```
Ocean: Apapa→NGAPP, Tin Can→NGTCN, Onne→NGONE, Warri→NGWAR,
  Rotterdam→NLRTM, Hamburg→DEHAM, Shanghai→CNSHA, Qingdao→CNTAO,
  Dubai/Jebel Ali→AEJEA, Antwerp→BEANR, Istanbul→TRIST,
  Tema→GHTEM, Mombasa→KEMBA, Singapore→SGSIN, Ningbo→CNNGB, Yantian→CNYTN
Air: Lagos→LOS, Dubai→DXB, London→LHR, Frankfurt→FRA,
  Hong Kong→HKG, Shanghai→PVG, Nairobi→NBO
```

### Volume rules
- **Ocean FCL:** container count ("2", "3") — NEVER ask for CBM
- **Ocean LCL:** CBM or dimensions
- **Air:** chargeable weight in kg

### HS Code suggestion
- Commodity known but code not stated → suggest `"8471.30 (suggested)"`, `ok: false`
- Do NOT add to `missing[]` when suggestion provided
- Frontend shows amber "AI" tag (not green check)

### Pre-classification (rule-based, before Claude)

Returns `"outbound"` | `"rate-reply"` | `null` (let Claude decide).

Outbound signals: subject "Rate Request —", body "rate request on behalf of OnePort", from-name "OnePort 365".

Rate-reply signals:
```typescript
/please find (?:below|attached|herewith).*(?:rates?|tariff|quotation)/i
/all[- ]in.*usd.*per.*(?:teu|container|box)/i
/(?:20ft|40ft|40hc).*:\s*(?:usd|n\/a)\s*[\d,]+/i
```

Rate-reply handling: fire `POST /api/rates/parse-email` (auto-extract rates into DB). No RFQ created.

---

## 8. @oneport365.com internal domain rule

Any `@oneport365.com` address is a team member — NEVER a customer. Three enforcement layers:

**Layer 1 — Server (gmail.ts):** `extractForwardedSender()` scans body for external sender before ingestion.
- Patterns: `From: Name <ext@domain.com>`, `From: Name [mailto:ext@domain.com]`
- Replaces fromName/fromEmail with external customer

**Layer 2 — Claude prompt:** INTERNAL FORWARD RULE instructs Claude to find external sender in body, set Customer/Company/Email to them.

**Layer 3 — Frontend:** `effectiveSender()` in RfqInbox.tsx:
```typescript
function effectiveSender(rfq: Rfq): { name: string; email: string } {
  const em = rfq.email;
  if (!em) return { name: "Unknown", email: "" };
  if (em.fromEmail?.toLowerCase().endsWith("@oneport365.com")) {
    const match = em.body?.match(
      /From:\s*([^<\n\r]+?)\s*<([a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,})>/i
    );
    if (match && !match[2].toLowerCase().endsWith("@oneport365.com"))
      return { name: match[1].trim(), email: match[2].toLowerCase() };
  }
  return { name: em.fromName || em.fromEmail, email: em.fromEmail };
}
```
Used in: inbox display, email header, compose To field, Quote Readiness Contact/Email.

**If any layer is missing, @oneport365.com shows as "customer".**

---

## 9. Quote Readiness (10 fields)

```typescript
// Replit reference fields
["Contact", "Email", "Company", "Freight Mode", "POL", "POD",
 "Commodity", "HS Code", "Volume", "Container"]
```

Check order: (1) rfq.fields with `ok: true`, (2) Contact/Email from `effectiveSender()`, (3) "missing".

Score: `X/10` — green ≥ 80%, amber ≥ 50%, red < 50%.

---

## 10. Multi-shipment groups

- `groupId` (UUID) shared across RFQs from same email
- `groupIndex` (1-based), `groupTotal` (count)
- Inbox: group badge "Group 1/3"
- Extraction panel: tabs per shipment (label = first word of Commodity)
- All tabs share `followUpDraft` from `groupIndex=1`

---

## 11. Debug playbook — blank inbox

Walk in order. Do not skip.

1. `GET /api/health` — server up? DB connected?
2. `GET /api/health/claude` — Claude working? Model ID correct?
3. `GET /api/email-accounts` — accounts configured?
4. `GET /api/gmail/status` — IMAP connection succeeds?
5. `POST /api/gmail/sync` — synced/skipped/errors?
6. `GET /api/rfqs` — RFQs exist? Check field quality.
7. Browser console — fetch errors? CORS?
8. Railway deploy logs — latest code deployed? (check uptime)
9. Only then: look at React components.

---

## 12. Future features (exist in Replit, not yet implemented)

- Sync as background job with progress polling
- Rate email auto-parse (Claude extracts rates from rate-replies)
- Partner rate request via email
- CMA CGM SpotOn / Maersk Spot API
- Market intelligence scrapers (Xeneta, Drewry)
- WATI/WhatsApp integration
- Microsoft Graph direct sync (app-only, tenant credentials)
- Shared mailbox (borrows OAuth tokens)
- Rate management UI with inline edit + CSV import

---

## 13. Anti-patterns

- Scanning full mailbox without SEARCH keywords
- Calling Claude per message instead of per thread
- Creating CRM contacts before Claude classification
- Returning blank pane (no loading/error/empty state)
- Inventing features not in SPEC.md
- Skipping PROGRESS.md update
- Using `ANTHROPIC_API_KEY` on Railway (use `CLAUDE_API_KEY`)
- Using untested model IDs
- Checking mailparser headers with `[]` (use `.has()`)
- Using `"Contact"` or `"Tonnage"` in frontend (Claude returns `"Customer"`, `"Weight"`)
- Storing tokens/keys in frontend code
