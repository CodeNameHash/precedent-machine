/**
 * store.js — Phase 5 of the v2 parser pipeline.
 *
 * Atomic storage of extracted provisions into Supabase:
 *   1. Store agreement source text (SHA-256 dedup)
 *   2. Delete existing provisions + annotations for the deal (clean slate)
 *   3. Batch-insert new provisions with agreement_source_id linked
 *
 * CommonJS — consumed by Next.js API routes.
 */

const crypto = require('crypto');

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
async function storeProvisions(dealId, provisions, agreementText, title, sb) {
  const errors = [];
  let agreementSourceId = null;
  let deletedCount = 0;
  let insertedCount = 0;

  // ── Step 1: Try to store agreement source text (table may not exist) ──
  try {
    const textHash = crypto.createHash('sha256').update(agreementText).digest('hex');
    const { data: existing } = await sb
      .from('agreement_sources')
      .select('id')
      .eq('text_hash', textHash)
      .single();

    if (existing) {
      agreementSourceId = existing.id;
    } else {
      const { data: srcData, error: srcError } = await sb
        .from('agreement_sources')
        .insert({
          title: title || 'Merger Agreement',
          full_text: agreementText,
          text_hash: textHash,
          metadata: {
            ingested_at: new Date().toISOString(),
            char_count: agreementText.length,
            pipeline: 'parser-v2',
          },
        })
        .select()
        .single();

      if (!srcError) agreementSourceId = srcData.id;
    }
  } catch (err) {
    // agreement_sources table may not exist — continue without it
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
    try {
      // Map each provision to the DB schema
      const rows = provisions.map((prov, idx) => {
        const row = {
          deal_id: dealId,
          type: prov.type,
          category: prov.category || 'Unclassified',
          full_text: (prov.text || '').trim(),
          ai_favorability: prov.favorability || 'neutral',
          display_tier: prov.display_tier || 2,
          sort_order: idx,
          ai_metadata: {
          code: prov.code || null,
          features: prov.features || {},
          relatedDefinitions: prov.relatedDefinitions || [],
          classifiedBy: prov.classifiedBy || 'ai',
          confidence: prov.confidence || 'medium',
          isNewCode: prov.isNewCode || false,
          proposedCode: prov.proposedCode || null,
          proposedLabel: prov.proposedLabel || null,
        },
      };
        if (agreementSourceId) row.agreement_source_id = agreementSourceId;
        return row;
      });

      const { data: insertData, error: insertErr } = await sb
        .from('provisions')
        .insert(rows)
        .select('id');

      if (insertErr) {
        errors.push(`Batch insert failed: ${insertErr.message}`);

        // Fallback: try inserting one at a time so we don't lose everything
        console.error('[store] Batch insert failed, falling back to individual inserts:', insertErr.message);
        for (let i = 0; i < rows.length; i++) {
          try {
            const { error: singleErr } = await sb
              .from('provisions')
              .insert(rows[i]);

            if (singleErr) {
              errors.push(`Insert failed for provision #${i} (${rows[i].type}/${rows[i].ai_metadata.code}): ${singleErr.message}`);
            } else {
              insertedCount++;
            }
          } catch (singleCatchErr) {
            errors.push(`Insert error for provision #${i}: ${singleCatchErr.message}`);
          }
        }
      } else {
        insertedCount = insertData ? insertData.length : rows.length;
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
