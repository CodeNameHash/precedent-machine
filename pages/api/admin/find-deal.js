import Anthropic from '@anthropic-ai/sdk';
import { getServiceSupabase } from '../../../lib/supabase';

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST only' });

  const { description } = req.body;
  if (!description) return res.status(400).json({ error: 'description required' });

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return res.status(500).json({ error: 'ANTHROPIC_API_KEY not configured' });

  try {
    const client = new Anthropic({ apiKey });
    const resp = await client.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 1000,
      messages: [{
        role: 'user',
        content: `Identify the M&A deal from this description and return structured data.

Description: "${description}"

Return ONLY valid JSON (no markdown):
{
  "acquirer": "full legal name of acquiring company",
  "target": "full legal name of target company",
  "value_usd": number or null (deal value in USD),
  "announce_date": "YYYY-MM-DD" or null,
  "sector": "industry sector",
  "jurisdiction": "state/country",
  "confidence": "high|medium|low"
}`
      }],
    });

    const raw = resp.content.map(c => c.text || '').join('');
    const clean = raw.replace(/```json|```/g, '').trim();
    let deal;
    try {
      deal = JSON.parse(clean);
    } catch {
      return res.status(500).json({ error: 'Failed to parse AI response' });
    }

    // Check if deal already exists in database
    const sb = getServiceSupabase();
    let duplicate = null;
    if (sb) {
      const { data: existing } = await sb.from('deals')
        .select('id, acquirer, target')
        .or(`acquirer.ilike.%${deal.acquirer}%,target.ilike.%${deal.target}%`)
        .limit(3);

      if (existing && existing.length > 0) {
        const match = existing.find(e =>
          e.acquirer.toLowerCase().includes(deal.acquirer.toLowerCase().split(' ')[0]) &&
          e.target.toLowerCase().includes(deal.target.toLowerCase().split(' ')[0])
        );
        if (match) {
          deal.id = match.id;
          duplicate = { message: `Deal already exists: ${match.acquirer} / ${match.target}`, id: match.id };
        }
      }
    }

    return res.json({ deal, duplicate });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
