# Phase 4 Audit — Ingestion Path Consolidation

> Produced 2026-05-24. Compares the two parallel ingestion paths and
> proposes a migration plan. **No code changes until reviewed.**

---

## 1. Two ingestion paths

| | **gmail.ts** (IMAP path) | **email-sync.ts** (Gmail API path) |
|---|---|---|
| **Endpoint** | `POST /api/gmail/sync` | `POST /api/emails/sync` |
| **Providers** | Gmail IMAP + Outlook Graph | Gmail API (OAuth) only |
| **Gmail auth** | App password (IMAP) | OAuth2 (Gmail API) |
| **Outlook** | Graph API (embedded in sync loop) | Not supported (`errors.push("coming soon")`) |
| **Threading model** | Per-message. Each email is processed individually. Replies detected via `inReplyTo` / subject fallback → triggers re-extract per reply. | Per-thread. Gmail API returns full threads. One Claude call per thread. |
| **Claude calls per thread** | N calls (one per message, plus re-extract on each reply) — **violates CLAUDE.md rule** | 1 call — **correct** |
| **Pre-classification** | No `preClassifyEmail()` — goes straight to local classifier then Claude | Uses `preClassifyEmail()` to filter outbound/rate-reply before Claude |
| **Local classifier** | Yes (`classifyEmail()`) | No (skips local classifier) |
| **Post-extraction route filter** | Accepts `customer-rfq`, `internal-rfq`, `rate-reply` | Accepts `customer-rfq`, `internal-rfq` only (not `rate-reply`) |
| **Route validation** | None — creates RFQ even without POL/POD | Requires at least one POL or POD with `ok=true` before creating RFQ |
| **Dedup UID scheme** | `mid:<messageId>` or `<account>:<seq>` | `gmail:<threadId>` |
| **Extraction failure handling** | Creates Email with `extractionStatus: "failed"` (Phase 1 fix) | Creates Email with `extractionStatus: "failed"` (Phase 1 fix) |
| **Delta sync** | Time-based (`SINCE <lastSyncedAt - 1hr>`) | Gmail History API (`historyId` cursor) |
| **Frontend trigger** | `POST /api/gmail/sync` — **this is what the UI calls** | `POST /api/emails/sync` — **never called from UI** |
| **Status endpoint** | `GET /api/gmail/status` — tests IMAP connections | `GET /api/emails/status` — shows OAuth status |
| **Send** | `POST /api/gmail/send` — SMTP via EmailAccount | N/A (no send route) |
| **File size** | ~635 lines | ~215 lines |

---

## 2. Behaviour differences (detail)

### 2.1 Claude calls per thread
- **gmail.ts:** When a reply arrives during IMAP sync, it creates the reply Email document, then immediately calls `extractWithClaude` with `"Original:\n...\n\nReply:\n..."`. This happens once per reply message, and only uses the original + that one reply (not all replies). If 3 replies arrive in one sync, Claude is called 3 times for the same thread.
- **email-sync.ts:** Gmail API returns all messages in a thread. The `processThread()` function combines them into one `threadText` with `──────────────` separators. One Claude call covers the whole thread.

### 2.2 Pre-classification
- **gmail.ts:** Entirely missing. Outbound emails sent by OnePort (subject "Rate Request —") go straight to Claude for classification. Wastes API budget.
- **email-sync.ts:** Calls `preClassifyEmail()` to catch outbound and rate-reply patterns before Claude. Outbound and rate-reply emails are skipped without Claude.

### 2.3 Local classifier
- **gmail.ts:** Uses `classifyEmail()` (0-1 scoring). Score < 0.4 skipped, 0.4-0.6 borderline sent to Claude, >= 0.6 sent to Claude.
- **email-sync.ts:** Does NOT use the local classifier at all. Every email that passes `preClassifyEmail()` goes to Claude.

### 2.4 Rate-reply handling
- **gmail.ts:** Accepts `rate-reply` type from Claude, creates Email + RFQ for rate replies.
- **email-sync.ts:** Rejects `rate-reply` (only accepts `customer-rfq` and `internal-rfq`). This is arguably more correct — rate replies shouldn't create RFQs (they should eventually go to `POST /api/rates/parse-email` per CLAUDE.md).

### 2.5 Route validation (POL/POD check)
- **gmail.ts:** No check. An email about "shipping" that lacks any port info becomes an RFQ.
- **email-sync.ts:** Requires at least one POL or POD with `ok=true`. This filters out vague emails that Claude classified as RFQs but didn't have enough info to identify a route.

### 2.6 Threading reply storage
- **gmail.ts:** Stores each reply as a separate Email document linked via `parentEmailId`/`inReplyTo`. This supports the `/thread` endpoint and reply bubble display.
- **email-sync.ts:** Stores the entire thread as ONE Email document with combined body text. No separate reply documents. The `/thread` endpoint would return no replies for these emails (replies are baked into the body).

### 2.7 `list-unsubscribe` header check
- **gmail.ts:** Checks `parsed.headers?.has("list-unsubscribe")` — catches bulk/promo emails.
- **email-sync.ts:** No header check. Gmail API doesn't easily expose raw headers.

### 2.8 Body handling
- **gmail.ts:** Prefers plain text, falls back to stripped HTML if HTML has 1.5x more content. Truncates to 15K chars.
- **email-sync.ts:** Gmail API `decodeBody()` tries plain text first, falls back to stripped HTML. No explicit 15K truncation (though `extractWithClaude` still truncates internally).

---

## 3. Features unique to each path

