import { Router, Request, Response } from "express";
import { Quote } from "../models/quote";
import { Rfq } from "../models/rfq";
import { generateQuoteFromRfq } from "../lib/ai-quote";

const router = Router();

function generateQuoteRef(): string {
  const now = new Date();
  const yymm = String(now.getFullYear()).slice(2) + String(now.getMonth() + 1).padStart(2, "0");
  const rand = String(Math.floor(Math.random() * 9000) + 1000);
  return `QUOTE-${yymm}-${rand}`;
}

function fieldVal(fields: Array<{ k: string; v: string; ok: boolean }>, key: string): string {
  const f = fields.find((x: any) => x.k.toLowerCase().includes(key.toLowerCase()));
  return f?.v && f.v !== "not specified" ? f.v : "";
}

// POST /api/quotes/generate/:rfqId — AI-generate a quote from an RFQ
router.post("/quotes/generate/:rfqId", async (req: Request, res: Response) => {
  try {
    const rfq = await Rfq.findById(req.params.rfqId)
      .populate("companyId", "name")
      .populate("contactId", "firstName lastName email");

    if (!rfq) {
      res.status(404).json({ error: "RFQ not found" });
      return;
    }

    const company = rfq.companyId as any;
    const contact = rfq.contactId as any;

    const aiResult = await generateQuoteFromRfq({
      ref: rfq.ref,
      fields: rfq.fields,
      companyName: company?.name,
      customerName: contact ? `${contact.firstName} ${contact.lastName || ""}`.trim() : undefined,
      contactEmail: contact?.email,
      companyId: company?._id?.toString(),
      contactId: contact?._id?.toString(),
    });

    // Compute totals
    const containerQty = parseInt(fieldVal(rfq.fields, "qty") || fieldVal(rfq.fields, "quantity")) || 1;
    const oceanTotal = (aiResult.oceanAmount || 0) * containerQty;

    // Convert NGN charges to USD for total
    const sumCharges = (charges: any[]) =>
      charges.reduce((sum, c) => {
        if (c.asPerReceipt || !c.amount) return sum;
        if (c.currency === "NGN") return sum + c.amount / aiResult.exchangeRate;
        return sum + c.amount;
      }, 0);

    const originTotal = sumCharges(aiResult.originCharges || []);
    const destTotal = sumCharges(aiResult.destCharges || []);
    const haulageUSD = aiResult.haulageAmount
      ? (aiResult.haulageCurrency === "NGN" ? aiResult.haulageAmount / aiResult.exchangeRate : aiResult.haulageAmount)
      : 0;

    const totalCostUSD = oceanTotal + originTotal + destTotal + haulageUSD;
    const sellPriceUSD = Math.round(totalCostUSD * (1 + aiResult.marginPct / 100) * 100) / 100;

    const quote = await Quote.create({
      quoteRef: generateQuoteRef(),
      rfqId: rfq._id,
      rfqRef: rfq.ref,
      status: "draft",
      customerName: contact ? `${contact.firstName} ${contact.lastName || ""}`.trim() : undefined,
      companyName: company?.name,
      customerEmail: contact?.email,
      pol: aiResult.polLabel,
      pod: aiResult.podLabel,
      polCode: fieldVal(rfq.fields, "pol"),
      podCode: fieldVal(rfq.fields, "pod"),
      commodity: fieldVal(rfq.fields, "commodity") || "General Cargo",
      containerType: fieldVal(rfq.fields, "container") || "40ft",
      containerQty,
      carrier: aiResult.carrier,
      oceanLine: {
        rateId: aiResult.selectedOceanRateId,
        carrier: aiResult.carrier,
        amount: aiResult.oceanAmount,
        currency: aiResult.oceanCurrency,
        transitTime: aiResult.transitTime,
        freeTime: aiResult.freeTime,
        polLabel: aiResult.polLabel,
        podLabel: aiResult.podLabel,
      },
      originCharges: aiResult.originCharges || [],
      destCharges: aiResult.destCharges || [],
      haulage: aiResult.hasSuggestedHaulage
        ? {
            rateId: aiResult.selectedHaulageRateId,
            terminal: aiResult.haulageTerminal,
            destCity: aiResult.haulageDestCity,
            amount: aiResult.haulageAmount,
            currency: aiResult.haulageCurrency,
          }
        : undefined,
      hasSuggestedHaulage: aiResult.hasSuggestedHaulage,
      exchangeRate: aiResult.exchangeRate,
      marginPct: aiResult.marginPct,
      totalCostUSD: Math.round(totalCostUSD * 100) / 100,
      sellPriceUSD,
      companyId: company?._id,
      contactId: contact?._id,
      aiNotes: aiResult.notes,
    });

    res.status(201).json(quote);
  } catch (err: any) {
    console.error("Quote generation error:", err);
    res.status(500).json({ error: "Failed to generate quote", details: err.message });
  }
});

// GET /api/quotes
router.get("/quotes", async (_req: Request, res: Response) => {
  try {
    const quotes = await Quote.find()
      .populate("companyId", "name")
      .populate("contactId", "firstName lastName email")
      .sort({ createdAt: -1 });
    res.json(quotes);
  } catch (err) {
    res.status(500).json({ error: "Failed to load quotes" });
  }
});

// GET /api/quotes/:id
router.get("/quotes/:id", async (req: Request, res: Response) => {
  try {
    const quote = await Quote.findById(req.params.id)
      .populate("companyId")
      .populate("contactId");
    if (!quote) { res.status(404).json({ error: "Quote not found" }); return; }
    res.json(quote);
  } catch (err) {
    res.status(500).json({ error: "Failed to get quote" });
  }
});

// POST /api/quotes
router.post("/quotes", async (req: Request, res: Response) => {
  try {
    const quote = await Quote.create(req.body);
    res.status(201).json(quote);
  } catch (err) {
    res.status(500).json({ error: "Failed to create quote" });
  }
});

// PATCH /api/quotes/:id
router.patch("/quotes/:id", async (req: Request, res: Response) => {
  try {
    const updated = await Quote.findByIdAndUpdate(req.params.id, req.body, { new: true });
    if (!updated) { res.status(404).json({ error: "Quote not found" }); return; }
    res.json(updated);
  } catch (err) {
    res.status(500).json({ error: "Failed to update quote" });
  }
});

// DELETE /api/quotes/:id
router.delete("/quotes/:id", async (req: Request, res: Response) => {
  try {
    await Quote.findByIdAndDelete(req.params.id);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: "Failed to delete quote" });
  }
});

export { router as quotesRouter };
