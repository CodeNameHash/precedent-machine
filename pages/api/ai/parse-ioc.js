import Anthropic from '@anthropic-ai/sdk';

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST only' });

  const { exceptions, provisionCategory } = req.body;
  if (!exceptions || !exceptions.length) return res.status(400).json({ error: 'exceptions required' });

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return res.status(500).json({ error: 'ANTHROPIC_API_KEY not configured' });

  const canonicalLabels = [
    "Budget Threshold", "Existing Facilities", "Ordinary Course", "Intercompany",
    "Required by Law", "Existing Plans/Awards", "Letters of Credit / Bonds",
    "Tax Withholding", "Subsidiary Dividends", "ESPP / Employee Programs", "De Minimis"
  ];

  try {
    const client = new Anthropic({ apiKey });

    const resp = await client.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 1500,
      messages: [{
        role: 'user',
        content: `You are a senior M&A attorney. Classify each IOC exception into a canonical label.

PROVISION CATEGORY: ${provisionCategory || 'unknown'}

CANONICAL LABELS (pick the best match, or use a short custom label if none fit):
${canonicalLabels.join(', ')}

EXCEPTIONS:
${exceptions.map(function(e) { return e.label + ': ' + e.text; }).join('\n\n')}

Return ONLY valid JSON (no markdown, no backticks):
{
  "labeled_exceptions": [
    {"label": "Exception 1", "text": "...", "canonicalLabel": "Ordinary Course"},
    ...
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
