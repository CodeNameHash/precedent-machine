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
  // Capture the canonical-code enforcement / auto-merge / coverage reports
  // stashed on the provisions array by extract.js. These are pulled off
  // BEFORE backfill since backfill creates a fresh array.
  const codeEnforcementReport = (provisions && provisions._codeEnforcementReport) || null;
  const codeMergeReport = (provisions && provisions._codeMergeReport) || null;
  const coverageBackfillReport = (provisions && provisions._coverageBackfillReport) || null;

  // Backfill any orphaned sections as OTHER provisions first so they get
  // validated alongside the rest.
  const coverageWarnings = [];
  if (classifiedSections) {
    const beforeLen = Array.isArray(provisions) ? provisions.length : 0;
    provisions = backfillOrphanSections(provisions, classifiedSections);
    const addedCount = provisions.length - beforeLen;
    if (addedCount > 0) {
      coverageWarnings.push(
        `Backfilled ${addedCount} OTHER provision(s) for orphan sections to maintain 100% coverage`,
      );
    }
    // Cross-check: assert that every classified section is covered by at
    // least one provision.
    const uncovered = [];
    for (const sect of classifiedSections) {
      const sStart = sect.startChar || 0;
      const sLen = (sect.text || '').length;
      const sEnd = sStart + sLen;
      const ok = provisions.some((p) => {
        const pStart = p.startChar || 0;
        const pLen = (p.text || '').length;
        const pEnd = pStart + pLen;
        return pStart < sEnd && pEnd > sStart;
      });
      if (!ok) {
        uncovered.push(sect.title || sect.heading || sect.category || `section@${sStart}`);
      }
    }
    if (uncovered.length > 0) {
      coverageWarnings.push(
        `Coverage WARNING: ${uncovered.length} classified section(s) still not represented in provisions after backfill: ${uncovered.slice(0, 5).join(', ')}${uncovered.length > 5 ? ' …' : ''}`,
      );
    }
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
        uncoded_provisions: [],
        auto_merged_codes: codeMergeReport ? codeMergeReport.autoMerged || [] : [],
        proposed_new_codes_pending_approval: codeMergeReport ? codeMergeReport.pendingNew || [] : [],
        code_enforcement: codeEnforcementReport,
        coverage_backfill: coverageBackfillReport,
        text_coverage: null,
        warnings: ['No provisions to validate', ...coverageWarnings],
      },
    };
  }

  const warnings = [...coverageWarnings];

  // Track counts
  let validCodes = 0;
  let invalidCodes = 0;
  let unknownCodes = 0;

  // Track duplicates: key = `${type}::${code}`
  const seen = {};      // key -> array of indices
  const duplicates = [];

  // Track proposed new codes
  const proposedNewCodes = [];

  // Track uncoded provisions — i.e. provisions that have neither a valid
  // canonical code nor an isNewCode+proposedCode marker. These are flagged
  // as a quality issue (warning, not fatal) so cross-deal matching coverage
  // can be reported in the API response.
  const uncodedProvisions = [];

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
        // Track as uncoded UNLESS this is an exempt provision (OTHER /
        // backfilled / preamble) — those legitimately carry no code.
        const catLower = (prov.category || '').toLowerCase();
        const exempt =
          type === 'OTHER' ||
          type === 'SECTION-LEFTOVER' ||
          prov.backfilled === true ||
          catLower === 'general / preamble' ||
          catLower === 'preamble';
        if (!exempt) {
          uncodedProvisions.push({
            index: idx,
            type,
            category: prov.category || null,
            sourceCategory: prov.sourceCategory || null,
            textPreview: (prov.text || '').substring(0, 120),
          });
        }
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

  // ── Uncoded-provisions check (quality warning, NOT fatal) ──
  if (uncodedProvisions.length > 0) {
    warnings.push(
      `${uncodedProvisions.length} provision(s) have no canonical code and no proposed-new-code marker — these will not be matchable across deals until coded`,
    );
  }

  // ── Auto-merge / pending-new-code summary warnings ──
  if (codeMergeReport) {
    if (Array.isArray(codeMergeReport.autoMerged) && codeMergeReport.autoMerged.length > 0) {
      warnings.push(
        `${codeMergeReport.autoMerged.length} proposed code(s) auto-merged into existing canonical codes`,
      );
    }
    if (Array.isArray(codeMergeReport.pendingNew) && codeMergeReport.pendingNew.length > 0) {
      warnings.push(
        `${codeMergeReport.pendingNew.length} proposed new code(s) pending user approval`,
      );
    }
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

  // ── Text coverage check ──
  // Compute REAL coverage: union of character ranges covered by all
  // provisions over the full-text length. Warn if <95% so the user knows
  // some language is not captured by any provision. Also surface the
  // section-leftover backfill report if extract.js emitted one.
  let coverageRatio = null;
  let uncoveredRanges = [];
  if (fullText && Array.isArray(provisions) && provisions.length > 0) {
    // Build intervals using provisions' startChar + text length. Skip
    // provisions whose text doesn't actually appear at startChar (we use a
    // simple containment check as fallback).
    const intervals = [];
    for (const p of provisions) {
      if (!p || !p.text) continue;
      const pStart = p.startChar || 0;
      const pLen = p.text.length;
      if (pStart < 0 || pStart >= fullText.length) {
        // Try to locate by substring match (first 80 chars).
        const probe = p.text.substring(0, Math.min(80, p.text.length));
        const idx = fullText.indexOf(probe);
        if (idx !== -1) intervals.push([idx, Math.min(fullText.length, idx + pLen)]);
        continue;
      }
      intervals.push([pStart, Math.min(fullText.length, pStart + pLen)]);
    }
    intervals.sort((a, b) => a[0] - b[0]);
    const merged = [];
    for (const iv of intervals) {
      if (merged.length === 0 || iv[0] > merged[merged.length - 1][1]) {
        merged.push([iv[0], iv[1]]);
      } else {
        merged[merged.length - 1][1] = Math.max(merged[merged.length - 1][1], iv[1]);
      }
    }
    let coveredChars = 0;
    for (const [s, e] of merged) coveredChars += (e - s);
    coverageRatio = fullText.length > 0 ? coveredChars / fullText.length : 1;

    // Build the list of uncovered runs (gaps between merged intervals plus
    // head/tail). Only report runs >100 chars so we don't drown in noise from
    // formatting whitespace. Limit to first 20 ranges.
    let cursor = 0;
    for (const [s, e] of merged) {
      if (s > cursor && (s - cursor) > 100) {
        uncoveredRanges.push({
          start: cursor,
          end: s,
          length: s - cursor,
          preview: fullText.substring(cursor, Math.min(cursor + 120, s)).replace(/\s+/g, ' ').trim(),
        });
      }
      cursor = e;
    }
    if (cursor < fullText.length && (fullText.length - cursor) > 100) {
      uncoveredRanges.push({
        start: cursor,
        end: fullText.length,
        length: fullText.length - cursor,
        preview: fullText.substring(cursor, Math.min(cursor + 120, fullText.length)).replace(/\s+/g, ' ').trim(),
      });
    }
    uncoveredRanges = uncoveredRanges.slice(0, 20);

    if (coverageRatio < 0.1) {
      warnings.push(
        `Low text coverage: provisions cover only ${Math.round(coverageRatio * 100)}% of the agreement text`,
      );
    } else if (coverageRatio < 0.95) {
      warnings.push(
        `Text coverage below 95%: provisions cover ${Math.round(coverageRatio * 100)}% of the agreement (${uncoveredRanges.length} uncovered range(s) >100 chars)`,
      );
    }
  }

  if (coverageBackfillReport && coverageBackfillReport.leftovers_emitted > 0) {
    warnings.push(
      `Section-leftover backfill emitted ${coverageBackfillReport.leftovers_emitted} SECTION-LEFTOVER provision(s) (${coverageBackfillReport.uncovered_chars_total} chars) to maintain 100% text coverage`,
    );
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
      uncoded_provisions: uncodedProvisions,
      auto_merged_codes: codeMergeReport ? codeMergeReport.autoMerged || [] : [],
      proposed_new_codes_pending_approval: codeMergeReport ? codeMergeReport.pendingNew || [] : [],
      code_enforcement: codeEnforcementReport,
      coverage_backfill: coverageBackfillReport,
      text_coverage: coverageRatio !== null ? {
        ratio: coverageRatio,
        percent: Math.round(coverageRatio * 100),
        uncovered_ranges: uncoveredRanges,
      } : null,
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
