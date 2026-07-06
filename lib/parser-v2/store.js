/**
 * store.js — Phase 5 of the v2 parser pipeline.
 *
 * Atomic storage of extracted provisions into Supabase:
 *   1. Store raw agreement text in deals.metadata.full_text
 *   2. Delete existing provisions + annotations for the deal (clean slate)
 *   3. Batch-insert new provisions
 *
 * CommonJS — consumed by Next.js API routes.
 */

// Canonicalize favorability to neutral / buyer-favorable / seller-favorable so
// new extractions never reintroduce the ~10 spelling variants the model emits.
const { canonicalFavorability } = require('../search');
const { validateFeatures, validationSummary } = require('../schema/validation');
const { normalizeForMatch, sanitizeFeatureQuotes } = require('../verification');
const normFav = (v) => canonicalFavorability(v) || 'neutral';

function provisionText(prov) {
  if (!prov || typeof prov !== 'object') return '';
  if (typeof prov.full_text === 'string') return prov.full_text;
  if (typeof prov.text === 'string') return prov.text;
  return '';
}

function stripPipelineMarkers(text) {
  return String(text || '')
    .replace(/\[\[\/?[A-Za-z0-9_ -]+\]\]/g, '')
    .replace(/\[\[\/?[A-Za-z0-9_ -]+\]?$/g, '')
    .replace(/\[\[\/?[A-Za-z0-9_ -]*$/g, '')
    .trim();
}

function scrubMarkerValue(value) {
  if (typeof value === 'string') return stripPipelineMarkers(value);
  if (Array.isArray(value)) return value.map(scrubMarkerValue);
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.entries(value).map(([key, val]) => [key, scrubMarkerValue(val)]));
  }
  return value;
}

function cleanProvisionText(prov) {
  return stripPipelineMarkers(provisionText(prov));
}

function normalizeProvisionText(text) {
  return String(text || '')
    .replace(/\[\[\/?[A-Za-z0-9_ -]+\]\]/g, '')
    .replace(/\[\[\/?[A-Za-z0-9_ -]+\]?$/g, '')
    .replace(/\[\[\/?[A-Za-z0-9_ -]*$/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
}

function quoteVerificationSummary(scrub) {
  if (!scrub || (scrub.removed <= 0 && scrub.repaired <= 0)) return null;
  return {
    removed: scrub.removed,
    repaired: scrub.repaired || 0,
    details: scrub.details.slice(0, 10),
  };
}

function scrubProvisionFeatureQuotes(prov, sourceText, normalizedSource) {
  const features = prov && prov.features && typeof prov.features === 'object' ? prov.features : {};
  return quoteVerificationSummary(sanitizeFeatureQuotes(features, sourceText, {
    provisionText: provisionText(prov),
    normalizedSource,
  }));
}

function dedupeProvisions(provisions) {
  if (!Array.isArray(provisions)) return [];

  const seenTypeAndText = new Set();
  const firstPass = [];

  for (const prov of provisions) {
    const normalizedText = normalizeProvisionText(provisionText(prov));
    if (!normalizedText) {
      firstPass.push(prov);
      continue;
    }

    const key = `${prov && prov.type ? prov.type : ''}||${normalizedText}`;
    if (seenTypeAndText.has(key)) continue;
    seenTypeAndText.add(key);
    firstPass.push(prov);
  }

  const seenText = new Set();
  const deduped = [];

  for (const prov of firstPass) {
    const normalizedText = normalizeProvisionText(provisionText(prov));
    if (!normalizedText) {
      deduped.push(prov);
      continue;
    }

    if (seenText.has(normalizedText)) continue;
    seenText.add(normalizedText);
    deduped.push(prov);
  }

  return deduped;
}

// Differentiate provisions that share (type, category) but have DIFFERENT
// text: two genuinely distinct sections stored under one label read as
// duplicates in the UI ("Capitalization; Subsidiaries" twice — SECTION 3.02
// Capital Structure vs SECTION 3.03 Company Subsidiaries). When a group has
// 2+ members, suffix each member's category with its OWN section heading
// (parsed from the leading "SECTION 3.02. Capital Structure." of its text),
// falling back to the section number, so every row is distinguishable.
// Groups of one are untouched; true duplicates were already removed above.
function differentiateCategories(provisions) {
  const groups = new Map();
  for (const p of provisions || []) {
    if (!p || !p.category) continue;
    const key = `${p.type}||${p.category}`;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(p);
  }
  let renamed = 0;
  for (const members of groups.values()) {
    if (members.length < 2) continue;
    for (const p of members) {
      const text = String(p.full_text || p.text || '');
      const m = text.match(/^\s*SECTION\s+(\d+\.\d+)\.?\s+([A-Z][^.\n]{2,60})[.\n]/i);
      const own = m ? m[2].trim() : null;
      const num = m ? m[1] : (p.ai_metadata && p.ai_metadata.features && p.ai_metadata.features.sectionNumber) || null;
      // Only rename when the section's own heading DIFFERS from the shared
      // label — that's what makes the rows distinguishable.
      if (own && own.toLowerCase() !== String(p.category).toLowerCase()) {
        p.category = `${p.category} — ${own}`;
        renamed += 1;
      } else if (!own && num) {
        p.category = `${p.category} (§${num})`;
        renamed += 1;
      }
    }
  }
  if (renamed > 0) console.log(`[store] differentiated ${renamed} same-category provision name(s)`);
  return provisions;
}

// ---------------------------------------------------------------------------
// Main export
// ---------------------------------------------------------------------------

/**
 * Store provisions atomically in Supabase.
 *
 * @param {string} dealId — the deal UUID
 * @param {Array<Object>} provisions — validated provisions from Phase 4
 * @param {string} agreementText — the full agreement source text
 * @param {string} title — agreement title
 * @param {Object} sb — Supabase client instance (from getServiceSupabase)
 * @returns {{ agreementSourceId: string, insertedCount: number, deletedCount: number, errors: Array }}
 */
async function storeProvisions(dealId, provisions, agreementText, title, sb, extras = {}) {
  const errors = [];
  let agreementSourceId = null;
  let deletedCount = 0;
  let insertedCount = 0;

  // ── Step 1: Store raw agreement text on deals.metadata ──
  try {
    const { data: existingDeal, error: fetchErr } = await sb
      .from('deals')
      .select('metadata')
      .eq('id', dealId)
      .single();

    if (fetchErr) {
      errors.push(`Failed to read deal metadata: ${fetchErr.message}`);
    } else {
      const existingMetadata = (existingDeal && existingDeal.metadata) || {};
      const newMetadata = {
        ...existingMetadata,
        full_text: agreementText,
        agreement_title: title || existingMetadata.agreement_title || 'Merger Agreement',
        ingested_at: new Date().toISOString(),
        char_count: agreementText.length,
        pipeline: 'parser-v2',
        // Stage 4: advisors model. We only OVERWRITE when the caller
        // supplied a non-empty advisors array — that way manual edits
        // persisted on the deal aren't blown away on re-ingest with a
        // weaker auto-extraction.
        ...(Array.isArray(extras.advisors) && extras.advisors.length > 0
          ? { advisors: extras.advisors }
          : (existingMetadata.advisors ? { advisors: existingMetadata.advisors } : {})),
        // Classified-sections snapshot (lib/parser-v2/snapshot.js): persisted
        // at ingest time so later per-type re-extraction (run-extract.js /
        // scripts/reprocess.js) can skip fetch → parse → classify entirely.
        // Only written when the caller supplies it — additive, never clears.
        ...(Array.isArray(extras.classified_sections) && extras.classified_sections.length > 0
          ? {
              classified_sections: extras.classified_sections,
              classify_run_at: new Date().toISOString(),
              ...(extras.classify_breakdown ? { classify_breakdown: extras.classify_breakdown } : {}),
            }
          : {}),
      };

      const { error: updateErr } = await sb
        .from('deals')
        .update({ metadata: newMetadata })
        .eq('id', dealId);

      if (updateErr) {
        errors.push(`Failed to write deal metadata: ${updateErr.message}`);
      } else {
        agreementSourceId = dealId; // use dealId as a stand-in identifier
      }
    }
  } catch (err) {
    errors.push(`Metadata storage error: ${err.message}`);
  }

  // ── Step 2: Delete existing provisions for this deal (clean slate) ──
  try {
    // First, get IDs of existing provisions so we can delete their annotations
    const { data: existingProvisions } = await sb
      .from('provisions')
      .select('id')
      .eq('deal_id', dealId);

    if (existingProvisions && existingProvisions.length > 0) {
      const provisionIds = existingProvisions.map(p => p.id);

      // ── Step 3: Delete annotations for those provisions ──
      const { error: annotErr } = await sb
        .from('annotations')
        .delete()
        .in('provision_id', provisionIds);

      if (annotErr) {
        errors.push(`Failed to delete annotations: ${annotErr.message}`);
        // Non-fatal — continue with provision deletion
      }

      // Delete the provisions themselves
      const { error: delErr } = await sb
        .from('provisions')
        .delete()
        .eq('deal_id', dealId);

      if (delErr) {
        errors.push(`Failed to delete existing provisions: ${delErr.message}`);
      } else {
        deletedCount = existingProvisions.length;
      }
    }
  } catch (err) {
    errors.push(`Deletion error: ${err.message}`);
  }

  // ── Step 4: Batch-insert all new provisions ──
  const provisionsForInsert = differentiateCategories(dedupeProvisions(provisions));
  const normalizedSource = normalizeForMatch(agreementText || '');
  const duplicateCount = provisions.length - provisionsForInsert.length;
  if (duplicateCount > 0) {
    console.log(`[store] deduped ${duplicateCount} duplicate provision(s)`);
  }

  if (provisionsForInsert.length > 0) {
    // Build core rows (no ai_metadata) and rich rows (with ai_metadata) so we
    // can degrade gracefully if the ai_metadata column doesn't exist yet.
    const buildCoreRow = (prov) => ({
      deal_id: dealId,
      type: prov.type,
      category: prov.category || 'Unclassified',
      full_text: cleanProvisionText(prov),
      ai_favorability: normFav(prov.favorability),
    });

    const buildRichRow = (prov) => {
      const quoteVerification = scrubProvisionFeatureQuotes(prov, agreementText || '', normalizedSource);
      // Flag malformed feature shapes at the door (see lib/schema/validation).
      const validation = validationSummary(validateFeatures(
        prov.type,
        prov.code || (prov.features && prov.features.canonicalCode) || null,
        prov.features || {},
      ));
      return {
        ...buildCoreRow(prov),
        ai_metadata: {
          features: scrubMarkerValue(prov.features || {}),
          code: prov.code || null,
          relatedDefinitions: scrubMarkerValue(prov.relatedDefinitions || []),
          isNewCode: prov.isNewCode || false,
          proposedCode: prov.proposedCode || null,
          proposedLabel: prov.proposedLabel || null,
          startChar: typeof prov.startChar === 'number' ? prov.startChar : null,
          ...(quoteVerification ? { quote_verification: quoteVerification } : {}),
          ...(validation ? { validation } : {}),
        },
      };
    };

    const isMissingColumnError = (msg) =>
      typeof msg === 'string' &&
      /column.*ai_metadata|ai_metadata.*does not exist|could not find.*ai_metadata|schema cache/i.test(msg);

    const insertWithFallback = async (richRows, coreRows) => {
      // Try with ai_metadata first
      const richResult = await sb.from('provisions').insert(richRows).select('id');
      if (!richResult.error) {
        return { data: richResult.data, error: null, fellBack: false };
      }
      if (isMissingColumnError(richResult.error.message)) {
        console.warn('[store] ai_metadata column missing — falling back to core columns. Apply supabase/ai-metadata-schema.sql to persist features.');
        const coreResult = await sb.from('provisions').insert(coreRows).select('id');
        return { data: coreResult.data, error: coreResult.error, fellBack: true };
      }
      return { data: null, error: richResult.error, fellBack: false };
    };

    try {
      const richRows = provisionsForInsert.map(buildRichRow);
      const coreRows = provisionsForInsert.map(buildCoreRow);

      const { data: insertData, error: insertErr, fellBack } = await insertWithFallback(richRows, coreRows);

      if (insertErr) {
        errors.push(`Batch insert failed: ${insertErr.message}`);

        // Fallback: try inserting one at a time so we don't lose everything
        console.error('[store] Batch insert failed, falling back to individual inserts:', insertErr.message);
        const useCore = fellBack || isMissingColumnError(insertErr.message);
        for (let i = 0; i < provisionsForInsert.length; i++) {
          const row = useCore ? coreRows[i] : richRows[i];
          try {
            const { error: singleErr } = await sb
              .from('provisions')
              .insert(row);

            if (singleErr) {
              if (!useCore && isMissingColumnError(singleErr.message)) {
                // Retry this one without ai_metadata
                const { error: retryErr } = await sb
                  .from('provisions')
                  .insert(coreRows[i]);
                if (retryErr) {
                  errors.push(`Insert failed for provision #${i} (${coreRows[i].type}/${provisionsForInsert[i].code || 'unclassified'}): ${retryErr.message}`);
                } else {
                  insertedCount++;
                }
              } else {
                errors.push(`Insert failed for provision #${i} (${coreRows[i].type}/${provisionsForInsert[i].code || 'unclassified'}): ${singleErr.message}`);
              }
            } else {
              insertedCount++;
            }
          } catch (singleCatchErr) {
            errors.push(`Insert error for provision #${i}: ${singleCatchErr.message}`);
          }
        }
      } else {
        insertedCount = insertData ? insertData.length : provisionsForInsert.length;
      }
    } catch (err) {
      errors.push(`Insert error: ${err.message}`);
    }
  }

  return {
    agreementSourceId,
    insertedCount,
    deletedCount,
    errors: errors.length > 0 ? errors : undefined,
  };
}

// ---------------------------------------------------------------------------
// Per-type variant — used by the split ingest pipeline (classify + per-type
// extract). Replaces ONLY the rows whose type matches the requested group;
// other provisions on the deal are untouched. The "type group" covers
// sub-types (e.g. type='IOC' → IOC, IOC-T, IOC-B).
// ---------------------------------------------------------------------------

function expandTypeGroupForStore(type) {
  if (!type) return [];
  if (type === 'IOC') return ['IOC', 'IOC-T', 'IOC-B'];
  if (type === 'TERMR') return ['TERMR', 'TERMR-M', 'TERMR-B', 'TERMR-T'];
  if (type === 'COND') return ['COND', 'COND-M', 'COND-B', 'COND-S'];
  if (type === 'OTHER') return ['OTHER', 'SECTION-LEFTOVER'];
  return [type];
}

/**
 * Replace all provisions on a deal whose type belongs to the requested
 * type-group with the supplied set. Safe to call multiple times — idempotent
 * replace-not-append.
 *
 * @param {string} dealId
 * @param {string} type — canonical type key (e.g. 'REP-T', 'IOC')
 * @param {Array<Object>} provisions — extracted provisions for this type
 * @param {Object} sb — Supabase client
 * @returns {{ insertedCount, deletedCount, errors }}
 */
async function storeProvisionsForType(dealId, type, provisions, sb) {
  const errors = [];
  let deletedCount = 0;
  let insertedCount = 0;

  const subTypes = expandTypeGroupForStore(type);
  if (subTypes.length === 0) {
    return { insertedCount: 0, deletedCount: 0, errors: ['No type specified'] };
  }

  // ── 1. Find existing provisions for this deal+type-group so we can delete
  // their annotations first (FK cascade unknown — be safe). ──
  try {
    const { data: existing, error: existingErr } = await sb
      .from('provisions')
      .select('id')
      .eq('deal_id', dealId)
      .in('type', subTypes);

    if (existingErr) {
      errors.push(`Failed to list existing ${type} provisions: ${existingErr.message}`);
    } else if (existing && existing.length > 0) {
      const ids = existing.map((p) => p.id);
      const { error: annotErr } = await sb
        .from('annotations')
        .delete()
        .in('provision_id', ids);
      if (annotErr) {
        errors.push(`Failed to delete annotations for ${type}: ${annotErr.message}`);
      }
      const { error: delErr } = await sb
        .from('provisions')
        .delete()
        .eq('deal_id', dealId)
        .in('type', subTypes);
      if (delErr) {
        errors.push(`Failed to delete existing ${type} provisions: ${delErr.message}`);
      } else {
        deletedCount = existing.length;
      }
    }
  } catch (err) {
    errors.push(`Per-type deletion error: ${err.message}`);
  }

  // ── 2. Insert the new provisions ──
  const provisionsForInsert = differentiateCategories(dedupeProvisions(provisions || []));
  const duplicateCount = (Array.isArray(provisions) ? provisions.length : 0) - provisionsForInsert.length;
  if (duplicateCount > 0) {
    console.log(`[store] deduped ${duplicateCount} duplicate ${type} provision(s)`);
  }

  if (provisionsForInsert.length > 0) {
    let sourceText = '';
    try {
      const { data: deal, error: dealErr } = await sb
        .from('deals')
        .select('metadata')
        .eq('id', dealId)
        .single();
      if (dealErr) {
        console.warn(`[store] quote verification source lookup failed: ${dealErr.message}`);
      } else {
        sourceText = (deal && deal.metadata && deal.metadata.full_text) || '';
      }
    } catch (err) {
      console.warn(`[store] quote verification source lookup error: ${err.message}`);
    }
    const normalizedSource = normalizeForMatch(sourceText);

    const buildCoreRow = (prov) => ({
      deal_id: dealId,
      type: prov.type,
      category: prov.category || 'Unclassified',
      full_text: cleanProvisionText(prov),
      ai_favorability: normFav(prov.favorability),
    });

    const buildRichRow = (prov) => {
      const quoteVerification = scrubProvisionFeatureQuotes(prov, sourceText, normalizedSource);
      // Flag malformed feature shapes at the door (see lib/schema/validation).
      const validation = validationSummary(validateFeatures(
        prov.type,
        prov.code || (prov.features && prov.features.canonicalCode) || null,
        prov.features || {},
      ));
      return {
        ...buildCoreRow(prov),
        ai_metadata: {
          features: scrubMarkerValue(prov.features || {}),
          code: prov.code || null,
          relatedDefinitions: scrubMarkerValue(prov.relatedDefinitions || []),
          isNewCode: prov.isNewCode || false,
          proposedCode: prov.proposedCode || null,
          proposedLabel: prov.proposedLabel || null,
          startChar: typeof prov.startChar === 'number' ? prov.startChar : null,
          ...(quoteVerification ? { quote_verification: quoteVerification } : {}),
          ...(validation ? { validation } : {}),
        },
      };
    };

    const isMissingColumnError = (msg) =>
      typeof msg === 'string' &&
      /column.*ai_metadata|ai_metadata.*does not exist|could not find.*ai_metadata|schema cache/i.test(msg);

    try {
      const richRows = provisionsForInsert.map(buildRichRow);
      const coreRows = provisionsForInsert.map(buildCoreRow);

      const richResult = await sb.from('provisions').insert(richRows).select('id');
      if (!richResult.error) {
        insertedCount = richResult.data ? richResult.data.length : provisionsForInsert.length;
      } else if (isMissingColumnError(richResult.error.message)) {
        console.warn('[store] ai_metadata column missing — falling back to core columns.');
        const coreResult = await sb.from('provisions').insert(coreRows).select('id');
        if (coreResult.error) {
          errors.push(`Per-type insert failed: ${coreResult.error.message}`);
        } else {
          insertedCount = coreResult.data ? coreResult.data.length : provisionsForInsert.length;
        }
      } else {
        errors.push(`Per-type insert failed: ${richResult.error.message}`);
        // Fall back to one-at-a-time to salvage what we can
        for (let i = 0; i < provisionsForInsert.length; i++) {
          try {
            const { error: singleErr } = await sb.from('provisions').insert(coreRows[i]);
            if (singleErr) {
              errors.push(`Insert #${i} (${coreRows[i].type}): ${singleErr.message}`);
            } else {
              insertedCount++;
            }
          } catch (single) {
            errors.push(`Insert error #${i}: ${single.message}`);
          }
        }
      }
    } catch (err) {
      errors.push(`Per-type insert error: ${err.message}`);
    }
  }

  return {
    insertedCount,
    deletedCount,
    errors: errors.length > 0 ? errors : undefined,
  };
}

// ---------------------------------------------------------------------------
// Exports
// ---------------------------------------------------------------------------

module.exports = {
  cleanProvisionText,
  dedupeProvisions,
  differentiateCategories,
  storeProvisions,
  storeProvisionsForType,
  expandTypeGroupForStore,
};
