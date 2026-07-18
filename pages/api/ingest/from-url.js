/**
 * from-url.js — one-step ingest from a SEC EDGAR (or other) URL.
 *
 * Flow:
 *   1. Fetch the URL (server-side, no CORS).
 *   2. Strip HTML → plain text.
 *   3. If no deal_id provided, ask Claude for the deal metadata
 *      (acquirer, target, signing_date, value_usd, sector, merger_form,
 *      parent_entity, target_entity, acquirer_display, target_display)
 *      from the preamble, then create a `deals` row.
 *   4. Hand the text off to the v2 parser pipeline (segment-v2 internals).
 *   5. Respond with { deal_id }.
 *
 * If a deal_id IS provided and no url, use the stored full_text from
 * deals.metadata.full_text — i.e. plain re-ingest of an existing deal.
 */

import { getAnthropic, MODEL } from '../../../lib/anthropic';
import { fromCp } from '../../../lib/html-entities';
import https from 'https';
import http from 'http';
import { getServiceSupabase } from '../../../lib/supabase';

const { parseStructure, cleanText, displayCleanText } = require('../../../lib/parser-v2/structural');
const { classifySections } = require('../../../lib/parser-v2/classify');
const { extractProvisions } = require('../../../lib/parser-v2/extract');
const { validateProvisions } = require('../../../lib/parser-v2/validate');
const { storeProvisions } = require('../../../lib/parser-v2/store');
const { extractAdvisors } = require('../../../lib/parser-v2/advisors');
const { buildPartiesFact, buildValueUsdFact, mergeDealFacts } = require('../../../lib/deal-facts');
const { extractDealMetadata: sharedExtractDealMetadata } = require('../../../lib/ingest/deal-metadata-prompt');
const { evaluateDealMetadataGates } = require('../../../scripts/ingest-qa');

export const config = {
  maxDuration: 300,
  api: { bodyParser: { sizeLimit: '50mb' } },
};

// SEC EDGAR requires a User-Agent in the format "Name email@domain.com" and
// blocks generic ones with 403. Env-overridable; defaults to the project owner.
const SEC_UA =
  process.env.SEC_USER_AGENT ||
  'Precedent Machine bengoodchild@gmail.com';

