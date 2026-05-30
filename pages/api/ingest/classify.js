/**
 * classify.js — Phase 1+2 only of the v2 parser pipeline.
 *
 * Runs cleanText + parseStructure + classifySections and persists the
 * classified sections to `deals.metadata.classified_sections`. Cheap enough
 * to comfortably finish inside a single Vercel function call. Subsequent
 * per-type extract calls (extract-type.js) consume the persisted sections.
 *
 * Input: POST { deal_id, url?, full_text? }
 *   - If `url`, fetch + clean + classify.
 *   - Else use `deals.metadata.full_text` (or the literal full_text field).
 */

import Anthropic from '@anthropic-ai/sdk';
import https from 'https';
import http from 'http';
import { getServiceSupabase } from '../../../lib/supabase';

const { parseStructure, cleanText, displayCleanText } = require('../../../lib/parser-v2/structural');
const { classifySections } = require('../../../lib/parser-v2/classify');

export const config = {
  maxDuration: 300,
  api: { bodyParser: { sizeLimit: '50mb' } },
};

const SEC_UA =
  process.env.SEC_USER_AGENT || 'Precedent Machine bengoodchild@gmail.com';

function fetchUrl(url) {
  return new Promise((resolve, reject) => {
    const client = url.startsWith('https') ? https : http;
    const req = client.get(
      url,
      {
        headers: {
          'User-Agent': SEC_UA,
          Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
          'Accept-Language': 'en-US,en;q=0.9',
          'Accept-Encoding': 'identity',
        },
      },
      (res) => {
        if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
          const next = new URL(res.headers.location, url).toString();
          return fetchUrl(next).then(resolve).catch(reject);
        }
        if (res.statusCode !== 200) {
          return reject(new Error(`HTTP ${res.statusCode} fetching ${url}`));
        }
        let data = '';
        res.on('data', (c) => (data += c));
        res.on('end', () => resolve(data));
      },
    );
    req.on('error', reject);
    req.setTimeout(45000, () => {
      req.destroy();
      reject(new Error('Fetch timeout'));
    });
  });
}

