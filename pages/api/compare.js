import Anthropic from '@anthropic-ai/sdk';

export const config = { maxDuration: 60 };

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST only' });

  const { provisionType, prongs, deals } = req.body;
  if (!prongs || !deals) return res.status(400).json({ error: 'Missing prongs or deals' });

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return res.status(500).json({ error: 'ANTHROPIC_API_KEY not configured' });

  try {
    const client = new Anthropic({ apiKey });

    const dealLabels = deals.map(d => `${d.acquirer}/${d.target}`);
    const prongText = prongs.map(p => {
      const entries = p.entries.map((e, i) => {
        const txt = (e.text || '').substring(0, 500);
        return `  ${dealLabels[i] || e.dealId}: ${txt}`;
      }).join('\n');
      return `[${p.category}]\n${entries}`;
    }).join('\n\n');

    const resp = await client.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 4000,
      messages: [{
        role: 'user',
        content: `You are a senior M&A attorney. Compare these ${provisionType} provisions across ${deals.length} deals. For each sub-provision category, provide a brief comparison.

DEALS: ${dealLabels.join(', ')}

PROVISIONS BY CATEGORY:
${prongText}

Return ONLY valid JSON (no markdown, no backticks):
{
  "comparisons": [
    {
      "category": "category name",
      "summary": "1-2 sentence comparison",
      "most_buyer_friendly": "deal name or null",
      "most_seller_friendly": "deal name or null",
      "market_position": "brief market standard note"
    }
  ],
  "overall_summary": "3-4 sentence overview of all differences",
  "key_takeaway": "Single most important insight for a deal attorney"
}`
      }],
    });

    const raw = resp.content.map(c => c.text || '').join('');
    const clean = raw.replace(/```json|```/g, '').trim();
    const result = JSON.parse(clean);
    return res.json(result);
  } catch (err) {
    return res.status(500).json({
      overall_summary: 'Error: ' + err.message,
      comparisons: [],
      key_takeaway: ''
    });
  }
}
