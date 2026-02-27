import Anthropic from '@anthropic-ai/sdk';

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST only' });

  const { question, context, history } = req.body;
  if (!question) return res.status(400).json({ error: 'Missing question' });

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return res.status(500).json({ error: 'ANTHROPIC_API_KEY not configured' });

  try {
    const client = new Anthropic({ apiKey });

    const messages = [];

    // Add conversation history
    if (history && history.length > 0) {
      history.forEach(h => {
        messages.push({ role: h.role, content: h.content });
      });
    } else {
      messages.push({ role: 'user', content: question });
    }

    // Ensure last message is the current question
    if (messages.length === 0 || messages[messages.length - 1].content !== question) {
      messages.push({ role: 'user', content: question });
    }

    const resp = await client.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 2000,
      system: `You are a senior M&A attorney assistant with deep expertise in merger agreement provisions. You have access to the following precedent database of coded provisions from major deals. Answer questions precisely and cite specific deals when relevant. Use **bold** for emphasis.

PRECEDENT DATABASE:
${context || 'No provisions loaded.'}`,
      messages,
    });

    const answer = resp.content.map(c => c.text || '').join('');
    return res.json({ answer });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
