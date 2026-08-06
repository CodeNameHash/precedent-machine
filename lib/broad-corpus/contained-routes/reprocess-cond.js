// lib/broad-corpus/contained-routes/reprocess-cond.js
//
// The repaired implementation behind pages/api/admin/reprocess-cond.js. NOT
// wired in — that route still resolves to
// createBroadCorpusContainedHandler('POST') (503) exactly as before.
// Un-containing it is separate work (see ROADMAP.md "Do not... turn them
// on"); this file exists so the fix is real code, reviewable and tested,
// not just a description, and so wiring it in later is a one-line swap.
//
// Restored from git history (pages/api/admin/reprocess-cond.js as of commit
// bc3b6267^, before commit bc3b6267 "fix(api): close service-client route
// actions" replaced it with the containment stub).
//
// SEC-repair (S2): the July security review's finding here was narrower
// than the other three critical routes — "unauthenticated destructive
// delete and reinsert" — i.e. the destructiveness is the route's actual,
// intended job (re-derive COND provisions for a deal: delete the old rows,
// insert the re-classified ones), and the defect was that anyone could
// trigger it with no identity check at all. That is what the global session
// gate (middleware.js) fixes once this is wired back in; there was no
// separate logic bug named for this route the way there was for the other
// three (users.js's is_admin self-grant, from-url.js's SSRF, saved-queries.js's
// admin self-grant), so the classification/split logic below is preserved
// byte-for-byte. The one change: the original re-used
// sendBroadCorpusRouteContained() (the "temporarily unavailable" 503) as a
// stand-in for a missing `deal_id` — a validation error wearing the
// containment message, evidently because the helper was already imported
// for the containment wrapper this file is being un-wrapped from. That
// would be a confusing response once this route is live and authenticated,
// so a missing deal_id now gets a normal 400 instead.
//
// Written as CommonJS (module.exports), matching
// lib/broad-corpus/contained-routes/users.js and ./from-url.js.
const { getServiceSupabase } = require('../../supabase');