### Features only in gmail.ts (must be preserved or migrated)
1. **Outlook Graph API sync** — the entire Outlook provider path (lines 137-264)
2. **IMAP connection testing** — `GET /api/gmail/status`
3. **SMTP send** — `POST /api/gmail/send` (used by send-followup)
4. **`list-unsubscribe` header filtering** — mailparser `.has()` check
5. **Local classifier** (`classifyEmail()`) — score-based pre-filtering
6. **Subject-based threading fallback** — for "Re:" replies without `In-Reply-To`
7. **Individual reply Email documents** — supports the thread UI (reply bubbles, "Original message" divider)
8. **IMAP app password auth** — currently the primary Gmail auth method in production

### Features only in email-sync.ts (should be adopted)
1. **Per-thread Claude calls** — correct architecture per CLAUDE.md
2. **`preClassifyEmail()`** — catches outbound/rate-reply before Claude
3. **POL/POD route validation** — prevents vague RFQs
4. **Gmail History API delta sync** — efficient incremental sync via `historyId`
5. **Rejects rate-reply type** — rate replies shouldn't create RFQs

---

## 4. Migration plan

### Target architecture
A single `POST /api/sync` endpoint that handles all providers:
- **Gmail (OAuth):** Gmail API per-thread path (from email-sync.ts)
- **Gmail (app password):** IMAP per-thread path (new — simulate per-thread by grouping by subject/inReplyTo before Claude)
- **Outlook (OAuth):** Graph API path (from gmail.ts, modified to group by `conversationId`)

### Phase 4A — Merge best-of-both into email-sync.ts
1. Add Outlook Graph sync to email-sync.ts (copy from gmail.ts, adapt to per-thread model using `conversationId` grouping)
2. Add local classifier (`classifyEmail()`) to email-sync.ts before Claude
3. Add `list-unsubscribe` equivalent: Gmail API labels include `CATEGORY_PROMOTIONS` — filter on that
4. Keep rate-reply rejection (don't create RFQs for rate replies)
5. Keep POL/POD route validation

### Phase 4B — Fix thread UI for per-thread emails
The `/thread` endpoint relies on separate reply Email documents (linked by `parentEmailId`). Per-thread emails store everything in one document. Options:
- **Option A:** When storing a thread-level Email, also create child Email documents for each message in the thread (with `parentEmailId` pointing to the first message). This preserves the reply bubble UI.
- **Option B:** Change the `/thread` endpoint to parse the combined body text and split it back into reply segments using the `──────────────` separator. Cheaper but fragile.
- **Recommended: Option A.** It keeps the data model clean and doesn't require parsing Claude's combined text.

### Phase 4C — Handle IMAP Gmail accounts
Gmail accounts using app passwords can't use the Gmail API. Options:
- **Option A (recommended):** Keep IMAP for app-password accounts, but refactor the processing: fetch all messages, group by `inReplyTo` chains into threads, then process each thread group with one Claude call. This aligns IMAP with the per-thread model.
- **Option B:** Force migration to Gmail OAuth. Show a warning on app-password accounts: "Please reconnect via Google OAuth for improved sync." email-sync.ts already does this.
- **Option C:** Support both indefinitely. Keep IMAP as a fallback.

### Phase 4D — Redirect frontend and retire gmail.ts sync
1. Change frontend `syncEmails` to call the new unified endpoint
2. Keep `GET /api/gmail/status` and `POST /api/gmail/send` in gmail.ts (they're utility routes, not ingestion)
3. Remove the sync handler from gmail.ts
4. Delete the deprecated IMAP sync code

---

## 5. Risk assessment

### Emails at risk during migration
1. **Gmail app-password accounts** — currently the primary auth method. If we switch to email-sync.ts immediately, these accounts stop syncing (email-sync.ts returns "Please reconnect via Google OAuth"). ~100% of current Gmail accounts use app passwords.
2. **Outlook accounts** — only gmail.ts handles Outlook Graph. If we retire gmail.ts sync before migrating, Outlook stops.
3. **Thread UI breakage** — existing RFQs have reply Email documents (linked by `parentEmailId`). New per-thread emails won't, so the reply bubble UI shows nothing for new emails unless we implement Option A from Phase 4B.

### Mitigation
- **Phase 4A+B first:** Add Outlook + per-thread child emails to email-sync.ts before touching gmail.ts
- **Phase 4C:** Keep IMAP for app-password Gmail accounts with per-thread grouping
- **Phase 4D:** Only retire gmail.ts sync after confirming all providers work on the new path
- **Feature flag:** Add an `EmailAccount.syncEngine: "legacy" | "v2"` field. Default new accounts to "v2", keep existing accounts on "legacy". Migrate one at a time.

### Effort estimate
- Phase 4A: Medium (move Outlook Graph, add classifier, add label filter)
- Phase 4B: Medium (create child Email docs from thread messages)
- Phase 4C: Medium (IMAP thread grouping logic)
- Phase 4D: Small (route redirect, cleanup)

---

## 6. Recommendation

Do not attempt Phases 4A-D in one session. The safest order is:

1. **4B first** — make email-sync.ts create child Email documents so thread UI works
2. **4A** — add Outlook Graph + classifier to email-sync.ts
3. **Test with one account** — create a test OAuth Gmail account, run email-sync.ts, verify thread UI + extraction
4. **4C** — add IMAP thread grouping for app-password accounts
5. **4D** — redirect frontend, retire gmail.ts sync

Each step should be a separate commit with tsc verification. Do not delete gmail.ts sync code until every provider works on the new path.

---

*Awaiting review before proceeding with any code changes.*
