import Anthropic from '@anthropic-ai/sdk';

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST only' });

  const { precedentText, draftText, dealName, provisionType } = req.body;
  if (!precedentText || !draftText) return res.status(400).json({ error: 'Missing text' });

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return res.status(500).json({ error: 'ANTHROPIC_API_KEY not configured' });

  try {
    const client = new Anthropic({ apiKey });

    const resp = await client.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 4000,
      messages: [{
        role: 'user',
        content: `You are a senior M&A attorney performing a redline analysis. Compare this draft ${provisionType} provision against the precedent from ${dealName}.

PRECEDENT (${dealName}):
${precedentText}

DRAFT:
${draftText}

Identify key differences and assess risk. Return ONLY valid JSON (no markdown, no backticks):
{
  "riskLevel": "low" or "medium" or "high",
  "summary": "2-3 sentence overall assessment",
  "differences": [
    {
      "category": "aspect name (e.g. Scope of Carve-outs)",
      "risk": "low" or "medium" or "high",
      "precedent_language": "relevant excerpt from precedent",
      "draft_language": "relevant excerpt from draft",
      "analysis": "explanation of the difference and its implications",
      "recommendation": "specific suggestion for the drafting attorney"
    }
  ]
}`
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
