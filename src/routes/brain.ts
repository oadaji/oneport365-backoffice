import { Router, Request, Response } from "express";
import Anthropic from "@anthropic-ai/sdk";

function getAnthropicClient() {
  const apiKey = process.env.ANTHROPIC_API_KEY || process.env.CLAUDE_API_KEY;
  if (!apiKey) throw new Error("No Claude API key set (ANTHROPIC_API_KEY or CLAUDE_API_KEY)");
  return new Anthropic({ apiKey });
}

export const brainRouter = Router();

brainRouter.post("/brain/query", async (req: Request, res: Response) => {
  try {
    const { query, context, history } = req.body;
    if (!query) return res.status(400).json({ error: "query is required" });

    const claude = getAnthropicClient();

    const systemPrompt = `You are OnePort 365 Brain — an AI business intelligence assistant for OnePort 365, a freight forwarding company based in Nigeria.

You help company executives, commercial leads, finance teams, and operations managers get quick answers about the business.

You have access to the following real-time data context:

## RFQs (Request for Quotes)
${JSON.stringify(context?.rfqs || [], null, 0)}

## Quotes
${JSON.stringify(context?.quotes || [], null, 0)}

## Companies / Customers
${JSON.stringify(context?.companies || [], null, 0)}

## Instructions
- Answer questions accurately based on the data provided.
- If the data doesn't contain enough information to answer, say so clearly.
- Use specific numbers, names, and references from the data.
- Format responses clearly with bullet points and sections where helpful.
- For financial data, use USD formatting.
- Be concise but thorough. Executives want actionable insights.
- When referencing RFQs, use their ref numbers.
- When discussing routes, use port codes (e.g., NGAPP for Lagos Apapa).
- If asked about trends or patterns, analyze the available data.
- Never make up data that isn't in the context.`;

    const messages: Anthropic.MessageParam[] = [
      ...(history || []).map((h: { role: string; content: string }) => ({
        role: h.role as "user" | "assistant",
        content: h.content,
      })),
      { role: "user", content: query },
    ];

    const response = await claude.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 1500,
      system: systemPrompt,
      messages,
    });

    const answer = response.content
      .filter((b) => b.type === "text")
      .map((b) => (b as Anthropic.TextBlock).text)
      .join("\n");

    // Determine which data sources were used
    const sources: { type: string; label: string }[] = [];
    if (context?.rfqs?.length > 0) sources.push({ type: "rfqs", label: `${context.rfqs.length} RFQs` });
    if (context?.quotes?.length > 0) sources.push({ type: "quotes", label: `${context.quotes.length} Quotes` });
    if (context?.companies?.length > 0) sources.push({ type: "companies", label: `${context.companies.length} Companies` });

    res.json({ answer, sources });
  } catch (err: any) {
    console.error("Brain query error:", err.message);
    res.status(500).json({ error: "Failed to process query" });
  }
});
