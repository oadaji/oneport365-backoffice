# PROGRESS.md — Task Tracker

> Updated at end of each session. Source of truth for what's done and what's next.

---

## Completed tasks

### Task 1: Project setup + core models + CRUD routes
- Express 5 + MongoDB + React scaffold
- Models: Company, Contact, Email, RFQ, Quote, Rate (Ocean/Haulage/OtherCharge), Partner, EmailAccount, AppSetting
- Full CRUD routes for all models
- Seed data + clear data endpoints
- **Commit:** `d3be535` and earlier

### Task 2: Email sync (IMAP) + AI extraction
- Gmail IMAP sync with app passwords
- Claude extraction (RFQ fields from email body)
- Email threading (In-Reply-To + subject-based fallback)
- CRM contact resolution from emails
- **Commit:** `d3be535`

### Task 3: Microsoft 365 OAuth2 integration
- MSAL-based OAuth flow for Outlook
- IMAP XOAUTH2 for Outlook email sync
- SMTP send with OAuth2 tokens
- Shared mailbox support with badge
- **Commit:** `b1468ae`

### Task 4: AI-powered quote generation
- `POST /api/quotes/generate/:rfqId` — Claude generates quote from RFQ + rate pools
- Matches ocean rates, haulage rates, other charges
- Computes totals with margin + exchange rate
- Generate Quote button in RFQ extraction panel
- Auto-selects quote on Quotes page via `?id=` param
- **Commit:** `f7ffc54`

