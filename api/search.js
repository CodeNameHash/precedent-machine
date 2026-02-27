const Anthropic = require("@anthropic-ai/sdk").default;

module.exports = async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "POST only" });
  const { query, deals, provisions } = req.body;
  if (!query) return res.status(400).json({ error: "Missing query" });

  try {
    const client = new Anthropic();
    const dealList = deals.map(d => `DEAL:${d.id} "${d.acquirer} / ${d.target}" (${d.sector}, ${d.value}, ${d.date})`).join("\n");
    const provList = provisions.map(p => `PROV:${p.id} [${p.type}] ${p.dealId} — ${p.category || p.type}. Tags: ${(p.tags||[]).join(", ")}`).join("\n");

    const resp = await client.messages.create({
      model: "claude-sonnet-4-20250514",
      max_tokens: 1000,
      messages: [{
        role: "user",
        content: `You are a legal search engine for M&A precedents. Classify this query and return matching results.

Query: "${query}"

Available deals:
${dealList}

Available provisions:
${provList}

Return ONLY JSON:
{
  "intent": "deal" or "provision",
  "results": [list of matching IDs (DEAL:x or PROV:x) ranked by relevance],
  "suggested_filters": ["filters that would help narrow results — e.g. sector names, provision types, jurisdictions"],
  "terms": [key terms to highlight],
  "reasoning": "brief explanation"
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