const COND_CATEGORY_PATTERNS = {
  'COND-M': [
    { pattern: /no\s+(?:legal\s+)?(?:impediment|injunction|order|restraint|prohibition)/i, category: 'No Legal Impediment' },
    { pattern: /(?:regulatory|antitrust|HSR|hart[\s-]*scott|competition)\s+(?:approval|clearance|filing|waiting)/i, category: 'Regulatory Approvals' },
    { pattern: /(?:waiting\s+period).*(?:HSR|hart[\s-]*scott)/i, category: 'Regulatory Approvals' },
    { pattern: /(?:stockholder|shareholder|requisite\s+(?:company|vote))\s+(?:approval|vote|consent|adoption)/i, category: 'Stockholder Approval' },
    { pattern: /(?:adoption|approval)\s+(?:of|by)\s+(?:the\s+)?(?:stockholder|shareholder)/i, category: 'Stockholder Approval' },
    { pattern: /(?:S-4|registration\s+statement|form\s+S)\s+(?:effective|declared)/i, category: 'Form S-4 Effectiveness' },
    { pattern: /(?:stock\s+exchange|NYSE|NASDAQ|listing)\s+(?:listing|approval|accepted|authorized)/i, category: 'Stock Exchange Listing' },
    { pattern: /(?:shares|stock)\s+(?:shall\s+have\s+been\s+)?(?:authorized|approved)\s+for\s+listing/i, category: 'Stock Exchange Listing' },
  ],
  'COND-B': [
    { pattern: /(?:accuracy|true|correct)\s+(?:of|in\s+all)\s+(?:the\s+)?(?:representations|company\s+rep|target\s+rep)/i, category: 'Accuracy of Target Reps' },
    { pattern: /representations\s+and\s+warranties\s+(?:of\s+)?(?:the\s+)?(?:company|target|seller)/i, category: 'Accuracy of Target Reps' },
    { pattern: /(?:company|target|seller)\s+(?:(?:shall|will)\s+have\s+)?(?:performed|complied)/i, category: 'Target Covenant Compliance' },
    { pattern: /(?:performance|compliance)\s+(?:of|by)\s+(?:the\s+)?(?:company|target|seller)/i, category: 'Target Covenant Compliance' },
    { pattern: /(?:performance\s+of\s+obligations?\s+of\s+(?:the\s+)?(?:company|target|seller))/i, category: 'Target Covenant Compliance' },
    { pattern: /(?:covenants?\s+and\s+agreements?\s+(?:of\s+)?(?:the\s+)?(?:company|target|seller))/i, category: 'Target Covenant Compliance' },
    { pattern: /no\s+(?:company|target|seller)?\s*(?:material\s+adverse|MAE)/i, category: 'No Target MAE' },
    { pattern: /(?:material\s+adverse)\s+(?:effect|change)/i, category: 'No Target MAE' },
    { pattern: /(?:closing\s+)?certificate.*(?:company|target|seller)\s+(?:(?:shall|will)\s+have\s+)?(?:delivered|furnished)/i, category: "Officer's Certificate (Target)" },
    { pattern: /(?:company|target|seller)\s+(?:(?:shall|will)\s+have\s+)?furnished.*certificate/i, category: "Officer's Certificate (Target)" },
    { pattern: /officer[''']?s?\s+certificate/i, category: "Officer's Certificate (Target)" },
    { pattern: /dissenting\s+(?:shares?|stockholder)|appraisal\s+(?:shares?|rights?).*(?:threshold|exceed|not\s+more)/i, category: 'Dissenting Shares Threshold' },
  ],
  'COND-S': [
    { pattern: /(?:accuracy|true|correct)\s+(?:of|in\s+all)\s+(?:the\s+)?(?:representations|buyer\s+rep|parent\s+rep|acqui)/i, category: 'Accuracy of Buyer Reps' },
    { pattern: /representations\s+and\s+warranties\s+(?:of\s+)?(?:the\s+)?(?:buyer|parent|acqui(?:ror|rer))/i, category: 'Accuracy of Buyer Reps' },
    { pattern: /(?:buyer|parent|acqui(?:ror|rer)|merger\s+sub)\s+(?:(?:shall|will)\s+have\s+)?(?:performed|complied)/i, category: 'Buyer Covenant Compliance' },
    { pattern: /(?:performance|compliance)\s+(?:of|by)\s+(?:the\s+)?(?:buyer|parent|acqui(?:ror|rer)|merger\s+sub)/i, category: 'Buyer Covenant Compliance' },
    { pattern: /(?:performance\s+of\s+obligations?\s+of\s+(?:the\s+)?(?:buyer|parent|acqui|merger\s+sub))/i, category: 'Buyer Covenant Compliance' },
    { pattern: /(?:covenants?\s+and\s+agreements?\s+(?:of\s+)?(?:the\s+)?(?:buyer|parent|acqui))/i, category: 'Buyer Covenant Compliance' },
    { pattern: /(?:closing\s+)?certificate.*(?:buyer|parent|acqui|merger\s+sub)\s+(?:(?:shall|will)\s+have\s+)?(?:delivered|furnished)/i, category: "Officer's Certificate (Buyer)" },
    { pattern: /(?:buyer|parent|acqui|merger\s+sub)\s+(?:(?:shall|will)\s+have\s+)?furnished.*certificate/i, category: "Officer's Certificate (Buyer)" },
    { pattern: /officer[''']?s?\s+certificate/i, category: "Officer's Certificate (Buyer)" },
    { pattern: /(?:availability|sufficiency)\s+(?:of\s+)?(?:funds|financing)/i, category: 'Availability of Funds' },
    { pattern: /(?:funds?|financing)\s+(?:shall\s+be\s+)?(?:available|sufficient)/i, category: 'Availability of Funds' },
  ],
};