function stripHtml(html) {
  return html
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p>/gi, '\n\n')
    .replace(/<\/div>/gi, '\n')
    .replace(/<\/tr>/gi, '\n')
    .replace(/<\/td>/gi, '\t')
    // P7 item 15: preserve italic / em / font-style:italic spans by wrapping
    // their content in «…» markers BEFORE the generic <[^>]+> strip. EDGAR
    // exhibits print defined terms in italics (the term itself is in italics,
    // followed by "means..."); without this marker the formatting is lost
    // and findInlineDefinitions has to rely on a fragile Title-Case heuristic.
    // The marker is single-line and balanced — won't false-positive on prose.
    //
    // Order matters: do the italic-marker substitution first while the tags
    // are still present, then fall through to the generic tag strip.
    .replace(/<\s*(?:i|em)(?:\s[^>]*)?>([^<\n]{1,500}?)<\s*\/\s*(?:i|em)\s*>/gi, '«$1»')
    .replace(/<\s*(?:span|font)(?:\s[^>]*?(?:font-style\s*:\s*italic|class\s*=\s*"?italic)[^>]*)?>([^<\n]{1,500}?)<\s*\/\s*(?:span|font)\s*>/gi, '«$1»')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/&rsquo;/gi, "'")
    .replace(/&ldquo;/gi, '"')
    .replace(/&rdquo;/gi, '"')
    .replace(/&mdash;/gi, '—')
    .replace(/&ndash;/gi, '–')
    .replace(/&#\d+;/g, '')
    .replace(/\t+/g, ' ')
    .replace(/ +/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

/**
 * Shared internal implementation — used by both this endpoint and the
 * run-all orchestrator. Returns { classifiedSectionsForExtract, summary,
 * fullCleanedText } and persists the classify output to deal.metadata.
 */
async function runClassifyPhase({ dealId, url, fullTextOverride, sb, client }) {
  // 1. Resolve full text
  let fullText = fullTextOverride || null;
  let sourceUrl = url || null;
  let existingDeal = null;

  if (dealId) {
    const { data, error } = await sb.from('deals').select('*').eq('id', dealId).single();
    if (error) throw new Error(`Deal lookup failed: ${error.message}`);
    existingDeal = data;
    if (!fullText && !url) {
      fullText = data?.metadata?.full_text || null;
      if (!fullText) {
        const err = new Error('Deal has no stored full_text. Provide a url to re-fetch.');
        err.statusCode = 400;
        throw err;
      }
      sourceUrl = data?.metadata?.source_url || null;
    }
  }

  if (url) {
    const html = await fetchUrl(url);
    fullText = stripHtml(html);
    if (fullText.length < 5000) {
      const err = new Error(`Fetched text too short (${fullText.length} chars) — wrong URL?`);
      err.statusCode = 422;
      throw err;
    }
  }

  if (!fullText) {
    const err = new Error('No agreement text available');
    err.statusCode = 400;
    throw err;
  }

  // 2. Clean + parse structure
  const cleaned = cleanText(fullText);
  const { sections, articles, diagnostics } = parseStructure(cleaned);
  if (sections.length === 0) {
    const err = new Error('Parser found no sections in the agreement text');
    err.statusCode = 422;
    err.diagnostics = diagnostics;
    throw err;
  }

  // 3. Classify
  const classifiedSections = await classifySections(sections, articles, client);
  const sectionsForExtract = classifiedSections.map((s) => ({
    ...s,
    provision_type: s.provisionType,
  }));

  // 4. Build by-type breakdown
  const by_type = {};
  for (const s of sectionsForExtract) {
    const t = s.provision_type || 'OTHER';
    by_type[t] = (by_type[t] || 0) + 1;
  }

  // P7 item 19: per-type sub-clause estimates. Helps the classify-summary UI
  // surface how heavy each type bucket will be in extract. For DEF we run
  // findInlineDefinitions on each section's text for a definition count.
  const { findInlineDefinitions } = require('../../../lib/parser-v2/extract');
  const by_type_estimate = {}; // { type: { sections, sub_clauses, definitions? } }
  for (const s of sectionsForExtract) {
    const t = s.provision_type || 'OTHER';
    if (!by_type_estimate[t]) by_type_estimate[t] = { sections: 0, sub_clauses: 0 };
    by_type_estimate[t].sections += 1;
    const text = s.text || s.body || '';
    // Sub-clause estimate: count "(a)" .. "(z)" markers.
    const subMatches = text.match(/\n\s*\([a-z]\)\s+/g);
    if (subMatches) by_type_estimate[t].sub_clauses += subMatches.length;
    if (t === 'DEF') {
      try {
        const defs = findInlineDefinitions(text);
        if (!by_type_estimate[t].definitions) by_type_estimate[t].definitions = 0;
        by_type_estimate[t].definitions += defs.length;
      } catch {
        // best-effort estimate; ignore failures
      }
    }
  }

  // 5. Persist to deal.metadata (compact form — drop big intermediate fields)
  const compactSections = sectionsForExtract.map((s) => ({
    sectionId: `section-${s.startChar ?? s.start ?? 0}`,
    type: s.provision_type || null,
    code: s.provisionCode || null,
    text: s.text || s.body || '',
    startChar: typeof s.startChar === 'number' ? s.startChar : (s.start || 0),
    sectionNumber: s.number || s.sectionNumber || null,
    title: s.title || s.heading || null,
    articleType: s.articleType || null,
    confidence: s.confidence || null,
    classifiedBy: s.classifiedBy || null,
  }));

  if (dealId) {
    const displayText = displayCleanText(fullText);
    const existingMetadata = (existingDeal && existingDeal.metadata) || {};
    const nextMetadata = {
      ...existingMetadata,
      // Always store the latest cleaned full text so subsequent extracts use
      // the SAME text the classifier ran on.
      full_text: displayText,
      source_url: sourceUrl || existingMetadata.source_url || null,
      classified_sections: compactSections,
      classify_run_at: new Date().toISOString(),
      classify_breakdown: by_type,
      // P7 item 19: per-type sub-clause / definition estimates.
      classify_breakdown_estimate: by_type_estimate,
      classify_diagnostics: diagnostics,
      // Reset per-type extract status — new classify means existing extract
      // status is stale. UI will repopulate as extract-type runs.
      extract_status: {},
      pipeline: 'parser-v2-split',
    };

    const { error: updateErr } = await sb
      .from('deals')
      .update({ metadata: nextMetadata })
      .eq('id', dealId);
    if (updateErr) {
      throw new Error(`Failed to persist classified sections: ${updateErr.message}`);
    }
  }

  return {
    sectionsForExtract,
    by_type,
    by_type_estimate,
    diagnostics,
    section_count: sectionsForExtract.length,
    article_count: (articles && articles.length) || 0,
    fullCleanedText: cleaned,
  };
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'POST only' });
  }

  const { deal_id, url, full_text } = req.body || {};
  if (!deal_id) {
    return res.status(400).json({ error: 'deal_id is required' });
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return res.status(500).json({ error: 'ANTHROPIC_API_KEY not configured' });

  const sb = getServiceSupabase();
  if (!sb) return res.status(500).json({ error: 'Supabase not configured' });

  const client = new Anthropic({ apiKey });
  const t0 = Date.now();

  try {
    const result = await runClassifyPhase({
      dealId: deal_id,
      url,
      fullTextOverride: full_text,
      sb,
      client,
    });

    return res.status(200).json({
      success: true,
      deal_id,
      section_count: result.section_count,
      article_count: result.article_count,
      by_type: result.by_type,
      // P7 item 19: per-type sub-clause / definition estimates.
      by_type_estimate: result.by_type_estimate,
      diagnostics: result.diagnostics,
      timing_ms: Date.now() - t0,
    });
  } catch (err) {
    console.error('[ingest/classify] error:', err);
    const status = err.statusCode || 500;
    return res.status(status).json({
      success: false,
      error: err.message || 'Classify failed',
      diagnostics: err.diagnostics || undefined,
    });
  }
}

// Re-export for run-all orchestrator
export { runClassifyPhase };
