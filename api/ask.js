const Anthropic = require("@anthropic-ai/sdk").default;

module.exports = async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "POST only" });
  const { question, context, history } = req.body;
  if (!question) return res.status(400).json({ error: "Missing question" });

  try {
    const client = new Anthropic();
    const messages = [...(history || []).slice(-10), { role: "user", content: question }];

    const resp = await client.messages.create({
      model: "claude-sonnet-4-20250514",
      max_tokens: 2000,
      system: `You are a senior M&A attorney with deep expertise in deal precedents. You have access to the following coded provision database. Answer precisely, cite specific deals and provisions, compare across precedents when relevant.

PRECEDENT DATABASE:
${context}

When answering:
- Cite specific deal names and exact provision language
- Compare across deals when the question warrants it
- Flag notable outliers or unusual terms
- Be precise about dollar amounts, percentages, time periods, standards
- If the database doesn't contain enough information, say so`,
      messages,
    });

    const text = resp.content.map(c => c.text || "").join("");
    res.status(200).json({ answer: text, usage: resp.usage });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};
