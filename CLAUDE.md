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
```

---

## Rules

- **SPEC.md is the source of truth.** If this repo disagrees with the spec, the spec wins.
- **Do not invent features, fields, routes, or UI** not in SPEC.md. If you think something is needed, add it to `PROGRESS.md → Open questions` and stop.
- **Do not rewrite the quote prompt** in `quote_claude_prompt.txt`. Wire it as-is.
- **Never scan a full mailbox.** Every IMAP SEARCH or API call must carry shipping-keyword filters.
- **Never return a blank pane.** Every list must handle loading, error, and empty states.
- **One Claude call per thread**, not per message.
- **Update PROGRESS.md** at the end of every session with what was done, committed, and what's next.
- **Commit with the task number** in the message, e.g. `Task 5: Add Outlook Graph API sync`.

---

## Debug playbook — blank inbox

Walk these steps in order. Do not skip.

1. Check `/api/health` — is the server up? Is DB connected?
2. Check `/api/email-accounts` — are accounts configured and active?
3. Check `/api/gmail/status` — does IMAP connection succeed?
4. Trigger `POST /api/gmail/sync` via curl — what does the response say? (synced/skipped/errors)
5. Check `/api/rfqs` — are there any RFQs in the database?
6. Check browser console — are there fetch errors? CORS issues?
7. Check Railway deploy logs — is the latest code actually deployed?
8. Only after steps 1-7: look at React components.

---

## Tech stack (do not change without discussion)

- **Backend:** Node 20, Express 5, TypeScript, Mongoose + MongoDB
- **Frontend:** React 18 (CRA), TypeScript, inline styles (design system in index.css)
- **Email:** Gmail via IMAP (app password) + Outlook via Microsoft Graph OAuth
- **AI:** Anthropic Claude (claude-sonnet-4-6-20250514) for extraction + quote generation
- **Deploy:** Railway (auto-deploy from main branch)
- **Package manager:** npm

---

## Environment variables

### Local (.env — gitignored)
```
PORT=5001
MONGODB_URI=mongodb://localhost:27017/oneport365
ANTHROPIC_API_KEY=
MICROSOFT_CLIENT_ID=
MICROSOFT_CLIENT_SECRET=
MICROSOFT_REDIRECT_URI=http://localhost:5001/api/auth/microsoft/callback
```

### Railway (set in Variables tab)
```
MONGODB_URI          — from Railway MongoDB plugin
ANTHROPIC_API_KEY    — from console.anthropic.com
MICROSOFT_CLIENT_ID  — from Azure AD app registration
MICROSOFT_CLIENT_SECRET
MICROSOFT_REDIRECT_URI=https://oneport365-backoffice-production.up.railway.app/api/auth/microsoft/callback
```

Gmail uses app passwords (no env vars needed — stored in DB via Email Monitoring UI).

---

## Key files

| Area | Files |
|------|-------|
| Email sync | `src/routes/gmail.ts`, `src/lib/email-filters.ts` |
| AI extraction | `src/lib/ai-extract.ts` |
| AI quote gen | `src/lib/ai-quote.ts` |
| Quote prompt | `/Users/okpanachi/Downloads/quote_claude_prompt (1).txt` |
| Models | `src/models/*.ts` |
| Routes index | `src/routes/index.ts` |
| Frontend inbox | `client/src/pages/RfqInbox.tsx` |
| Frontend quotes | `client/src/pages/Quotes.tsx` |
| CSS design system | `client/src/index.css` |

---

## Anti-patterns to avoid

- Scanning full mailbox (IMAP LIST without SEARCH keywords)
- Calling Claude per message instead of per thread
- Creating CRM contacts for non-freight emails
- Returning `null` from render when data is empty
- Adding features not in SPEC.md
- Skipping PROGRESS.md update at end of session
- Using `localStorage` for anything that should be server-side
- Storing API keys or tokens in frontend code
