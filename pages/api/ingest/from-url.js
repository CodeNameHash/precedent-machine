/**
 * from-url.js — one-step ingest from a SEC EDGAR (or other) URL.
 *
 * Flow:
 *   1. Fetch the URL (server-side, no CORS).
 *   2. Strip HTML → plain text.
 *   3. If no deal_id provided, ask Claude for the deal metadata
 *      (acquirer, target, signing_date, value_usd, sector, merger_form)
 *      from the preamble, then create a `deals` row.
 *   4. Hand the text off to the v2 parser pipeline (segment-v2 internals).
 *   5. Respond with { deal_id }.
 *
 * If a deal_id IS provided and no url, use the stored full_text from
 * deals.metadata.full_text — i.e. plain re-ingest of an existing deal.
 */

import Anthropic from '@anthropic-ai/sdk';
import https from 'https';
import http from 'http';
import { getServiceSupabase } from '../../../lib/supabase';
import { MERGER_FORMS } from '../../../lib/taxonomy';

const { parseStructure, cleanText, displayCleanText } = require('../../../lib/parser-v2/structural');
const { classifySections } = require('../../../lib/parser-v2/classify');
const { extractProvisions } = require('../../../lib/parser-v2/extract');
const { validateProvisions } = require('../../../lib/parser-v2/validate');
const { storeProvisions } = require('../../../lib/parser-v2/store');
const { extractAdvisors } = require('../../../lib/parser-v2/advisors');

export const config = {
  maxDuration: 300,
  api: { bodyParser: { sizeLimit: '50mb' } },
};

