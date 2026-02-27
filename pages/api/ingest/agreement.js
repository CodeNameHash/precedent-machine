import Anthropic from '@anthropic-ai/sdk';
import { getServiceSupabase } from '../../../lib/supabase';
import crypto from 'crypto';

export const config = { maxDuration: 120 };

const PROVISION_TYPE_CONFIGS = {
  ANTI: {
    label: 'Antitrust / Regulatory Efforts',
    categories: [
      'Efforts Standard', 'Anti-Hell or High Water', 'Hell or High Water',
      'Burdensome Condition', 'Definition of Burdensome Condition',
      'Obligation to Litigate', 'Obligation Not to Litigate',
      'Regulatory Approval Filing Deadline', 'Cooperation Obligations'
    ],
    searchTerms: ['antitrust', 'regulatory', 'HSR', 'efforts', 'hell or high water', 'burdensome', 'divestiture', 'FTC', 'DOJ', 'competition'],
  },
  COND: {
    label: 'Conditions to Closing',
    categories: [
      'Regulatory Approval / HSR', 'No Legal Impediment',
      'Accuracy of Target Representations', 'Accuracy of Acquirer Representations',
      'Target Compliance with Covenants', 'Acquirer Compliance with Covenants',
      'No MAE', 'Third-Party Consents', 'Stockholder Approval'
    ],
    searchTerms: ['conditions', 'closing', 'condition precedent', 'effectiveness', 'shall have been satisfied'],
  },
  TERMR: {
    label: 'Termination Rights',
    categories: [
      'Mutual Termination', 'Outside Date', 'Outside Date Extension',
      'Regulatory Failure', 'Breach by Target', 'Breach by Acquirer',
      'Superior Proposal', 'Intervening Event', 'Failure of Conditions'
    ],
    searchTerms: ['termination', 'terminate', 'outside date', 'end date', 'superior proposal'],
  },
  TERMF: {
    label: 'Termination Fees',
    categories: [
      'Target Termination Fee', 'Reverse Termination Fee', 'Regulatory Break-Up Fee',
      'Fee Amount', 'Fee Triggers', 'Expense Reimbursement', 'Fee as Percentage of Deal Value'
    ],
    searchTerms: ['termination fee', 'break-up fee', 'reverse termination', 'expense reimbursement'],
  },
  MAE: {
    label: 'Material Adverse Effect',
    categories: [
      'Base Definition', 'General Economic / Market Conditions', 'Changes in Law / GAAP',
      'Industry Conditions', 'War / Terrorism', 'Acts of God / Pandemic',
      'Failure to Meet Projections', 'Announcement / Pendency Effects',
      'Actions at Parent Request', 'Disproportionate Impact Qualifier',
      'Changes in Stock Price', 'Customer / Supplier Relationships'
    ],
    searchTerms: ['material adverse effect', 'material adverse change', 'MAE', 'MAC'],
  },
  IOC: {
    label: 'Interim Operating Covenants',
    categories: [
      'Ordinary Course Standard', 'M&A / Acquisitions', 'Dividends / Distributions',
      'Equity Issuances', 'Indebtedness', 'Capital Expenditures', 'Employee Compensation',
      'Material Contracts', 'Accounting / Tax Changes', 'Charter / Organizational Amendments',
      'Stock Repurchases / Splits', 'Labor Agreements', 'Litigation Settlements',
      'Liquidation / Dissolution', 'Stockholder Rights Plans', 'Catch-All / General'
    ],
    searchTerms: ['conduct of business', 'interim', 'ordinary course', 'between the date', 'prior to the closing'],
  },
};

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST only' });

  const { deal_id, full_text, title, source_url, filing_date, provision_types } = req.body;
  if (!deal_id || !full_text) {
    return res.status(400).json({ error: 'deal_id and full_text are required' });
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return res.status(500).json({ error: 'ANTHROPIC_API_KEY not configured' });

  const sb = getServiceSupabase();
  if (!sb) return res.status(500).json({ error: 'Supabase not configured' });

  try {
    // 1. Store full agreement text
    const textHash = crypto.createHash('sha256').update(full_text).digest('hex');

    // Check for duplicate
    const { data: existing } = await sb.from('agreement_sources')
      .select('id').eq('text_hash', textHash).single();

    let agreementSourceId;
    if (existing) {
      agreementSourceId = existing.id;
    } else {
      const { data: srcData, error: srcError } = await sb.from('agreement_sources')
        .insert({
          title: title || 'Merger Agreement',
          full_text,
          text_hash: textHash,
          source_url: source_url || null,
          filing_date: filing_date || null,
          metadata: { ingested_at: new Date().toISOString(), char_count: full_text.length },
        })
        .select().single();
      if (srcError) return res.status(500).json({ error: 'Failed to store agreement: ' + srcError.message });
      agreementSourceId = srcData.id;
    }

    // 2. Extract provisions using AI
    const typesToExtract = provision_types || Object.keys(PROVISION_TYPE_CONFIGS);
    const client = new Anthropic({ apiKey });
    const results = [];

    for (const typeKey of typesToExtract) {
      const config = PROVISION_TYPE_CONFIGS[typeKey];
      if (!config) continue;

      // Truncate text intelligently - find relevant sections
      const textForAI = truncateToRelevantSections(full_text, config.searchTerms, 15000);

      const resp = await client.messages.create({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 8000,
        messages: [{
          role: 'user',
          content: `You are a senior M&A attorney extracting "${config.label}" provisions from a merger agreement.

AGREEMENT TEXT (may be truncated to relevant sections):
${textForAI}

Extract each sub-provision category. For each, copy the EXACT text from the agreement (verbatim, word-for-word).

Categories to look for:
${config.categories.map((c, i) => `${i + 1}. ${c}`).join('\n')}

For each category found in the agreement text, provide the exact verbatim text. If a category is not present, omit it.

Return ONLY valid JSON (no markdown, no backticks):
{
  "provisions": [
    {
      "category": "exact category name from list above",
      "text": "exact verbatim text from agreement",
      "favorability": "strong-buyer|mod-buyer|neutral|mod-seller|strong-seller"
    }
  ],
  "ai_suggested_categories": [
    {
      "category": "name of a sub-provision not in the predefined list",
      "text": "exact verbatim text",
      "favorability": "neutral",
      "reason": "why this should be a new category"
    }
  ]
}`
        }],
      });

      const raw = resp.content.map(c => c.text || '').join('');
      const clean = raw.replace(/```json|```/g, '').trim();
      let parsed;
      try {
        parsed = JSON.parse(clean);
      } catch {
        results.push({ type: typeKey, error: 'Failed to parse AI response', raw: clean.substring(0, 200) });
        continue;
      }

      // 3. Create provision records
      const provisions = parsed.provisions || [];
      const suggested = parsed.ai_suggested_categories || [];
      let created = 0;

      for (const prov of [...provisions, ...suggested]) {
        if (!prov.text || prov.text.length < 20) continue;

        const { data, error } = await sb.from('provisions')
          .insert({
            deal_id,
            type: typeKey,
            category: prov.category,
            full_text: prov.text.trim(),
            ai_favorability: prov.favorability || 'neutral',
            agreement_source_id: agreementSourceId,
            ai_metadata: prov.reason ? { ai_suggested: true, reason: prov.reason } : { ai_extracted: true },
          })
          .select().single();

        if (!error && data) {
          created++;
          // Fire-and-forget AI annotation
          fetch(`${req.headers.origin || 'http://localhost:3000'}/api/ai/annotate`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              provision_id: data.id,
              text: prov.text.trim(),
              type: typeKey,
              category: prov.category,
            }),
          }).catch(() => {});
        }
      }

      results.push({
        type: typeKey,
        label: config.label,
        extracted: provisions.length,
        suggested: suggested.length,
        created,
      });
    }

    return res.json({
      success: true,
      agreement_source_id: agreementSourceId,
      results,
    });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}

function truncateToRelevantSections(text, searchTerms, maxChars) {
  if (text.length <= maxChars) return text;

  // Find sections that contain search terms
  const lower = text.toLowerCase();
  const windows = [];

  searchTerms.forEach(term => {
    let idx = 0;
    while ((idx = lower.indexOf(term.toLowerCase(), idx)) !== -1) {
      const start = Math.max(0, idx - 2000);
      const end = Math.min(text.length, idx + 3000);
      windows.push({ start, end, term });
      idx += term.length;
    }
  });

  if (!windows.length) return text.substring(0, maxChars);

  // Merge overlapping windows
  windows.sort((a, b) => a.start - b.start);
  const merged = [windows[0]];
  for (let i = 1; i < windows.length; i++) {
    const last = merged[merged.length - 1];
    if (windows[i].start <= last.end) {
      last.end = Math.max(last.end, windows[i].end);
    } else {
      merged.push(windows[i]);
    }
  }

  // Concatenate windows with markers
  let result = '';
  merged.forEach((w, i) => {
    if (i > 0) result += '\n\n[...]\n\n';
    result += text.substring(w.start, w.end);
    if (result.length >= maxChars) return;
  });

  return result.substring(0, maxChars);
}
