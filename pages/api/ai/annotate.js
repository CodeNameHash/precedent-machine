import Anthropic from '@anthropic-ai/sdk';
import { getServiceSupabase } from '../../../lib/supabase';

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST only' });

  const { provision_id, text, type, category } = req.body;
  if (!text) return res.status(400).json({ error: 'text required' });

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return res.status(500).json({ error: 'ANTHROPIC_API_KEY not configured' });

  try {
    const client = new Anthropic({ apiKey });

    // Learning loop: fetch recent verified admin annotations as calibration examples
    let calibrationExamples = '';
    const sb = getServiceSupabase();
    if (sb) {
      const { data: verified } = await sb.from('annotations')
        .select('phrase, favorability, note')
        .eq('is_ai_generated', false)
        .not('verified_by', 'is', null)
        .order('created_at', { ascending: false })
        .limit(20);
      if (verified && verified.length > 0) {
        calibrationExamples = '\n\nCALIBRATION — These are verified admin annotations. Use them to calibrate your favorability assessments:\n' +
          verified.map(v => `"${v.phrase}" => ${v.favorability} (${v.note || 'no note'})`).join('\n');
      }
    }

    const resp = await client.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 4000,
      messages: [{
        role: 'user',
        content: `You are a senior M&A attorney annotating provision text for a legal precedent database. Identify specific phrases within the text that indicate favorability toward buyer or seller.

PROVISION TYPE: ${type || 'merger agreement'}
CATEGORY: ${category || 'general'}

TEXT (${text.length} characters):
${text}

For each notable phrase, provide:
1. The exact phrase as it appears in the text (must be an exact substring)
2. The character offset where the phrase starts (start_offset) and ends (end_offset) in the text above
3. Favorability on a 5-level scale: "strong-buyer", "mod-buyer", "neutral", "mod-seller", "strong-seller"
4. A brief note explaining why this phrase matters

Focus on these phrase types:
- Materiality qualifiers ("material", "in all material respects", "would reasonably be expected to")
- Carve-outs and exceptions ("provided, however", "other than", "except")
- Consent requirements ("without the prior written consent of")
- Knowledge qualifiers ("to the knowledge of")
- Thresholds (dollar amounts, percentages, time periods)
- Bring-down standards
- Disproportionate impact qualifiers
- Ordinary course standards ("consistent with past practice")
- Temporal qualifiers ("since the date of this Agreement")
- Scope limiters ("taken as a whole", "individually or in the aggregate")
${calibrationExamples}

Return ONLY valid JSON (no markdown, no backticks):
{
  "annotations": [
    {
      "phrase": "exact phrase from text",
      "start_offset": 0,
      "end_offset": 10,
      "favorability": "neutral",
      "note": "brief explanation"
    }
  ]
}

Return 5-15 annotations, prioritized by legal significance.`
      }],
    });

    const raw = resp.content.map(c => c.text || '').join('');
    const clean = raw.replace(/```json|```/g, '').trim();
    const result = JSON.parse(clean);

    // Validate offsets — fix or discard broken annotations
    const validated = (result.annotations || []).filter(a => {
      if (!a.phrase || !a.favorability) return false;
      // Validate offsets match phrase
      if (typeof a.start_offset === 'number' && typeof a.end_offset === 'number' &&
          a.start_offset >= 0 && a.end_offset <= text.length &&
          text.substring(a.start_offset, a.end_offset) === a.phrase) {
        return true;
      }
      // Fallback: find phrase in text and fix offsets
      const idx = text.indexOf(a.phrase);
      if (idx >= 0) {
        a.start_offset = idx;
        a.end_offset = idx + a.phrase.length;
        return true;
      }
      // Phrase not found in text — discard
      return false;
    });

    return res.json({ annotations: validated, provision_id });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
