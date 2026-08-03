/**
 * lib/canonical-v2/native-producer/producer-prompt-registry.js
 *
 * THE DISPATCH SEAM ALL NEW SECTION FAMILIES PLUG INTO
 * (docs/superpowers/specs/2026-08-02-family-termination-rights-design.md
 * section 3, "Dispatch seam -- designed HERE, because it does not exist
 * yet"). Before this module existed, `native-extraction-run.js` had a
 * single hard-required import of `buildCapitalisationProducerPrompt` (its
 * old lines ~143, ~387) -- one prompt, one governed scope, no per-family
 * selection seam of any kind. This module is that seam: a
 * `section_family -> producer prompt module` lookup, encapsulated so the
 * registry itself cannot be mutated from outside this file.
 *
 * WHY A FUNCTION, NOT AN EXPORTED MAP. `Object.freeze()` on a `Map`
 * instance does NOT make its contents immutable -- `.set()`/`.delete()`
 * are inherited from `Map.prototype` and are unaffected by freezing the
 * instance (only the instance's own properties are frozen, and a `Map`
 * keeps its entries in an internal slot, not an own property).
 * `Object.freeze(REGISTRY)` below is kept anyway as defense-in-depth /
 * documentation of intent, but the REAL guarantee -- the registry is
 * genuinely frozen for every caller -- comes from never exporting the
 * `Map` object itself: only `getProducerPromptModule` (read) and
 * `listRegisteredSectionFamilies` (introspection) leave this module.
 *
 * FAIL CLOSED ON UNKNOWN FAMILY. `getProducerPromptModule` returns `null`
 * for any `section_family` not in the table -- there is no default, no
 * "fall back to capitalisation", no silent widening. A section whose
 * family cannot be resolved to a registered producer is a section that is
 * NOT sent to any producer: no prompt is built, no candidates are
 * produced, and the caller (`native-extraction-run.js`) is responsible for
 * recording that fact rather than dropping the section silently (see that
 * module's `undispatched_sections` receipt field).
 *
 * ONE ENTRY THIS SLICE. The existing capitalisation producer is
 * registered as the first, and this slice's only, entry:
 * `CAPITALISATION -> buildCapitalisationProducerPrompt`. Its behavior is
 * completely unchanged -- this module only relocates *how the prompt
 * builder is selected*, never *what it does*. Recorded fixture replays
 * (F28/TopBuild, Skechers, Modiv) must still produce byte-identical
 * output routed through this registry; that is a pure refactor, not a
 * behavior change (see native-extraction-run.js's own header note on
 * "PURE REFACTOR THROUGH THE REGISTRY").
 *
 * Future families (e.g. TERMINATION, per the termination-rights spec)
 * register their own prompt module here, in their own reviewed diff, and
 * nowhere else -- this file is the only place a section_family is ever
 * mapped to a producer.
 */

'use strict';

const { buildCapitalisationProducerPrompt } = require('./capitalisation-producer-prompt');
// TERMINATION_FEE (docs/superpowers/specs/2026-08-02-family-termination-
// fee-design.md section 3): the second registered producer, and the first
// family registered here since this seam was built. Registered in its OWN
// reviewed diff, per this file's own "Future families ... register their
// own prompt module here, in their own reviewed diff, and nowhere else"
// convention -- capitalisation-producer-prompt.js's behavior is completely
// unchanged (its PROMPT_VERSION does not move, its recorded fixtures replay
// byte-identically).
const { buildTerminationFeeProducerPrompt } = require('./termination-fee-producer-prompt');
// NO_SHOP (docs/superpowers/specs/2026-08-02-family-no-shop-design.md
// section 3): the third registered producer, registered in its OWN
// reviewed diff, per this file's own "Future families ... register their
// own prompt module here, in their own reviewed diff, and nowhere else"
// convention -- neither capitalisation-producer-prompt.js nor
// termination-fee-producer-prompt.js is edited by this module's addition.
const { buildNoShopProducerPrompt } = require('./no-shop-producer-prompt');
// MAE_DEFINITION (docs/superpowers/specs/2026-08-02-family-mae-definition-
// design.md section 3): the fourth registered producer, registered in its
// OWN reviewed diff, per this file's own "Future families ... register
// their own prompt module here, in their own reviewed diff, and nowhere
// else" convention -- none of capitalisation-producer-prompt.js,
// termination-fee-producer-prompt.js, or no-shop-producer-prompt.js is
// edited by this module's addition.
const { buildMaeDefinitionProducerPrompt } = require('./mae-definition-producer-prompt');
// TERMINATION (docs/superpowers/specs/2026-08-02-family-termination-rights-
// design.md section 3): the fifth registered producer, and the family the
// classifier's own pre-existing TERMINATION stage-1 rule (sharing
// TERMF_TITLE_PATTERN with the fee family's rule -- section-family-
// classifier.js's own header) has been waiting for since this seam was
// built. Registered in its OWN reviewed diff, per this file's own "Future
// families ... register their own prompt module here, in their own
// reviewed diff, and nowhere else" convention -- none of capitalisation-
// producer-prompt.js, termination-fee-producer-prompt.js, no-shop-
// producer-prompt.js, or mae-definition-producer-prompt.js is edited by
// this module's addition.
const { buildTerminationProducerPrompt } = require('./termination-producer-prompt');
const { buildAntitrustRegulatoryProducerPrompt } = require('./antitrust-regulatory-producer-prompt');
const { buildMergerStructureProducerPrompt } = require('./merger-structure-producer-prompt');
const { buildFinancingGuarantyProducerPrompt } = require('./financing-guaranty-producer-prompt');
const { buildEmployeeDnoProducerPrompt } = require('./employee-dno-producer-prompt');
const { buildTaxDividendAppraisalProducerPrompt } = require('./tax-dividend-appraisal-producer-prompt');
const { buildRemediesMiscProducerPrompt } = require('./remedies-misc-producer-prompt');
const { buildKeyTermsMaeFollowOnProducerPrompt } = require('./key-terms-mae-follow-on-producer-prompt');

