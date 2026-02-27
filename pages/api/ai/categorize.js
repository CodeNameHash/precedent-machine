import Anthropic from '@anthropic-ai/sdk';

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST only' });

  const { text, type, current_category } = req.body;
  if (!text) return res.status(400).json({ error: 'text required' });

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return res.status(500).json({ error: 'ANTHROPIC_API_KEY not configured' });

  try {
    const client = new Anthropic({ apiKey });

    const resp = await client.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 1500,
      messages: [{
        role: 'user',
        content: `You are a senior M&A attorney analyzing merger agreement provisions. Analyze this provision and categorize it.

CONTEXT:
- This is a ${type || 'unknown'} provision from a merger agreement
- MAE (Material Adverse Effect) provisions define what constitutes a material adverse effect that could allow a buyer to walk away from a deal
- IOC (Interim Operating Covenant) provisions restrict the target company's actions between signing and closing
- Current category (if any): ${current_category || 'uncategorized'}

PROVISION TEXT:
${text}

Analyze and return ONLY valid JSON (no markdown, no backticks):
{
  "type": "MAE" or "IOC",
  "category": "specific subcategory (e.g. for MAE: 'General MAE Definition', 'Industry Exception', 'Pandemic Exception', 'Regulatory Exception', 'Market Conditions', 'Disproportionate Effect'; for IOC: 'Ordinary Course', 'Capital Expenditure', 'Employee Compensation', 'Material Contracts', 'Debt/Financing', 'Dividends', 'Equity Issuance', 'Asset Sales', 'IP/Technology', 'Litigation', 'Tax', 'Insurance', 'Accounting Changes')",
  "favorability": "buyer", "seller", or "neutral",
  "favorability_score": 1-10 (1=extremely seller-friendly, 10=extremely buyer-friendly),
  "reasoning": "2-3 sentences explaining the categorization and favorability assessment",
  "key_terms": ["notable legal terms or phrases in this provision"],
  "market_position": "How this compares to market standard (above/at/below market for buyer protection)"
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
