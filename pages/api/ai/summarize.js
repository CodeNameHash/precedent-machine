import Anthropic from '@anthropic-ai/sdk';

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST only' });

  const { provisions } = req.body;
  if (!provisions || !Array.isArray(provisions) || provisions.length < 2) {
    return res.status(400).json({ error: 'Need at least 2 provisions to compare' });
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return res.status(500).json({ error: 'ANTHROPIC_API_KEY not configured' });

  try {
    const client = new Anthropic({ apiKey });

    const provTexts = provisions.map((p, i) =>
      `PROVISION ${i + 1} (${p.deal_label || 'Deal ' + (i + 1)}, ${p.type || '?'}, ${p.category || 'uncategorized'}):\n${p.full_text || p.text || '[No text]'}`
    ).join('\n\n---\n\n');

    const resp = await client.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 3000,
      messages: [{
        role: 'user',
        content: `You are a senior M&A attorney comparing merger agreement provisions across deals. Analyze these provisions and highlight key differences.

${provTexts}

Return ONLY valid JSON (no markdown, no backticks):
{
  "executive_summary": "3-4 sentence overview of how these provisions compare",
  "key_differences": [
    {
      "aspect": "name of the specific difference",
      "description": "detailed explanation of how the provisions differ on this point",
      "most_favorable_to_buyer": "which deal number (1, 2, etc.)",
      "most_favorable_to_seller": "which deal number"
    }
  ],
  "common_elements": ["elements shared across all provisions"],
  "notable_outliers": ["any provision that is unusual compared to the others"],
  "market_assessment": "Which provision is closest to current market standard and why",
  "practitioner_note": "Single most important takeaway for a deal attorney"
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
