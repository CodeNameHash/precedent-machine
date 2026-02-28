import Anthropic from '@anthropic-ai/sdk';

export const config = {
  api: { bodyParser: { sizeLimit: '10mb' } },
};

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST only' });

  const { message, provisions, agreement_text, history, rules } = req.body;
  if (!message) return res.status(400).json({ error: 'message is required' });

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return res.status(500).json({ error: 'ANTHROPIC_API_KEY not configured' });

  try {
    const client = new Anthropic({ apiKey });

    // Build provisions summary for context
    const provSummary = (provisions || []).map((p, i) => (
      `[${p._id}] ${p.type} > ${p.category} | tier:${p.display_tier} | fav:${p.favorability}\n  ${p.text.substring(0, 300)}${p.text.length > 300 ? '...' : ''}`
    )).join('\n\n');

    // Build rules section
    let rulesSection = '';
    if (rules && rules.length > 0) {
      rulesSection = '\n\nLEARNED RULES (from prior review sessions):\n' +
        rules.map(r => `- ${r.rule} [scope: ${r.scope}]`).join('\n');
    }

    const systemPrompt = `You are a senior M&A attorney reviewing an automated extraction of merger agreement provisions. You have access to the current set of extracted provisions and the source agreement text.

Your job is to help the user improve the extraction — fix misclassifications, identify missed provisions, merge or split items, adjust verbatim text, and correct favorability assessments.

CURRENT PROVISIONS (${(provisions || []).length} total):
${provSummary}

SOURCE AGREEMENT TEXT (truncated):
${(agreement_text || '').substring(0, 30000)}
${rulesSection}

RESPONSE FORMAT:
You MUST respond with valid JSON only (no markdown, no backticks). Use this exact format:
{
  "message": "Your human-readable response explaining what you found and what actions you're taking",
  "actions": [
    { "action": "update", "id": "_id of provision", "field": "category|type|text|favorability|display_tier", "value": "new value" },
    { "action": "remove", "id": "_id of provision" },
    { "action": "add", "provision": { "type": "MAE", "category": "category name", "text": "verbatim text", "favorability": "neutral", "display_tier": 2 } }
  ],
  "rules": [
    { "rule": "description of a reusable rule for future imports", "scope": "classify|parse|extract" }
  ]
}

RULES:
- "actions" array can be empty if you're just answering a question
- "rules" array can be empty if no new rules are suggested
- When updating text, use the EXACT verbatim text from the agreement
- When adding provisions, extract the EXACT text from the source agreement
- Valid provision types: MAE, IOC, ANTI, COND, TERMR, TERMF, DEF, REP, COV, MISC, STRUCT
- Valid favorability values: strong-buyer, mod-buyer, neutral, mod-seller, strong-seller
- Valid display_tier values: 1, 2, 3
- Only suggest rules when the user explicitly asks or when you identify a systematic pattern
- The "id" field in actions must match the _id of existing provisions exactly`;

    // Build messages
    const messages = [];
    if (history && history.length > 0) {
      for (const h of history) {
        messages.push({ role: h.role, content: h.content });
      }
    }
    // Add current message
    if (messages.length === 0 || messages[messages.length - 1].content !== message) {
      messages.push({ role: 'user', content: message });
    }

    const resp = await client.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 4000,
      system: systemPrompt,
      messages,
    });

    const raw = resp.content.map(c => c.text || '').join('');
    const clean = raw.replace(/```json|```/g, '').trim();

    let parsed;
    try {
      parsed = JSON.parse(clean);
    } catch {
      // If AI didn't return valid JSON, wrap the text as a message-only response
      return res.json({
        message: raw,
        actions: [],
        rules: [],
      });
    }

    return res.json({
      message: parsed.message || '',
      actions: parsed.actions || [],
      rules: parsed.rules || [],
    });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