### Task 5: Railway deployment
- Backend serves React frontend build in production
- Nixpacks config, Express 5 catch-all route fix (`/{*splat}` not `*`)
- dotenv removed from production (Railway env vars only)
- MongoDB plugin connected (public URL, not internal)
- `CLAUDE_API_KEY` variable name (not `ANTHROPIC_API_KEY` — Railway won't inject it)
- Port set to 8080 in Railway networking
- Live at: https://oneport365-backoffice-production.up.railway.app
- **Commits:** `81540f0` through `ec43e25`

### Task 6: Email Monitoring modal
- Modal triggered from mail button in inbox sidebar
- Gmail: app password form with test connection
- Outlook: OAuth redirect buttons (personal + shared)
- Connected inboxes list with provider icons, sync status, badges
- **Commits:** various (part of Tasks 2-3)

### Task 7: IMAP SEARCH for shipping keywords
- Replaced "fetch last N" with server-side IMAP SEARCH
- Searches each keyword individually (ImapFlow `or` doesn't support arrays), merges UIDs
- Keywords: RFQ, quote, freight, shipment, container, FCL, LCL, booking, rates, EXW, FOB, CIF, etc.
- 60-day window, cap 500 results
- **Commit:** `56ddca2`

### Task 8: Email filter fixes
- Fixed `list-unsubscribe` header detection (mailparser headers are a `Map` — use `.has()` not bracket notation)
- Added blocked sender domain list (50+ retail/promo domains)
- Added promotional subject patterns (% off, flash sale, shop now)
- **Commits:** `451b4cd` through `23d261b`

### Task 9: Claude extraction end-to-end
- **API key fix:** Railway won't inject `ANTHROPIC_API_KEY` — code reads `CLAUDE_API_KEY` as fallback
- **Model ID fix:** Tested all model IDs — only `claude-haiku-4-5-20251001` works on this API key
- **Health check:** Added `GET /api/health/claude` test endpoint (tries model, returns exact error)
- **Promo email fix:** Failed extractions no longer create RFQs — fallback returns `detectedEmailType: "irrelevant"` + empty shipments. Default type changed from `"customer-rfq"` to `"irrelevant"`.
- **Claude classification prompt:** Added "promotional" and "irrelevant" email types with explicit instruction that retail "free shipping" ≠ freight
- **Field name fix:** Frontend QUOTE_REQUIRED changed from `["Contact", "Tonnage"]` to `["Customer", "Weight"]` to match Claude's actual field names
- **Sync button fix:** Now calls `POST /api/gmail/sync` (not just `GET /api/rfqs`), with spinning animation
- **CRM pollution fix:** `resolveContact()` only runs after Claude confirms freight RFQ
- **Result:** 9 freight RFQs synced, 0 promotional, extraction working (3-13 fields per RFQ)
- **Commits:** `eb67ca3` through `d41509f`

### Task 10: Project governance files
- Created CLAUDE.md — session protocol, 15 hard-won lessons, extraction pipeline, debug playbook
- Created SPEC.md — feature spec, email filter, extraction fields, UI layout, endpoints
- Created PROGRESS.md — task tracker
- Integrated Replit handover: @oneport365.com rule (3 layers), effectiveSender(), volume rules, HS code suggestions, multi-shipment groups, pre-classification signals
- Cleaned up CLAUDE.md: 437 → 296 lines, zero duplication, 13 numbered sections
- **Commits:** `9172b49` through `9b9f60c`

---

## Next up

### Task 11: Phase 2 — Microsoft Graph API for Outlook
- Replace Outlook IMAP with Graph API
- KQL `$search` with shipping keywords on `/me/mailFolders/inbox/messages`
- Group by `conversationId` for threading
- Delta sync with `deltaLink` cursor
- Scopes: `offline_access Mail.Read User.Read`
- Merged inbox across Gmail + Outlook with provider badges (G/O)

### Task 12: Phase 3 — Stage 2 classifier + thread briefs
- Local scoring classifier (0-1) with Claude fallback for borderline (0.4-0.6)
- Combined brief + RFQ extraction in one Claude call per thread
- Type pills: Customer RFQ, Rate Sheet, Booking Confirmation, Operational
- Status: Ready (>=8), Info needed (4-7), New (<4)
- Proper empty/loading/error states per SPEC.md Section 5.1

### Task 13: Implement @oneport365.com 3-layer rule
- Layer 1: `extractForwardedSender()` in gmail.ts
- Layer 2: INTERNAL FORWARD RULE in Claude prompt
- Layer 3: `effectiveSender()` in frontend
- Currently only Layer 2 exists partially

### Task 14: Multi-shipment group UI
- Tabs in extraction panel per shipment
- Group badges in inbox list
- Shared followUpDraft from groupIndex=1

### Task 15: Quote improvements
- Regenerate button (PATCH in-place, save: false)
- Rate-reply auto-parse (POST /api/rates/parse-email)
- Stronger preClassify with Replit rate-reply signals

### Task 16: Sync as background job
- POST /api/gmail/sync returns `{ jobId }`
- Poll GET /api/gmail/sync/status/:jobId
- Progress bar in UI (processed / synced / skipped / errors)
- Prevents timeout on large syncs

---

## Open questions

- Should we upgrade to a Sonnet model when available on this API key? Haiku works but Sonnet would be better for extraction quality.
- How should rate data be ingested? Manual entry, CSV upload, or PDF parsing?
- Multi-user auth — when is this needed?
- WhatsApp integration — any specific provider (Twilio, WATI)?
- Should Gmail switch to Gmail API (requires Google Cloud Console setup)?

---

## Known issues

1. Railway auto-deploy sometimes doesn't trigger — needs empty commit push or manual redeploy
2. IMAP sync can timeout on Railway (502) for large batches — need background job (Task 16)
3. Some emails may still slip through if Claude Haiku misclassifies them — Sonnet would be more accurate
4. Gmail/Outlook logo images use external CDN URLs — may break if CDN is down
5. `extractForwardedSender()` not yet implemented (Task 13) — @oneport365.com emails show team member as customer

### Task 11: Phase 2 — Microsoft Graph API for Outlook (completed)
- Created `outlook-graph.ts` with OUTLOOK_SHIPPING_SEARCH (KQL)
- Server-side `$search` + `$filter` on `/me/mailFolders/inbox/messages`
- OAuth scopes updated to `Mail.Read` + `User.Read` (no IMAP)
- Auto-detects Outlook accounts in sync route, uses Graph API
- Delta sync with deltaLink cursor
- **Commit:** `bc6e7ae`

### Task 12: Phase 3 — Stage 2 classifier + empty/loading states (completed)
- Local classifier scores 0-1 (keywords, domains, attachments, promo signals)
- Score < 0.4 dropped before Claude (saves API cost)
- Integrated into both Gmail IMAP and Outlook Graph sync
- Improved empty/loading states — no blank pane
- **Commit:** `567f970`

### Task 17: Phase 1 — Correctness bugs in extraction and threading
- **1.1:** Fixed undefined `fromEmail` variable in `POST /api/gmail/send` (gmail.ts:614) — was referencing out-of-scope variable instead of `from`
- **1.2:** Extraction failures now create Email documents with `extractionStatus: "failed"` instead of silently skipping. Added `extractionStatus`/`extractionError` fields to Email model. `extractWithClaude` returns discriminated union (`status: "ok"` or `status: "error"` with errorType). Added `POST /api/emails/:id/retry-extraction` endpoint for retrying failed extractions.
- **1.3:** Extracted `findThreadReplies()` into `src/lib/thread.ts` — shared by both `/thread` and `/re-extract` routes so they use identical `$or` queries (parentEmailId + inReplyTo). Previously `/re-extract` only matched on `parentEmailId`, missing inReplyTo-linked replies.
- **1.4:** Added `"partial"` and `"stuck"` statuses to Rfq model. Re-extract now compares prior vs new missing fields: replies + no missing → "ready", replies + fewer missing → "partial", replies + same/more missing → "stuck". Frontend renders "partial reply" (amber) and "stalled" (red).
- **1.5:** Re-extract now updates all sibling RFQs in a multi-shipment group, not just the first. Matches by groupIndex to shipment index. Logs warning if count mismatch.
- Also removed inline `require()` calls in rfqs.ts re-extract handler (replaced with top-level imports)
