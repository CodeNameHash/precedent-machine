import Anthropic from '@anthropic-ai/sdk';

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST only' });

  const { carveouts } = req.body;
  if (!carveouts || !carveouts.length) return res.status(400).json({ error: 'carveouts required' });

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return res.status(500).json({ error: 'ANTHROPIC_API_KEY not configured' });

  const canonicalLabels = [
    "General Economic Conditions", "Industry-Wide Changes", "Changes in Law / Regulation",
    "Changes in GAAP / Accounting Standards", "Changes in Financial / Credit Markets",
    "War / Terrorism / Natural Disasters / Pandemics", "Failure to Meet Projections",
    "Changes in Stock Price / Credit Rating", "Announcement / Pendency of Transaction",
    "Compliance with Agreement Terms", "Actions Required / Permitted by Agreement",
    "Actions Consented to by Buyer", "Seasonal Fluctuations",
    "Changes in Political Conditions", "Cyber Attacks / Data Breaches",
    "Labor Actions / Strikes", "Customer / Supplier Changes",
  ];

  try {
    const client = new Anthropic({ apiKey });

    const resp = await client.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 2000,
      messages: [{
        role: 'user',
        content: `You are a senior M&A attorney. Classify each MAE carve-out into a canonical label for cross-deal comparison.

CANONICAL LABELS (pick the best match, or use a short custom label if none fit):
${canonicalLabels.join(', ')}

CARVE-OUTS:
${carveouts.map(function(c) { return c.label + ': ' + c.text; }).join('\n\n')}

Return ONLY valid JSON (no markdown, no backticks):
{
  "labeled_carveouts": [
    {"label": "(1)", "text": "...", "canonicalLabel": "General Economic Conditions"},
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
