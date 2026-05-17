# PROGRESS.md — Task Tracker

> Updated at end of each session. Source of truth for what's done and what's next.

---

## Completed tasks

### Task 1: Project setup + core models + CRUD routes
- Express + MongoDB + React scaffold
- Models: Company, Contact, Email, RFQ, Quote, Rate (Ocean/Haulage/OtherCharge), Partner, EmailAccount, AppSetting
- Full CRUD routes for all models
- Seed data endpoint
- **Commit:** `d3be535` and earlier

### Task 2: Email sync (IMAP) + AI extraction
- Gmail IMAP sync with app passwords
- Claude extraction (RFQ fields from email body)
- Pre-classification filters
- Email threading (In-Reply-To + subject-based fallback)
- CRM contact resolution from emails
- **Commit:** `d3be535`

### Task 3: Microsoft 365 OAuth2 integration
- MSAL-based OAuth flow for Outlook
- IMAP XOAUTH2 for Outlook email sync
- SMTP send with OAuth2 tokens
- Shared mailbox support
- **Commit:** `b1468ae`

### Task 4: AI-powered quote generation
- `POST /api/quotes/generate/:rfqId` — Claude generates quote from RFQ + rate pools
- Matches ocean rates, haulage rates, other charges
- Computes totals with margin + exchange rate
- Generate Quote button in RFQ extraction panel
- **Commit:** `f7ffc54`

### Task 5: Railway deployment
- Backend serves React frontend build in production
- Nixpacks config, Express 5 catch-all route fix
- dotenv removed from production (Railway env vars)
- MongoDB plugin connected
- Live at: https://oneport365-backoffice-production.up.railway.app
- **Commits:** `81540f0` through `ec43e25`

### Task 6: Email Monitoring modal
- Modal triggered from mail button in inbox sidebar
- Gmail: app password form with test connection
- Outlook: OAuth redirect buttons (personal + shared)
- Connected inboxes list with provider icons, sync status, badges
- **Commit:** various (part of Tasks 2-3)

### Task 7: IMAP SEARCH for shipping keywords
- Replaced "fetch last N" with server-side IMAP SEARCH
- Searches each shipping keyword individually, merges UIDs
- Keywords: RFQ, quote, freight, shipment, container, FCL, LCL, etc.
- 60-day window, cap at 500 results
- **Commit:** `56ddca2`

### Task 8: Email filter fixes
- Fixed list-unsubscribe header detection (Map vs object bug)
- Added blocked sender domain list (50+ retail/promo domains)
- Domain check covers subdomains (email.gapfactory.com → gapfactory.com)
- Removed redundant double-filtering (IMAP SEARCH already filters)
- Fixed Claude model ID to `claude-sonnet-4-6-20250514`
- **Commits:** `451b4cd` through `eb67ca3`

---

## In progress

### Task 9: Verify Claude extraction works end-to-end
- **Status:** Extraction may be failing silently (all fields show "missing")
- **Blocker:** Need to confirm ANTHROPIC_API_KEY is set on Railway
- **Next steps:**
  1. Verify API key is set and valid
  2. Check deploy logs for "Claude extraction failed" errors
  3. Clear data + resync after confirming key works
  4. Verify real freight emails get proper POL/POD/Commodity extraction

---

## Next up

### Task 10: Phase 2 — Microsoft Graph API for Outlook
- Replace Outlook IMAP with Graph API
- KQL `$search` with shipping keywords on `/me/mailFolders/inbox/messages`
- Group by `conversationId` for threading
- Delta sync with `deltaLink` cursor
- Scopes: `offline_access Mail.Read User.Read`

### Task 11: Phase 3 — Stage 2 classifier + thread briefs
- Local scoring classifier (0-1) with Claude fallback for borderline
- Combined brief + RFQ extraction in one Claude call per thread
- Type pills: Customer RFQ, Rate Sheet, Booking Confirmation, Operational
- Status: Ready (>=8), Info needed (4-7), New (<4)
- Merged inbox across Gmail + Outlook with provider badges (G/O)
- Proper empty/loading/error states per SPEC.md Section 5.1

### Task 12: Quote UI improvements
- Regenerate button functionality
- Send to customer (email)
- PDF generation

---

## Open questions

- Should Gmail switch from IMAP to Gmail API (requires Google Cloud Console setup)?
- How should rate data be ingested? Manual entry, CSV upload, or PDF parsing?
- Multi-user auth — when is this needed?
- WhatsApp integration — any specific provider (Twilio, WhatsApp Business API)?

---

## Known issues

1. Railway auto-deploy sometimes doesn't trigger — may need manual redeploy or empty commit push
2. Some promotional emails still slip through IMAP SEARCH (e.g. "free shipping" in subject)
3. Claude extraction quality needs verification with ANTHROPIC_API_KEY confirmed working
4. Gmail/Outlook logo images use external URLs (img.icons8.com, gstatic.com) — may break if CDN is down
