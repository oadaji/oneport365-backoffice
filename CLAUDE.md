# CLAUDE.md — Session Protocol for OnePort 365 Backoffice

> This file governs how Claude Code operates in this repo. Read it fully before every session.

---

## Session-start protocol (mandatory, every session)

1. Re-read `CLAUDE.md`, `SPEC.md`, and `PROGRESS.md` in full.
2. Run: `git log --oneline -10`, `git status`, baseline checks (see below).
3. Report back in this format — do not write code until confirmed:

```
Last session: [task #] done — [one-line proof it works].
Open: [task #] not started / in progress.
I propose: [task #] — [what you will do].
Acceptance check: [how to verify it works].
OK to proceed?
```

4. Wait for user confirmation before writing any code.

---

## Baseline checks (run at session start)

```bash
cd /Users/okpanachi/oneport365-backoffice
npx tsc --noEmit                    # backend type-check
cd client && npx tsc --noEmit       # frontend type-check
curl -s https://oneport365-backoffice-production.up.railway.app/api/health
curl -s https://oneport365-backoffice-production.up.railway.app/api/health/claude
```

---

## Rules

- **CLAUDE.md is the source of truth for how to work.** SPEC.md is the source of truth for what to build.
- **Do not invent features, fields, routes, or UI** not in SPEC.md. If you think something is needed, add it to `PROGRESS.md → Open questions` and stop.
- **Do not rewrite the quote prompt** in `quote_claude_prompt.txt`. Wire it as-is.
- **Never scan a full mailbox.** Every IMAP SEARCH must carry shipping-keyword filters.
- **Never return a blank pane.** Every list must handle loading, error, and empty states.
- **One Claude call per thread**, not per message.
- **Update PROGRESS.md** at the end of every session with what was done, committed, and what's next.
- **Commit with the task number** in the message, e.g. `Task 5: Add Outlook Graph API sync`.

---

## Hard-won lessons (DO NOT RELEARN THESE)

### Railway deployment gotchas

1. **`ANTHROPIC_API_KEY` doesn't work as a variable name on Railway.** Use `CLAUDE_API_KEY` instead. The code reads both: `process.env.ANTHROPIC_API_KEY || process.env.CLAUDE_API_KEY`.
2. **dotenv must NOT run in production.** The `.env` file baked into builds overrides Railway's variables. Server.ts does NOT import dotenv — dev mode uses `-r dotenv/config` flag instead.
3. **Railway auto-deploy is unreliable.** Often needs a `git commit --allow-empty -m "Trigger deploy" && git push` or manual redeploy from the dashboard.
4. **Railway networking port:** The app listens on whatever `PORT` Railway sets (usually 8080). The networking config in Railway Settings must match.
5. **Express 5 catch-all route:** Use `"/{*splat}"` not `"*"` — Express 5 uses path-to-regexp v8.
6. **CI treats ESLint warnings as errors.** Never leave unused imports/variables — the React build will fail on Railway.

### Claude API gotchas

7. **Model ID:** The working model is `claude-haiku-4-5-20251001`. Other IDs (`claude-sonnet-4-6-20250514`, `claude-3-5-sonnet-20241022`, `claude-sonnet-4-5-20241022`) all return 404 on this API key.
8. **API key check:** Always test with `GET /api/health/claude` after deploy to verify Claude is working before syncing emails.
9. **Silent extraction failure:** If Claude fails, the catch block returns only `{ Customer, Email }` as fallback — everything else shows "missing". Always check the model ID and API key first.

### Email sync gotchas

10. **`list-unsubscribe` header:** mailparser returns headers as a `Map`, not a plain object. Use `parsed.headers.has("list-unsubscribe")`, NOT `headers?.["list-unsubscribe"]`.
11. **IMAP SEARCH with ImapFlow:** The `or` parameter does NOT support arrays. Search each keyword individually and merge UIDs: `for (const kw of keywords) { uids = await client.search({ since, subject: kw }, { uid: true }); }`.
12. **"free shipping" false positives:** IMAP SEARCH catches retail promo emails containing "shipping". Claude classification is the final filter — the prompt must explicitly instruct that retail "free shipping" is NOT freight.
13. **CRM pollution:** Never call `resolveContact()` until AFTER Claude confirms the email is a freight RFQ. Otherwise every promo email creates a CRM record.

### Frontend gotchas

14. **Field name mismatch:** Claude returns `"Customer"` (not "Contact") and `"Weight"` (not "Tonnage"). The `QUOTE_REQUIRED` array in `RfqInbox.tsx` must match Claude's exact field names: `["Company", "Customer", "Email", "Commodity", "HS Code", "Weight", "Volume", "POL", "POD", "Container"]`.
15. **Sync button must call POST /api/gmail/sync**, not just reload RFQs. The old code only called `GET /api/rfqs` which just re-fetched existing data.

