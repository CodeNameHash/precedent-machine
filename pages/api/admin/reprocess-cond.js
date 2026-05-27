import { getServiceSupabase } from '../../../lib/supabase';
import { cleanEdgarText, removeRepeatedHeaders } from '../../../lib/edgar-cleanup';

export const config = {
  maxDuration: 60,
  api: { bodyParser: { sizeLimit: '1mb' } },
};

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
    { pattern: /(?:company|target|seller)\s+(?:shall\s+have\s+)?(?:performed|complied)/i, category: 'Target Covenant Compliance' },
    { pattern: /(?:performance|compliance)\s+(?:of|by)\s+(?:the\s+)?(?:company|target|seller)/i, category: 'Target Covenant Compliance' },
    { pattern: /(?:covenants?\s+and\s+agreements?\s+(?:of\s+)?(?:the\s+)?(?:company|target|seller))/i, category: 'Target Covenant Compliance' },
    { pattern: /no\s+(?:company|target|seller)?\s*(?:material\s+adverse|MAE)/i, category: 'No Target MAE' },
    { pattern: /(?:material\s+adverse)\s+(?:effect|change)/i, category: 'No Target MAE' },
    { pattern: /(?:absence|no)\s+(?:of\s+)?(?:a\s+)?(?:company|target)?\s*(?:material\s+adverse)/i, category: 'No Target MAE' },
    { pattern: /officer[''’]?s?\s+certificate|(?:company|target|seller)\s+(?:shall\s+have\s+)?(?:delivered|furnished).*certificate/i, category: "Officer's Certificate (Target)" },
    { pattern: /dissenting\s+(?:shares?|stockholder)|appraisal\s+(?:shares?|rights?).*(?:threshold|exceed|not\s+more)/i, category: 'Dissenting Shares Threshold' },
  ],
  'COND-S': [
    { pattern: /(?:accuracy|true|correct)\s+(?:of|in\s+all)\s+(?:the\s+)?(?:representations|buyer\s+rep|parent\s+rep|acqui)/i, category: 'Accuracy of Buyer Reps' },
    { pattern: /representations\s+and\s+warranties\s+(?:of\s+)?(?:the\s+)?(?:buyer|parent|acqui(?:ror|rer))/i, category: 'Accuracy of Buyer Reps' },
    { pattern: /(?:buyer|parent|acqui(?:ror|rer))\s+(?:shall\s+have\s+)?(?:performed|complied)/i, category: 'Buyer Covenant Compliance' },
    { pattern: /(?:performance|compliance)\s+(?:of|by)\s+(?:the\s+)?(?:buyer|parent|acqui(?:ror|rer))/i, category: 'Buyer Covenant Compliance' },
    { pattern: /(?:covenants?\s+and\s+agreements?\s+(?:of\s+)?(?:the\s+)?(?:buyer|parent|acqui))/i, category: 'Buyer Covenant Compliance' },
    { pattern: /officer[''’]?s?\s+certificate|(?:buyer|parent|acqui)\s+(?:shall\s+have\s+)?(?:delivered|furnished).*certificate/i, category: "Officer's Certificate (Buyer)" },
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

function classifyCondType(sectionText) {
  const header = sectionText.substring(0, 300).toLowerCase();
  if (/(?:obligations?\s+of\s+)?(?:the\s+)?(?:each|both|all)\s+part/i.test(header)) return 'COND-M';
  if (/(?:obligations?\s+of\s+)?(?:the\s+)?(?:buyer|parent|acqui(?:ror|rer)|investor)/i.test(header)) return 'COND-B';
  if (/(?:obligations?\s+of\s+)?(?:the\s+)?(?:company|target|seller)/i.test(header)) return 'COND-S';
  if (/mutual/i.test(header)) return 'COND-M';
  return 'COND-M';
}

function splitCondSection(sectionText, condType) {
  const clausePattern = /(?:^|\n)\s*\(([a-z])\)\s/g;
  const matches = [];
  let m;
  while ((m = clausePattern.exec(sectionText)) !== null) {
    const offset = sectionText[m.index] === '\n' ? 1 : 0;
    matches.push({ index: m.index + offset, letter: m[1] });
  }
  const inlinePattern = /\.\s+\(([a-z])\)\s/g;
  while ((m = inlinePattern.exec(sectionText)) !== null) {
    const pos = m.index + m[0].indexOf('(');
    if (matches.some(x => Math.abs(x.index - pos) < 5)) continue;
    matches.push({ index: pos, letter: m[1] });
  }
  matches.sort((a, b) => a.index - b.index);

  if (matches.length < 2) {
    const cat = mapCondCategory(sectionText, condType) || extractSubClauseCategory(sectionText);
    return [{ type: condType, category: cat, text: sectionText.trim(), favorability: 'neutral' }];
  }

  const provisions = [];
  if (matches[0].index > 50) {
    const preamble = sectionText.substring(0, matches[0].index).trim();
    if (preamble.length > 30) {
      provisions.push({ type: condType, category: 'General / Preamble', text: preamble, favorability: 'neutral' });
    }
  }

  for (let i = 0; i < matches.length; i++) {
    const start = matches[i].index;
    const end = i + 1 < matches.length ? matches[i + 1].index : sectionText.length;
    const text = sectionText.substring(start, end).trim();
    if (text.length < 20) continue;
    const category = mapCondCategory(text, condType) || extractSubClauseCategory(text);
    provisions.push({ type: condType, category, text, favorability: 'neutral' });
  }

  return provisions;
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST only' });

  const { deal_id, dry_run } = req.body;
  const sb = getServiceSupabase();
  if (!sb) return res.status(500).json({ error: 'Supabase not configured' });

  const results = [];
  const dealIds = deal_id ? [deal_id] : [];

  if (!dealIds.length) {
    const { data: deals } = await sb.from('deals').select('id, acquirer, target');
    if (deals) dealIds.push(...deals.map(d => d.id));
  }

  for (const did of dealIds) {
    const { data: deal } = await sb.from('deals').select('acquirer, target').eq('id', did).single();
    const dealLabel = deal ? `${deal.acquirer}/${deal.target}` : did;

    const { data: provs } = await sb.from('provisions')
      .select('id, agreement_source_id')
      .eq('deal_id', did)
      .like('type', 'COND%');

    const sourceIds = [...new Set((provs || []).map(p => p.agreement_source_id).filter(Boolean))];

    let fullText = null;
    if (sourceIds.length > 0) {
      const { data: src } = await sb.from('agreement_sources')
        .select('full_text')
        .eq('id', sourceIds[0])
        .single();
      if (src) fullText = src.full_text;
    }

    if (!fullText) {
      const { data: allProvs } = await sb.from('provisions')
        .select('agreement_source_id')
        .eq('deal_id', did)
        .not('agreement_source_id', 'is', null)
        .limit(1);
      if (allProvs?.length) {
        const { data: src } = await sb.from('agreement_sources')
          .select('full_text')
          .eq('id', allProvs[0].agreement_source_id)
          .single();
        if (src) fullText = src.full_text;
      }
    }

    if (!fullText) {
      results.push({ deal: dealLabel, error: 'No agreement source text found', old_count: provs?.length || 0 });
      continue;
    }

    const cleaned = removeRepeatedHeaders(cleanEdgarText(fullText));

    // Find all COND-related article/sections
    const condSections = [];
    // Pattern: find "conditions" sections by heading
    const sectionPattern = /(?:SECTION|Section)\s+(\d+\.\d{1,2})\b([^\n]*)/g;
    let sm;
    while ((sm = sectionPattern.exec(cleaned)) !== null) {
      const heading = sm[0] + sm.input.substring(sm.index + sm[0].length).split('\n')[0];
      if (/conditions?\s+(?:to|of|precedent)|conditions?\s+(?:to\s+)?closing|conditions?\s+(?:to\s+)?(?:the\s+)?(?:obligations?|parties)/i.test(heading)) {
        // Find the end of this section (next SECTION heading or ARTICLE heading)
        const afterMatch = cleaned.substring(sm.index);
        const nextSection = afterMatch.match(/\n\s*(?:SECTION|Section)\s+\d+\.\d{1,2}\b/);
        const nextArticle = afterMatch.match(/\n\s*ARTICLE\s+(?:[IVXLC]+|\d+)\b/i);

        let endOffset = afterMatch.length;
        if (nextSection && nextSection.index > 10) endOffset = Math.min(endOffset, nextSection.index);
        if (nextArticle && nextArticle.index > 10) endOffset = Math.min(endOffset, nextArticle.index);

        const sectionText = afterMatch.substring(0, endOffset).trim();
        const condType = classifyCondType(sectionText);

        condSections.push({
          number: sm[1],
          heading: heading.trim(),
          text: sectionText,
          condType,
        });
      }
    }

    // Also try article-level detection for agreements without "SECTION" headings
    if (condSections.length === 0) {
      const artPattern = /\n\s*ARTICLE\s+(?:[IVXLC]+|\d+)\b[^\n]*conditions?[^\n]*/gi;
      let am;
      while ((am = artPattern.exec(cleaned)) !== null) {
        const afterArt = cleaned.substring(am.index);
        const nextArt = afterArt.substring(10).match(/\n\s*ARTICLE\s+(?:[IVXLC]+|\d+)\b/i);
        const endOffset = nextArt ? nextArt.index + 10 : afterArt.length;
        const articleText = afterArt.substring(0, endOffset).trim();

        // Split the article into sub-sections by "Section X.XX" or numbered headings
        const subSections = articleText.split(/(?=(?:SECTION|Section)\s+\d+\.\d{1,2}\b)/);
        for (const sub of subSections) {
          if (sub.length < 50) continue;
          if (/conditions?\s+(?:to|of|precedent)|obligations?\s+/i.test(sub.substring(0, 300))) {
            const condType = classifyCondType(sub);
            condSections.push({ heading: sub.substring(0, 100).trim(), text: sub.trim(), condType });
          }
        }
      }
    }

    // Split each COND section into sub-provisions
    const newProvisions = [];
    for (const sec of condSections) {
      const split = splitCondSection(sec.text, sec.condType);
      newProvisions.push(...split);
    }

    // Find misclassified provisions for dry_run reporting too
    const misclassifiedProvs = [];
    for (const sec of condSections) {
      const prefix = sec.text.substring(0, 80).replace(/[%_]/g, '');
      const { data: misclassified } = await sb.from('provisions')
        .select('id, type, category')
        .eq('deal_id', did)
        .not('type', 'like', 'COND%')
        .ilike('full_text', `${prefix}%`);
      if (misclassified) misclassifiedProvs.push(...misclassified);
    }

    if (dry_run) {
      results.push({
        deal: dealLabel,
        old_cond_count: provs?.length || 0,
        misclassified: misclassifiedProvs.map(p => ({ id: p.id, current_type: p.type, category: p.category })),
        new_count: newProvisions.length,
        sections_found: condSections.map(s => ({ number: s.number, type: s.condType, heading: s.heading.substring(0, 100) })),
        new_provisions: newProvisions.map(p => ({ type: p.type, category: p.category, text_preview: p.text.substring(0, 120) })),
      });
      continue;
    }

    // Delete old COND provisions (typed as COND%)
    const oldIds = (provs || []).map(p => p.id);

    // Also find misclassified provisions by matching text prefixes from found sections
    for (const sec of condSections) {
      const prefix = sec.text.substring(0, 80).replace(/[%_]/g, '');
      const { data: misclassified } = await sb.from('provisions')
        .select('id')
        .eq('deal_id', did)
        .not('type', 'like', 'COND%')
        .ilike('full_text', `${prefix}%`);
      if (misclassified) {
        for (const m of misclassified) {
          if (!oldIds.includes(m.id)) oldIds.push(m.id);
        }
      }
    }

    if (oldIds.length) {
      await sb.from('annotations').delete().in('provision_id', oldIds);
      await sb.from('provisions').delete().in('id', oldIds);
    }

    // Insert new COND provisions
    const inserted = [];
    for (const p of newProvisions) {
      const { data, error } = await sb.from('provisions')
        .insert({
          deal_id: did,
          type: p.type,
          category: p.category,
          full_text: p.text,
          ai_favorability: p.favorability || 'neutral',
          display_tier: 1,
          agreement_source_id: sourceIds[0] || null,
        })
        .select('id, type, category')
        .single();
      if (data) inserted.push(data);
      if (error) console.warn(`Insert failed for ${p.category}:`, error.message);
    }

    results.push({
      deal: dealLabel,
      old_count: provs?.length || 0,
      deleted: provs?.length || 0,
      sections_found: condSections.length,
      new_count: inserted.length,
      provisions: inserted.map(p => ({ id: p.id, type: p.type, category: p.category })),
    });
  }

  return res.status(200).json({ results });
}