function fetchUrl(url) {
  return new Promise((resolve, reject) => {
    const client = url.startsWith('https') ? https : http;
    const req = client.get(
      url,
      {
        headers: {
          'User-Agent': SEC_UA,
          Accept:
            'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
          'Accept-Language': 'en-US,en;q=0.9',
          'Accept-Encoding': 'identity',
        },
      },
      (res) => {
        if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
          // Resolve relative redirects against the current URL.
          const next = new URL(res.headers.location, url).toString();
          return fetchUrl(next).then(resolve).catch(reject);
        }
        if (res.statusCode !== 200) {
          return reject(
            new Error(
              `HTTP ${res.statusCode} fetching ${url} — SEC EDGAR requires a User-Agent in the form "Name email@domain". Set the SEC_USER_AGENT env var if you need to override the default.`
            )
          );
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
    // Invisible directional/zero-width marks appear as NAMED entities in some
    // EDGAR exhibits (Summit Materials salts 99 "&lrm;" through its headings
    // and cross-references) — drop the invisible, space the space-like.
    .replace(/&(?:lrm|rlm|zwnj|zwj|ZeroWidthSpace|NegativeThinSpace);/g, '')
    .replace(/&(?:ensp|emsp|thinsp|hairsp|numsp|puncsp);/g, ' ')
    .replace(/&sect;/gi, '§')
    .replace(/&#x([0-9a-fA-F]+);/g, (_, h) => fromCp(parseInt(h, 16)))
    .replace(/&#(\d+);/g, (_, n) => fromCp(parseInt(n, 10)))
    // The numeric decode can EMIT invisible marks (&#8206; -> U+200E).
    .replace(/[\u200B-\u200F\u2060\uFEFF]/g, '')
    .replace(/\t+/g, ' ')
    .replace(/ +/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

function metadataWithDealFacts(base, meta, sourceUrl) {
  return mergeDealFacts(base || {}, {
    value_usd: buildValueUsdFact(meta && meta.value_usd, {
      source_url: sourceUrl || null,
      source_label: 'Agreement preamble',
      method: 'ingest_metadata',
    }),
    parties: buildPartiesFact(meta || {}, {
      source_url: sourceUrl || null,
      source_label: 'Agreement preamble',
      method: 'ingest_metadata',
    }),
  });
}

// Best-effort sibling-exhibit fetch for the value-derivation ladder's tier
// (b): look in the same EDGAR filing index as the agreement exhibit for an
// EX-99.1-style press-release exhibit, extract the stated transaction value
// with a quote. Returns null (never throws) — deriveValue() falls through
// to 'no_stated_value' when this comes back empty.
async function fetchPressReleaseForDeal(client, sourceUrl) {
  if (!sourceUrl) return null;
  try {
    const idxUrl = sourceUrl.replace(/\/[^/]*$/, '/');
    const idxHtml = await fetchUrl(idxUrl);
    const hrefs = [...idxHtml.matchAll(/href="([^"]+)"/gi)].map((m) => m[1]);
    const exhibitHref = hrefs.find((h) => /ex-?99/i.test(h));
    if (!exhibitHref) return null;
    const exhibitUrl = new URL(exhibitHref, idxUrl).toString();
    const html = await fetchUrl(exhibitUrl);
    const text = stripHtml(html).slice(0, 6000);
    if (text.length < 200) return null;
    const prompt = `Extract the stated aggregate transaction value (in USD) from this press release, if any is stated. Return ONLY JSON: {"value_usd": number or null, "quote": "string or null — the exact sentence stating the value"}.\n\nPress release text:\n"""\n${text}\n"""\n\nReturn ONLY the JSON object, no prose, no markdown fence.`;
    const resp = await client.messages.create({ model: MODEL, max_tokens: 300, messages: [{ role: 'user', content: prompt }] });
    const raw = resp.content?.[0]?.text || '{}';
    const jsonMatch = raw.match(/\{[\s\S]*\}/);
    if (!jsonMatch) return null;
    const parsed = JSON.parse(jsonMatch[0]);
    if (typeof parsed.value_usd === 'number' && parsed.value_usd > 0) {
      return { value_usd: parsed.value_usd, source_url: exhibitUrl, quote: parsed.quote || null };
    }
    return null;
  } catch {
    return null;
  }
}

async function extractDealMetadata(client, text, opts = {}) {
  return sharedExtractDealMetadata(client, text, {
    model: MODEL,
    sourceUrl: opts.sourceUrl || null,
    fetchPressRelease: opts.skipPressReleaseFetch ? undefined : () => fetchPressReleaseForDeal(client, opts.sourceUrl),
  });
}

async function runParserPipeline(client, fullText, dealId, title, sb, dealMeta = {}) {
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

  const provisions = await extractProvisions(sectionsForExtract, client, cleaned, dealMeta);
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

  const client = getAnthropic();

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
    let refreshedMetadata = null;

    if (!targetDealId) {
      createdMetadata = await extractDealMetadata(client, fullText, { sourceUrl });

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
        metadata: metadataWithDealFacts({
          source_url: sourceUrl,
          full_text: fullText,
          merger_form: createdMetadata.merger_form,
          ingested_at: new Date().toISOString(),
          parent_entity: createdMetadata.parent_entity,
          target_entity: createdMetadata.target_entity,
          acquirer_display: createdMetadata.acquirer_display,
          target_display: createdMetadata.target_display,
          ...(createdMetadata.ultimateParent ? { ultimateParent: createdMetadata.ultimateParent } : {}),
          buyer_is_shell: createdMetadata.buyer_is_shell,
          buyer_profile: createdMetadata.buyer_profile,
          value_provenance: createdMetadata.value_provenance,
        }, createdMetadata, sourceUrl),
      };

      const { data: newDeal, error: insErr } = await sb
        .from('deals')
        .insert(insertRow)
        .select()
        .single();
      if (insErr) throw new Error(`Deal insert failed: ${insErr.message}`);
      targetDealId = newDeal.id;
    } else {
      try {
        refreshedMetadata = await extractDealMetadata(client, fullText, { sourceUrl: sourceUrl || existingDeal?.metadata?.source_url || null });
      } catch (metadataErr) {
        console.warn('[from-url] existing-deal metadata refresh failed:', metadataErr.message);
      }
      // Update metadata for existing deal: refresh full_text + source_url.
      const basis = refreshedMetadata || {};
      const mergedMeta = metadataWithDealFacts({
        ...(existingDeal?.metadata || {}),
        full_text: fullText,
        source_url: sourceUrl || existingDeal?.metadata?.source_url || null,
        ...(basis.merger_form ? { merger_form: basis.merger_form } : {}),
        ...(basis.parent_entity ? { parent_entity: basis.parent_entity } : {}),
        ...(basis.target_entity ? { target_entity: basis.target_entity } : {}),
        ...(basis.acquirer_display ? { acquirer_display: basis.acquirer_display } : {}),
        ...(basis.target_display ? { target_display: basis.target_display } : {}),
        ...(basis.ultimateParent ? { ultimateParent: basis.ultimateParent } : {}),
        ...(basis.buyer_is_shell !== undefined ? { buyer_is_shell: basis.buyer_is_shell } : {}),
        ...(basis.buyer_profile ? { buyer_profile: basis.buyer_profile } : {}),
        ...(basis.value_provenance ? { value_provenance: basis.value_provenance } : {}),
        ingested_at: new Date().toISOString(),
      }, refreshedMetadata, sourceUrl || existingDeal?.metadata?.source_url || null);
      const updateRow = {
        metadata: mergedMeta,
        ...(refreshedMetadata && refreshedMetadata.value_usd ? { value_usd: refreshedMetadata.value_usd } : {}),
      };
      const { error: updErr } = await sb
        .from('deals')
        .update(updateRow)
        .eq('id', targetDealId);
      if (updErr) console.warn('[from-url] deal metadata update failed:', updErr.message);
    }

    // ── 3. Run the parser pipeline ──
    const title = existingDeal
      ? `${existingDeal.acquirer} / ${existingDeal.target}`
      : `${createdMetadata.acquirer} / ${createdMetadata.target}`;

    const signingDate = existingDeal ? existingDeal.announce_date : createdMetadata.signing_date;
    const parseResult = await runParserPipeline(client, fullText, targetDealId, title, sb, { signingDate });

    // Deal-metadata QA gates (buyer_display/value/consideration_type/
    // buyer_profile/signing_date — advisors_found informational only), so
    // the admin UI can flag a clean ingest that would ship a blank index
    // cell immediately rather than waiting on a separate ingest-qa run.
    let qaGates = null;
    try {
      const { data: gateDeal, error: gateErr } = await sb
        .from('deals')
        .select('id, acquirer, target, value_usd, announce_date, metadata')
        .eq('id', targetDealId)
        .single();
      if (!gateErr && gateDeal) {
        const evalResult = evaluateDealMetadataGates(gateDeal);
        qaGates = { ok: evalResult.ok, checks: evalResult.checks };
      }
    } catch (gateEvalErr) {
      console.warn('[from-url] deal-metadata QA gate evaluation failed:', gateEvalErr.message);
    }

    return res.status(200).json({
      success: true,
      deal_id: targetDealId,
      created: !deal_id,
      metadata: createdMetadata,
      provisions_inserted: parseResult.insertedCount,
      provisions_deleted: parseResult.deletedCount,
      advisors_found: parseResult.advisors.length,
      qa_gates: qaGates,
    });
  } catch (err) {
    console.error('[from-url] error:', err);
    return res.status(500).json({ error: err.message || 'Ingest failed' });
  }
}
