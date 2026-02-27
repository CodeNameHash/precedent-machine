const Anthropic = require("@anthropic-ai/sdk").default;

module.exports = async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "POST only" });
  const { precedentText, draftText, dealName, provisionType } = req.body;
  if (!precedentText || !draftText) return res.status(400).json({ error: "Missing text" });

  try {
    const client = new Anthropic();
    const resp = await client.messages.create({
      model: "claude-sonnet-4-20250514",
      max_tokens: 4000,
      messages: [{
        role: "user",
        content: `You are a corporate M&A attorney. Compare this DRAFT ${provisionType} provision against the PRECEDENT from ${dealName}.

PRECEDENT:
${precedentText}

DRAFT:
${draftText}

Return ONLY JSON:
{
  "summary": "2-3 sentence executive summary of key differences",
  "riskLevel": "low|medium|high",
  "differences": [
    {
      "category": "category name",
      "precedent_language": "excerpt",
      "draft_language": "excerpt or OMITTED",
      "analysis": "significance",
      "risk": "low|medium|high",
      "recommendation": "specific change"
    }
  ],
  "missing_provisions": ["important items in precedent but absent from draft"],
  "novel_provisions": ["items in draft not in precedent"]
}`
      }],
    });
    const text = resp.content.map(c => c.text || "").join("");
    res.status(200).json(JSON.parse(text.replace(/```json|```/g, "").trim()));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};
