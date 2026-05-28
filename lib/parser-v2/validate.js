/**
 * validate.js — Phase 4 of the v2 parser pipeline.
 *
 * Validates extracted provisions against the canonical rubric:
 *   - Checks each provision's code is valid
 *   - Flags duplicates (same type + code)
 *   - Identifies missing universal-frequency codes
 *   - Collects proposed new codes
 *   - Generates a validation report
 *
 * CommonJS — consumed by Next.js API routes.
 */

const { CODES, isValidCode } = require('../rubric');

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Get all codes from the rubric that have universal frequency.
 * These are expected to appear in every well-formed merger agreement.
 */
function getUniversalCodes() {
  const universal = [];
  for (const [code, entry] of Object.entries(CODES)) {
    if (entry.frequency === 'universal') {
      universal.push(code);
    }
  }
  return universal;
}

// ---------------------------------------------------------------------------
// Main export
// ---------------------------------------------------------------------------

/**
 * Backfill OTHER provisions for any classified section that didn't make it
 * into the final provisions list. This guarantees 100% coverage — every
 * section appears somewhere in the output, even if it didn't fit any
 * canonical type.
 *
 * @param {Array<Object>} provisions — output from extractProvisions
 * @param {Array<Object>} [classifiedSections] — output from classifySections
 *        (with provision_type / provisionType + text + startChar). If omitted,
 *        no backfill is attempted.
 * @returns {Array<Object>} provisions array, possibly augmented with OTHER
 *        provisions for any orphaned sections.
 */
function backfillOrphanSections(provisions, classifiedSections) {
  if (!Array.isArray(classifiedSections) || classifiedSections.length === 0) {
    return provisions;
  }
  if (!Array.isArray(provisions)) provisions = [];

  // Build a set of (startChar, length) signatures for every section that
  // already appears in the provisions list. A section is considered covered
  // if ANY provision falls within its char range — even a sub-clause counts.
  const covered = new Set();
  for (const sect of classifiedSections) {
    const sStart = sect.startChar || 0;
    const sLen = (sect.text || '').length;
    const sEnd = sStart + sLen;
    for (const prov of provisions) {
      const pStart = prov.startChar || 0;
      const pLen = (prov.text || '').length;
      const pEnd = pStart + pLen;
      // Provision overlaps this section's range
      if (pStart < sEnd && pEnd > sStart) {
        covered.add(sStart);
        break;
      }
    }
  }

  const augmented = [...provisions];
  for (const sect of classifiedSections) {
    const sStart = sect.startChar || 0;
    if (covered.has(sStart)) continue;
    // Orphan — emit it as an OTHER provision so coverage stays at 100%.
    augmented.push({
      type: 'OTHER',
      code: null,
      category: sect.category || sect.title || sect.heading || 'Other Provision',
      text: sect.text || '',
      startChar: sStart,
      favorability: 'neutral',
      features: {
        mainConcept: sect.title || sect.heading || sect.category || null,
        summary: '(Backfilled — section had no matching rubric classification.)',
      },
      relatedDefinitions: [],
      isNewCode: false,
      proposedCode: null,
      proposedLabel: null,
      backfilled: true,
    });
  }

  return augmented;
}

/**
 * Validate provisions against the rubric and produce a report.
 *
 * @param {Array<Object>} provisions — output from Phase 3 (extract)
 *   Each has: { type, code, category, text, features, isNewCode, proposedCode, proposedLabel, ... }
 * @param {string} fullText — the original agreement full text (for coverage checks)
 * @param {Array<Object>} [classifiedSections] — optional, used to backfill
 *   orphaned sections as OTHER provisions for 100% coverage.
 * @returns {{ valid: boolean, provisions: Array<Object>, report: Object }}
 */
