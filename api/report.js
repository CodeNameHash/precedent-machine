const Anthropic = require("@anthropic-ai/sdk").default;

module.exports = async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "POST only" });
  const { deals, provisionType, comparisons } = req.body;
  if (!deals) return res.status(400).json({ error: "Missing deals" });

  try {
    const client = new Anthropic();
    const resp = await client.messages.create({
      model: "claude-sonnet-4-20250514",
      max_tokens: 3000,
      messages: [{
        role: "user",
        content: `Generate a precedent analysis report. Return ONLY JSON:

Deals: ${JSON.stringify(deals.map(d => ({ name: `${d.acquirer} / ${d.target}`, value: d.value, sector: d.sector, date: d.date })))}
Focus: ${provisionType || "All provisions"}
${comparisons ? `Prior comparison data: ${JSON.stringify(comparisons)}` : ""}

{
  "title": "report title",
  "date": "${new Date().toISOString().split("T")[0]}",
  "executive_summary": "3-4 sentence overview",
  "themes": [{ "theme": "name", "analysis": "2-3 sentences", "deals": ["relevant deal names"] }],
  "market_observations": ["3-5 observations"],
  "recommendations": ["3-5 recommendations"]
}`
      }],
    });
    const text = resp.content.map(c => c.text || "").join("");
    res.status(200).json(JSON.parse(text.replace(/```json|```/g, "").trim()));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};
