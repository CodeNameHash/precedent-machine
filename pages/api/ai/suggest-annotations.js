import Anthropic from '@anthropic-ai/sdk';

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST only' });

  const { text, type, category } = req.body;
  if (!text) return res.status(400).json({ error: 'text required' });

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return res.status(500).json({ error: 'ANTHROPIC_API_KEY not configured' });

  try {
    const client = new Anthropic({ apiKey });

    const resp = await client.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 2500,
      messages: [{
        role: 'user',
        content: `You are a senior M&A attorney reviewing a ${type || 'merger agreement'} provision (${category || 'general'}). Identify key phrases that should be annotated for a legal precedent database.

PROVISION TEXT:
${text}

For each notable phrase, identify:
1. The exact phrase as it appears in the text (must be an exact substring match)
2. Whether it favors buyer, seller, or is neutral
3. Why it matters

Return ONLY valid JSON (no markdown, no backticks):
{
  "annotations": [
    {
      "phrase": "exact phrase from the text",
      "favorability": "buyer" | "seller" | "neutral",
      "note": "brief explanation of why this phrase matters and its legal significance",
      "importance": "high" | "medium" | "low"
    }
  ]
}

Focus on:
- Materiality qualifiers ("material", "in all material respects", "would reasonably be expected to")
- Temporal qualifiers ("since the date of this Agreement", "prior to Closing")
- Carve-outs and exceptions
- Consent requirements ("without the prior written consent of Buyer")
- Standard of review ("ordinary course of business consistent with past practice")
- Measurement thresholds (dollar amounts, percentages)
- Knowledge qualifiers
- Bring-down standards
Return 5-10 annotations, prioritized by importance.`
      }],
    });

    const raw = resp.content.map(c => c.text || '').join('');
    const clean = raw.replace(/```json|```/g, '').trim();
    const result = JSON.parse(clean);
    return res.json(result);
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