function validateProvisions(provisions, fullText, classifiedSections) {
  // Backfill any orphaned sections as OTHER provisions first so they get
  // validated alongside the rest.
  if (classifiedSections) {
    provisions = backfillOrphanSections(provisions, classifiedSections);
  }

  if (!provisions || provisions.length === 0) {
    return {
      valid: false,
      provisions: [],
      report: {
        totalProvisions: 0,
        validCodes: 0,
        invalidCodes: 0,
        unknownCodes: 0,
        duplicates: [],
        missingUniversal: getUniversalCodes(),
        proposedNewCodes: [],
        warnings: ['No provisions to validate'],
      },
    };
  }

  const warnings = [];

  // Track counts
  let validCodes = 0;
  let invalidCodes = 0;
  let unknownCodes = 0;

  // Track duplicates: key = `${type}::${code}`
  const seen = {};      // key -> array of indices
  const duplicates = [];

  // Track proposed new codes
  const proposedNewCodes = [];

  // Track which codes are present (for coverage check)
  const presentCodes = new Set();

  // ── Per-provision validation ──
  const validated = provisions.map((prov, idx) => {
    const result = { ...prov };
    const code = prov.code;
    const type = prov.type;

    // 1. Validate code
    if (!code) {
      // No code assigned — could be a preamble or unclassified
      if (prov.isNewCode && prov.proposedCode) {
        result.status = 'new-code';
        proposedNewCodes.push({
          index: idx,
          type,
          proposedCode: prov.proposedCode,
          proposedLabel: prov.proposedLabel,
          textPreview: (prov.text || '').substring(0, 120),
        });
      } else {
        result.status = 'unknown';
        unknownCodes++;
      }
    } else if (isValidCode(code)) {
      // Valid rubric code
      result.status = 'valid';
      validCodes++;
      presentCodes.add(code);

      // Verify the code belongs to the declared type
      const codeEntry = CODES[code];
      if (codeEntry && codeEntry.type !== type) {
        warnings.push(
          `Provision #${idx}: code "${code}" belongs to type "${codeEntry.type}" but provision is typed as "${type}"`
        );
      }
    } else if (prov.isNewCode) {
      // Code is not in the rubric but flagged as new
      result.status = 'new-code';
      proposedNewCodes.push({
        index: idx,
        type,
        proposedCode: prov.proposedCode || code,
        proposedLabel: prov.proposedLabel || prov.category,
        textPreview: (prov.text || '').substring(0, 120),
      });
    } else {
      // Code doesn't exist in the rubric and wasn't flagged as new
      result.status = 'invalid';
      invalidCodes++;
      warnings.push(
        `Provision #${idx}: code "${code}" is not in the rubric`
      );
    }

    // 2. Track for duplicate detection
    if (code) {
      const key = `${type}::${code}`;
      if (!seen[key]) {
        seen[key] = [];
      }
      seen[key].push(idx);
    }

    return result;
  });

  // ── Duplicate detection ──
  for (const [key, indices] of Object.entries(seen)) {
    if (indices.length > 1) {
      const [type, code] = key.split('::');
      duplicates.push({
        type,
        code,
        count: indices.length,
        indices,
      });
    }
  }

  if (duplicates.length > 0) {
    warnings.push(
      `Found ${duplicates.length} duplicate code(s): ${duplicates.map(d => d.code).join(', ')}`
    );
  }

  // ── Coverage check: missing universal codes ──
  const universalCodes = getUniversalCodes();
  const missingUniversal = universalCodes.filter(code => !presentCodes.has(code));

  if (missingUniversal.length > 0 && missingUniversal.length < universalCodes.length) {
    // Only warn if some but not all universal codes are missing
    // (if all are missing, the agreement probably wasn't parsed correctly)
    warnings.push(
      `${missingUniversal.length} universal rubric code(s) not found in provisions`
    );
  }

  // ── Text coverage sanity check ──
  if (fullText) {
    const totalTextLength = provisions.reduce((sum, p) => sum + (p.text || '').length, 0);
    const ratio = totalTextLength / fullText.length;
    if (ratio < 0.1) {
      warnings.push(
        `Low text coverage: provisions contain only ${Math.round(ratio * 100)}% of the agreement text`
      );
    }
  }

  // ── Determine overall validity ──
  // Valid if: no invalid codes AND at least some valid codes
  const valid = invalidCodes === 0 && validCodes > 0;

  return {
    valid,
    provisions: validated,
    report: {
      totalProvisions: provisions.length,
      validCodes,
      invalidCodes,
      unknownCodes,
      duplicates,
      missingUniversal,
      proposedNewCodes,
      warnings,
    },
  };
}

// ---------------------------------------------------------------------------
// Exports
// ---------------------------------------------------------------------------

module.exports = {
  validateProvisions,
  backfillOrphanSections,
};