function mapCondCategory(text, condType) {
  const patterns = COND_CATEGORY_PATTERNS[condType];
  if (!patterns) return null;
  for (const { pattern, category } of patterns) {
    if (pattern.test(text)) return category;
  }
  if (condType !== 'COND-M') {
    for (const { pattern, category } of COND_CATEGORY_PATTERNS['COND-M']) {
      if (pattern.test(text)) return category;
    }
  }
  return null;
}

function extractSubClauseCategory(text) {
  const stripped = text.replace(/^\s*\([a-z]\)\s*/, '').trim();
  const firstLine = stripped.split('\n')[0].trim();
  const titleMatch = firstLine.match(/^([A-Z][^.]{3,60})\./);
  if (titleMatch) return titleMatch[1].trim();
  const sentenceMatch = firstLine.match(/^(.{10,80}?)[.;]/);
  if (sentenceMatch) return sentenceMatch[1].trim();
  const excerpt = firstLine.substring(0, 60);
  const lastSpace = excerpt.lastIndexOf(' ');
  return lastSpace > 15 ? excerpt.substring(0, lastSpace) : excerpt;
}

function classifyCondType(text) {
  // Only look at the heading line, not body text which may mention other parties
  const firstLine = text.split('\n')[0].substring(0, 200).toLowerCase();
  // Also check up to the first sub-clause marker
  const toParen = text.substring(0, text.indexOf('(a)') > 0 ? text.indexOf('(a)') : 200).toLowerCase();
  const header = firstLine + ' ' + toParen;
  if (/(?:obligations?\s+of\s+)?(?:the\s+)?(?:each|both|all)\s+part/i.test(header)) return 'COND-M';
  if (/(?:obligations?\s+of\s+)?(?:the\s+)?(?:company|target|seller)/i.test(header)) return 'COND-S';
  if (/(?:obligations?\s+of\s+)?(?:the\s+)?(?:buyer|parent|acqui(?:ror|rer)|investor|merger\s+sub)/i.test(header)) return 'COND-B';
  if (/mutual/i.test(header)) return 'COND-M';
  return 'COND-M';
}

function splitCondProvision(text, condType) {
  // Skip roman numeral markers (i, ii, iii, iv, v, vi, vii, viii, ix, x, xi, xii)
  const romanNumerals = new Set(['i','ii','iii','iv','v','vi','vii','viii','ix','x','xi','xii']);
  const clausePattern = /(?:^|\n)\s*\(([a-z]+)\)\s/g;
  const matches = [];
  let m;
  while ((m = clausePattern.exec(text)) !== null) {
    if (romanNumerals.has(m[1])) continue;
    const offset = text[m.index] === '\n' ? 1 : 0;
    matches.push({ index: m.index + offset, letter: m[1] });
  }
  const inlinePattern = /\.\s+\(([a-z]+)\)\s/g;
  while ((m = inlinePattern.exec(text)) !== null) {
    if (romanNumerals.has(m[1])) continue;
    const pos = m.index + m[0].indexOf('(');
    if (matches.some(x => Math.abs(x.index - pos) < 5)) continue;
    matches.push({ index: pos, letter: m[1] });
  }
  matches.sort((a, b) => a.index - b.index);

  if (matches.length < 2) {
    const cat = mapCondCategory(text, condType) || extractSubClauseCategory(text);
    return [{ type: condType, category: cat, text: text.trim() }];
  }

  const provisions = [];
  if (matches[0].index > 50) {
    const preamble = text.substring(0, matches[0].index).trim();
    if (preamble.length > 30) {
      provisions.push({ type: condType, category: 'General / Preamble', text: preamble });
    }
  }

  for (let i = 0; i < matches.length; i++) {
    const start = matches[i].index;
    const end = i + 1 < matches.length ? matches[i + 1].index : text.length;
    const clauseText = text.substring(start, end).trim();
    if (clauseText.length < 20) continue;
    const category = mapCondCategory(clauseText, condType) || extractSubClauseCategory(clauseText);
    provisions.push({ type: condType, category, text: clauseText });
  }

  return provisions;
}

