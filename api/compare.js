const Anthropic = require("@anthropic-ai/sdk").default;

module.exports = async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "POST only" });
  const { provisionType, prongs, deals } = req.body;
  if (!prongs || !deals) return res.status(400).json({ error: "Missing prongs or deals" });

  try {
    const client = new Anthropic();

    const prongData = prongs.map(p => {
      const entries = deals.map(d => {
        const match = p.entries.find(e => e.dealId === d.id);
        return `  ${d.acquirer}/${d.target}: ${match ? match.text : "[NOT PRESENT]"}`;
      }).join("\n");
      return `PRONG: ${p.category}\n${entries}`;
    }).join("\n\n");

    const resp = await client.messages.create({
      model: "claude-sonnet-4-20250514",
      max_tokens: 4000,
      messages: [{
        role: "user",
        content: `You are a senior M&A attorney comparing ${provisionType} provisions across ${deals.length} deals. Analyze the coded prongs below and explain material differences.

${prongData}

For EACH prong, return analysis. Return ONLY JSON (no markdown):
{
  "comparisons": [
    {
      "category": "prong category name",
      "summary": "1-2 sentence summary of how this prong differs across deals",
      "most_buyer_friendly": "deal name",
      "most_seller_friendly": "deal name",
      "market_position": "what is standard market practice for this prong",
      "notable_differences": ["specific differences worth flagging"],
      "risk_notes": "any risk allocation implications"
    }
  ],
  "overall_summary": "3-4 sentence executive summary comparing these deals on this provision type",
  "key_takeaway": "single most important observation for a practitioner"
}`
      }],
    });

    const text = resp.content.map(c => c.text || "").join("");
    const clean = text.replace(/```json|```/g, "").trim();
    res.status(200).json(JSON.parse(clean));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};