---

## Tech stack (do not change without discussion)

- **Backend:** Node 20, Express 5, TypeScript, Mongoose + MongoDB
- **Frontend:** React 18 (CRA), TypeScript, inline styles (design system in index.css)
- **Email:** Gmail via IMAP (app password) + Outlook via Microsoft Graph OAuth
- **AI:** Anthropic Claude (`claude-haiku-4-5-20251001`) for extraction + quote generation
- **Deploy:** Railway (auto-deploy from main branch, often needs manual trigger)
- **Package manager:** npm

---

## Environment variables

### Local (.env — gitignored)
```
PORT=5001
MONGODB_URI=mongodb://localhost:27017/oneport365
ANTHROPIC_API_KEY=sk-ant-...
MICROSOFT_CLIENT_ID=
MICROSOFT_CLIENT_SECRET=
MICROSOFT_REDIRECT_URI=http://localhost:5001/api/auth/microsoft/callback
```

### Railway (set in Variables tab, Raw Editor)
```
CLAUDE_API_KEY       — use this name, NOT ANTHROPIC_API_KEY
MONGODB_URI          — from Railway MongoDB plugin (use public URL)
NIXPACKS_NO_CACHE    — set to 1
```

Gmail uses app passwords (no env vars — stored in DB via Email Monitoring UI).
Microsoft OAuth vars added when Phase 2 is implemented.

---

## Key files

| Area | Files |
|------|-------|
| Email sync (IMAP) | `src/routes/gmail.ts` |
| Email filters | `src/lib/email-filters.ts` |
| AI extraction | `src/lib/ai-extract.ts` |
| AI quote gen | `src/lib/ai-quote.ts` |
| Quote prompt | `/Users/okpanachi/Downloads/quote_claude_prompt (1).txt` |
| Models | `src/models/*.ts` |
| Routes index | `src/routes/index.ts` |
| Frontend inbox | `client/src/pages/RfqInbox.tsx` |
| Frontend quotes | `client/src/pages/Quotes.tsx` |
| CSS design system | `client/src/index.css` |
| Health check | `src/routes/health.ts` (includes `/api/health/claude` test) |
| Email sync (Gmail API — Phase 1, unused) | `src/lib/gmail-api.ts`, `src/routes/email-sync.ts` |
| Google OAuth (unused) | `src/routes/google-auth.ts` |
| Microsoft OAuth | `src/routes/microsoft-auth.ts`, `src/lib/microsoft-oauth.ts` |

---

## Debug playbook — blank inbox

Walk these steps in order. Do not skip.

1. `GET /api/health` — is the server up? Is DB connected?
2. `GET /api/health/claude` — does Claude API work? Check model ID and key.
3. `GET /api/email-accounts` — are accounts configured and active?
4. `GET /api/gmail/status` — does IMAP connection succeed?
5. `POST /api/gmail/sync` via curl — what does the response say? (synced/skipped/errors)
6. `GET /api/rfqs` — are there any RFQs? Check field extraction quality.
7. Check browser console — fetch errors? CORS?
8. Check Railway deploy logs — is the latest code actually deployed? (check uptime in /api/health)
9. Only after steps 1-8: look at React components.

---

## Extraction pipeline (from Replit reference)

### Complete flow

```
Email arrives (IMAP sync)
       │
       ▼
Automated filter (email-filters.ts)
— skips newsletters, no-reply, list-unsubscribe, blocked domains
       │
       ▼
IMAP SEARCH (gmail.ts)
— server-side keyword filter: RFQ, quote, freight, shipment, container, etc.
— 60-day window, cap 500 results
       │
       ▼
For each email:
  ├─► Check if already ingested (uid lookup)
  ├─► Check threading (inReplyTo / subject-based fallback)
  │    └─► If reply to existing RFQ: re-extract with full thread, update RFQ
  │
  ├─► extractWithClaude() — classifies + extracts fields
  │    ├─► "customer-rfq" or "internal-rfq" → continue
  │    ├─► "rate-reply" → accept (future: parse rates)
  │    ├─► "promotional" / "irrelevant" / "outbound" → SKIP
  │    └─► Returns: { shipments[], combinedDraft, detectedEmailType }
  │
  ├─► resolveContact() — ONLY for confirmed freight emails
  │
  ├─► Create Email document
  │
  └─► Create RFQ(s) — one per shipment detected
       fields, missingFields, followUpDraft, status saved
```