function createReprocessCondHandler({ getSupabase = getServiceSupabase } = {}) {
  return async function handler(req, res) {
    if (req.method !== 'POST') return res.status(405).json({ error: 'POST only' });

    const { deal_id, dry_run } = req.body || {};
    if (!deal_id) return res.status(400).json({ error: 'deal_id is required' });

    const sb = getSupabase();
    if (!sb) return res.status(500).json({ error: 'Supabase not configured' });

    const results = [];
    const dealIds = [deal_id];

    for (const did of dealIds) {
      const { data: deal } = await sb.from('deals').select('acquirer, target').eq('id', did).single();
      const dealLabel = deal ? `${deal.acquirer}/${deal.target}` : did;

      // Find existing COND provisions
      const { data: condProvs } = await sb.from('provisions')
        .select('id, type, category, full_text')
        .eq('deal_id', did)
        .like('type', 'COND%');

      // Find misclassified provisions — search ALL provisions for condition-related text
      const { data: allProvs } = await sb.from('provisions')
        .select('id, type, category, full_text')
        .eq('deal_id', did);

      const misclassified = (allProvs || []).filter(p => {
        if (p.type.startsWith('COND')) return false;
        const header = (p.full_text || '').substring(0, 300).toLowerCase();
        return /(?:conditions?\s+to\s+(?:the\s+)?(?:obligations?|closing|each|parties)|(?:additional\s+)?conditions?\s+(?:to\s+)?(?:the\s+)?obligations?)/i.test(header);
      });

      // Combine: both correctly typed COND provisions AND misclassified ones
      const oldProvisions = [...(condProvs || []), ...misclassified];

      if (oldProvisions.length === 0) {
        results.push({ deal: dealLabel, message: 'No COND or condition-related provisions found', old_count: 0, new_count: 0 });
        continue;
      }

      // Re-process each provision: fix type, split sub-clauses, assign canonical categories
      const newProvisions = [];
      for (const prov of oldProvisions) {
        const correctType = classifyCondType(prov.full_text);
        const split = splitCondProvision(prov.full_text, correctType);
        newProvisions.push(...split);
      }

      if (dry_run) {
        results.push({
          deal: dealLabel,
          old_provisions: oldProvisions.map(p => ({
            id: p.id,
            type: p.type,
            category: p.category,
            text_preview: (p.full_text || '').substring(0, 100),
          })),
          misclassified: misclassified.map(p => ({
            id: p.id,
            current_type: p.type,
            category: p.category,
            correct_type: classifyCondType(p.full_text),
          })),
          new_provisions: newProvisions.map(p => ({
            type: p.type,
            category: p.category,
            text_preview: p.text.substring(0, 120),
          })),
          old_count: oldProvisions.length,
          new_count: newProvisions.length,
        });
        continue;
      }

      // Delete old provisions and their annotations
      const oldIds = oldProvisions.map(p => p.id);
      await sb.from('annotations').delete().in('provision_id', oldIds);
      await sb.from('provisions').delete().in('id', oldIds);

      // Insert new provisions
      const inserted = [];
      const errors = [];
      for (const p of newProvisions) {
        const { data, error } = await sb.from('provisions')
          .insert({
            deal_id: did,
            type: p.type,
            category: p.category,
            full_text: p.text,
            ai_favorability: 'neutral',
            display_tier: 1,
          })
          .select('id, type, category')
          .single();
        if (data) inserted.push(data);
        if (error) errors.push({ category: p.category, error: error.message, code: error.code, details: error.details });
      }

      results.push({
        deal: dealLabel,
        old_count: oldProvisions.length,
        deleted: oldIds.length,
        new_count: inserted.length,
        provisions: inserted.map(p => ({ id: p.id, type: p.type, category: p.category })),
        ...(errors.length > 0 ? { errors } : {}),
      });
    }

    return res.status(200).json({ results });
  };
}

module.exports = {
  createReprocessCondHandler,
  default: createReprocessCondHandler(),
  classifyCondType,
  splitCondProvision,
  mapCondCategory,
};
