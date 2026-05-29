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
  if (provisions.length > 0) {
    // Build core rows (no ai_metadata) and rich rows (with ai_metadata) so we
    // can degrade gracefully if the ai_metadata column doesn't exist yet.
    const buildCoreRow = (prov) => ({
      deal_id: dealId,
      type: prov.type,
      category: prov.category || 'Unclassified',
      full_text: (prov.text || '').trim(),
      ai_favorability: prov.favorability || 'neutral',
    });

    const buildRichRow = (prov) => ({
      ...buildCoreRow(prov),
      ai_metadata: {
        features: prov.features || {},
        code: prov.code || null,
        relatedDefinitions: prov.relatedDefinitions || [],
        isNewCode: prov.isNewCode || false,
        proposedCode: prov.proposedCode || null,
        proposedLabel: prov.proposedLabel || null,
        startChar: typeof prov.startChar === 'number' ? prov.startChar : null,
      },
    });

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
      const richRows = provisions.map(buildRichRow);
      const coreRows = provisions.map(buildCoreRow);

      const { data: insertData, error: insertErr, fellBack } = await insertWithFallback(richRows, coreRows);

      if (insertErr) {
        errors.push(`Batch insert failed: ${insertErr.message}`);

        // Fallback: try inserting one at a time so we don't lose everything
        console.error('[store] Batch insert failed, falling back to individual inserts:', insertErr.message);
        const useCore = fellBack || isMissingColumnError(insertErr.message);
        for (let i = 0; i < provisions.length; i++) {
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
                  errors.push(`Insert failed for provision #${i} (${coreRows[i].type}/${provisions[i].code || 'unclassified'}): ${retryErr.message}`);
                } else {
                  insertedCount++;
                }
              } else {
                errors.push(`Insert failed for provision #${i} (${coreRows[i].type}/${provisions[i].code || 'unclassified'}): ${singleErr.message}`);
              }
            } else {
              insertedCount++;
            }
          } catch (singleCatchErr) {
            errors.push(`Insert error for provision #${i}: ${singleCatchErr.message}`);
          }
        }
      } else {
        insertedCount = insertData ? insertData.length : provisions.length;
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
// Exports
// ---------------------------------------------------------------------------

module.exports = {
  storeProvisions,
};
