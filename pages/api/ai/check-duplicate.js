import Anthropic from '@anthropic-ai/sdk';

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST only' });

  const { newCategory, existingCategories, provisionType } = req.body;
  if (!newCategory || !existingCategories) return res.status(400).json({ error: 'Missing required fields' });

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return res.status(500).json({ error: 'ANTHROPIC_API_KEY not configured' });

  try {
    const client = new Anthropic({ apiKey });

    const resp = await client.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 500,
      messages: [{
        role: 'user',
        content: `You are an M&A legal expert reviewing sub-provision categories for "${provisionType || 'merger agreement'}" provisions.

A user wants to add a new category: "${newCategory}"

Existing categories:
${existingCategories.map((c, i) => `${i + 1}. ${c}`).join('\n')}

Determine if the new category is a duplicate, synonym, subset, or significant overlap of any existing category.

Return ONLY valid JSON (no markdown, no backticks):
{
  "is_duplicate": true/false,
  "confidence": "low" | "medium" | "high",
  "similar_to": "name of most similar existing category or null",
  "explanation": "brief explanation of why this is or isn't a duplicate"
}`
      }],
    });

    const raw = resp.content.map(c => c.text || '').join('');
    const clean = raw.replace(/```json|```/g, '').trim();
    const result = JSON.parse(clean);
    return res.json(result);
  } catch (err) {
    return res.status(500).json({
      is_duplicate: false,
      confidence: 'low',
      similar_to: null,
      explanation: 'AI check failed: ' + err.message
    });
  }
}
