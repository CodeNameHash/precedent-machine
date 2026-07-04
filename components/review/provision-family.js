/* ─────────────────────────────────────────────────────────────────────────
   components/review/provision-family.js — group a "split" provision back
   into the section the lawyer actually thinks in.

   The extraction pipeline stores PARTS (a specific-performance limb, an IOC
   sub-clause, a decomposed no-shop carve-out) as separate provision rows.
   There is no `parent_section` / `parent_provision_id` column — the only
   grouping signals available client-side are:
     - provision.type            (e.g. "NOSOL-T")
     - provision.category        (free-text label, usually stable across parts)
     - ai_metadata.features.sectionNumber (e.g. "5.3(b)")
     - ai_metadata.code          (a taxonomy code, sometimes shared verbatim
                                  across sibling parts, e.g. "COND-FRUSTRATE")

   FB3 Surface 1 (the provision card page) needs "the whole section, then its
   parts" — this module is the pure (no-JSX, independently testable) logic
   that answers "who are this provision's siblings, and in what order do they
   read". Pulled out of pages/review/[id].js rather than added to it, per the
   FB3 brief's "keep [id].js edits to wiring only".
   ───────────────────────────────────────────────────────────────────────── */

import { parseSectionParts, compareSectionParts, sortByAgreementOrder } from './table-logic.js';

function aiCode(provision) {
  const meta = provision && provision.ai_metadata;
  const parsed = typeof meta === 'string' ? safeParse(meta) : meta;
  return (parsed && parsed.code) || null;
}

function safeParse(s) {
  try { return JSON.parse(s); } catch { return null; }
}

export function getSectionNumber(provision) {
  const meta = provision && provision.ai_metadata;
  const parsed = typeof meta === 'string' ? safeParse(meta) : meta;
  const features = parsed && parsed.features;
  const fromFeatures = features && features.sectionNumber;
  return String(fromFeatures || provision?.section_number || '').trim();
}

/* A section number's "root" drops any trailing sub-clause parens, so
 * "5.3(b)(ii)" and "5.3(a)" share the root "5.3" (same family) while "5.4"
 * does not. Provisions whose section number doesn't parse (parseSectionParts
 * returns null — e.g. it's a bare cite like "Article V" or empty) fall back
 * to null, meaning "no section signal for this provision". */
export function sectionRoot(sectionNumber) {
  const parts = parseSectionParts(sectionNumber);
  return parts ? parts.nums.join('.') : null;
}

/* Strip a trailing "-<digit(s)>" / "-<letter>" split-index suffix some codes
 * carry for sibling parts (e.g. "NOSOL-EXCEPTION-2" -> "NOSOL-EXCEPTION"). If
 * there's no such suffix the code is returned unchanged. */
export function codeFamilyRoot(code) {
  if (!code) return null;
  return String(code).replace(/-\d+$/, '').trim();
}

/**
 * Build the "family" for `target` out of `allProvisions` (siblings + self).
 * Returns:
 *   {
 *     isSplit: boolean,       // more than one provision in the family
 *     parts: [...],           // family members, in agreement (section) order
 *     parent: {               // synthesized "whole section" view
 *       type, category, sectionNumber, full_text, isSynthetic, parts
 *     },
 *   }
 * Grouping predicate (a sibling of `target` shares ALL of):
 *   - same `type`
 *   - same `category` (when both have one — an empty/missing category on
 *     either side is treated as a wildcard, not a mismatch, so a stray part
 *     missing its category still joins the family)
 *   - same section-number root OR same taxonomy-code family root (either
 *     signal matching is enough — some pipelines only populate one of them)
 * A provision with neither a section number nor a code never merges with
 * anything (avoids over-grouping every uncategorized row into one family).
 */
export function buildProvisionFamily(target, allProvisions) {
  if (!target) return { isSplit: false, parts: [], parent: null };
  const list = Array.isArray(allProvisions) ? allProvisions : [];

  const targetRoot = sectionRoot(getSectionNumber(target));
  const targetCodeRoot = codeFamilyRoot(aiCode(target));
  const hasSignal = !!(targetRoot || targetCodeRoot);

  const siblings = hasSignal
    ? list.filter((p) => {
        if (p.id === target.id) return true;
        if (p.type !== target.type) return false;
        if (target.category && p.category && p.category !== target.category) return false;
        const pRoot = sectionRoot(getSectionNumber(p));
        const pCodeRoot = codeFamilyRoot(aiCode(p));
        const sectionMatch = !!(targetRoot && pRoot && pRoot === targetRoot);
        const codeMatch = !!(targetCodeRoot && pCodeRoot && pCodeRoot === targetCodeRoot);
        return sectionMatch || codeMatch;
      })
    : [target];

  // Always include target even if it lost the filter somehow (defensive).
  const byId = new Map(siblings.map((p) => [p.id, p]));
  if (!byId.has(target.id)) byId.set(target.id, target);

  const parts = sortByAgreementOrder([...byId.values()], (p) => getSectionNumber(p));
  const isSplit = parts.length > 1;

  const parent = isSplit
    ? {
        type: target.type,
        category: target.category,
        sectionNumber: targetRoot || getSectionNumber(target),
        full_text: parts.map((p) => (p.full_text || '').trim()).filter(Boolean).join('\n\n'),
        isSynthetic: true,
        parts,
      }
    : {
        ...target,
        isSynthetic: false,
        parts,
      };

  return { isSplit, parts, parent };
}

export { compareSectionParts };
