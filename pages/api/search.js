import Anthropic from '@anthropic-ai/sdk';

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST only' });

  const { query, deals, provisions } = req.body;
  if (!query) return res.status(400).json({ error: 'Missing query' });

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    // Fallback: simple keyword search without AI
    const terms = query.toLowerCase().split(/\s+/).filter(t => t.length > 2);
    return res.json({ intent: 'provision', results: [], terms, suggested_filters: [] });
  }

  try {
    const client = new Anthropic({ apiKey });

    const dealList = (deals || []).map(d => `${d.id}: ${d.acquirer}/${d.target} (${d.sector}, ${d.value})`).join('\n');

    const resp = await client.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 1000,
      messages: [{
        role: 'user',
        content: `You are a search assistant for an M&A precedent database. Parse this search query and determine the user's intent.

AVAILABLE DEALS:
${dealList}

QUERY: "${query}"

Return ONLY valid JSON (no markdown, no backticks):
{
  "intent": "deal" or "provision" or "comparison",
  "results": ["DEAL:d1", "DEAL:d2"] (deal IDs prefixed with DEAL: if intent is deal),
  "terms": ["keyword1", "keyword2"] (search highlight terms),
  "suggested_filters": ["MAE", "Technology", etc] (up to 3 relevant filter chips)
}`
      }],
    });

    const raw = resp.content.map(c => c.text || '').join('');
    const clean = raw.replace(/```json|```/g, '').trim();
    const result = JSON.parse(clean);
    return res.json(result);
  } catch (err) {
    const terms = query.toLowerCase().split(/\s+/).filter(t => t.length > 2);
    return res.json({ intent: 'provision', results: [], terms, suggested_filters: [] });
  }
}
