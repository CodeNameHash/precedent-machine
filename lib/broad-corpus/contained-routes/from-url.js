/**
 * lib/broad-corpus/contained-routes/from-url.js
 *
 * The repaired implementation behind pages/api/ingest/from-url.js. NOT wired
 * in — that route still resolves to createBroadCorpusContainedHandler('POST')
 * (503) exactly as before. Un-containing it is separate work (ingestion
 * stays off — see ROADMAP.md "Do not... turn them on"); this file exists so
 * the fix is real code, reviewable and tested, not just a description, and
 * so wiring it in later is a one-line swap — the same shape
 * lib/query/contained-routes/ already uses for the query family.
 *
 * Restored from git history (pages/api/ingest/from-url.js as of commit
 * bc3b6267^, before commit bc3b6267 "fix(api): close service-client route
 * actions" replaced it with the containment stub), with one fix:
 *
 * SEC-repair (S2): the July security review's finding was "unauthenticated
 * SSRF — fetches attacker-supplied URL server-side, follows redirects with
 * no revalidation." The fetch itself (fetchUrl/isAllowedIngestUrl/stripHtml)
 * now lives in ./from-url-fetch.js — see that file's header for the actual
 * fix (host allowlist + redirect revalidation) and for why it was split out
 * (so it is unit-testable with plain `node --test`, independent of
 * lib/anthropic.js's Next-bundler-only import). Nothing else in the
 * pipeline (deal metadata extraction, parser-v2 handoff, storage) changed —
 * that is parser-v2 territory this task does not touch.
 *
 * Flow (unchanged from the original):
 *   1. Fetch the URL (server-side, no CORS) — now SSRF-guarded.
 *   2. Strip HTML -> plain text.
 *   3. If no deal_id provided, ask Claude for the deal metadata
 *      (acquirer, target, signing_date, value_usd, sector, merger_form,
 *      parent_entity, target_entity, acquirer_display, target_display)
 *      from the preamble, then create a `deals` row.
 *   4. Hand the text off to the v2 parser pipeline (segment-v2 internals).
 *   5. Respond with { deal_id }.
 *
 * If a deal_id IS provided and no url, use the stored full_text from
 * deals.metadata.full_text — i.e. plain re-ingest of an existing deal (no
 * network fetch at all, so the SSRF guard does not apply to that path).
 *
 * Written as CommonJS (module.exports), matching lib/broad-corpus/contained-routes/users.js.
 * This particular file still cannot be `require()`'d standalone under plain
 * `node --test` — it transitively pulls in lib/anthropic.js, which imports
 * `./model` with no file extension (a Next-bundler-only resolution that
 * predates this task) — but that only affects standalone unit loading, not
 * the live app, and it is why the SSRF fix itself lives in
 * ./from-url-fetch.js where it CAN be directly tested.
 */
const { getAnthropic, MODEL } = require('../../anthropic');
const { getServiceSupabase } = require('../../supabase');
const { isAllowedIngestUrl, fetchUrl, stripHtml } = require('./from-url-fetch');

const { parseStructure, cleanText, displayCleanText } = require('../../parser-v2/structural');
const { classifySections } = require('../../parser-v2/classify');
const { extractProvisions } = require('../../parser-v2/extract');
const { validateProvisions } = require('../../parser-v2/validate');
const { storeProvisions } = require('../../parser-v2/store');
const { extractAdvisors } = require('../../parser-v2/advisors');
const { buildPartiesFact, buildValueUsdFact, mergeDealFacts } = require('../../deal-facts');
const { extractDealMetadata: sharedExtractDealMetadata } = require('../../ingest/deal-metadata-prompt');
const { evaluateDealMetadataGates } = require('../../../scripts/ingest-qa');

const config = {
  maxDuration: 300,
  api: { bodyParser: { sizeLimit: '50mb' } },
};

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
// to 'no_stated_value' when this comes back empty. fetchUrl() here is the
// same SSRF-guarded fetch as the main flow, so a redirect out of sec.gov
// from within a filing index page is refused the same way.
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

async function handler(req, res) {
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

module.exports = { config, handler, default: handler, isAllowedIngestUrl, fetchUrl };
