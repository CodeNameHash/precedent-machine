import { cachedSystem, getAnthropic, MODEL } from '../../../lib/anthropic';
import { getServiceSupabase } from '../../../lib/supabase';

const { loadContext } = require('../../../lib/query/context-cache');
const {
  buildFieldCatalog,
  buildInterpreterPrompt,
  buildIntentTool,
  compileIntent,
  interpretDeterministically,
  normaliseQuestion,
  requiresRowChoice,
} = require('../../../lib/query/natural-language');

export const config = { maxDuration: 60 };

function clarification(message) {
  return { status: 'needs_clarification', clarification: message, suggestions: [] };
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST only' });

  let question;
  try {
    question = normaliseQuestion(req.body && req.body.question);
  } catch (error) {
    return res.status(400).json(clarification(error.message));
  }

  const catalog = buildFieldCatalog();
  if (question.split(/\s+/).length <= 4
    && !/\b(compare|versus|vs|market|deals?)\b/i.test(question)
    && requiresRowChoice(question, catalog)) {
    return res.status(200).json(interpretDeterministically(question, { catalog, deals: [] }));
  }

  let deals = [];
  let provisions = [];
  const sb = getServiceSupabase();
  if (sb) {
    try {
      ({ deals, provisions } = await loadContext(sb));
    } catch {
      deals = [];
      provisions = [];
    }
  }

  const fallback = interpretDeterministically(question, { catalog, deals, provisions });
  if (fallback.status === 'needs_clarification' && requiresRowChoice(question, catalog)) {
    return res.status(200).json(fallback);
  }
  const client = getAnthropic();
  if (!client) return res.status(200).json(fallback);

  try {
    const tool = buildIntentTool(catalog, deals);
    const response = await client.messages.create({
      model: MODEL,
      max_tokens: 1200,
      temperature: 0,
      system: cachedSystem(buildInterpreterPrompt(catalog, deals)),
      messages: [{ role: 'user', content: JSON.stringify({ question }) }],
      tools: [tool],
      tool_choice: { type: 'tool', name: tool.name, disable_parallel_tool_use: true },
    });
    const block = response.content.find((item) => item.type === 'tool_use' && item.name === tool.name);
    if (!block) throw new Error('Interpreter did not submit an intent');
    const interpreted = compileIntent(block.input, { catalog, deals, provisions });
    if (interpreted.status === 'ready' || fallback.status !== 'ready') {
      return res.status(200).json(interpreted);
    }
    return res.status(200).json(fallback);
  } catch {
    return res.status(200).json(fallback);
  }
}