const PRODUCER_PROMPT_REGISTRY_SCHEMA = 'NATIVE_PRODUCER_PROMPT_REGISTRY/V1';

// Module-private. Never exported directly -- see the file header's "WHY A
// FUNCTION, NOT AN EXPORTED MAP" note.
const REGISTRY = new Map([
  ['CAPITALISATION', buildCapitalisationProducerPrompt],
  ['TERMINATION_FEE', buildTerminationFeeProducerPrompt],
  ['NO_SHOP', buildNoShopProducerPrompt],
  ['MAE_DEFINITION', buildMaeDefinitionProducerPrompt],
  ['TERMINATION', buildTerminationProducerPrompt],
  ['ANTITRUST_REGULATORY', buildAntitrustRegulatoryProducerPrompt],
  ['MERGER_STRUCTURE_CLOSING', buildMergerStructureProducerPrompt],
  ['FINANCING_COVENANTS', buildFinancingGuarantyProducerPrompt],
  ['GUARANTY_FINANCING_PARTY', buildFinancingGuarantyProducerPrompt],
  ['EMPLOYEE_MATTERS', buildEmployeeDnoProducerPrompt],
  ['DNO_INDEMNIFICATION', buildEmployeeDnoProducerPrompt],
  ['TAX_MATTERS', buildTaxDividendAppraisalProducerPrompt],
  ['DIVIDENDS', buildTaxDividendAppraisalProducerPrompt],
  ['APPRAISAL_DISSENTERS_RIGHTS', buildTaxDividendAppraisalProducerPrompt],
  ['SPECIFIC_PERFORMANCE_REMEDIES', buildRemediesMiscProducerPrompt],
  ['MISC_BOILERPLATE', buildRemediesMiscProducerPrompt],
  ['KEY_DEFINED_TERMS', buildKeyTermsMaeFollowOnProducerPrompt],
]);
Object.freeze(REGISTRY);

/**
 * Looks up the producer prompt-builder function registered for a
 * `section_family`. Returns `null` -- never throws, never falls back --
 * when the family is not registered, so the caller can fail closed
 * (no producer dispatched) rather than silently reusing some other
 * family's prompt.
 *
 * @param {string} sectionFamily
 * @returns {Function|null}
 */
function getProducerPromptModule(sectionFamily) {
  if (typeof sectionFamily !== 'string' || sectionFamily.length === 0) return null;
  return REGISTRY.has(sectionFamily) ? REGISTRY.get(sectionFamily) : null;
}

/**
 * @returns {string[]} the registered section_family keys, sorted, for
 * introspection/tests -- never a live reference to the registry itself.
 */
function listRegisteredSectionFamilies() {
  return Array.from(REGISTRY.keys()).sort();
}

module.exports = {
  PRODUCER_PROMPT_REGISTRY_SCHEMA,
  getProducerPromptModule,
  listRegisteredSectionFamilies,
};