### What triggers Claude calls (5 triggers total)

| # | Trigger | Endpoint | Claude function |
|---|---------|----------|-----------------|
| 1 | Sync button | `POST /api/gmail/sync` | `extractWithClaude()` per new email |
| 2 | Opening email with replies | `POST /api/rfqs/:id/re-extract` | `extractWithClaude()` on full thread |
| 3 | Convert to Quote button | `POST /api/quotes/generate/:rfqId` | Quote generation prompt |
| 4 | Generate Quote modal | `POST /api/quotes/generate/:rfqId` | Quote generation prompt |
| 5 | Regenerate Quote button | `POST /api/quotes/generate/:rfqId` | Quote generation (patch in-place) |

Two server-side Claude entry points: extraction (`ai-extract.ts`) and quote generation (`ai-quote.ts`).

### Pre-classification (rule-based, before Claude)

```typescript
preClassifyEmail({ fromName, fromEmail, subject, body }): string | null
```

Returns:
- `"outbound"` → OnePort's own rate-request template, skip entirely
- `"rate-reply"` → carrier/shipping line replying with rates (body has USD amounts, 40ft/40hc, validity dates)
- `null` → let Claude decide

Outbound signals: subject starts with "Rate Request —", body contains OnePort boilerplate, from-name contains "OnePort 365".

Rate-reply signals: "please find our rates", "all-in rate", rate tables with USD per container, carrier + route + amount, "Option 1 / Option 2" with prices.

### Claude extraction prompt — field names (MUST MATCH FRONTEND)

Claude returns these exact field keys. The frontend `QUOTE_REQUIRED` array must use these names:

```
Customer, Company, Freight Mode, POL, POD, Commodity, HS Code,
Weight, Volume, Pick-up, Container, Cargo class, Incoterm, Target Price
```

Frontend QUOTE_REQUIRED (for readiness score):
```typescript
["Company", "Customer", "Email", "Commodity", "HS Code", "Weight", "Volume", "POL", "POD", "Container"]
```

### Claude extraction prompt — email type classification

The prompt MUST include these types with clear instructions:

```
- "customer-rfq": actual cargo/freight that needs physical shipping
- "rate-reply": carrier/shipping line providing rates
- "internal-rfq": internal team forwarding customer request
- "outbound": email sent BY OnePort
- "promotional": marketing, retail, e-commerce, "free shipping" offers — NOT freight
- "irrelevant": personal, social, financial — unrelated to freight forwarding
```

CRITICAL instruction in prompt: "Only classify as customer-rfq if the email is about actual cargo that needs to be physically shipped between ports/countries. Retail 'free shipping' is NEVER freight."

### Claude extraction prompt — port resolution

The prompt must include these port code mappings:

```
Ocean: Lagos/Apapa→NGAPP, Tin Can→NGTCN, Onne→NGONE, Warri→NGWAR,
Rotterdam→NLRTM, Hamburg→DEHAM, Shanghai→CNSHA, Qingdao→CNTAO,
Dubai/Jebel Ali→AEJEA, Antwerp→BEANR, Istanbul/Ambarlı→TRIST,
Tema/Accra→GHTEM, Mombasa→KEMBA, Abidjan→CIABJ, Durban→ZADUR,
Singapore→SGSIN, Ningbo→CNNGB, Shenzhen/Yantian→CNYTN

Air: Lagos→LOS, Dubai→DXB, London→LHR, Frankfurt→FRA,
Hong Kong→HKG, Shanghai→PVG, Nairobi→NBO
```

### Internal forward rule

If From address ends in @oneport365.com, scan the body for the original external sender (look for "From: Name <external@domain.com>" lines). Set Customer to that name, Company from their domain. Classify as "customer-rfq" not "internal-rfq".

---

## Anti-patterns to avoid

- Scanning full mailbox (IMAP without SEARCH keywords)
- Calling Claude per message instead of per thread
- Creating CRM contacts for non-freight emails
- Returning `null` from render when data is empty
- Adding features not in SPEC.md
- Skipping PROGRESS.md update at end of session
- Using `localStorage` for anything that should be server-side
- Storing API keys or tokens in frontend code
- Using `ANTHROPIC_API_KEY` as Railway variable name (use `CLAUDE_API_KEY`)
- Using model IDs other than `claude-haiku-4-5-20251001` without testing first
- Checking mailparser headers with bracket notation (use `.has()` / `.get()`)
- Calling `resolveContact()` before Claude classification
- Using `"Contact"` or `"Tonnage"` in frontend field matching (Claude returns `"Customer"` and `"Weight"`)
