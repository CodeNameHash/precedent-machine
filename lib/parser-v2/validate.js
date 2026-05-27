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
 * Validate provisions against the rubric and produce a report.
 *
 * @param {Array<Object>} provisions — output from Phase 3 (extract)
 *   Each has: { type, code, category, text, features, isNewCode, proposedCode, proposedLabel, ... }
 * @param {string} fullText — the original agreement full text (for coverage checks)
 * @returns {{ valid: boolean, provisions: Array<Object>, report: Object }}
 */
function validateProvisions(provisions, fullText) {
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
};