function fetchUrl(url) {
  return new Promise((resolve, reject) => {
    const client = url.startsWith('https') ? https : http;
    const req = client.get(
      url,
      { headers: { 'User-Agent': 'PrecedentMachine/1.0 (legal research)' } },
      (res) => {
        if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
          return fetchUrl(res.headers.location).then(resolve).catch(reject);
        }
        if (res.statusCode !== 200) {
          return reject(new Error(`HTTP ${res.statusCode} fetching ${url}`));
        }
        let data = '';
        res.on('data', (c) => (data += c));
        res.on('end', () => resolve(data));
      }
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

async function extractDealMetadata(client, text) {
  // Use the first ~10k chars — that's where preamble + recitals + Article 1 live.
  const preamble = text.substring(0, 10000);

  const mergerFormCodes = Object.keys(MERGER_FORMS);

  const prompt = `You are extracting structured metadata from the preamble of a merger or acquisition agreement.

Return ONLY a JSON object with these fields. Use null for any field you cannot determine confidently.

{
  "acquirer": "string — the buyer / parent entity legal name (e.g. 'Pfizer Inc.')",
  "target": "string — the target / company legal name (e.g. 'Metsera, Inc.')",
  "signing_date": "YYYY-MM-DD — the agreement signing/execution date from the preamble",
  "value_usd": number or null — total transaction equity value in USD if stated; otherwise null,
  "sector": "string — single short label like 'Biopharma', 'Technology', 'Financial Services'",
  "merger_form": "one of: ${mergerFormCodes.join(', ')} — pick the best match"
}

Agreement text (preamble):
"""
${preamble}
"""

Return ONLY the JSON object, no prose, no markdown fence.`;

  const resp = await client.messages.create({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 600,
    messages: [{ role: 'user', content: prompt }],
  });

  const raw = resp.content?.[0]?.text || '{}';
  // Tolerate the model wrapping the JSON in a code fence.
  const jsonMatch = raw.match(/\{[\s\S]*\}/);
  if (!jsonMatch) {
    throw new Error('Metadata extraction did not return JSON');
  }
  const parsed = JSON.parse(jsonMatch[0]);

  return {
    acquirer: parsed.acquirer || null,
    target: parsed.target || null,
    signing_date: parsed.signing_date || null,
    value_usd: typeof parsed.value_usd === 'number' ? parsed.value_usd : null,
    sector: parsed.sector || null,
    merger_form: parsed.merger_form || null,
  };
}

async function runParserPipeline(client, fullText, dealId, title, sb) {
  const cleaned = cleanText(fullText);
  const { sections, articles, diagnostics } = parseStructure(cleaned);
  if (sections.length === 0) {
    throw new Error('Parser found no sections in the agreement text');
  }

  const classifiedSections = await classifySections(sections, articles, client);
  const sectionsForExtract = classifiedSections.map((s) => ({
    ...s,
    provision_type: s.provisionType,
  }));

  const provisions = await extractProvisions(sectionsForExtract, client);
  const validation = validateProvisions(provisions, cleaned, sectionsForExtract);
  const finalProvisions = validation.provisions;

  const displayText = displayCleanText(fullText);
  let advisors = [];
  try {
    advisors = extractAdvisors(displayText) || [];
  } catch (advErr) {
    console.warn('[from-url] advisor extraction failed:', advErr.message);
  }

  const storeResult = await storeProvisions(dealId, finalProvisions, displayText, title, sb, {
    advisors,
  });

  return {
    insertedCount: storeResult?.insertedCount || 0,
    deletedCount: storeResult?.deletedCount || 0,
    diagnostics,
    advisors,
  };
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST only' });

  const { url, deal_id } = req.body || {};

  if (!url && !deal_id) {
    return res.status(400).json({ error: 'Provide a url, a deal_id, or both' });
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return res.status(500).json({ error: 'ANTHROPIC_API_KEY not configured' });

  const sb = getServiceSupabase();
  if (!sb) return res.status(500).json({ error: 'Supabase not configured' });

  const client = new Anthropic({ apiKey });

  try {
    // ── 1. Get the agreement text ──
    let fullText = null;
    let sourceUrl = url || null;
    let existingDeal = null;

    if (deal_id) {
      const { data, error } = await sb.from('deals').select('*').eq('id', deal_id).single();
      if (error) throw new Error(`Deal lookup failed: ${error.message}`);
      existingDeal = data;
      if (!url) {
        // Re-ingest using stored text.
        fullText = data?.metadata?.full_text || null;
        if (!fullText) {
          return res
            .status(400)
            .json({ error: 'Deal has no stored full_text. Provide a url to re-fetch.' });
        }
        sourceUrl = data?.metadata?.source_url || null;
      }
    }

    if (url) {
      const html = await fetchUrl(url);
      fullText = stripHtml(html);
      if (fullText.length < 5000) {
        return res
          .status(422)
          .json({ error: `Fetched text too short (${fullText.length} chars) — wrong URL?` });
      }
    }

    // ── 2. Resolve the deal record (create or reuse) ──
    let targetDealId = deal_id || null;
    let createdMetadata = null;

    if (!targetDealId) {
      createdMetadata = await extractDealMetadata(client, fullText);

      if (!createdMetadata.acquirer || !createdMetadata.target) {
        return res.status(422).json({
          error: 'Could not identify acquirer/target from the preamble',
          extracted: createdMetadata,
        });
      }

      const insertRow = {
        acquirer: createdMetadata.acquirer,
        target: createdMetadata.target,
        value_usd: createdMetadata.value_usd,
        announce_date: createdMetadata.signing_date,
        sector: createdMetadata.sector,
        metadata: {
          source_url: sourceUrl,
          full_text: fullText,
          merger_form: createdMetadata.merger_form,
          ingested_at: new Date().toISOString(),
        },
      };

      const { data: newDeal, error: insErr } = await sb
        .from('deals')
        .insert(insertRow)
        .select()
        .single();
      if (insErr) throw new Error(`Deal insert failed: ${insErr.message}`);
      targetDealId = newDeal.id;
    } else {
      // Update metadata for existing deal: refresh full_text + source_url.
      const mergedMeta = {
        ...(existingDeal?.metadata || {}),
        full_text: fullText,
        source_url: sourceUrl || existingDeal?.metadata?.source_url || null,
        ingested_at: new Date().toISOString(),
      };
      const { error: updErr } = await sb
        .from('deals')
        .update({ metadata: mergedMeta })
        .eq('id', targetDealId);
      if (updErr) console.warn('[from-url] deal metadata update failed:', updErr.message);
    }

    // ── 3. Run the parser pipeline ──
    const title = existingDeal
      ? `${existingDeal.acquirer} / ${existingDeal.target}`
      : `${createdMetadata.acquirer} / ${createdMetadata.target}`;

    const parseResult = await runParserPipeline(client, fullText, targetDealId, title, sb);

    return res.status(200).json({
      success: true,
      deal_id: targetDealId,
      created: !deal_id,
      metadata: createdMetadata,
      provisions_inserted: parseResult.insertedCount,
      provisions_deleted: parseResult.deletedCount,
      advisors_found: parseResult.advisors.length,
    });
  } catch (err) {
    console.error('[from-url] error:', err);
    return res.status(500).json({ error: err.message || 'Ingest failed' });
  }
}
