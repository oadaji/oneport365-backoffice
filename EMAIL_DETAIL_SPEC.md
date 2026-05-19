# Email Detail — Technical Reference (from Replit)

> This documents how the Replit version handles email detail view, thread replies,
> sender attribution, drafts, and compose. Use as implementation reference.

---

## 1. selEmail(rfqId) — entry point

Every inbox click triggers this. It does:

1. **Synchronous** (from in-memory rfqData[]):
   - Write subject, from (via effectiveSender), time, body to DOM
   - Build sibling group (multi-shipment: all RFQs from same emailId)
   - Clear stale replies from previous selection
   - Render extraction panel + brief from loaded data

2. **Async** (loadThread):
   - Fetch thread replies
   - If replies exist: auto re-extract with full thread
   - Refresh inbox list status badges

---

## 2. Thread replies + "Original message" divider

### Reading order:
```
[newest reply]
[older reply]
──── Original message ────
[original email body]
```

### Flow:
1. `GET /api/rfqs/:id/thread` → returns reply emails ordered ASC
2. Reverse for display (newest first)
3. Inject reply bubbles into thread container above email body
4. Insert "Original message" divider between replies and body
5. If no replies: clear thread container, remove divider

### Reply bubble format:
```
Customer reply [N]
[fromName] · [date]
[reply body]
```

---

## 3. Auto re-extract on thread open

When loadThread() finds replies, it automatically fires:
```
POST /api/rfqs/:id/re-extract
```

This sends the combined thread (original + all replies) to Claude.
Claude re-extracts fields and updates:
- `fields`, `missingFields`, `followUpDraft`, `status`

Status logic after re-extract:
- Replies exist + missing=[] → "ready"
- Replies exist + missing>0 → "replied" (advance anyway)
- No replies → Claude's verdict

The extraction panel silently refreshes with updated data.

---

## 4. effectiveSender(rfq) — sender attribution

Never expose @oneport365.com as customer. Resolution priority:

| # | Check | Source |
|---|-------|--------|
| 1 | fromEmail NOT @oneport365.com | email.fromEmail — return immediately |
| 2 | Extracted field k="Email" | Claude's fields[] |
| 3 | Extracted field k="Customer" or "Contact" | Claude's fields[] |
| 4 | Fallback | Return internal address as-is |

Used in: d-from header, compose To: field, Quote Readiness Contact+Email.

The compose tray To: field is driven by Claude's extraction, not raw IMAP From: header.

---

## 5. Follow-up draft lifecycle

### A. Created during ingestion
- Claude generates `combinedDraft` covering all missing fields
- Warm, professional email from "Commercial Team · OnePort 365"
- Personalised greeting, numbered list of missing items, under 120 words
- For multi-shipment: labelled sections per shipment
- Stored in `rfq.followUpDraft`
- For groups: only stored on groupIndex=0

### B. Updated during re-extract
- When replies arrive, Claude re-runs on combined thread
- New draft generated reflecting updated missing fields
- Preserved if Claude returns nothing new

### C. Displayed in compose tray
- Pre-filled into textarea from rfq.followUpDraft
- For grouped RFQs: draft always from groupIndex=0 sibling
- If compose tray is open (user typing): NEVER overwrite with re-extract result
- If info_needed + has draft: auto-open compose tray

---

## 6. Compose tray "Send Now"

### Email channel (SMTP):
```
POST /api/rfqs/:id/send-followup
{ to: effectiveSender.email, subject: "Re: <original>", body: draft }
```
On success: status → "replied", followUpDraft updated

### WhatsApp channel (WATI):
```
POST /api/wati/send
{ phone: whatsappPhone, message: draft }
PATCH /api/rfqs/:id
{ status: "replied", followUpDraft: draft }
```

Both paths re-render inbox item with new "replied" status badge.

---

## 7. Complete data flow

```
User clicks inbox item
  → selEmail(rfqId)
      ├─ sync: write subject, from, time, body from memory
      │   from uses effectiveSender() → checks @oneport365.com
      │
      ├─ sync: renderExtraction() + renderBrief()
      │   reads rfq.followUpDraft → writes into compose textarea
      │
      └─ async: loadThread(rfqId)
            ├─ GET /api/rfqs/:id/thread
            │   replies → inject above body + "Original message" divider
            │
            ├─ POST /api/rfqs/:id/re-extract (if replies exist)
            │   combined thread → Claude → updated fields/draft/status
            │   renderExtraction() again (skip if compose open)
            │
            └─ GET /api/rfqs → refresh inbox list badges
```

---

## Not yet implemented in our version

- [ ] Thread reply bubbles display (loadThread UI)
- [ ] "Original message" divider
- [ ] Auto re-extract when opening email with replies
- [ ] Compose tray with auto-open for info_needed
- [ ] Draft protection (don't overwrite if user is typing)
- [ ] AbortController for stale loadThread requests
- [ ] WhatsApp send channel
