// CommonJS home for the correction-logging primitives shared across the v1
// PATCH flow (pages/api/provisions.js), pages/api/corrections.js's own
// route handlers, and the Correct-tab submit/review routes
// (pages/api/corrections/submit.js, pages/api/corrections/review.js).
//
// Lives in lib/ (not pages/api/corrections.js) so plain `node --test` can
// `require()` it directly — pages/api/*.js files use ESM `export` syntax,
// which Next.js's build pipeline transpiles but a bare CommonJS `require()`
// cannot parse. pages/api/corrections.js re-exports these two functions for
// backward compatibility; this file is the source of truth.

/**
 * Determine the correction_type from a before/after diff.
 */
function diffCorrectionType(before, after) {
  const tracked = ['type', 'category', 'full_text', 'ai_favorability', 'features'];
  const changed = tracked.filter(k => {
    const b = before ? before[k] : undefined;
    const a = after ? after[k] : undefined;
    const norm = v => (v === null || v === undefined ? '' : v);
    if (Array.isArray(b) || Array.isArray(a)) {
      return JSON.stringify(b || []) !== JSON.stringify(a || []);
    }
    if (typeof b === 'object' || typeof a === 'object') {
      return JSON.stringify(b) !== JSON.stringify(a);
    }
    return norm(b) !== norm(a);
  });

  if (changed.length === 0) return null;
  if (changed.length > 1) return 'multi_change';
  switch (changed[0]) {
    case 'type': return 'type_change';
    case 'category': return 'category_change';
    case 'full_text': return 'text_change';
    case 'ai_favorability': return 'favorability_change';
    case 'features': return 'feature_change';
    default: return 'multi_change';
  }
}

/**
 * Best-effort insert into the corrections table.
 * If the table doesn't exist (or any other error), log to console and
 * return null without throwing — Phase 1 must not break edits.
 */
async function logCorrection(sb, payload) {
  if (!sb) return null;
  try {
    const { data, error } = await sb
      .from('corrections')
      .insert(payload)
      .select()
      .single();
    if (error) {
      console.warn('[corrections] insert failed (table may not exist yet):', error.message);
      return null;
    }
    return data;
  } catch (err) {
    console.warn('[corrections] insert threw:', err?.message || err);
    return null;
  }
}

module.exports = { diffCorrectionType, logCorrection };
