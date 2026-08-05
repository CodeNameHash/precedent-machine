/**
 * lib/canonical-v2/native-producer/anthropic-provider.js
 *
 * The first real backend behind provider-interface.js's injected-provider
 * seam. `createAnthropicProvider(...)` returns a function matching that
 * seam's signature exactly -- `({governed_scope, definitions, contract_bundle})
 * => providerOutput` -- so this module is interchangeable with a recorded
 * fixture in tests and with `--replay` in the CLI. It never imports
 * provider-interface.js or candidate-proposal-compiler.js and never calls
 * either; it only has to produce output shaped so they accept it.
 *
 * SCOPE. This file builds the prompt (via the frozen
 * capitalisation-producer-prompt.js), calls the model, parses the response
 * with the repo's existing tolerant JSON parser, and validates the response
 * against the prompt's own RESPONSE_SHAPE contract. It then performs a
 * MECHANICAL, STRUCTURAL translation from that response into the proposal
 * shape candidate-proposal-compiler.js expects -- one proposal per
 * qualifier / limb assertion / bring-down tier / open-world candidate --
 * using fixed, generic "_CANDIDATE" claim_definition_keys. This is NOT
 * legal classification: every response produces the same bucket structure
 * regardless of content, so there is no judgment call about which real
 * production claim type a proposition belongs to. That reconciliation is
 * deliberately left to a later stage.
 *
 * Every emitted claim's evidence is a byte-exact span located in the exact
 * source_text the model was given (see `locateQuoteBytes`). A quote the
 * model returned that cannot be found byte-for-byte in the source is
 * DROPPED -- the specific candidate it would have backed is skipped, never
 * fabricated with an invented offset. This mirrors the prompt's own EVIDENCE
 * RULE ("a quote that does not reproduce exactly is discarded and the
 * proposal with it").
 *
 * FAILURE CONTRACT. A malformed, incomplete, or oversized model response is
 * a typed `NativeProducerAnthropicError`, never an empty `proposals: []`.
 * An empty array can only result from a WELL-FORMED response whose
 * structural lists were genuinely empty, or one whose quotes all failed
 * byte-verification (a hallucination signal, not "nothing here" -- callers
 * should treat proposals: [] alongside dropped_quote_mismatches > 0 as
 * suspect, not as a clean negative).
 *
 * QUALIFIERS LIVE AT THE REPRESENTATION LEVEL, NOT NESTED IN A LIMB
 * (PROMPT_VERSION 2, see capitalisation-producer-prompt.js and
 * docs/handoffs/F28-FIRST-LIVE-RUN.md defect 2). A qualifier's scope is
 * described entirely by its `attachment.governs_path` -- a limb_path array,
 * or null for a representation-wide chapeau qualifier -- so nesting a
 * qualifier inside one specific limb object would be redundant for ITEM
 * qualifiers and structurally impossible for CHAPEAU/TRAILING qualifiers,
 * which do not belong to any single limb. `attachment.scope_reading` is
 * NEVER read from the model's response (there is no such field in the
 * contract): it is always computed here, deterministically, by
 * qualifier-attachment.js, from `attachment.position` and the qualifier's
 * own byte-verified quote text.
 */

'use strict';

const { canonicalJson, contentId } = require('../canonical-bytes');
const { MODEL: DEFAULT_MODEL } = require('../../model');
const {
  PROMPT_ID,
  PROMPT_VERSION,
  CONTROLLED_VOCABULARIES,
} = require('./capitalisation-producer-prompt');
const { getProducerPromptModule } = require('./producer-prompt-registry');
const { bindNativePromptToGovernedScope } = require('./native-prompt-binding');
const {
  CONTROLLED_VOCABULARIES: REGULATORY_CONTROLLED_VOCABULARIES,
} = require('./antitrust-regulatory-producer-prompt');
const {
  RESPONSE_LISTS: NO_OTHER_REPS_FRAUD_RESPONSE_LISTS,
  shapeNoOtherRepsFraudProposals,
} = require('./no-other-reps-fraud-producer');
const { resolveQualifierAttachment } = require('./qualifier-attachment');
const {
  MATERIAL_CONTRACT_BUCKET_KINDS,
  MATERIAL_CONTRACT_CADENCE_KINDS,
  MATERIAL_CONTRACT_THRESHOLD_KINDS,
} = require('./material-contracts-producer-prompt');
const {
  GENERAL_COVENANT_CODES,
} = require('./general-covenants-producer-prompt');
const {
  GENERAL_COVENANT_FOLLOW_ON_OWNERS,
} = require('../p0-product-surface-routing');
const { CERTIFICATE_RELATIONSHIP_STATUS } = require('../closing-conditions-relationships');
// No-shop family (spec section 3): the registry's own controlled
// vocabularies, single-sourced -- imported directly (both are already
// exported from contract-bundle.js), never hand-copied as a frozen literal,
// so this shaping layer's codebooks can never drift from the resolver's own
// enum gate.
const {
  NO_SHOP_ACTION_CODES_V2: NO_SHOP_ACTION_CODES,
  NO_SHOP_EXCEPTION_PREREQUISITE_CODES_V2: NO_SHOP_EXCEPTION_PREREQUISITE_CODES,
  MAE_CARVEOUT_CODES_V2: MAE_CARVEOUT_CODES,
} = require('../contract-bundle');
// MAE-definition family (spec section 3): the prong codes are NOT exported
// from contract-bundle.js as a standalone constant (they live inline on
// MAE_DEFINITION_PRONG_CLAIM_DEFINITION_V1.allowed_canonical_values) --
// duplicated here as a literal, matching this file's own SHARE_COUNT_KINDS/
// FEE_TRIGGER_CODES precedent of a hand-carried list for a vocabulary that
// has no standalone bundle export; a table-driven test pins the byte-
// equality relationship to the registered claim definition's own values.
const MAE_DEFINITION_PRONG_CODES = Object.freeze(['BUSINESS_EFFECTS', 'CONSUMMATION_PREVENTION']);
const {
  OBSERVED_MECHANIC_SURFACES: CONSIDERATION_MECHANIC_SURFACES,
  ELECTION_MECHANIC_FIELDS,
} = require('./consideration-producer-prompt');

const PROVIDER_ID = 'native-producer-anthropic/v1';
const RESPONSE_VERSION = 'NATIVE_PRODUCER_ANTHROPIC/V1';
const SUBJECT_DOMAIN = 'NATIVE_PRODUCER_SUBJECT/V1';
const EXCERPT_DOMAIN = 'NATIVE_PRODUCER_EXCERPT/V1';

const DEFAULT_MAX_RETRIES = 2;
const DEFAULT_MAX_TOKENS = 8000;
const DEFAULT_MAX_RESPONSE_CHARS = 200000;

const REQUIRED_RESPONSE_LISTS = Object.freeze([
  'representation_instances',
  'bring_down_conditions',
  'open_world_candidates',
]);
const REQUIRED_RESPONSE_LISTS_BY_FAMILY = Object.freeze({
  CAPITALISATION: REQUIRED_RESPONSE_LISTS,
  TERMINATION_FEE: Object.freeze([
    'fee_amount_assertions',
    'fee_trigger_assertions',
    'tail_period_assertions',
    'open_world_candidates',
  ]),
  NO_SHOP: Object.freeze([
    'no_shop_action_assertions',
    'exception_prerequisite_assertions',
    'period_assertions',
    'open_world_candidates',
  ]),
  MAE_DEFINITION: Object.freeze([
    'mae_definition_instances',
    'open_world_candidates',
  ]),
  TERMINATION: Object.freeze([
    'termination_right_assertions',
    'open_world_candidates',
  ]),
  MATERIAL_CONTRACTS: Object.freeze([
    'material_contract_criteria',
    'open_world_candidates',
  ]),
  NO_OTHER_REPS_FRAUD: NO_OTHER_REPS_FRAUD_RESPONSE_LISTS,
  GENERAL_COVENANTS: Object.freeze([
    'general_covenants',
    'open_world_candidates',
  ]),
  INTERIM_OPERATING: Object.freeze([
    'ioc_mechanics',
    'open_world_candidates',
  ]),
  CLOSING_CONDITIONS: Object.freeze(['open_world_candidates']),
  PROXY_MEETING: Object.freeze(['open_world_candidates']),
  ANTITRUST_REGULATORY: Object.freeze(['regulatory_efforts_assertions', 'open_world_candidates']),
  MERGER_STRUCTURE_CLOSING: Object.freeze(['structure_assertions', 'open_world_candidates']),
  REPRESENTATIONS: REQUIRED_RESPONSE_LISTS,
  CONSIDERATION: Object.freeze(['open_world_candidates']),
  FINANCING_COVENANTS: Object.freeze(['open_world_candidates']),
  GUARANTY_FINANCING_PARTY: Object.freeze(['open_world_candidates']),
  EMPLOYEE_MATTERS: Object.freeze(['employee_matters_assertions', 'open_world_candidates']),
  DNO_INDEMNIFICATION: Object.freeze(['dno_assertions', 'open_world_candidates']),
  TAX_MATTERS: Object.freeze(['open_world_candidates']),
  DIVIDENDS: Object.freeze(['open_world_candidates']),
  APPRAISAL_DISSENTERS_RIGHTS: Object.freeze(['open_world_candidates']),
  SPECIFIC_PERFORMANCE_REMEDIES: Object.freeze(['remedy_assertions', 'open_world_candidates']),
  MISC_BOILERPLATE: Object.freeze(['boilerplate_assertions', 'open_world_candidates']),
  KEY_DEFINED_TERMS: Object.freeze(['open_world_candidates']),
});

// share_count_assertions is new under PROMPT_VERSION 5 and, deliberately,
// NOT added to REQUIRED_RESPONSE_LISTS: every recorded pre-PROMPT_VERSION-5
// response fixture this repo replays (F28/Skechers/Modiv) predates this
// array, and strict-additivity means those byte-identical replay tests must
// keep working unmodified. A response missing this key (or carrying a
// non-array) is treated as an empty list, never a schema failure.
const SHARE_COUNT_ASSERTIONS_KEY = 'share_count_assertions';

const QUALIFIER_CLAIM_KEY = 'NATIVE_CAPITALISATION_QUALIFIER_CANDIDATE';
const LIMB_ASSERTION_CLAIM_KEY = 'NATIVE_CAPITALISATION_LIMB_ASSERTION_CANDIDATE';
const BRING_DOWN_TIER_CLAIM_KEY = 'NATIVE_BRING_DOWN_TIER_CANDIDATE';
const OPEN_WORLD_CLAIM_KEY = 'OPEN_WORLD_PROPOSITION';
const TAX_MATTERS_CLAIM_KEY = 'NATIVE_TAX_MATTERS_CANDIDATE';
const DIVIDENDS_CLAIM_KEY = 'NATIVE_DIVIDENDS_CANDIDATE';
const APPRAISAL_CLAIM_KEY = 'NATIVE_APPRAISAL_CANDIDATE';
const EMPLOYEE_MATTERS_CLAIM_KEY = 'NATIVE_EMPLOYEE_MATTERS_CANDIDATE';
const DNO_CLAIM_KEY = 'NATIVE_DNO_CANDIDATE';
const EMPLOYEE_MATTERS_PROPOSAL_KIND = 'EMPLOYEE_MATTERS';
const DNO_PROPOSAL_KIND = 'DNO';
const IOC_REMAINING_SURFACES = Object.freeze([
  'AFFIRMATIVE_COVENANT', 'LONG_TAIL_RESTRICTION',
  'CONSENT_OR_EFFORTS_STANDARD', 'EXCEPTION', 'THRESHOLD_OR_NOTICE_WINDOW',
]);
const STRUCTURE_SURFACES = Object.freeze(['DIRECTORS', 'EFFECTS', 'ACTIONS', 'CLOSING_LOCATION', 'CLOSING_TIMING', 'EFFECTIVE_TIME', 'SHORT_FORM_251H', 'TOP_UP', 'SUBSEQUENT_OFFERING', 'SCHEDULE_TO_14D9', 'STOCKHOLDER_LIST', 'BOARD_DESIGNATION']);
const REMEDY_ASSERTION_KINDS = Object.freeze(['SPECIFIC_PERFORMANCE', 'DAMAGES_WAIVER', 'LITIGATION_EXTENSION', 'EXPEDITED_PROCEEDING']);
const SPECIFIC_PERFORMANCE_ASSERTION_KINDS = Object.freeze(['SPECIFIC_PERFORMANCE']);
const MISC_ASSERTION_KINDS = Object.freeze(['GOVERNING_LAW', 'FORUM_FALLBACK', 'WAIVER_OR_SURVIVAL', 'CONSTRUCTION_OR_EXPENSES', 'TPB_EXCEPTION', 'ASSIGNMENT_DETAIL', 'NOTICE']);
const FINANCING_SURFACES = Object.freeze(['ALTERNATIVE_FINANCING', 'LENDER_ARRANGEMENT', 'MARKET_FLEX', 'MARKETING_PERIOD', 'REIMBURSEMENT_OR_INDEMNITY', 'GUARANTY_DELIVERY', 'GUARANTY_CORE_TERM', 'FINANCING_PARTY_PROTECTION']);
const EMPLOYEE_DNO_SURFACES = Object.freeze(['RETIREMENT_401K', 'BONUS_OR_LTI', 'WARN_OR_CBA', 'ADVANCEMENT_TIMING', 'SUCCESSOR_ASSUMPTION', 'PENDING_CLAIM_SURVIVAL', 'INDEMNIFICATION_AGREEMENT', 'FEE_SHIFTING', 'CLAIMS_HANDLING']);
const TAX_DIVIDEND_APPRAISAL_SURFACES = Object.freeze(['TAX_OPINION_COOPERATION', 'TAX_SHARING_TERMINATION', 'TAX_MECHANIC', 'DIVIDEND_COORDINATION', 'DIVIDEND_FINAL_PERIOD', 'APPRAISAL_NOTICE', 'APPRAISAL_INFORMATION_RIGHT', 'APPRAISAL_MODALITY', 'APPRAISAL_STATUTE']);
const REMEDIES_MISC_SURFACES = Object.freeze(['SOLE_REMEDY_EVIDENCE', 'FEE_ELECTION_EVIDENCE', 'DAMAGES_WAIVER', 'LITIGATION_EXTENSION', 'EXPEDITED_PROCEEDING', 'GOVERNING_LAW', 'FORUM_FALLBACK', 'WAIVER_OR_SURVIVAL', 'CONSTRUCTION_OR_EXPENSES', 'TPB_EXCEPTION', 'ASSIGNMENT_DETAIL', 'NOTICE']);
const KEY_TERMS_MAE_SURFACES = Object.freeze(['DEF_PRODUCT_OUTPUT', 'ACQUISITION_THRESHOLD', 'SUPERIOR_THRESHOLD', 'ORDINARY_COURSE_STRUCTURE', 'EFFECTIVE_THRESHOLD_RELATIONSHIP']);
// Wave B mechanisms are evidence-routing labels, not governed legal codes.
// Unknown labels remain open-world too, under UNCLASSIFIED_SURFACE.
const TERMINATION_RIGHT_WAVE_B_SURFACES = Object.freeze([
  'OUTSIDE_DATE_EXTENSION', 'RESTRAINT_FINALITY', 'VOTE_THRESHOLD',
  'BREACH_STANDARD', 'PRE_VOTE_LIMIT',
]);
const TERMINATION_FEE_WAVE_B_SURFACES = Object.freeze([
  'SOLE_REMEDY', 'NAKED_NO_VOTE', 'EXPENSE_REIMBURSEMENT',
  'LATE_PAYMENT_INTEREST', 'TAIL_FEE_STRUCTURE',
]);
// P1 cap-table numeric promotions (docs/superpowers/specs/2026-08-02-p1-
// captable-numerics-design.md section 3): a distinct generic key and
// proposal_kind from OPEN_WORLD, so the resolver's own routing (which keys
// on proposal_kind === 'OPEN_WORLD' vs everything else) never has to guess
// which array a candidate came from.
const SHARE_COUNT_CLAIM_KEY = 'NATIVE_CAPITALISATION_SHARE_COUNT_CANDIDATE';
const SHARE_COUNT_PROPOSAL_KIND = 'SHARE_COUNT';
const SHARE_COUNT_KINDS = Object.freeze([
  'AUTHORIZED', 'ISSUED_OUTSTANDING', 'RESERVED', 'TREASURY', 'OUTSTANDING_AWARDS',
]);
const MATERIAL_CONTRACT_BUCKET_CLAIM_KEY = 'NATIVE_MATERIAL_CONTRACT_BUCKET_CANDIDATE';
const MATERIAL_CONTRACT_THRESHOLD_CLAIM_KEY = 'NATIVE_MATERIAL_CONTRACT_THRESHOLD_CANDIDATE';
const MATERIAL_CONTRACT_PROPOSAL_KIND = 'MATERIAL_CONTRACTS';
const GENERAL_COVENANT_PROPOSAL_KIND = 'GENERAL_COVENANT';
const GENERAL_COVENANT_CLAIM_KEYS = Object.freeze(Object.fromEntries(
  GENERAL_COVENANT_CODES.map((code) => [
    code,
    `NATIVE_GENERAL_COVENANT_${code.replace(/^COV-/, '').replace(/-/g, '_')}_PRESENT_CANDIDATE`,
  ]),
));
const FINANCING_COVENANT_CLAIM_KEY = 'NATIVE_FINANCING_COVENANT_CANDIDATE';
const GUARANTY_CLAIM_KEY = 'NATIVE_GUARANTY_CANDIDATE';
const FINANCING_COVENANT_PROPOSAL_KIND = 'FINANCING_COVENANT';
const GUARANTY_PROPOSAL_KIND = 'GUARANTY';

// Termination-fee family (docs/superpowers/specs/2026-08-02-family-
// termination-fee-design.md section 3): three new generic keys, each with
// its own non-OPEN_WORLD proposal_kind -- the same "distinct generic key
// and proposal_kind from OPEN_WORLD" discipline the SHARE_COUNT promotion
// established, so the resolver's own proposal_kind === 'OPEN_WORLD' routing
// never has to guess which array a candidate came from. These are shaped
// from the SEPARATE termination-fee-producer-prompt.js response (its own
// response schema, never merged into REQUIRED_RESPONSE_LISTS or the
// capitalisation module's own arrays -- spec section 3's "deliberately NOT
// the share_count precedent" pin).
const FEE_AMOUNT_CLAIM_KEY = 'NATIVE_TERMINATION_FEE_AMOUNT_CANDIDATE';
const FEE_AMOUNT_PROPOSAL_KIND = 'FEE_AMOUNT';
const FEE_TRIGGER_CLAIM_KEY = 'NATIVE_TERMINATION_FEE_TRIGGER_CANDIDATE';
const FEE_TRIGGER_PROPOSAL_KIND = 'FEE_TRIGGER';
const FEE_TAIL_PERIOD_CLAIM_KEY = 'NATIVE_TERMINATION_FEE_TAIL_PERIOD_CANDIDATE';
const FEE_TAIL_PERIOD_PROPOSAL_KIND = 'FEE_TAIL_PERIOD';
// The trigger enum this shaping layer tags onto taxonomy_codes/codebooks --
// duplicated here as a literal (never imported from contract-bundle.js,
// matching this file's own SHARE_COUNT_KINDS precedent of a hand-carried
// list): the governed TERMINATION_FEE_TRIGGER claim definition's own
// allowed_canonical_values (contract-bundle.js V15) is the single source of
// truth this list must stay a content-superset of; a table-driven test pins
// that relationship.
const FEE_TRIGGER_CODES = Object.freeze([
  'CHANGE_IN_RECOMMENDATION_TERMINATION',
  'NO_SOLICIT_BREACH_TERMINATION',
  'STOCKHOLDER_APPROVAL_FAILURE_TERMINATION',
  'OUTSIDE_DATE_TERMINATION',
  'COUNTERPARTY_COVENANT_BREACH_TERMINATION',
  'INTERVENING_EVENT_RECOMMENDATION_CHANGE_TERMINATION',
  'SUPERIOR_PROPOSAL_TERMINATION',
]);
const FEE_SIDES = Object.freeze(['SELLER', 'BUYER']);

// No-shop family (docs/superpowers/specs/2026-08-02-family-no-shop-design.md
// section 3): FIVE new generic claim keys, ONE shared proposal_kind
// `NO_SHOP` (deliberately singular, unlike the fee family's three --
// spec section 3 pins exactly this shape: "one proposal_kind NO_SHOP (!=
// OPEN_WORLD)"), so the resolver's own proposal_kind === 'OPEN_WORLD'
// routing never has to guess which array a candidate came from. Shaped
// from the SEPARATE no-shop-producer-prompt.js response (its own response
// schema, never merged into REQUIRED_RESPONSE_LISTS or the capitalisation/
// termination-fee modules' own arrays).
const NO_SHOP_ACTION_CLAIM_KEY = 'NATIVE_NO_SHOP_ACTION_CANDIDATE';
const NO_SHOP_EXCEPTION_PREREQUISITE_CLAIM_KEY = 'NATIVE_NO_SHOP_EXCEPTION_PREREQUISITE_CANDIDATE';
const NO_SHOP_NOTICE_PERIOD_CLAIM_KEY = 'NATIVE_NO_SHOP_NOTICE_PERIOD_CANDIDATE';
const NO_SHOP_MATCH_PERIOD_CLAIM_KEY = 'NATIVE_NO_SHOP_MATCH_PERIOD_CANDIDATE';
const NO_SHOP_REMATCH_PERIOD_CLAIM_KEY = 'NATIVE_NO_SHOP_REMATCH_PERIOD_CANDIDATE';
const NO_SHOP_WAVE_B_CLAIM_KEY = 'NATIVE_NO_SHOP_WAVE_B_CANDIDATE';
const NO_SHOP_PROPOSAL_KIND = 'NO_SHOP';
const NO_SHOP_WAVE_B_ASSERTION_KINDS = Object.freeze([
  'CEASE_ACTION',
  'REPRESENTATIVE_CONTROL_STANDARD',
  'REPRESENTATIVE_BREACH_ATTRIBUTION',
  'STANDSTILL_ACTION',
  'FIDUCIARY_ENGAGEMENT_STANDARD',
  'RECOMMENDATION_CHANGE_FIDUCIARY_STANDARD',
  'RECOMMENDATION_CHANGE_ACTION',
  'RECOMMENDATION_CHANGE_TRIGGER',
  'RECOMMENDATION_SAFE_DISCLOSURE',
]);

// period_role -> generic claim key, mechanical (spec section 3): "The
// provider maps period_role -> key mechanically and rejects an unknown role
// as a typed provider error (fail-closed, the existing
// NativeProducerAnthropicError shape)." Three roles resolve to three
// DIFFERENT concepts downstream (NOSOL-NOTICE / NOSOL-MATCH / NOSOL-REMATCH)
// -- distinct concepts get distinct keys so RESOLUTION_UNCONDITIONAL (a Map
// keyed on generic_claim_key alone) never needs a concept minted inside a
// handler (P1 audit M-2 precedent).
const NO_SHOP_PERIOD_ROLE_TO_CLAIM_KEY = Object.freeze({
  NOTICE: NO_SHOP_NOTICE_PERIOD_CLAIM_KEY,
  INITIAL_MATCH: NO_SHOP_MATCH_PERIOD_CLAIM_KEY,
  SUBSEQUENT_MATCH: NO_SHOP_REMATCH_PERIOD_CLAIM_KEY,
});
const NO_SHOP_PERIOD_ROLES = Object.freeze(Object.keys(NO_SHOP_PERIOD_ROLE_TO_CLAIM_KEY));

// MAE-definition family (docs/superpowers/specs/2026-08-02-family-mae-
// definition-design.md section 3): THREE new generic claim keys, one
// proposal_kind `MAE_DEFINITION` (!= OPEN_WORLD) -- the fee family's
// three-distinct-generic-keys shape ("the three shapes carry different
// attribute contracts"), not the no-shop family's five. Shaped from the
// SEPARATE mae-definition-producer-prompt.js response (its own response
// schema, never merged into REQUIRED_RESPONSE_LISTS or any sibling
// family's own arrays).
const MAE_CARVEOUT_CLAIM_KEY = 'NATIVE_MAE_CARVEOUT_CANDIDATE';
const MAE_DEFINITION_PRONG_CLAIM_KEY = 'NATIVE_MAE_DEFINITION_PRONG_CANDIDATE';
const MAE_DISPROPORTIONALITY_CLAIM_KEY = 'NATIVE_MAE_DISPROPORTIONALITY_CANDIDATE';
const MAE_DEFINITION_PROPOSAL_KIND = 'MAE_DEFINITION';

// Termination-RIGHTS family (docs/superpowers/specs/2026-08-02-family-
// termination-rights-design.md section 3): ONE new generic claim key, ONE
// new non-OPEN_WORLD proposal_kind -- the fee family's own "distinct
// generic key and proposal_kind from OPEN_WORLD" discipline, so the
// resolver's own proposal_kind === 'OPEN_WORLD' routing never has to guess.
// The definition split (RIGHT_GRANT/OUTSIDE_DATE/CURE_PERIOD, and within
// RIGHT_GRANT the eight trigger_kind-keyed concepts) is made entirely
// inside the resolver's own handler, on `assertion_kind`/`trigger_kind` --
// mirroring the SHARE_COUNT/MAE precedent of "one generic key, definition
// split downstream" -- never split here in the shaping layer, which stays
// purely mechanical/structural. Shaped from the SEPARATE termination-
// producer-prompt.js response (its own response schema, never merged into
// REQUIRED_RESPONSE_LISTS or any sibling family's own arrays).
const TERMINATION_RIGHT_CLAIM_KEY = 'NATIVE_TERMINATION_RIGHT_CANDIDATE';
const TERMINATION_RIGHT_PROPOSAL_KIND = 'TERMINATION_RIGHT';
// The eight registered-concept trigger_kind values (spec section 1's
// governed attribute enum) -- duplicated here as a literal, matching this
// file's own SHARE_COUNT_KINDS/FEE_TRIGGER_CODES precedent of a hand-
// carried list for a vocabulary with no standalone claim-definition-level
// enum export (trigger_kind is a governed ATTRIBUTE, never a claim
// definition's own allowed_canonical_values).
const TERMINATION_TRIGGER_KINDS = Object.freeze([
  'MUTUAL_CONSENT',
  'OUTSIDE_DATE',
  'VOTE_FAILURE',
  'BREACH',
  'LEGAL_RESTRAINT',
  'SUPERIOR_PROPOSAL',
  'RECOMMENDATION_CHANGE',
  'NO_SOLICITATION_BREACH',
]);
const TERMINATION_PARTY_SCOPES = Object.freeze(['EITHER_PARTY', 'ONE_PARTY']);
const TERMINATION_DAY_KINDS = Object.freeze(['CALENDAR', 'BUSINESS']);
const TERMINATION_PERIOD_KINDS = Object.freeze(['CURE', 'NOTICE']);
const TERMINATION_ASSERTION_KINDS = Object.freeze(['RIGHT_GRANT', 'OUTSIDE_DATE', 'CURE_PERIOD']);

const DEFINED_TERM_CLAIM_KEY = 'NATIVE_DEFINED_TERM_CANDIDATE';
const DEFINED_TERM_PROPOSAL_KIND = 'DEFINED_TERM';
const DEFINED_TERM_ASSERTION_KINDS = Object.freeze([
  'ACQ_THRESHOLD',
  'SUPERIOR_THRESHOLD',
  'THRESHOLD_SUBSTITUTION',
  'SUPERIOR_QUALIFIER',
  'INTERVENING_DEFINITION',
  'INTERVENING_EXCLUSION',
  'KNOWLEDGE_STANDARD',
  'KNOWLEDGE_PERSON_SOURCE',
  'WILLFUL_DEFINITION',
  'WILLFUL_STANDARD',
  'RECORDED_DEFINITION',
]);
const DEFINED_TERM_THRESHOLD_BASES = Object.freeze(['EQUITY_SECURITIES', 'ASSETS', 'REVENUE_OR_EARNINGS']);
const DEFINED_TERM_SUPERIOR_QUALIFIER_CODES = Object.freeze(['FINANCIAL_FAVORABILITY', 'CONSUMMATION_LIKELIHOOD']);
const DEFINED_TERM_INTERVENING_EXCLUSION_CODES = Object.freeze([
  'ACQUISITION_PROPOSAL_RECEIPT', 'STOCK_PRICE_CHANGE', 'NON_MAE_EFFECT',
]);
const DEFINED_TERM_STANDARD_CODES = Object.freeze([
  'ACTUAL', 'AFTER_INQUIRY', 'CONSTRUCTIVE', 'ACTUAL_OR_CONSTRUCTIVE',
]);
const DEFINED_TERM_PERSON_SOURCE_CODES = Object.freeze(['NAMED_INDIVIDUALS', 'SCHEDULE_REFERENCE', 'TITLE_CLASS']);
const DEFINED_TERM_KNOWLEDGE_PARTIES = Object.freeze(['TARGET', 'BUYER']);
const DEFINITION_ENVELOPE_KINDS = Object.freeze(['TERM_DEFINITION', 'CROSS_REFERENCE', 'INLINE_PARENTHETICAL']);
const RECORDED_DEFINITION_TERM_MAP = Object.freeze({
  tax: Object.freeze({ concept_key: 'DEF-TAX', claim_definition_key: 'TAX_DEFINITION_RECORDED' }),
  'tax return': Object.freeze({ concept_key: 'DEF-TAX-RETURN', claim_definition_key: 'TAX_RETURN_DEFINITION_RECORDED' }),
  'made available': Object.freeze({ concept_key: 'DEF-MADE-AVAILABLE', claim_definition_key: 'MADE_AVAILABLE_DEFINITION_RECORDED' }),
  'ordinary course': Object.freeze({ concept_key: 'DEF-ORDINARY-COURSE', claim_definition_key: 'ORDINARY_COURSE_DEFINITION_RECORDED' }),
});
const IOC_RESTRICTION_CLAIM_KEY = 'NATIVE_IOC_RESTRICTION_CANDIDATE';
const IOC_RESTRICTION_PROPOSAL_KIND = 'IOC_RESTRICTION';
const IOC_ASSERTION_KINDS = Object.freeze(['RESTRICTION_PRESENT']);
const CLOSING_CONDITION_CLAIM_KEY = 'NATIVE_CLOSING_CONDITION_CANDIDATE';
const CLOSING_CONDITION_PROPOSAL_KIND = 'CLOSING_CONDITION';
const CLOSING_CONDITION_ASSERTION_KINDS = Object.freeze([
  'BRING_DOWN_TIER', 'NO_MAE_CONDITION', 'MAE_CONTINUING', 'COVENANT_COMPLIANCE',
  'REGULATORY_APPROVAL', 'STOCKHOLDER_APPROVAL', 'LEGAL_RESTRAINT',
  'GOVERNMENT_PROCEEDING', 'S4_COMPONENT', 'LISTING', 'FUNDS',
  'OFFICER_CERTIFICATE', 'FRUSTRATION_CAUSATION', 'FRUSTRATION_BREACH',
  'DOLLAR_THRESHOLD', 'BURDENSOME_CONDITION',
]);
const PROXY_MEETING_COVENANT_CLAIM_KEY = 'NATIVE_PROXY_MEETING_COVENANT_CANDIDATE';
const PROXY_MEETING_COVENANT_PROPOSAL_KIND = 'PROXY_MEETING_COVENANT';
const PROXY_MEETING_ASSERTION_KINDS = Object.freeze([
  'FILING_DEADLINE', 'MAILING_DEADLINE', 'MEETING_DEADLINE',
  'RECORD_DATE_ESTABLISHMENT', 'BROKER_SEARCH_OBLIGATION',
  'ADJOURNMENT_COUNT_CAP', 'ADJOURNMENT_DURATION_CAP', 'ADJOURNMENT_REASON',
  'ADJOURNMENT_CONTROL', 'ADJOURNMENT_CONSENT_OVERRIDE',
  'RECOMMENDATION_INCLUSION', 'CONVENE_OBLIGATION', 'PARENT_APPROVAL', 'MERGER_SUB_APPROVAL',
]);
const REGULATORY_EFFORTS_CLAIM_KEY = 'NATIVE_REGULATORY_EFFORTS_CANDIDATE';
const REGULATORY_EFFORTS_PROPOSAL_KIND = 'REGULATORY_EFFORTS';
const REGULATORY_ASSERTION_KINDS = Object.freeze([
  ...REGULATORY_CONTROLLED_VOCABULARIES.ASSERTION_KIND,
  'TIMING_RESTRICTION',
]);
const REGULATORY_OBLIGOR_SCOPES = REGULATORY_CONTROLLED_VOCABULARIES.OBLIGOR_PARTY_SCOPE;
const REGULATORY_DAY_KINDS = REGULATORY_CONTROLLED_VOCABULARIES.DAY_KIND;
const REGULATORY_INFORMATION_PROTECTION_KINDS = REGULATORY_CONTROLLED_VOCABULARIES.INFORMATION_PROTECTION_KIND;
const CONSIDERATION_CLAIM_KEY = 'NATIVE_CONSIDERATION_CANDIDATE';
const CONSIDERATION_PROPOSAL_KIND = 'CONSIDERATION';
const REPRESENTATION_QUALIFIER_CLAIM_KEY = 'NATIVE_REPRESENTATION_QUALIFIER_CANDIDATE';
const REPRESENTATION_QUALIFIER_PROPOSAL_KIND = 'REPRESENTATION_QUALIFIER';
const MERGER_STRUCTURE_CLAIM_KEY = 'NATIVE_MERGER_STRUCTURE_CANDIDATE';
const MERGER_STRUCTURE_PROPOSAL_KIND = 'MERGER_STRUCTURE';
const SPECIFIC_PERFORMANCE_REMEDY_CLAIM_KEY = 'NATIVE_SPECIFIC_PERFORMANCE_REMEDY_CANDIDATE';
const SPECIFIC_PERFORMANCE_REMEDY_PROPOSAL_KIND = 'SPECIFIC_PERFORMANCE_REMEDY';
const MISC_BOILERPLATE_CLAIM_KEY = 'NATIVE_MISC_BOILERPLATE_CANDIDATE';
const MISC_BOILERPLATE_PROPOSAL_KIND = 'MISC_BOILERPLATE';
const CONSIDERATION_ASSERTION_KINDS = Object.freeze([
  'PER_SHARE_CASH', 'EXCHANGE_RATIO', 'APPRAISAL_STATUS',
]);
const APPRAISAL_STATUS_VALUES = Object.freeze(['AVAILABLE', 'NOT_AVAILABLE']);

const ACCURACY_CODES = Object.freeze(Object.keys(CONTROLLED_VOCABULARIES.ACCURACY_STANDARD));
const KNOWLEDGE_CODES = Object.freeze(Object.keys(CONTROLLED_VOCABULARIES.KNOWLEDGE_STANDARD));
const QUALIFIER_CODES = Object.freeze([...ACCURACY_CODES, ...KNOWLEDGE_CODES]);

/**
 * A typed, fail-closed error. Every field the caller needs to decide what
 * happened is on the instance -- never just a message string to parse.
 */
class NativeProducerAnthropicError extends Error {
  constructor(code, message, details = {}) {
    super(message);
    this.name = 'NativeProducerAnthropicError';
    this.code = code;
    this.details = details;
  }
}

function requirePlainObject(value, label) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new NativeProducerAnthropicError('INVALID_INPUT', `${label} must be a plain object`);
  }
  return value;
}

// ---------------------------------------------------------------------------
// Response-shape validation.
// ---------------------------------------------------------------------------

function validateResponseLists(parsed, requiredLists) {
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new NativeProducerAnthropicError(
      'MALFORMED_RESPONSE',
      'model response did not parse to a JSON object',
    );
  }
  for (const key of requiredLists) {
    if (!Array.isArray(parsed[key])) {
      throw new NativeProducerAnthropicError(
        'SCHEMA_MISSING_KEY',
        `model response is missing required top-level array "${key}"`,
        { missing_key: key },
      );
    }
  }
  return parsed;
}

function validateResponseShape(parsed) {
  return validateResponseLists(parsed, REQUIRED_RESPONSE_LISTS);
}

function validateFamilyResponseShape(parsed, sectionFamily) {
  const requiredLists = REQUIRED_RESPONSE_LISTS_BY_FAMILY[sectionFamily];
  if (!requiredLists) {
    throw new NativeProducerAnthropicError(
      'UNSUPPORTED_SECTION_FAMILY',
      `no live response contract is registered for section family ${JSON.stringify(sectionFamily)}`,
      { section_family: sectionFamily },
    );
  }
  return validateResponseLists(parsed, requiredLists);
}

// ---------------------------------------------------------------------------
// Byte-exact quote location. A quote that does not reproduce exactly from
// the source the model was given is never trusted with an invented offset.
// ---------------------------------------------------------------------------

function locateQuoteBytes(sourceBytes, quote) {
  if (typeof quote !== 'string' || quote.length === 0) return null;
  const needle = Buffer.from(quote, 'utf8');
  const start = sourceBytes.indexOf(needle);
  if (start < 0) return null;
  return { start, end: start + needle.length };
}

function locateAllQuoteBytes(sourceBytes, quote) {
  if (typeof quote !== 'string' || quote.length === 0) return [];
  const needle = Buffer.from(quote, 'utf8');
  const spans = [];
  let offset = 0;
  while (offset < sourceBytes.length) {
    const start = sourceBytes.indexOf(needle, offset);
    if (start < 0) break;
    spans.push({ start, end: start + needle.length });
    offset = start + 1;
  }
  return spans;
}

function evidenceFromSpan(quote, span, role = 'OPERATIVE_TEXT') {
  const excerptId = contentId(EXCERPT_DOMAIN, { quote, start: span.start, end: span.end });
  return {
    evidence_role: role,
    excerpt_id: excerptId,
    document_ordinal: 0,
    absolute_start: span.start,
    absolute_end: span.end,
    ordinal: 0,
  };
}

function evidenceFromQuote(sourceBytes, quote, role = 'OPERATIVE_TEXT') {
  const span = locateQuoteBytes(sourceBytes, quote);
  if (!span) return null;
  return evidenceFromSpan(quote, span, role);
}

// A purely mechanical grammatical observation -- never taken from the
// model -- used as one of a TRAILING/ITEM/CHAPEAU qualifier's
// ambiguity_signals: does a comma (rather than a period, semicolon, or
// nothing) immediately precede the qualifier's own quoted text, skipping
// intervening whitespace. Comma vs. full-stop before a trailing qualifier is
// itself a live signal in the last-antecedent case law, so this is recorded
// even though it does not, on its own, decide scope_reading.
function commaPrecedesQuote(sourceBytes, quoteStart) {
  let i = quoteStart - 1;
  while (i >= 0) {
    const byte = sourceBytes[i];
    if (byte === 0x20 || byte === 0x09 || byte === 0x0a || byte === 0x0d) {
      i -= 1;
      continue;
    }
    return byte === 0x2c; // ','
  }
  return false;
}

// ---------------------------------------------------------------------------
// Mechanical proposal shaping. Fixed generic buckets per RESPONSE_SHAPE slot
// -- see file header. No content-dependent branching, no invented facts.
// ---------------------------------------------------------------------------

function makeOrdinalCounter() {
  const counts = new Map();
  return (key) => {
    const next = (counts.get(key) || 0);
    counts.set(key, next + 1);
    return next;
  };
}

function mintSubjectId(fields) {
  return contentId(SUBJECT_DOMAIN, fields);
}

function isNonEmptyLimbPath(value) {
  return Array.isArray(value) && value.length > 0 && value.every((label) => typeof label === 'string' && label.length > 0);
}

function evidenceForItemQualifier({ sourceBytes, limbs, governsPath, quote }) {
  if (!isNonEmptyLimbPath(governsPath) || typeof quote !== 'string' || quote.length === 0) return null;
  const targetPath = canonicalJson(governsPath);
  const spans = new Map();
  for (const limb of (Array.isArray(limbs) ? limbs : [])) {
    if (!limb || typeof limb.assertion_quote !== 'string'
      || canonicalJson(isNonEmptyLimbPath(limb.limb_path) ? limb.limb_path : null) !== targetPath) continue;
    for (const limbSpan of locateAllQuoteBytes(sourceBytes, limb.assertion_quote)) {
      for (const qualifierSpan of locateAllQuoteBytes(sourceBytes, quote)) {
        if (qualifierSpan.start >= limbSpan.start && qualifierSpan.end <= limbSpan.end) {
          spans.set(`${qualifierSpan.start}:${qualifierSpan.end}`, qualifierSpan);
        }
      }
    }
  }
  if (spans.size !== 1) return null;
  return evidenceFromSpan(quote, [...spans.values()][0]);
}

function evidenceForDerivedShareCount({ sourceBytes, governingLimbQuote, quote }) {
  if (typeof governingLimbQuote !== 'string' || governingLimbQuote.length === 0
    || typeof quote !== 'string' || quote.length === 0) return null;
  const spans = new Map();
  for (const limbSpan of locateAllQuoteBytes(sourceBytes, governingLimbQuote)) {
    for (const quoteSpan of locateAllQuoteBytes(sourceBytes, quote)) {
      if (quoteSpan.start >= limbSpan.start && quoteSpan.end <= limbSpan.end) {
        spans.set(`${quoteSpan.start}:${quoteSpan.end}`, quoteSpan);
      }
    }
  }
  if (spans.size !== 1) return null;
  return evidenceFromSpan(quote, [...spans.values()][0]);
}

function shapeRepresentationInstance(instance, sourceBytes, ordinalFor, dropCounter) {
  const proposals = [];
  if (!instance || typeof instance !== 'object') return proposals;
  const sectionReference = instance.section_reference ?? null;
  const partyMaking = instance.party_making ?? null;
  const subjectId = mintSubjectId({
    kind: 'REPRESENTATION_INSTANCE',
    section_reference: sectionReference,
    party_making: partyMaking,
    chapeau_quote: instance.chapeau_quote ?? null,
  });

  // Every limb's own path, in document order, captured up front so a
  // TRAILING qualifier's AMBIGUOUS decision-support `readings` (see
  // qualifier-attachment.js) can name every sibling limb without a second
  // pass over the response.
  const siblingLimbPaths = [];
  for (const limb of (Array.isArray(instance.limbs) ? instance.limbs : [])) {
    if (limb && isNonEmptyLimbPath(limb.limb_path)) siblingLimbPaths.push(limb.limb_path);
  }

  for (const limb of (Array.isArray(instance.limbs) ? instance.limbs : [])) {
    if (!limb || typeof limb !== 'object') continue;
    const limbPath = isNonEmptyLimbPath(limb.limb_path) ? limb.limb_path : null;

    const assertionEvidence = evidenceFromQuote(sourceBytes, limb.assertion_quote);
    if (assertionEvidence) {
      proposals.push({
        kind: 'claim',
        proposal_kind: 'GOVERNED',
        subject_occurrence_id: subjectId,
        claim_definition_key: LIMB_ASSERTION_CLAIM_KEY,
        claim_definition_version: 1,
        ordinal: ordinalFor(`${subjectId}:${LIMB_ASSERTION_CLAIM_KEY}`),
        state: 'PRESENT',
        raw_value: limb.assertion_quote,
        canonical_value: null,
        attributes: {
          section_reference: sectionReference,
          party_making: partyMaking,
          limb_path: limbPath,
          subject: limb.subject ?? null,
        },
        allowed_attributes: ['section_reference', 'party_making', 'limb_path', 'subject'],
        taxonomy_codes: {},
        codebooks: {},
        evidence: [assertionEvidence],
        extraction_version: RESPONSE_VERSION,
        normalisation_version: RESPONSE_VERSION,
        derivation_version: RESPONSE_VERSION,
      });
    } else if (limb.assertion_quote) {
      dropCounter.record('LIMB_ASSERTION_QUOTE_UNVERIFIED', limb.assertion_quote);
    }
  }

  // Qualifiers are a flat, representation-level list (not nested inside a
  // limb) precisely because attachment.governs_path already says everything
  // there is to say about which limb (if any) a qualifier modifies -- see
  // the file header and qualifier-attachment.js.
  for (const qualifier of (Array.isArray(instance.qualifiers) ? instance.qualifiers : [])) {
    if (!qualifier || typeof qualifier !== 'object') continue;
    const rawAttachment = qualifier.attachment;
    const position = rawAttachment && typeof rawAttachment === 'object' ? rawAttachment.position : null;
    if (!['CHAPEAU', 'ITEM', 'TRAILING'].includes(position)) {
      // A response that does not conform to the current attachment contract
      // (e.g. a stale recording from before PROMPT_VERSION 2, whose
      // `attachment` was a bare string) is never guessed at: the qualifier
      // is dropped as a typed residual, exactly like an unverifiable quote.
      dropCounter.record('QUALIFIER_ATTACHMENT_MALFORMED', qualifier.quote);
      continue;
    }

    const qualifierEvidence = position === 'ITEM'
      ? evidenceForItemQualifier({
        sourceBytes,
        limbs: instance.limbs,
        governsPath: rawAttachment.governs_path,
        quote: qualifier.quote,
      })
      : evidenceFromQuote(sourceBytes, qualifier.quote);
    if (!qualifierEvidence) {
      dropCounter.record(
        position === 'ITEM' ? 'QUALIFIER_GOVERNS_PATH_OCCURRENCE_AMBIGUOUS' : 'QUALIFIER_QUOTE_UNVERIFIED',
        qualifier.quote,
      );
      continue;
    }

    const resolvedAttachment = resolveQualifierAttachment({
      position,
      governs_path: rawAttachment.governs_path,
      quote_text: qualifier.quote,
      items_grammatically_parallel: rawAttachment.ambiguity_signals
        ? rawAttachment.ambiguity_signals.items_grammatically_parallel
        : null,
      comma_before_qualifier: commaPrecedesQuote(sourceBytes, qualifierEvidence.absolute_start),
      sibling_limb_paths: siblingLimbPaths,
    });

    const code = qualifier.code ?? null;
    proposals.push({
      kind: 'claim',
      proposal_kind: 'GOVERNED',
      subject_occurrence_id: subjectId,
      claim_definition_key: QUALIFIER_CLAIM_KEY,
      claim_definition_version: 1,
      ordinal: ordinalFor(`${subjectId}:${QUALIFIER_CLAIM_KEY}`),
      state: 'PRESENT',
      raw_value: qualifier.quote,
      canonical_value: code,
      attributes: {
        section_reference: sectionReference,
        party_making: partyMaking,
        qualifier_kind: qualifier.kind ?? null,
        attachment: resolvedAttachment,
      },
      allowed_attributes: [
        'section_reference', 'party_making', 'qualifier_kind', 'attachment',
      ],
      taxonomy_codes: code ? { qualifier_code: code } : {},
      codebooks: { qualifier_code: QUALIFIER_CODES },
      evidence: [qualifierEvidence],
      extraction_version: RESPONSE_VERSION,
      normalisation_version: RESPONSE_VERSION,
      derivation_version: RESPONSE_VERSION,
    });
  }
  return proposals;
}

function shapeBringDownCondition(condition, sourceBytes, ordinalFor, dropCounter) {
  const proposals = [];
  if (!condition || typeof condition !== 'object') return proposals;
  const sectionReference = condition.section_reference ?? null;
  const subjectId = mintSubjectId({
    kind: 'BRING_DOWN_CONDITION',
    section_reference: sectionReference,
    condition_obligor: condition.condition_obligor ?? null,
    beneficiary: condition.beneficiary ?? null,
    measurement_date_quote: condition.measurement_date_quote ?? null,
  });

  for (const tier of (Array.isArray(condition.tiers) ? condition.tiers : [])) {
    if (!tier || typeof tier !== 'object') continue;
    const tierEvidence = evidenceFromQuote(sourceBytes, tier.covered_scope_quote);
    if (!tierEvidence) {
      if (tier.covered_scope_quote) dropCounter.record('BRING_DOWN_TIER_QUOTE_UNVERIFIED', tier.covered_scope_quote);
      continue;
    }
    const accuracyStandard = tier.accuracy_standard ?? null;
    proposals.push({
      kind: 'claim',
      proposal_kind: 'GOVERNED',
      subject_occurrence_id: subjectId,
      claim_definition_key: BRING_DOWN_TIER_CLAIM_KEY,
      claim_definition_version: 1,
      ordinal: ordinalFor(`${subjectId}:${BRING_DOWN_TIER_CLAIM_KEY}`),
      state: 'PRESENT',
      raw_value: tier.covered_scope_quote,
      canonical_value: accuracyStandard,
      attributes: {
        section_reference: sectionReference,
        condition_obligor: condition.condition_obligor ?? null,
        beneficiary: condition.beneficiary ?? null,
        measurement_date_quote: condition.measurement_date_quote ?? null,
        covered_limb_references: Array.isArray(tier.covered_limb_references) ? tier.covered_limb_references : [],
      },
      allowed_attributes: [
        'section_reference', 'condition_obligor', 'beneficiary',
        'measurement_date_quote', 'covered_limb_references',
      ],
      taxonomy_codes: accuracyStandard ? { accuracy_standard: accuracyStandard } : {},
      codebooks: { accuracy_standard: ACCURACY_CODES },
      evidence: [tierEvidence],
      extraction_version: RESPONSE_VERSION,
      normalisation_version: RESPONSE_VERSION,
      derivation_version: RESPONSE_VERSION,
    });
  }
  return proposals;
}

function shapeOpenWorldCandidate(candidate, sourceBytes, ordinalFor, dropCounter) {
  if (!candidate || typeof candidate !== 'object') return null;
  const evidence = evidenceFromQuote(sourceBytes, candidate.observed_quote);
  if (!evidence) {
    if (candidate.observed_quote) dropCounter.record('OPEN_WORLD_QUOTE_UNVERIFIED', candidate.observed_quote);
    return null;
  }
  const subjectId = mintSubjectId({
    kind: 'OPEN_WORLD_CANDIDATE',
    observed_quote: candidate.observed_quote ?? null,
    why_unmapped: candidate.why_unmapped ?? null,
    structured_mechanic: candidate.structured_mechanic ?? null,
  });
  const attributes = {
    why_unmapped: candidate.why_unmapped ?? null,
    nearest_concept: candidate.nearest_concept ?? null,
    ...(typeof candidate.candidate_kind === 'string' && candidate.candidate_kind.length > 0
      ? { candidate_kind: candidate.candidate_kind }
      : {}),
    ...(typeof candidate.observed_category === 'string' && candidate.observed_category.length > 0
      ? { observed_category: candidate.observed_category }
      : {}),
    ...(candidate.structured_mechanic && typeof candidate.structured_mechanic === 'object'
      ? { structured_mechanic: candidate.structured_mechanic }
      : {}),
  };
  return {
    kind: 'claim',
    proposal_kind: 'OPEN_WORLD',
    subject_occurrence_id: subjectId,
    claim_definition_key: OPEN_WORLD_CLAIM_KEY,
    claim_definition_version: 1,
    ordinal: ordinalFor(`${subjectId}:${OPEN_WORLD_CLAIM_KEY}`),
    state: 'PRESENT',
    raw_value: candidate.observed_quote,
    canonical_value: null,
    attributes,
    allowed_attributes: Object.keys(attributes),
    taxonomy_codes: {},
    codebooks: {},
    evidence: [evidence],
    extraction_version: RESPONSE_VERSION,
    normalisation_version: RESPONSE_VERSION,
    derivation_version: RESPONSE_VERSION,
  };
}

function shapeIocMechanic(mechanic, sourceBytes, ordinalFor, dropCounter) {
  if (!mechanic || typeof mechanic !== 'object') return null;
  const surface = IOC_REMAINING_SURFACES.includes(mechanic.surface)
    ? mechanic.surface : 'UNCLASSIFIED_SURFACE';
  const attachment = ['RESTRICTION_LIMB', 'PARENT_COVENANT'].includes(mechanic.attachment_scope)
    ? mechanic.attachment_scope : null;
  const exact = (value) => (
    typeof value === 'string' && value.length > 0 && mechanic.quote?.includes(value)
      ? value : null
  );
  const operandFields = [
    'target_restriction_quote', 'value_literal', 'unit_literal', 'basis_literal', 'period_literal',
  ];
  const unverifiedOperandFields = operandFields.filter((field) => (
    typeof mechanic[field] === 'string' && mechanic[field].length > 0 && exact(mechanic[field]) === null
  ));
  const shape = {
    section_reference: mechanic.section_reference ?? null,
    attachment_scope: attachment,
    target_restriction_quote: exact(mechanic.target_restriction_quote),
    value_literal: exact(mechanic.value_literal),
    unit_literal: exact(mechanic.unit_literal),
    basis_literal: exact(mechanic.basis_literal),
    period_literal: exact(mechanic.period_literal),
    unverified_operand_fields: unverifiedOperandFields,
  };
  return shapeOpenWorldCandidate({
    observed_quote: mechanic.quote,
    why_unmapped: `${surface}: ${mechanic.detail || 'IOC mechanism observed'} | ${JSON.stringify(shape)}`,
    nearest_concept: null,
    structured_mechanic: Object.freeze({ surface, ...shape }),
  }, sourceBytes, ordinalFor, dropCounter);
}

function shapeObservedMechanicProposals({ parsed, sourceText, listKey, surfaces, fallbackDetail }) {
  const sourceBytes = Buffer.from(sourceText, 'utf8');
  const ordinalFor = makeOrdinalCounter();
  const dropped = [];
  const dropCounter = {
    record(reason, quote) {
      dropped.push({ reason, quote_preview: String(quote).slice(0, 120) });
    },
  };
  const proposals = [];
  for (const item of (Array.isArray(parsed[listKey]) ? parsed[listKey] : [])) {
    const surface = surfaces.includes(item?.surface) ? item.surface : 'UNCLASSIFIED_SURFACE';
    const proposal = shapeOpenWorldCandidate({
      observed_quote: item?.quote,
      why_unmapped: `${surface}: ${item?.detail || fallbackDetail}`,
      nearest_concept: null,
    }, sourceBytes, ordinalFor, dropCounter);
    if (proposal) proposals.push(proposal);
  }
  for (const item of (Array.isArray(parsed.open_world_candidates) ? parsed.open_world_candidates : [])) {
    const proposal = shapeOpenWorldCandidate(item, sourceBytes, ordinalFor, dropCounter);
    if (proposal) proposals.push(proposal);
  }
  return { proposals, evidence_residuals: dropped };
}

function combineShapedProposalOutputs(...outputs) {
  return {
    proposals: outputs.flatMap((output) => output.proposals),
    evidence_residuals: outputs.flatMap((output) => output.evidence_residuals),
  };
}

function shapeGovernedAndObservedMechanics({
  parsed,
  sourceText,
  governedShaper,
  observedShaper,
}) {
  const governed = governedShaper({ ...parsed, open_world_candidates: [] }, sourceText);
  const observed = observedShaper(parsed, sourceText);
  return combineShapedProposalOutputs(governed, observed);
}

function shapeFinancingGuarantyProposals(
  parsed,
  sourceText,
  fallbackDetail = 'financing mechanism observed',
) {
  return shapeObservedMechanicProposals({
    parsed, sourceText, listKey: 'financing_mechanics', surfaces: FINANCING_SURFACES,
    fallbackDetail,
  });
}

function shapeFinancingAssertion(assertion, sourceBytes, ordinalFor, dropCounter) {
  if (!assertion || typeof assertion !== 'object') return null;
  const evidence = evidenceFromQuote(sourceBytes, assertion.quote);
  if (!evidence) {
    if (assertion.quote) dropCounter.record('FINANCING_QUOTE_UNVERIFIED', assertion.quote);
    return null;
  }
  const attrs = {
    section_reference: assertion.section_reference ?? null,
    assertion_kind: assertion.assertion_kind ?? null,
    financing_kind: assertion.financing_kind ?? null,
    standard_code: assertion.standard_code ?? null,
    obligor: assertion.obligor ?? null,
    day_kind: assertion.day_kind ?? null,
    delivery_stage: assertion.delivery_stage ?? null,
    deliverable_term: assertion.deliverable_term ?? null,
    marketing_term: assertion.marketing_term ?? null,
  };
  const subjectId = mintSubjectId({ kind: 'FINANCING_ASSERTION', ...attrs, quote: assertion.quote });
  return {
    kind: 'claim', proposal_kind: FINANCING_COVENANT_PROPOSAL_KIND,
    subject_occurrence_id: subjectId, claim_definition_key: FINANCING_COVENANT_CLAIM_KEY,
    claim_definition_version: 1, ordinal: ordinalFor(`${subjectId}:${FINANCING_COVENANT_CLAIM_KEY}`),
    state: 'PRESENT', raw_value: assertion.quote, canonical_value: null, attributes: attrs,
    allowed_attributes: Object.keys(attrs), taxonomy_codes: {}, codebooks: {}, evidence: [evidence],
    extraction_version: RESPONSE_VERSION, normalisation_version: RESPONSE_VERSION, derivation_version: RESPONSE_VERSION,
  };
}

function shapeGuarantyAssertion(assertion, sourceBytes, ordinalFor, dropCounter) {
  if (!assertion || typeof assertion !== 'object') return null;
  const evidence = evidenceFromQuote(sourceBytes, assertion.quote);
  if (!evidence) {
    if (assertion.quote) dropCounter.record('GUARANTY_QUOTE_UNVERIFIED', assertion.quote);
    return null;
  }
  const attrs = {
    section_reference: assertion.section_reference ?? null,
    assertion_kind: assertion.assertion_kind ?? null,
    guarantor_ref: assertion.guarantor_ref ?? null,
    obligor_ref: assertion.obligor_ref ?? null,
  };
  const subjectId = mintSubjectId({ kind: 'GUARANTY_ASSERTION', ...attrs, quote: assertion.quote });
  return {
    kind: 'claim', proposal_kind: GUARANTY_PROPOSAL_KIND,
    subject_occurrence_id: subjectId, claim_definition_key: GUARANTY_CLAIM_KEY,
    claim_definition_version: 1, ordinal: ordinalFor(`${subjectId}:${GUARANTY_CLAIM_KEY}`),
    state: 'PRESENT', raw_value: assertion.quote, canonical_value: null, attributes: attrs,
    allowed_attributes: Object.keys(attrs), taxonomy_codes: {}, codebooks: {}, evidence: [evidence],
    extraction_version: RESPONSE_VERSION, normalisation_version: RESPONSE_VERSION, derivation_version: RESPONSE_VERSION,
  };
}

function shapeGovernedFinancingProposals(parsed, sourceText) {
  const sourceBytes = Buffer.from(sourceText, 'utf8'); const ordinalFor = makeOrdinalCounter(); const dropped = [];
  const dropCounter = { record(reason, quote) { dropped.push({ reason, quote_preview: String(quote).slice(0, 120) }); } };
  const proposals = [];
  for (const assertion of (Array.isArray(parsed.financing_assertions) ? parsed.financing_assertions : [])) {
    const proposal = shapeFinancingAssertion(assertion, sourceBytes, ordinalFor, dropCounter);
    if (proposal) proposals.push(proposal);
  }
  for (const candidate of (Array.isArray(parsed.open_world_candidates) ? parsed.open_world_candidates : [])) {
    const proposal = shapeOpenWorldCandidate(candidate, sourceBytes, ordinalFor, dropCounter);
    if (proposal) proposals.push(proposal);
  }
  return { proposals, evidence_residuals: dropped };
}

function shapeGovernedGuarantyProposals(parsed, sourceText) {
  const sourceBytes = Buffer.from(sourceText, 'utf8'); const ordinalFor = makeOrdinalCounter(); const dropped = [];
  const dropCounter = { record(reason, quote) { dropped.push({ reason, quote_preview: String(quote).slice(0, 120) }); } };
  const proposals = [];
  for (const assertion of (Array.isArray(parsed.guaranty_assertions) ? parsed.guaranty_assertions : [])) {
    const proposal = shapeGuarantyAssertion(assertion, sourceBytes, ordinalFor, dropCounter);
    if (proposal) proposals.push(proposal);
  }
  for (const candidate of (Array.isArray(parsed.open_world_candidates) ? parsed.open_world_candidates : [])) {
    const proposal = shapeOpenWorldCandidate(candidate, sourceBytes, ordinalFor, dropCounter);
    if (proposal) proposals.push(proposal);
  }
  return { proposals, evidence_residuals: dropped };
}

function shapeFinancingFamilyProposals(parsed, sourceText) {
  return shapeGovernedAndObservedMechanics({
    parsed,
    sourceText,
    governedShaper: shapeGovernedFinancingProposals,
    observedShaper: (observedParsed, observedSourceText) => shapeFinancingGuarantyProposals(
      observedParsed,
      observedSourceText,
      'financing mechanism observed',
    ),
  });
}

function shapeGuarantyFamilyProposals(parsed, sourceText) {
  return shapeGovernedAndObservedMechanics({
    parsed,
    sourceText,
    governedShaper: shapeGovernedGuarantyProposals,
    observedShaper: (observedParsed, observedSourceText) => shapeFinancingGuarantyProposals(
      observedParsed,
      observedSourceText,
      'guaranty or financing-party mechanism observed',
    ),
  });
}

function shapeEmployeeDnoProposals(
  parsed,
  sourceText,
  fallbackDetail = 'employee or D&O mechanism observed',
) {
  return shapeObservedMechanicProposals({
    parsed, sourceText, listKey: 'employee_dno_mechanics', surfaces: EMPLOYEE_DNO_SURFACES,
    fallbackDetail,
  });
}

function shapeEmployeeDnoAssertion(assertion, sourceBytes, ordinalFor, dropCounter, type) {
  if (!assertion || typeof assertion !== 'object') return null;
  const evidence = evidenceFromQuote(sourceBytes, assertion.quote);
  if (!evidence) { if (assertion.quote) dropCounter.record(`${type}_QUOTE_UNVERIFIED`, assertion.quote); return null; }
  const keys = type === 'EMPLOYEE' ? ['section_reference', 'assertion_kind', 'comp_item', 'standard_kind', 'aggregation', 'benchmark', 'period_term', 'relief_kind'] : ['section_reference', 'assertion_kind', 'cap_basis', 'cap_term', 'schedule_reference_phrase'];
  const attrs = Object.fromEntries(keys.map((key) => [key, assertion[key] ?? null]));
  const claimKey = type === 'EMPLOYEE' ? EMPLOYEE_MATTERS_CLAIM_KEY : DNO_CLAIM_KEY;
  const proposalKind = type === 'EMPLOYEE' ? EMPLOYEE_MATTERS_PROPOSAL_KIND : DNO_PROPOSAL_KIND;
  const subjectId = mintSubjectId({ kind: `${type}_ASSERTION`, ...attrs, quote: assertion.quote });
  return { kind: 'claim', proposal_kind: proposalKind, subject_occurrence_id: subjectId, claim_definition_key: claimKey, claim_definition_version: 1, ordinal: ordinalFor(`${subjectId}:${claimKey}`), state: 'PRESENT', raw_value: assertion.quote, canonical_value: null, attributes: attrs, allowed_attributes: Object.keys(attrs), taxonomy_codes: {}, codebooks: {}, evidence: [evidence], extraction_version: RESPONSE_VERSION, normalisation_version: RESPONSE_VERSION, derivation_version: RESPONSE_VERSION };
}

function shapeGovernedEmployeeMattersProposals(parsed, sourceText) {
  const sourceBytes = Buffer.from(sourceText, 'utf8'); const ordinalFor = makeOrdinalCounter(); const dropped = []; const dropCounter = { record(reason, quote) { dropped.push({ reason, quote_preview: String(quote).slice(0, 120) }); } };
  const proposals = (Array.isArray(parsed.employee_matters_assertions) ? parsed.employee_matters_assertions : []).map((entry) => shapeEmployeeDnoAssertion(entry, sourceBytes, ordinalFor, dropCounter, 'EMPLOYEE')).filter(Boolean);
  return { proposals, evidence_residuals: dropped };
}

function shapeGovernedDnoProposals(parsed, sourceText) {
  const sourceBytes = Buffer.from(sourceText, 'utf8'); const ordinalFor = makeOrdinalCounter(); const dropped = []; const dropCounter = { record(reason, quote) { dropped.push({ reason, quote_preview: String(quote).slice(0, 120) }); } };
  const proposals = (Array.isArray(parsed.dno_assertions) ? parsed.dno_assertions : []).map((entry) => shapeEmployeeDnoAssertion(entry, sourceBytes, ordinalFor, dropCounter, 'DNO')).filter(Boolean);
  return { proposals, evidence_residuals: dropped };
}

function shapeEmployeeMattersFamilyProposals(parsed, sourceText) {
  return shapeGovernedAndObservedMechanics({
    parsed,
    sourceText,
    governedShaper: shapeGovernedEmployeeMattersProposals,
    observedShaper: (observedParsed, observedSourceText) => shapeEmployeeDnoProposals(
      observedParsed,
      observedSourceText,
      'employee mechanism observed',
    ),
  });
}

function shapeDnoFamilyProposals(parsed, sourceText) {
  return shapeGovernedAndObservedMechanics({
    parsed,
    sourceText,
    governedShaper: shapeGovernedDnoProposals,
    observedShaper: (observedParsed, observedSourceText) => shapeEmployeeDnoProposals(
      observedParsed,
      observedSourceText,
      'D&O mechanism observed',
    ),
  });
}

function shapeTaxDividendAppraisalProposals(
  parsed,
  sourceText,
  fallbackDetail = 'mechanism observed',
) {
  return shapeObservedMechanicProposals({
    parsed, sourceText, listKey: 'mechanics', surfaces: TAX_DIVIDEND_APPRAISAL_SURFACES,
    fallbackDetail,
  });
}

function shapePresenceAssertions({ parsed, sourceText, listKey, claimKey, proposalKind, allowedKinds, subjectKind }) {
  const sourceBytes = Buffer.from(sourceText, 'utf8'); const ordinalFor = makeOrdinalCounter(); const dropped = [];
  const dropCounter = { record(reason, quote) { dropped.push({ reason, quote_preview: String(quote).slice(0, 120) }); } }; const proposals = [];
  for (const assertion of (Array.isArray(parsed[listKey]) ? parsed[listKey] : [])) {
    const evidence = evidenceFromQuote(sourceBytes, assertion?.quote); if (!evidence) { if (assertion?.quote) dropCounter.record(`${proposalKind}_QUOTE_UNVERIFIED`, assertion.quote); continue; }
    const assertionKind = assertion.assertion_kind ?? assertion.surface ?? null; const subjectId = mintSubjectId({ kind: subjectKind, assertion_kind: assertionKind, quote: assertion.quote });
    proposals.push({ kind: 'claim', proposal_kind: proposalKind, subject_occurrence_id: subjectId, claim_definition_key: claimKey, claim_definition_version: 1, ordinal: ordinalFor(`${subjectId}:${claimKey}`), state: 'PRESENT', raw_value: assertion.quote, canonical_value: true, attributes: { assertion_kind: assertionKind }, allowed_attributes: ['assertion_kind'], taxonomy_codes: allowedKinds.includes(assertionKind) ? { assertion_kind: assertionKind } : {}, codebooks: { assertion_kind: allowedKinds }, evidence: [evidence], extraction_version: RESPONSE_VERSION, normalisation_version: RESPONSE_VERSION, derivation_version: RESPONSE_VERSION });
  }
  for (const candidate of (Array.isArray(parsed.open_world_candidates) ? parsed.open_world_candidates : [])) { const proposal = shapeOpenWorldCandidate(candidate, sourceBytes, ordinalFor, dropCounter); if (proposal) proposals.push(proposal); }
  return { proposals, evidence_residuals: dropped };
}

function sourceHasSpecificPerformanceOperativePremise(sourceText) {
  return typeof sourceText === 'string'
    && /\birreparable (?:harm|damage)\b/i.test(sourceText)
    && /\b(?:money|monetary) damages\b[\s\S]{0,180}\bnot be an adequate remedy\b/i.test(sourceText);
}

function isIncompleteSpecificPerformanceGrant(assertion, sourceText) {
  if (!assertion || assertion.assertion_kind !== 'SPECIFIC_PERFORMANCE' || typeof assertion.quote !== 'string') return false;
  const operativeGrant = /\bshall be entitled to\b[\s\S]{0,160}\b(?:injunction|specific performance|equitable relief)\b/i.test(assertion.quote);
  if (!operativeGrant) return false;
  if (!sourceHasSpecificPerformanceOperativePremise(sourceText)) return false;
  return !(/\birreparable harm would occur\b/i.test(assertion.quote)
    && /\bmoney damages would not be an adequate remedy\b/i.test(assertion.quote));
}

function shapeSpecificPerformanceRemedyProposals(parsed, sourceText) {
  const assertions = Array.isArray(parsed.remedy_assertions) ? parsed.remedy_assertions : [];
  const incompleteGrants = assertions.filter((assertion) => isIncompleteSpecificPerformanceGrant(assertion, sourceText));
  const shaped = shapePresenceAssertions({
    parsed: {
      ...parsed,
      remedy_assertions: assertions.filter((assertion) => !isIncompleteSpecificPerformanceGrant(assertion, sourceText)),
    },
    sourceText,
    listKey: 'remedy_assertions',
    claimKey: SPECIFIC_PERFORMANCE_REMEDY_CLAIM_KEY,
    proposalKind: SPECIFIC_PERFORMANCE_REMEDY_PROPOSAL_KIND,
    allowedKinds: SPECIFIC_PERFORMANCE_ASSERTION_KINDS,
    subjectKind: 'SPECIFIC_PERFORMANCE_REMEDY',
  });
  return {
    ...shaped,
    evidence_residuals: [
      ...shaped.evidence_residuals,
      ...incompleteGrants.map((assertion) => ({
        reason: 'SPECIFIC_PERFORMANCE_OPERATIVE_PREMISE_UNVERIFIED',
        quote_preview: assertion.quote.slice(0, 120),
      })),
    ],
  };
}
function shapeMiscBoilerplateProposals(parsed, sourceText) {
  const governed = shapePresenceAssertions({
    parsed: {
      boilerplate_assertions: parsed.boilerplate_assertions,
      open_world_candidates: [],
    },
    sourceText,
    listKey: 'boilerplate_assertions',
    claimKey: MISC_BOILERPLATE_CLAIM_KEY,
    proposalKind: MISC_BOILERPLATE_PROPOSAL_KIND,
    allowedKinds: MISC_ASSERTION_KINDS,
    subjectKind: 'MISC_BOILERPLATE',
  });
  const observed = shapeRemediesMiscProposals(parsed, sourceText);
  return combineShapedProposalOutputs(governed, observed);
}

function shapeGovernedTdaAssertions(parsed, sourceText, listKey, claimKey, proposalKind) {
  const sourceBytes = Buffer.from(sourceText, 'utf8'); const ordinalFor = makeOrdinalCounter(); const dropped = [];
  const assertions = Array.isArray(parsed[listKey]) ? parsed[listKey] : [];
  const proposals = assertions.map((assertion) => {
    const evidence = evidenceFromQuote(sourceBytes, assertion?.quote);
    if (!evidence) { if (assertion?.quote) dropped.push({ reason: `${proposalKind}_QUOTE_UNVERIFIED`, quote_preview: String(assertion.quote).slice(0, 120) }); return null; }
    const attributes = Object.fromEntries(['section_reference', 'assertion_kind', 'treatment_scope_ref', 'treatment_term_ref', 'tax_opinion_ref', 'representation_letter_ref', 'bearer_ref', 'dividend_term_ref', 'statute_ref'].map((key) => [key, assertion[key] ?? null]));
    const subject_occurrence_id = mintSubjectId({ kind: `${proposalKind}_ASSERTION`, ...attributes, quote: assertion.quote });
    return { kind: 'claim', proposal_kind: proposalKind, subject_occurrence_id, claim_definition_key: claimKey, claim_definition_version: 1, ordinal: ordinalFor(`${subject_occurrence_id}:${claimKey}`), state: 'PRESENT', raw_value: assertion.quote, canonical_value: null, attributes, allowed_attributes: Object.keys(attributes), taxonomy_codes: {}, codebooks: {}, evidence: [evidence], extraction_version: RESPONSE_VERSION, normalisation_version: RESPONSE_VERSION, derivation_version: RESPONSE_VERSION };
  }).filter(Boolean);
  return { proposals, evidence_residuals: dropped };
}
function shapeGovernedTaxMattersProposals(parsed, sourceText) { return shapeGovernedTdaAssertions(parsed, sourceText, 'tax_assertions', TAX_MATTERS_CLAIM_KEY, 'TAX_MATTERS'); }
function shapeGovernedDividendsProposals(parsed, sourceText) { return shapeGovernedTdaAssertions(parsed, sourceText, 'dividend_assertions', DIVIDENDS_CLAIM_KEY, 'DIVIDENDS'); }
function shapeGovernedAppraisalProposals(parsed, sourceText) { return shapeGovernedTdaAssertions(parsed, sourceText, 'appraisal_assertions', APPRAISAL_CLAIM_KEY, 'APPRAISAL'); }

function shapeTaxMattersFamilyProposals(parsed, sourceText) {
  return shapeGovernedAndObservedMechanics({ parsed, sourceText, governedShaper: shapeGovernedTaxMattersProposals, observedShaper: (observedParsed, observedSourceText) => shapeTaxDividendAppraisalProposals(observedParsed, observedSourceText, 'tax mechanism observed') });
}
function shapeDividendsFamilyProposals(parsed, sourceText) {
  return shapeGovernedAndObservedMechanics({ parsed, sourceText, governedShaper: shapeGovernedDividendsProposals, observedShaper: (observedParsed, observedSourceText) => shapeTaxDividendAppraisalProposals(observedParsed, observedSourceText, 'dividend mechanism observed') });
}
function shapeAppraisalFamilyProposals(parsed, sourceText) {
  return shapeGovernedAndObservedMechanics({ parsed, sourceText, governedShaper: shapeGovernedAppraisalProposals, observedShaper: (observedParsed, observedSourceText) => shapeTaxDividendAppraisalProposals(observedParsed, observedSourceText, 'appraisal mechanism observed') });
}

function shapeRemediesMiscProposals(
  parsed,
  sourceText,
  fallbackDetail = 'remedies or boilerplate mechanism observed',
) {
  return shapeObservedMechanicProposals({
    parsed, sourceText, listKey: 'mechanics', surfaces: REMEDIES_MISC_SURFACES,
    fallbackDetail,
  });
}

function shapeKeyTermsMaeFollowOnProposals(
  parsed,
  sourceText,
  fallbackDetail = 'defined term or MAE mechanism observed',
) {
  return shapeObservedMechanicProposals({
    parsed, sourceText, listKey: 'mechanics', surfaces: KEY_TERMS_MAE_SURFACES,
    fallbackDetail,
  });
}

function shapeDefinedTermsFamilyProposals(parsed, sourceText) {
  return shapeGovernedAndObservedMechanics({
    parsed,
    sourceText,
    governedShaper: shapeDefinedTermsProposals,
    observedShaper: shapeKeyTermsMaeFollowOnProposals,
  });
}

function shapeMergerStructureProposals(parsed, sourceText) {
  return shapeGovernedAndObservedMechanics({
    parsed,
    sourceText,
    governedShaper: (governedParsed, governedSourceText) => shapePresenceAssertions({
      parsed: governedParsed,
      sourceText: governedSourceText,
      listKey: 'structure_assertions',
      claimKey: MERGER_STRUCTURE_CLAIM_KEY,
      proposalKind: MERGER_STRUCTURE_PROPOSAL_KIND,
      allowedKinds: STRUCTURE_SURFACES,
      subjectKind: 'MERGER_STRUCTURE',
    }),
    observedShaper: (observedParsed, observedSourceText) => shapeObservedMechanicProposals({
      parsed: observedParsed,
      sourceText: observedSourceText,
      listKey: 'structure_mechanics',
      surfaces: STRUCTURE_SURFACES,
      fallbackDetail: 'merger structure or closing mechanism observed',
    }),
  });
}

function settledTerminationMechanic(surface, mechanic) {
  const common = {
    surface,
    section_reference: mechanic.section_reference ?? null,
  };
  if (surface === 'OUTSIDE_DATE_EXTENSION') {
    return {
      ...common,
      extension_mode: mechanic.extension_mode ?? null,
      electing_party: mechanic.electing_party ?? null,
      consent_requirement_quote: mechanic.consent_requirement_quote ?? null,
      trigger_quote: mechanic.trigger_quote ?? null,
      maximum_exercises: mechanic.maximum_exercises ?? null,
      extension_period_quote: mechanic.extension_period_quote ?? null,
    };
  }
  if (surface === 'RESTRAINT_FINALITY') {
    return {
      ...common,
      finality_terms_present: Array.isArray(mechanic.finality_terms_present)
        ? mechanic.finality_terms_present : [],
      other_finality_terms: Array.isArray(mechanic.other_finality_terms)
        ? mechanic.other_finality_terms : [],
    };
  }
  if (surface === 'SOLE_REMEDY') {
    return {
      ...common,
      surface: 'SOLE_REMEDY_EVIDENCE',
      owner_family: 'SPECIFIC_PERFORMANCE_REMEDIES',
      payment_context_quote: mechanic.payment_context_quote ?? null,
      remedy_effect_quote: mechanic.remedy_effect_quote ?? null,
      carve_outs: Array.isArray(mechanic.carve_outs) ? mechanic.carve_outs : [],
    };
  }
  if (surface === 'TAIL_FEE_STRUCTURE') {
    return {
      ...common,
      period_quote: mechanic.period_quote ?? null,
      arming_event_quote: mechanic.arming_event_quote ?? null,
      qualifying_transaction_quote: mechanic.qualifying_transaction_quote ?? null,
      threshold_quote: mechanic.threshold_quote ?? null,
      same_proposal_requirement_quote: mechanic.same_proposal_requirement_quote ?? null,
    };
  }
  if (surface === 'LATE_PAYMENT_INTEREST') {
    return {
      ...common,
      interest_present: true,
      benchmark_quote: mechanic.benchmark_quote ?? null,
      due_date_reference_quote: mechanic.due_date_reference_quote ?? null,
    };
  }
  return { ...common };
}

function explicitClauseCrossReference(mechanic) {
  const reference = typeof mechanic?.related_clause_reference === 'string'
    ? mechanic.related_clause_reference.trim() : '';
  const quote = typeof mechanic?.cross_reference_quote === 'string'
    ? mechanic.cross_reference_quote.trim() : '';
  const source = typeof mechanic?.quote === 'string' ? mechanic.quote : '';
  // A clause link is evidence, not an inference.  Keep it only when both
  // the asserted reference and the quoted reference are present in this
  // clause's own verified text.
  if (!reference || !quote || !source.includes(reference) || !source.includes(quote)) return null;
  return { clause_reference: reference, quote };
}

function shapeWaveBMechanics(mechanics, surfaces, sourceBytes, ordinalFor, dropCounter) {
  if (!Array.isArray(mechanics)) return [];
  return mechanics.map((mechanic) => {
    if (!mechanic || typeof mechanic !== 'object') return null;
    const surface = surfaces.includes(mechanic.surface)
      ? mechanic.surface
      : 'UNCLASSIFIED_SURFACE';
    const baseMechanic = settledTerminationMechanic(surface, mechanic);
    const crossReference = explicitClauseCrossReference(mechanic);
    const structuredMechanic = crossReference
      ? { ...baseMechanic, explicit_clause_cross_reference: crossReference }
      : baseMechanic;
    const routedSurface = structuredMechanic.surface;
    return shapeOpenWorldCandidate({
      observed_quote: mechanic.quote,
      why_unmapped: `${routedSurface}: ${mechanic.detail || 'deferred mechanism observed'}`,
      nearest_concept: null,
      structured_mechanic: structuredMechanic,
    }, sourceBytes, ordinalFor, dropCounter);
  }).filter(Boolean);
}

// P1 cap-table numeric promotions (spec section 3): mechanical, structural
// shaping only -- exactly like shapeOpenWorldCandidate, no content-dependent
// branching. count_kind enum membership, corroboration, attribute
// verbatim-ness, and the actual number parse are ALL resolver-stage
// concerns (candidate-resolution.js); this function's only job is to turn
// one response-array entry into one typed, evidenced proposal, or drop it
// as a residual when its quote cannot be byte-verified.
function shapeShareCountAssertion(assertion, sourceBytes, ordinalFor, dropCounter) {
  if (!assertion || typeof assertion !== 'object') return null;
  const derivedFromLimb = typeof assertion.governing_limb_quote === 'string';
  const evidence = derivedFromLimb
    ? evidenceForDerivedShareCount({
      sourceBytes,
      governingLimbQuote: assertion.governing_limb_quote,
      quote: assertion.quote,
    })
    : evidenceFromQuote(sourceBytes, assertion.quote);
  if (!evidence) {
    if (assertion.quote) dropCounter.record(
      derivedFromLimb
        ? 'SHARE_COUNT_GOVERNED_LIMB_OCCURRENCE_AMBIGUOUS'
        : 'SHARE_COUNT_QUOTE_UNVERIFIED',
      assertion.quote,
    );
    return null;
  }
  const sectionReference = assertion.section_reference ?? null;
  const partyMaking = assertion.party_making ?? null;
  const countKind = assertion.count_kind ?? null;
  const limbPath = isNonEmptyLimbPath(assertion.limb_path) ? assertion.limb_path : null;
  const subjectId = mintSubjectId({
    kind: 'SHARE_COUNT_ASSERTION',
    section_reference: sectionReference,
    party_making: partyMaking,
    count_kind: countKind,
    share_class: assertion.share_class ?? null,
    plan: assertion.plan ?? null,
    quote: assertion.quote ?? null,
  });
  return {
    kind: 'claim',
    proposal_kind: SHARE_COUNT_PROPOSAL_KIND,
    subject_occurrence_id: subjectId,
    claim_definition_key: SHARE_COUNT_CLAIM_KEY,
    claim_definition_version: 1,
    ordinal: ordinalFor(`${subjectId}:${SHARE_COUNT_CLAIM_KEY}`),
    state: 'PRESENT',
    raw_value: assertion.quote,
    canonical_value: null,
    attributes: {
      section_reference: sectionReference,
      party_making: partyMaking,
      count_kind: countKind,
      share_class_ref: assertion.share_class ?? null,
      plan_ref: assertion.plan ?? null,
      limb_path: limbPath,
    },
    allowed_attributes: [
      'section_reference', 'party_making', 'count_kind', 'share_class_ref', 'plan_ref', 'limb_path',
    ],
    taxonomy_codes: countKind && SHARE_COUNT_KINDS.includes(countKind) ? { count_kind: countKind } : {},
    codebooks: { count_kind: SHARE_COUNT_KINDS },
    evidence: [evidence],
    extraction_version: RESPONSE_VERSION,
    normalisation_version: RESPONSE_VERSION,
    derivation_version: RESPONSE_VERSION,
  };
}

function deriveZeroShareCountAssertions(representationInstances) {
  const derived = [];

  for (const instance of (Array.isArray(representationInstances) ? representationInstances : [])) {
    if (!instance || typeof instance !== 'object') continue;
    for (const limb of (Array.isArray(instance.limbs) ? instance.limbs : [])) {
      if (!limb || typeof limb !== 'object' || typeof limb.assertion_quote !== 'string') continue;
      const shared = {
        section_reference: instance.section_reference ?? null,
        party_making: instance.party_making ?? null,
        count_kind: 'ISSUED_OUTSTANDING',
        plan: null,
        limb_path: isNonEmptyLimbPath(limb.limb_path) ? limb.limb_path : null,
        governing_limb_quote: limb.assertion_quote,
      };
      const noShares = /\bno\s+shares\s+of\s+([^.;]+?)\s+were\s+issued\s+and\s+outstanding\b/i.exec(limb.assertion_quote);
      if (noShares) {
        derived.push({
          ...shared,
          share_class: noShares[1],
          quote: noShares[0],
        });
      }
      const noneOutstanding = /\bshares\s+of\s+([^,.;]+(?:,\s*par\s+value\s+\$\d+(?:\.\d+)?\s+per\s+share)?),\s*(none\s+of\s+which\s+were\s+outstanding\b[^.;]*)/i.exec(limb.assertion_quote);
      if (noneOutstanding) {
        derived.push({
          ...shared,
          share_class: noneOutstanding[1],
          quote: noneOutstanding[0],
        });
      }
    }
  }

  return derived;
}

function shareCountProposalIdentity(proposal) {
  const evidence = Array.isArray(proposal?.evidence) ? proposal.evidence[0] : null;
  const attrs = proposal?.attributes || {};
  if (!evidence || !Number.isSafeInteger(evidence.absolute_start)
    || !Number.isSafeInteger(evidence.absolute_end)) return null;
  return canonicalJson({
    absolute_start: evidence.absolute_start,
    absolute_end: evidence.absolute_end,
    count_kind: attrs.count_kind ?? null,
    share_class_ref: attrs.share_class_ref ?? null,
  });
}

// Termination-fee family shaping functions (spec section 3): mechanical,
// structural shaping only -- exactly like shapeShareCountAssertion above,
// no content-dependent branching. fee_side/trigger_code enum membership,
// corroboration, attribute verbatim-ness (fee_term_ref/payer_party), and
// the actual amount/period parse are ALL resolver-stage concerns
// (candidate-resolution.js); each function's only job is to turn one
// termination-fee-producer-prompt.js response-array entry into one typed,
// evidenced proposal, or drop it as a residual when its quote cannot be
// byte-verified.

function shapeFeeAmountAssertion(assertion, sourceBytes, ordinalFor, dropCounter) {
  if (!assertion || typeof assertion !== 'object') return null;
  const evidence = evidenceFromQuote(sourceBytes, assertion.quote);
  if (!evidence) {
    if (assertion.quote) dropCounter.record('FEE_AMOUNT_QUOTE_UNVERIFIED', assertion.quote);
    return null;
  }
  const sectionReference = assertion.section_reference ?? null;
  const feeSide = assertion.fee_side ?? null;
  const payerParty = assertion.payer_party ?? null;
  const feeTermRef = assertion.fee_term_ref ?? null;
  const subjectId = mintSubjectId({
    kind: 'FEE_AMOUNT_ASSERTION',
    section_reference: sectionReference,
    fee_side: feeSide,
    payer_party: payerParty,
    fee_term_ref: feeTermRef,
    quote: assertion.quote ?? null,
  });
  return {
    kind: 'claim',
    proposal_kind: FEE_AMOUNT_PROPOSAL_KIND,
    subject_occurrence_id: subjectId,
    claim_definition_key: FEE_AMOUNT_CLAIM_KEY,
    claim_definition_version: 1,
    ordinal: ordinalFor(`${subjectId}:${FEE_AMOUNT_CLAIM_KEY}`),
    state: 'PRESENT',
    raw_value: assertion.quote,
    canonical_value: null,
    attributes: {
      section_reference: sectionReference,
      fee_side: feeSide,
      payer_party: payerParty,
      fee_term_ref: feeTermRef,
    },
    allowed_attributes: ['section_reference', 'fee_side', 'payer_party', 'fee_term_ref'],
    taxonomy_codes: feeSide && FEE_SIDES.includes(feeSide) ? { fee_side: feeSide } : {},
    codebooks: { fee_side: FEE_SIDES },
    evidence: [evidence],
    extraction_version: RESPONSE_VERSION,
    normalisation_version: RESPONSE_VERSION,
    derivation_version: RESPONSE_VERSION,
  };
}

function shapeFeeTriggerAssertion(assertion, sourceBytes, ordinalFor, dropCounter) {
  if (!assertion || typeof assertion !== 'object') return null;
  const evidence = evidenceFromQuote(sourceBytes, assertion.quote);
  if (!evidence) {
    if (assertion.quote) dropCounter.record('FEE_TRIGGER_QUOTE_UNVERIFIED', assertion.quote);
    return null;
  }
  const sectionReference = assertion.section_reference ?? null;
  const feeSide = assertion.fee_side ?? null;
  const triggerCode = assertion.trigger_code ?? null;
  const subjectId = mintSubjectId({
    kind: 'FEE_TRIGGER_ASSERTION',
    section_reference: sectionReference,
    fee_side: feeSide,
    trigger_code: triggerCode,
    quote: assertion.quote ?? null,
  });
  return {
    kind: 'claim',
    proposal_kind: FEE_TRIGGER_PROPOSAL_KIND,
    subject_occurrence_id: subjectId,
    claim_definition_key: FEE_TRIGGER_CLAIM_KEY,
    claim_definition_version: 1,
    ordinal: ordinalFor(`${subjectId}:${FEE_TRIGGER_CLAIM_KEY}`),
    state: 'PRESENT',
    raw_value: assertion.quote,
    canonical_value: null,
    attributes: {
      section_reference: sectionReference,
      fee_side: feeSide,
      trigger_code: triggerCode,
    },
    allowed_attributes: ['section_reference', 'fee_side', 'trigger_code'],
    taxonomy_codes: triggerCode && FEE_TRIGGER_CODES.includes(triggerCode) ? { trigger_code: triggerCode } : {},
    codebooks: { trigger_code: FEE_TRIGGER_CODES, fee_side: FEE_SIDES },
    evidence: [evidence],
    extraction_version: RESPONSE_VERSION,
    normalisation_version: RESPONSE_VERSION,
    derivation_version: RESPONSE_VERSION,
  };
}

function shapeTailPeriodAssertion(assertion, sourceBytes, ordinalFor, dropCounter) {
  if (!assertion || typeof assertion !== 'object') return null;
  const evidence = evidenceFromQuote(sourceBytes, assertion.quote);
  if (!evidence) {
    if (assertion.quote) dropCounter.record('FEE_TAIL_PERIOD_QUOTE_UNVERIFIED', assertion.quote);
    return null;
  }
  const sectionReference = assertion.section_reference ?? null;
  const subjectId = mintSubjectId({
    kind: 'FEE_TAIL_PERIOD_ASSERTION',
    section_reference: sectionReference,
    quote: assertion.quote ?? null,
  });
  return {
    kind: 'claim',
    proposal_kind: FEE_TAIL_PERIOD_PROPOSAL_KIND,
    subject_occurrence_id: subjectId,
    claim_definition_key: FEE_TAIL_PERIOD_CLAIM_KEY,
    claim_definition_version: 1,
    ordinal: ordinalFor(`${subjectId}:${FEE_TAIL_PERIOD_CLAIM_KEY}`),
    state: 'PRESENT',
    raw_value: assertion.quote,
    canonical_value: null,
    attributes: {
      section_reference: sectionReference,
    },
    allowed_attributes: ['section_reference'],
    taxonomy_codes: {},
    codebooks: {},
    evidence: [evidence],
    extraction_version: RESPONSE_VERSION,
    normalisation_version: RESPONSE_VERSION,
    derivation_version: RESPONSE_VERSION,
  };
}

/**
 * Shapes a full termination-fee-producer-prompt.js response into proposals.
 * Mirrors shapeProposals's own contract (parsed response + source text ->
 * {proposals, evidence_residuals}) but over this family's OWN response
 * schema (fee_amount_assertions / fee_trigger_assertions /
 * tail_period_assertions / open_world_candidates) -- never merged into
 * shapeProposals itself, matching the "SEPARATE prompt executions,
 * SEPARATE response schema" wiring pin (spec section 3, audit m-3).
 */
function shapeTerminationFeeProposals(parsed, sourceText) {
  const sourceBytes = Buffer.from(sourceText, 'utf8');
  const ordinalFor = makeOrdinalCounter();
  const dropped = [];
  const dropCounter = {
    record(reason, quote) {
      dropped.push({ reason, quote_preview: String(quote).slice(0, 120) });
    },
  };

  const proposals = [];
  const feeAmountAssertions = Array.isArray(parsed.fee_amount_assertions) ? parsed.fee_amount_assertions : [];
  for (const assertion of feeAmountAssertions) {
    const proposal = shapeFeeAmountAssertion(assertion, sourceBytes, ordinalFor, dropCounter);
    if (proposal) proposals.push(proposal);
  }
  const feeTriggerAssertions = Array.isArray(parsed.fee_trigger_assertions) ? parsed.fee_trigger_assertions : [];
  for (const assertion of feeTriggerAssertions) {
    const proposal = shapeFeeTriggerAssertion(assertion, sourceBytes, ordinalFor, dropCounter);
    if (proposal) proposals.push(proposal);
  }
  const tailPeriodAssertions = Array.isArray(parsed.tail_period_assertions) ? parsed.tail_period_assertions : [];
  for (const assertion of tailPeriodAssertions) {
    const proposal = shapeTailPeriodAssertion(assertion, sourceBytes, ordinalFor, dropCounter);
    if (proposal) proposals.push(proposal);
  }
  proposals.push(...shapeWaveBMechanics(
    parsed.wave_b_mechanics,
    TERMINATION_FEE_WAVE_B_SURFACES,
    sourceBytes,
    ordinalFor,
    dropCounter,
  ));
  const openWorldCandidates = Array.isArray(parsed.open_world_candidates) ? parsed.open_world_candidates : [];
  for (const candidate of openWorldCandidates) {
    const proposal = shapeOpenWorldCandidate(candidate, sourceBytes, ordinalFor, dropCounter);
    if (proposal) proposals.push(proposal);
  }

  return { proposals, evidence_residuals: dropped };
}

// No-shop family shaping functions (spec section 3): mechanical, structural
// shaping only, exactly like the fee family's own shaping functions above --
// no content-dependent branching. action_code/prerequisite_code enum
// membership, corroboration, attribute verbatim-ness, and the actual period
// parse are ALL resolver-stage concerns (candidate-resolution.js); each
// function's only job is to turn one no-shop-producer-prompt.js response-
// array entry into one typed, evidenced proposal, or drop it as a residual
// when its quote cannot be byte-verified.

function shapeNoShopActionAssertion(assertion, sourceBytes, ordinalFor, dropCounter) {
  if (!assertion || typeof assertion !== 'object') return null;
  const evidence = evidenceFromQuote(sourceBytes, assertion.quote);
  if (!evidence) {
    if (assertion.quote) dropCounter.record('NO_SHOP_ACTION_QUOTE_UNVERIFIED', assertion.quote);
    return null;
  }
  const sectionReference = assertion.section_reference ?? null;
  const actionCode = assertion.action_code ?? null;
  const covenantObligor = assertion.covenant_obligor ?? null;
  const subjectId = mintSubjectId({
    kind: 'NO_SHOP_ACTION_ASSERTION',
    section_reference: sectionReference,
    action_code: actionCode,
    covenant_obligor: covenantObligor,
    quote: assertion.quote ?? null,
  });
  return {
    kind: 'claim',
    proposal_kind: NO_SHOP_PROPOSAL_KIND,
    subject_occurrence_id: subjectId,
    claim_definition_key: NO_SHOP_ACTION_CLAIM_KEY,
    claim_definition_version: 1,
    ordinal: ordinalFor(`${subjectId}:${NO_SHOP_ACTION_CLAIM_KEY}`),
    state: 'PRESENT',
    raw_value: assertion.quote,
    canonical_value: null,
    attributes: {
      section_reference: sectionReference,
      action_code: actionCode,
      covenant_obligor: covenantObligor,
    },
    allowed_attributes: ['section_reference', 'action_code', 'covenant_obligor'],
    taxonomy_codes: actionCode ? { action_code: actionCode } : {},
    codebooks: { action_code: NO_SHOP_ACTION_CODES },
    evidence: [evidence],
    extraction_version: RESPONSE_VERSION,
    normalisation_version: RESPONSE_VERSION,
    derivation_version: RESPONSE_VERSION,
  };
}

function shapeNoShopExceptionPrerequisiteAssertion(assertion, sourceBytes, ordinalFor, dropCounter) {
  if (!assertion || typeof assertion !== 'object') return null;
  const evidence = evidenceFromQuote(sourceBytes, assertion.quote);
  if (!evidence) {
    if (assertion.quote) dropCounter.record('NO_SHOP_PREREQUISITE_QUOTE_UNVERIFIED', assertion.quote);
    return null;
  }
  const sectionReference = assertion.section_reference ?? null;
  const prerequisiteCode = assertion.prerequisite_code ?? null;
  const permittedActionContext = assertion.permitted_action_context ?? null;
  const subjectId = mintSubjectId({
    kind: 'NO_SHOP_EXCEPTION_PREREQUISITE_ASSERTION',
    section_reference: sectionReference,
    prerequisite_code: prerequisiteCode,
    permitted_action_context: permittedActionContext,
    quote: assertion.quote ?? null,
  });
  return {
    kind: 'claim',
    proposal_kind: NO_SHOP_PROPOSAL_KIND,
    subject_occurrence_id: subjectId,
    claim_definition_key: NO_SHOP_EXCEPTION_PREREQUISITE_CLAIM_KEY,
    claim_definition_version: 1,
    ordinal: ordinalFor(`${subjectId}:${NO_SHOP_EXCEPTION_PREREQUISITE_CLAIM_KEY}`),
    state: 'PRESENT',
    raw_value: assertion.quote,
    canonical_value: null,
    attributes: {
      section_reference: sectionReference,
      prerequisite_code: prerequisiteCode,
      permitted_action_context: permittedActionContext,
      // covenant_obligor: exception prerequisites have no payer/obligor
      // phrase of their own in the response shape -- the resolver assigns
      // the FIVE resolution-table rows' shared party_field/party_role
      // (covenant_obligor / COVENANT_OBLIGOR, spec section 4 audit m-2)
      // from this same attribute name, left null here since the producer
      // prompt never asks for it on this array; the resolver's own
      // PARTY_UNRESOLVED routing handles the null case honestly.
      covenant_obligor: null,
    },
    allowed_attributes: ['section_reference', 'prerequisite_code', 'permitted_action_context', 'covenant_obligor'],
    taxonomy_codes: prerequisiteCode ? { prerequisite_code: prerequisiteCode } : {},
    codebooks: { prerequisite_code: NO_SHOP_EXCEPTION_PREREQUISITE_CODES },
    evidence: [evidence],
    extraction_version: RESPONSE_VERSION,
    normalisation_version: RESPONSE_VERSION,
    derivation_version: RESPONSE_VERSION,
  };
}

function shapeNoShopPeriodAssertion(assertion, sourceBytes, ordinalFor, dropCounter) {
  if (!assertion || typeof assertion !== 'object') return null;
  const evidence = evidenceFromQuote(sourceBytes, assertion.quote);
  if (!evidence) {
    if (assertion.quote) dropCounter.record('NO_SHOP_PERIOD_QUOTE_UNVERIFIED', assertion.quote);
    return null;
  }
  const sectionReference = assertion.section_reference ?? null;
  const periodRole = assertion.period_role ?? null;
  // Mechanical period_role -> generic key mapping (spec section 3): an
  // unknown role is a fail-closed, TYPED provider error -- never a guess,
  // never silently coerced to one of the three known roles.
  const claimKey = Object.hasOwn(NO_SHOP_PERIOD_ROLE_TO_CLAIM_KEY, periodRole)
    ? NO_SHOP_PERIOD_ROLE_TO_CLAIM_KEY[periodRole]
    : null;
  if (!claimKey) {
    throw new NativeProducerAnthropicError(
      'NO_SHOP_PERIOD_ROLE_UNKNOWN',
      `period_assertions entry carries an unrecognised period_role: ${JSON.stringify(periodRole)}`,
      { period_role: periodRole, quote_preview: String(assertion.quote).slice(0, 120) },
    );
  }
  const subjectId = mintSubjectId({
    kind: 'NO_SHOP_PERIOD_ASSERTION',
    section_reference: sectionReference,
    period_role: periodRole,
    quote: assertion.quote ?? null,
  });
  return {
    kind: 'claim',
    proposal_kind: NO_SHOP_PROPOSAL_KIND,
    subject_occurrence_id: subjectId,
    claim_definition_key: claimKey,
    claim_definition_version: 1,
    ordinal: ordinalFor(`${subjectId}:${claimKey}`),
    state: 'PRESENT',
    raw_value: assertion.quote,
    canonical_value: null,
    attributes: {
      section_reference: sectionReference,
      period_role: periodRole,
      // covenant_obligor: period claims carry no payer/obligor phrase of
      // their own either (same rationale as the prerequisite shaping
      // function above) -- the resolver's dedicated handler assigns the
      // fixed COVENANT_OBLIGOR party per spec section 4 (audit m-2: "the
      // period obligations' obligor IS the covenant obligor in every
      // corpus form"), never read from this null attribute.
      covenant_obligor: null,
    },
    allowed_attributes: ['section_reference', 'period_role', 'covenant_obligor'],
    taxonomy_codes: {},
    codebooks: { period_role: NO_SHOP_PERIOD_ROLES },
    evidence: [evidence],
    extraction_version: RESPONSE_VERSION,
    normalisation_version: RESPONSE_VERSION,
    derivation_version: RESPONSE_VERSION,
  };
}

function shapeNoShopWaveBAssertion(assertion, sourceBytes, ordinalFor, dropCounter) {
  if (!assertion || typeof assertion !== 'object') return null;
  const evidence = evidenceFromQuote(sourceBytes, assertion.quote);
  if (!evidence) {
    if (assertion.quote) dropCounter.record('NO_SHOP_WAVE_B_QUOTE_UNVERIFIED', assertion.quote);
    return null;
  }
  const sectionReference = assertion.section_reference ?? null;
  const assertionKind = assertion.assertion_kind ?? null;
  const canonicalValue = assertion.canonical_value ?? null;
  const covenantObligor = assertion.covenant_obligor ?? null;
  const subjectId = mintSubjectId({
    kind: 'NO_SHOP_WAVE_B_ASSERTION',
    section_reference: sectionReference,
    assertion_kind: assertionKind,
    canonical_value: canonicalValue,
    covenant_obligor: covenantObligor,
    quote: assertion.quote ?? null,
  });
  return {
    kind: 'claim',
    proposal_kind: NO_SHOP_PROPOSAL_KIND,
    subject_occurrence_id: subjectId,
    claim_definition_key: NO_SHOP_WAVE_B_CLAIM_KEY,
    claim_definition_version: 1,
    ordinal: ordinalFor(`${subjectId}:${NO_SHOP_WAVE_B_CLAIM_KEY}`),
    state: 'PRESENT',
    raw_value: assertion.quote,
    canonical_value: null,
    attributes: {
      section_reference: sectionReference,
      assertion_kind: assertionKind,
      proposed_canonical_value: canonicalValue,
      covenant_obligor: covenantObligor,
    },
    allowed_attributes: ['section_reference', 'assertion_kind', 'proposed_canonical_value', 'covenant_obligor'],
    taxonomy_codes: assertionKind ? { assertion_kind: assertionKind } : {},
    codebooks: { assertion_kind: NO_SHOP_WAVE_B_ASSERTION_KINDS },
    evidence: [evidence],
    extraction_version: RESPONSE_VERSION,
    normalisation_version: RESPONSE_VERSION,
    derivation_version: RESPONSE_VERSION,
  };
}

/**
 * Shapes a full no-shop-producer-prompt.js response into proposals. Mirrors
 * shapeTerminationFeeProposals's own contract (parsed response + source
 * text -> {proposals, evidence_residuals}) but over this family's OWN
 * response schema (no_shop_action_assertions / exception_prerequisite_
 * assertions / period_assertions / open_world_candidates).
 */
function shapeNoShopProposals(parsed, sourceText) {
  const sourceBytes = Buffer.from(sourceText, 'utf8');
  const ordinalFor = makeOrdinalCounter();
  const dropped = [];
  const dropCounter = {
    record(reason, quote) {
      dropped.push({ reason, quote_preview: String(quote).slice(0, 120) });
    },
  };

  const proposals = [];
  const actionAssertions = Array.isArray(parsed.no_shop_action_assertions) ? parsed.no_shop_action_assertions : [];
  for (const assertion of actionAssertions) {
    const proposal = shapeNoShopActionAssertion(assertion, sourceBytes, ordinalFor, dropCounter);
    if (proposal) proposals.push(proposal);
  }
  const prerequisiteAssertions = Array.isArray(parsed.exception_prerequisite_assertions)
    ? parsed.exception_prerequisite_assertions
    : [];
  for (const assertion of prerequisiteAssertions) {
    const proposal = shapeNoShopExceptionPrerequisiteAssertion(assertion, sourceBytes, ordinalFor, dropCounter);
    if (proposal) proposals.push(proposal);
  }
  const periodAssertions = Array.isArray(parsed.period_assertions) ? parsed.period_assertions : [];
  for (const assertion of periodAssertions) {
    const proposal = shapeNoShopPeriodAssertion(assertion, sourceBytes, ordinalFor, dropCounter);
    if (proposal) proposals.push(proposal);
  }
  for (const listName of [
    'cease_assertions',
    'standstill_assertions',
    'fiduciary_standard_assertions',
    'recommendation_assertions',
  ]) {
    const assertions = Array.isArray(parsed[listName]) ? parsed[listName] : [];
    for (const assertion of assertions) {
      const proposal = shapeNoShopWaveBAssertion(assertion, sourceBytes, ordinalFor, dropCounter);
      if (proposal) proposals.push(proposal);
    }
  }
  const openWorldCandidates = Array.isArray(parsed.open_world_candidates) ? parsed.open_world_candidates : [];
  for (const candidate of openWorldCandidates) {
    const proposal = shapeOpenWorldCandidate(candidate, sourceBytes, ordinalFor, dropCounter);
    if (proposal) proposals.push(proposal);
  }

  return { proposals, evidence_residuals: dropped };
}

// MAE-definition family shaping (spec section 3). Same discipline as the
// no-shop/fee families' own shaping functions: mechanical, structural
// shaping only, no content-dependent branching. carveout_code/prong_code
// enum membership, corroboration, attribute verbatim-ness, and the
// carveback source-form and carveback-to-limb relationship checks are ALL
// resolver-stage concerns
// (candidate-resolution.js). Each function turns one nested assertion,
// carrying its parent mae_definition_instances entry's shared identity
// fields (section_reference, defined_term, definition_subject), into one
// typed, evidenced proposal, or drops it as a residual when its quote
// cannot be byte-verified.

function shapeMaeCarveoutAssertion(instance, assertion, sourceBytes, ordinalFor, dropCounter) {
  if (!assertion || typeof assertion !== 'object') return null;
  const evidence = evidenceFromQuote(sourceBytes, assertion.quote);
  if (!evidence) {
    if (assertion.quote) dropCounter.record('MAE_CARVEOUT_QUOTE_UNVERIFIED', assertion.quote);
    return null;
  }
  const sectionReference = instance.section_reference ?? null;
  const definedTerm = instance.defined_term ?? null;
  const definitionSubject = instance.definition_subject ?? null;
  const carveoutCode = assertion.carveout_code ?? null;
  const clauseLabel = assertion.clause_label ?? null;
  const limbPath = Array.isArray(assertion.limb_path) ? assertion.limb_path : [];
  const subjectId = mintSubjectId({
    kind: 'MAE_CARVEOUT_ASSERTION',
    section_reference: sectionReference,
    defined_term: definedTerm,
    carveout_code: carveoutCode,
    clause_label: clauseLabel,
    quote: assertion.quote ?? null,
  });
  return {
    kind: 'claim',
    proposal_kind: MAE_DEFINITION_PROPOSAL_KIND,
    subject_occurrence_id: subjectId,
    claim_definition_key: MAE_CARVEOUT_CLAIM_KEY,
    claim_definition_version: 1,
    ordinal: ordinalFor(`${subjectId}:${MAE_CARVEOUT_CLAIM_KEY}`),
    state: 'PRESENT',
    raw_value: assertion.quote,
    canonical_value: null,
    attributes: {
      section_reference: sectionReference,
      defined_term_ref: definedTerm,
      definition_subject: definitionSubject,
      carveout_code: carveoutCode,
      clause_label: clauseLabel,
      limb_path: limbPath,
    },
    allowed_attributes: [
      'section_reference', 'defined_term_ref', 'definition_subject', 'carveout_code', 'clause_label', 'limb_path',
    ],
    taxonomy_codes: carveoutCode ? { carveout_code: carveoutCode } : {},
    codebooks: { carveout_code: MAE_CARVEOUT_CODES },
    evidence: [evidence],
    extraction_version: RESPONSE_VERSION,
    normalisation_version: RESPONSE_VERSION,
    derivation_version: RESPONSE_VERSION,
  };
}

function shapeMaeDefinitionProngAssertion(instance, assertion, sourceBytes, ordinalFor, dropCounter) {
  if (!assertion || typeof assertion !== 'object') return null;
  const evidence = evidenceFromQuote(sourceBytes, assertion.quote);
  if (!evidence) {
    if (assertion.quote) dropCounter.record('MAE_PRONG_QUOTE_UNVERIFIED', assertion.quote);
    return null;
  }
  const sectionReference = instance.section_reference ?? null;
  const definedTerm = instance.defined_term ?? null;
  const definitionSubject = instance.definition_subject ?? null;
  const prongCode = assertion.prong_code ?? null;
  const prongLabel = assertion.prong_label ?? null;
  const limbPath = Array.isArray(assertion.limb_path) ? assertion.limb_path : [];
  // period_role-style mechanical dispatch: an unrecognised prong_code is a
  // fail-closed, TYPED provider error (spec section 3: prong_code has no
  // null -- "if you cannot tell which prong a quote states ... use
  // open_world_candidates instead"), never silently coerced.
  if (!MAE_DEFINITION_PRONG_CODES.includes(prongCode)) {
    throw new NativeProducerAnthropicError(
      'MAE_PRONG_CODE_UNKNOWN',
      `prong_assertions entry carries an unrecognised prong_code: ${JSON.stringify(prongCode)}`,
      { prong_code: prongCode, quote_preview: String(assertion.quote).slice(0, 120) },
    );
  }
  const subjectId = mintSubjectId({
    kind: 'MAE_DEFINITION_PRONG_ASSERTION',
    section_reference: sectionReference,
    defined_term: definedTerm,
    prong_code: prongCode,
    quote: assertion.quote ?? null,
  });
  return {
    kind: 'claim',
    proposal_kind: MAE_DEFINITION_PROPOSAL_KIND,
    subject_occurrence_id: subjectId,
    claim_definition_key: MAE_DEFINITION_PRONG_CLAIM_KEY,
    claim_definition_version: 1,
    ordinal: ordinalFor(`${subjectId}:${MAE_DEFINITION_PRONG_CLAIM_KEY}`),
    state: 'PRESENT',
    raw_value: assertion.quote,
    canonical_value: null,
    attributes: {
      section_reference: sectionReference,
      defined_term_ref: definedTerm,
      definition_subject: definitionSubject,
      prong_code: prongCode,
      prong_label: prongLabel,
      limb_path: limbPath,
    },
    allowed_attributes: [
      'section_reference', 'defined_term_ref', 'definition_subject', 'prong_code', 'prong_label', 'limb_path',
    ],
    taxonomy_codes: { prong_code: prongCode },
    codebooks: { prong_code: MAE_DEFINITION_PRONG_CODES },
    evidence: [evidence],
    extraction_version: RESPONSE_VERSION,
    normalisation_version: RESPONSE_VERSION,
    derivation_version: RESPONSE_VERSION,
  };
}

function shapeMaeDisproportionalityAssertion(
  instance, assertion, sourceBytes, ordinalFor, dropCounter, sourceForm = 'TRAILING_LIST',
) {
  if (!assertion || typeof assertion !== 'object') return null;
  const evidence = evidenceFromQuote(sourceBytes, assertion.quote);
  if (!evidence) {
    if (assertion.quote) dropCounter.record('MAE_DISPROPORTIONALITY_QUOTE_UNVERIFIED', assertion.quote);
    return null;
  }
  const sectionReference = instance.section_reference ?? null;
  const definedTerm = instance.defined_term ?? null;
  const definitionSubject = instance.definition_subject ?? null;
  const clauseLabel = assertion.clause_label ?? null;
  const appliesToClauseLabels = sourceForm === 'PER_LIMB'
    ? (typeof clauseLabel === 'string' && clauseLabel ? [clauseLabel] : [])
    : (Array.isArray(assertion.applies_to_clause_labels) ? assertion.applies_to_clause_labels : []);
  const comparisonBaselinePhrase = assertion.comparison_baseline_phrase ?? null;
  const incrementalImpactPhrase = assertion.incremental_impact_phrase ?? null;
  const limbPath = Array.isArray(assertion.limb_path) ? assertion.limb_path : [];
  const subjectId = mintSubjectId({
    kind: 'MAE_DISPROPORTIONALITY_ASSERTION',
    section_reference: sectionReference,
    defined_term: definedTerm,
    carveback_source_form: sourceForm,
    applies_to_clause_labels: appliesToClauseLabels,
    quote: assertion.quote ?? null,
  });
  return {
    kind: 'claim',
    proposal_kind: MAE_DEFINITION_PROPOSAL_KIND,
    subject_occurrence_id: subjectId,
    claim_definition_key: MAE_DISPROPORTIONALITY_CLAIM_KEY,
    claim_definition_version: 1,
    ordinal: ordinalFor(`${subjectId}:${MAE_DISPROPORTIONALITY_CLAIM_KEY}`),
    state: 'PRESENT',
    raw_value: assertion.quote,
    canonical_value: null,
    attributes: {
      section_reference: sectionReference,
      defined_term_ref: definedTerm,
      definition_subject: definitionSubject,
      carveback_source_form: sourceForm,
      applies_to_clause_labels: appliesToClauseLabels,
      comparison_baseline_phrase: comparisonBaselinePhrase,
      incremental_impact_phrase: incrementalImpactPhrase,
      limb_path: limbPath,
    },
    allowed_attributes: [
      'section_reference', 'defined_term_ref', 'definition_subject',
      'carveback_source_form', 'applies_to_clause_labels', 'comparison_baseline_phrase',
      'incremental_impact_phrase', 'limb_path',
    ],
    taxonomy_codes: {},
    codebooks: {},
    evidence: [evidence],
    extraction_version: RESPONSE_VERSION,
    normalisation_version: RESPONSE_VERSION,
    derivation_version: RESPONSE_VERSION,
  };
}

/**
 * Shapes a full mae-definition-producer-prompt.js response into proposals.
 * Mirrors shapeNoShopProposals's own contract, but flattens the response's
 * ONE LEVEL OF NESTING (mae_definition_instances[].{prong,carveout,
 * limb-local-disproportionality,disproportionality}_assertions[]) into a
 * flat proposal list -- each
 * nested assertion becomes its own proposal, carrying its parent
 * instance's shared identity fields (section_reference, defined_term,
 * definition_subject) as attributes, never merged into one compound claim.
 */
function shapeMaeDefinitionProposals(parsed, sourceText) {
  const sourceBytes = Buffer.from(sourceText, 'utf8');
  const ordinalFor = makeOrdinalCounter();
  const dropped = [];
  const dropCounter = {
    record(reason, quote) {
      dropped.push({ reason, quote_preview: String(quote).slice(0, 120) });
    },
  };

  const proposals = [];
  const instances = Array.isArray(parsed.mae_definition_instances) ? parsed.mae_definition_instances : [];
  for (const instance of instances) {
    if (!instance || typeof instance !== 'object') continue;
    const prongAssertions = Array.isArray(instance.prong_assertions) ? instance.prong_assertions : [];
    for (const assertion of prongAssertions) {
      const proposal = shapeMaeDefinitionProngAssertion(instance, assertion, sourceBytes, ordinalFor, dropCounter);
      if (proposal) proposals.push(proposal);
    }
    const carveoutAssertions = Array.isArray(instance.carveout_assertions) ? instance.carveout_assertions : [];
    for (const assertion of carveoutAssertions) {
      const proposal = shapeMaeCarveoutAssertion(instance, assertion, sourceBytes, ordinalFor, dropCounter);
      if (proposal) proposals.push(proposal);
    }
    const limbLocalDisproportionalityAssertions = Array.isArray(instance.limb_local_disproportionality_assertions)
      ? instance.limb_local_disproportionality_assertions
      : [];
    for (const assertion of limbLocalDisproportionalityAssertions) {
      const proposal = shapeMaeDisproportionalityAssertion(
        instance, assertion, sourceBytes, ordinalFor, dropCounter, 'PER_LIMB',
      );
      if (proposal) proposals.push(proposal);
    }
    const disproportionalityAssertions = Array.isArray(instance.disproportionality_assertions)
      ? instance.disproportionality_assertions
      : [];
    for (const assertion of disproportionalityAssertions) {
      const proposal = shapeMaeDisproportionalityAssertion(
        instance, assertion, sourceBytes, ordinalFor, dropCounter, 'TRAILING_LIST',
      );
      if (proposal) proposals.push(proposal);
    }
  }
  const openWorldCandidates = Array.isArray(parsed.open_world_candidates) ? parsed.open_world_candidates : [];
  for (const candidate of openWorldCandidates) {
    const proposal = shapeOpenWorldCandidate(candidate, sourceBytes, ordinalFor, dropCounter);
    if (proposal) proposals.push(proposal);
  }

  const uniqueProposals = [];
  const seenAssertions = new Set();
  for (const proposal of proposals) {
    const identity = canonicalJson({
      proposal_kind: proposal.proposal_kind,
      claim_definition_key: proposal.claim_definition_key,
      subject_occurrence_id: proposal.subject_occurrence_id,
      raw_value: proposal.raw_value,
      canonical_value: proposal.canonical_value,
      attributes: proposal.attributes,
      evidence: proposal.evidence,
    });
    if (seenAssertions.has(identity)) continue;
    seenAssertions.add(identity);
    uniqueProposals.push(proposal);
  }

  return { proposals: uniqueProposals, evidence_residuals: dropped };
}

// Termination-RIGHTS family shaping (spec section 3): mechanical,
// structural shaping only, exactly like every sibling family's own shaping
// function -- no content-dependent branching. trigger_kind/party-scope
// enum membership, corroboration, attribute verbatim-ness, and the actual
// deadline/cure-period parses are ALL resolver-stage concerns
// (candidate-resolution.js); this function's only job is to turn one
// termination-producer-prompt.js response-array entry into one typed,
// evidenced proposal, or drop it as a residual when its quote cannot be
// byte-verified.
function shapeTerminationRightAssertion(assertion, sourceBytes, ordinalFor, dropCounter) {
  if (!assertion || typeof assertion !== 'object') return null;
  const evidence = evidenceFromQuote(sourceBytes, assertion.quote);
  if (!evidence) {
    if (assertion.quote) dropCounter.record('TERMINATION_RIGHT_QUOTE_UNVERIFIED', assertion.quote);
    return null;
  }
  const sectionReference = assertion.section_reference ?? null;
  const assertionKind = assertion.assertion_kind ?? null;
  const triggerKind = assertion.trigger_kind ?? null;
  const terminatingPartyScope = assertion.terminating_party_scope ?? null;
  const terminatingParty = assertion.terminating_party ?? null;
  const deadlineTerm = assertion.deadline_term ?? null;
  const dayKind = assertion.day_kind ?? null;
  const periodKind = assertion.period_kind ?? null;
  const subjectId = mintSubjectId({
    kind: 'TERMINATION_RIGHT_ASSERTION',
    section_reference: sectionReference,
    assertion_kind: assertionKind,
    trigger_kind: triggerKind,
    terminating_party_scope: terminatingPartyScope,
    terminating_party: terminatingParty,
    deadline_term: deadlineTerm,
    day_kind: dayKind,
    period_kind: periodKind,
    quote: assertion.quote ?? null,
  });
  return {
    kind: 'claim',
    proposal_kind: TERMINATION_RIGHT_PROPOSAL_KIND,
    subject_occurrence_id: subjectId,
    claim_definition_key: TERMINATION_RIGHT_CLAIM_KEY,
    claim_definition_version: 1,
    ordinal: ordinalFor(`${subjectId}:${TERMINATION_RIGHT_CLAIM_KEY}`),
    state: 'PRESENT',
    raw_value: assertion.quote,
    canonical_value: null,
    attributes: {
      section_reference: sectionReference,
      assertion_kind: assertionKind,
      trigger_kind: triggerKind,
      terminating_party_scope: terminatingPartyScope,
      terminating_party: terminatingParty,
      deadline_term: deadlineTerm,
      day_kind: dayKind,
      period_kind: periodKind,
    },
    allowed_attributes: [
      'section_reference', 'assertion_kind', 'trigger_kind', 'terminating_party_scope',
      'terminating_party', 'deadline_term', 'day_kind', 'period_kind',
    ],
    taxonomy_codes: {
      ...(assertionKind && TERMINATION_ASSERTION_KINDS.includes(assertionKind) ? { assertion_kind: assertionKind } : {}),
      ...(triggerKind && TERMINATION_TRIGGER_KINDS.includes(triggerKind) ? { trigger_kind: triggerKind } : {}),
    },
    codebooks: {
      assertion_kind: TERMINATION_ASSERTION_KINDS,
      trigger_kind: TERMINATION_TRIGGER_KINDS,
      terminating_party_scope: TERMINATION_PARTY_SCOPES,
      day_kind: TERMINATION_DAY_KINDS,
      period_kind: TERMINATION_PERIOD_KINDS,
    },
    evidence: [evidence],
    extraction_version: RESPONSE_VERSION,
    normalisation_version: RESPONSE_VERSION,
    derivation_version: RESPONSE_VERSION,
  };
}

/**
 * Shapes a full termination-producer-prompt.js response into proposals.
 * Mirrors shapeTerminationFeeProposals's own contract (parsed response +
 * source text -> {proposals, evidence_residuals}) but over this family's
 * OWN response schema (termination_right_assertions / open_world_
 * candidates) -- never merged into shapeProposals itself.
 */
function shapeTerminationProposals(parsed, sourceText) {
  const sourceBytes = Buffer.from(sourceText, 'utf8');
  const ordinalFor = makeOrdinalCounter();
  const dropped = [];
  const dropCounter = {
    record(reason, quote) {
      dropped.push({ reason, quote_preview: String(quote).slice(0, 120) });
    },
  };

  const proposals = [];
  const terminationRightAssertions = Array.isArray(parsed.termination_right_assertions)
    ? parsed.termination_right_assertions
    : [];
  for (const assertion of terminationRightAssertions) {
    const proposal = shapeTerminationRightAssertion(assertion, sourceBytes, ordinalFor, dropCounter);
    if (proposal) proposals.push(proposal);
  }
  proposals.push(...shapeWaveBMechanics(
    parsed.wave_b_mechanics,
    TERMINATION_RIGHT_WAVE_B_SURFACES,
    sourceBytes,
    ordinalFor,
    dropCounter,
  ));
  const openWorldCandidates = Array.isArray(parsed.open_world_candidates) ? parsed.open_world_candidates : [];
  for (const candidate of openWorldCandidates) {
    const proposal = shapeOpenWorldCandidate(candidate, sourceBytes, ordinalFor, dropCounter);
    if (proposal) proposals.push(proposal);
  }

  return { proposals, evidence_residuals: dropped };
}

function shapeDefinedTermAssertion(assertion, sourceBytes, ordinalFor, dropCounter) {
  if (!assertion || typeof assertion !== 'object') return null;
  const definitionHeadQuote = assertion.definition_head_quote;
  const limbQuote = assertion.limb_quote;
  const definitionEvidence = evidenceFromQuote(sourceBytes, definitionHeadQuote, 'DEFINITION');
  const limbEvidence = evidenceFromQuote(sourceBytes, limbQuote);
  if (!definitionEvidence) {
    if (definitionHeadQuote) dropCounter.record('DEFINED_TERM_HEAD_QUOTE_UNVERIFIED', definitionHeadQuote);
    return null;
  }
  if (!limbEvidence) {
    if (limbQuote) dropCounter.record('DEFINED_TERM_LIMB_QUOTE_UNVERIFIED', limbQuote);
    return null;
  }

  const sectionReference = assertion.section_reference ?? null;
  const assertionKind = assertion.assertion_kind ?? null;
  const attributes = {
    section_reference: sectionReference,
    assertion_kind: assertionKind,
    definition_head_quote: definitionHeadQuote,
    limb_quote: limbQuote,
    proposal_term_ref: assertion.proposal_term_ref ?? null,
    superior_term_ref: assertion.superior_term_ref ?? null,
    substitution_from_percent: assertion.substitution_from_percent ?? null,
    substituted_term_ref: assertion.substituted_term_ref ?? null,
    host_term_ref: assertion.host_term_ref ?? null,
    threshold_basis: assertion.threshold_basis ?? null,
    qualifier_code: assertion.qualifier_code ?? null,
    event_term_ref: assertion.event_term_ref ?? null,
    exclusion_code: assertion.exclusion_code ?? null,
    knowledge_term_ref: assertion.knowledge_term_ref ?? null,
    standard_code: assertion.standard_code ?? null,
    source_code: assertion.source_code ?? null,
    knowledge_party: assertion.knowledge_party ?? null,
    named_persons: Array.isArray(assertion.named_persons) ? assertion.named_persons : [],
    breach_term_ref: assertion.breach_term_ref ?? null,
  };
  const subjectId = mintSubjectId({ kind: 'DEFINED_TERM_ASSERTION', ...attributes });
  const taxonomyCodes = {
    ...(assertionKind && DEFINED_TERM_ASSERTION_KINDS.includes(assertionKind)
      ? { assertion_kind: assertionKind } : {}),
    ...(attributes.threshold_basis && DEFINED_TERM_THRESHOLD_BASES.includes(attributes.threshold_basis)
      ? { threshold_basis: attributes.threshold_basis } : {}),
    ...(attributes.qualifier_code && DEFINED_TERM_SUPERIOR_QUALIFIER_CODES.includes(attributes.qualifier_code)
      ? { qualifier_code: attributes.qualifier_code } : {}),
    ...(attributes.exclusion_code && DEFINED_TERM_INTERVENING_EXCLUSION_CODES.includes(attributes.exclusion_code)
      ? { exclusion_code: attributes.exclusion_code } : {}),
    ...(attributes.standard_code && DEFINED_TERM_STANDARD_CODES.includes(attributes.standard_code)
      ? { standard_code: attributes.standard_code } : {}),
    ...(attributes.source_code && DEFINED_TERM_PERSON_SOURCE_CODES.includes(attributes.source_code)
      ? { source_code: attributes.source_code } : {}),
    ...(attributes.knowledge_party && DEFINED_TERM_KNOWLEDGE_PARTIES.includes(attributes.knowledge_party)
      ? { knowledge_party: attributes.knowledge_party } : {}),
  };
  const evidence = definitionHeadQuote === limbQuote
    ? [limbEvidence]
    : [definitionEvidence, limbEvidence];

  return {
    kind: 'claim',
    proposal_kind: DEFINED_TERM_PROPOSAL_KIND,
    subject_occurrence_id: subjectId,
    claim_definition_key: DEFINED_TERM_CLAIM_KEY,
    claim_definition_version: 1,
    ordinal: ordinalFor(`${subjectId}:${DEFINED_TERM_CLAIM_KEY}`),
    state: 'PRESENT',
    raw_value: limbQuote,
    canonical_value: null,
    attributes,
    allowed_attributes: Object.keys(attributes),
    taxonomy_codes: taxonomyCodes,
    codebooks: {
      assertion_kind: DEFINED_TERM_ASSERTION_KINDS,
      threshold_basis: DEFINED_TERM_THRESHOLD_BASES,
      qualifier_code: DEFINED_TERM_SUPERIOR_QUALIFIER_CODES,
      exclusion_code: DEFINED_TERM_INTERVENING_EXCLUSION_CODES,
      standard_code: DEFINED_TERM_STANDARD_CODES,
      source_code: DEFINED_TERM_PERSON_SOURCE_CODES,
      knowledge_party: DEFINED_TERM_KNOWLEDGE_PARTIES,
    },
    evidence,
    extraction_version: RESPONSE_VERSION,
    normalisation_version: RESPONSE_VERSION,
    derivation_version: RESPONSE_VERSION,
  };
}

function normaliseDefinedTermIdentity(value) {
  if (typeof value !== 'string') return null;
  const normalised = value.normalize('NFKC').replace(/[“”"']/g, '')
    .replace(/[^A-Za-z0-9]+/g, ' ').trim().toLowerCase();
  return normalised || null;
}

function recordedDefinitionMappingForTerm(term) {
  const identity = normaliseDefinedTermIdentity(term);
  return identity ? RECORDED_DEFINITION_TERM_MAP[identity] || null : null;
}

function shapeDefinitionEnvelope(envelope, sourceBytes, ordinalFor, dropCounter) {
  if (!envelope || typeof envelope !== 'object') return null;
  const head = envelope.definition_head_quote;
  const body = envelope.definition_body_quote;
  const headEvidence = evidenceFromQuote(sourceBytes, head, 'DEFINITION');
  const bodyEvidence = evidenceFromQuote(sourceBytes, body);
  if (!headEvidence || !bodyEvidence) {
    dropCounter.record('DEFINITION_ENVELOPE_QUOTE_UNVERIFIED', head || body || '');
    return null;
  }
  const term = typeof envelope.defined_term === 'string' ? envelope.defined_term.trim() : '';
  if (!term || !head.includes(term)) {
    dropCounter.record('DEFINITION_ENVELOPE_TERM_UNVERIFIED', term || head);
    return null;
  }
  const definitionKind = DEFINITION_ENVELOPE_KINDS.includes(envelope.definition_kind)
    ? envelope.definition_kind : 'TERM_DEFINITION';
  const crossReference = typeof envelope.cross_reference_target === 'string'
    && envelope.cross_reference_target.trim()
    && body.includes(envelope.cross_reference_target)
    ? envelope.cross_reference_target.trim() : null;
  const definitionEnvelope = {
    defined_term: term,
    normalized_term_identity: normaliseDefinedTermIdentity(term),
    definition_kind: definitionKind,
    definition_head_quote: head,
    definition_body_quote: body,
    cross_reference_target: crossReference,
    owner_hint: typeof envelope.owner_hint === 'string' ? envelope.owner_hint : null,
  };
  const recordedMapping = recordedDefinitionMappingForTerm(term);
  if (recordedMapping) {
    const attributes = {
      section_reference: envelope.section_reference ?? null,
      assertion_kind: 'RECORDED_DEFINITION',
      defined_term_ref: term,
      definition_head_quote: head,
      definition_envelope: definitionEnvelope,
    };
    const subjectId = mintSubjectId({ kind: 'RECORDED_DEFINED_TERM', ...attributes });
    const evidence = head === body ? [bodyEvidence] : [headEvidence, bodyEvidence];
    return {
      kind: 'claim',
      proposal_kind: DEFINED_TERM_PROPOSAL_KIND,
      subject_occurrence_id: subjectId,
      claim_definition_key: DEFINED_TERM_CLAIM_KEY,
      claim_definition_version: 1,
      ordinal: ordinalFor(`${subjectId}:${DEFINED_TERM_CLAIM_KEY}`),
      state: 'PRESENT',
      raw_value: body,
      canonical_value: null,
      attributes,
      allowed_attributes: Object.keys(attributes),
      taxonomy_codes: { assertion_kind: 'RECORDED_DEFINITION' },
      codebooks: { assertion_kind: DEFINED_TERM_ASSERTION_KINDS },
      evidence,
      extraction_version: RESPONSE_VERSION,
      normalisation_version: RESPONSE_VERSION,
      derivation_version: RESPONSE_VERSION,
    };
  }
  const proposal = shapeOpenWorldCandidate({
    observed_quote: body,
    why_unmapped: 'DEFINITION_ENVELOPE: exact definition evidence retained pending structured review',
    nearest_concept: null,
    structured_mechanic: definitionEnvelope,
  }, sourceBytes, ordinalFor, dropCounter);
  if (proposal) {
    proposal.attributes.definition_envelope = definitionEnvelope;
    proposal.allowed_attributes.push('definition_envelope');
  }
  return proposal;
}

function shapeDefinedTermsProposals(parsed, sourceText) {
  const sourceBytes = Buffer.from(sourceText, 'utf8');
  const ordinalFor = makeOrdinalCounter();
  const dropped = [];
  const dropCounter = {
    record(reason, quote) {
      dropped.push({ reason, quote_preview: String(quote).slice(0, 120) });
    },
  };

  const proposals = [];
  const assertions = Array.isArray(parsed.defined_term_assertions) ? parsed.defined_term_assertions : [];
  for (const assertion of assertions) {
    const proposal = shapeDefinedTermAssertion(assertion, sourceBytes, ordinalFor, dropCounter);
    if (proposal) proposals.push(proposal);
  }
  const envelopes = Array.isArray(parsed.definition_envelopes) ? parsed.definition_envelopes : [];
  for (const envelope of envelopes) {
    const proposal = shapeDefinitionEnvelope(envelope, sourceBytes, ordinalFor, dropCounter);
    if (proposal) proposals.push(proposal);
  }
  const openWorldCandidates = Array.isArray(parsed.open_world_candidates) ? parsed.open_world_candidates : [];
  for (const candidate of openWorldCandidates) {
    const proposal = shapeOpenWorldCandidate(candidate, sourceBytes, ordinalFor, dropCounter);
    if (proposal) proposals.push(proposal);
  }
  return { proposals, evidence_residuals: dropped };
}

function shapeMaterialContractCriterion(criterion, sourceBytes, ordinalFor, dropCounter) {
  if (!criterion || typeof criterion !== 'object') return [];
  const evidence = evidenceFromQuote(sourceBytes, criterion.quote);
  if (!evidence) {
    if (criterion.quote) dropCounter.record('MATERIAL_CONTRACT_QUOTE_UNVERIFIED', criterion.quote);
    return [];
  }
  const sectionReference = criterion.section_reference ?? null;
  const partyMaking = criterion.party_making ?? null;
  const bucketCode = criterion.bucket_code ?? null;
  const thresholdKind = criterion.threshold_kind ?? null;
  const thresholdValue = criterion.threshold_value ?? null;
  const cadenceKind = criterion.cadence_kind ?? null;
  const definitionCrossReferences = Array.isArray(criterion.definition_cross_references)
    ? criterion.definition_cross_references
    : [];
  const subjectId = mintSubjectId({
    kind: 'MATERIAL_CONTRACT_CRITERION',
    section_reference: sectionReference,
    party_making: partyMaking,
    bucket_code: bucketCode,
    quote: criterion.quote,
  });
  const common = {
    kind: 'claim',
    proposal_kind: MATERIAL_CONTRACT_PROPOSAL_KIND,
    subject_occurrence_id: subjectId,
    claim_definition_version: 1,
    state: 'PRESENT',
    raw_value: criterion.quote,
    attributes: {
      section_reference: sectionReference,
      party_making: partyMaking,
      bucket_code: bucketCode,
      threshold_kind: thresholdKind,
      threshold_value: thresholdValue,
      cadence_kind: cadenceKind,
      definition_cross_references: definitionCrossReferences,
    },
    allowed_attributes: [
      'section_reference', 'party_making', 'bucket_code', 'threshold_kind',
      'threshold_value', 'cadence_kind', 'definition_cross_references',
    ],
    evidence: [evidence],
    extraction_version: RESPONSE_VERSION,
    normalisation_version: RESPONSE_VERSION,
    derivation_version: RESPONSE_VERSION,
  };
  const proposals = [{
    ...common,
    claim_definition_key: MATERIAL_CONTRACT_BUCKET_CLAIM_KEY,
    ordinal: ordinalFor(`${subjectId}:${MATERIAL_CONTRACT_BUCKET_CLAIM_KEY}`),
    canonical_value: bucketCode,
    taxonomy_codes: bucketCode && MATERIAL_CONTRACT_BUCKET_KINDS.includes(bucketCode)
      ? { bucket_code: bucketCode }
      : {},
    codebooks: { bucket_code: MATERIAL_CONTRACT_BUCKET_KINDS },
  }];
  if (thresholdKind) proposals.push({
    ...common,
    claim_definition_key: MATERIAL_CONTRACT_THRESHOLD_CLAIM_KEY,
    ordinal: ordinalFor(`${subjectId}:${MATERIAL_CONTRACT_THRESHOLD_CLAIM_KEY}`),
    canonical_value: thresholdKind,
    taxonomy_codes: thresholdKind && MATERIAL_CONTRACT_THRESHOLD_KINDS.includes(thresholdKind)
      ? { threshold_kind: thresholdKind }
      : {},
    codebooks: {
      threshold_kind: MATERIAL_CONTRACT_THRESHOLD_KINDS,
      cadence_kind: MATERIAL_CONTRACT_CADENCE_KINDS,
    },
  });
  return proposals;
}

function shapeMaterialContractsProposals(parsed, sourceText) {
  const sourceBytes = Buffer.from(sourceText, 'utf8');
  const ordinalFor = makeOrdinalCounter();
  const dropped = [];
  const dropCounter = {
    record(reason, quote) {
      dropped.push({ reason, quote_preview: String(quote).slice(0, 120) });
    },
  };
  const proposals = [];
  const criteria = Array.isArray(parsed.material_contract_criteria) ? parsed.material_contract_criteria : [];
  for (const criterion of criteria) {
    proposals.push(...shapeMaterialContractCriterion(criterion, sourceBytes, ordinalFor, dropCounter));
  }
  const openWorldCandidates = Array.isArray(parsed.open_world_candidates) ? parsed.open_world_candidates : [];
  for (const candidate of openWorldCandidates) {
    const proposal = shapeOpenWorldCandidate(candidate, sourceBytes, ordinalFor, dropCounter);
    if (proposal) proposals.push(proposal);
  }
  return { proposals, evidence_residuals: dropped };
}

function shapeGeneralCovenant(covenant, sourceBytes, ordinalFor, dropCounter) {
  if (!covenant || typeof covenant !== 'object') return null;
  const evidence = evidenceFromQuote(sourceBytes, covenant.quote);
  if (!evidence) {
    if (covenant.quote) dropCounter.record('GENERAL_COVENANT_QUOTE_UNVERIFIED', covenant.quote);
    return null;
  }
  const covenantCode = covenant.covenant_code ?? null;
  const claimDefinitionKey = GENERAL_COVENANT_CLAIM_KEYS[covenantCode]
    || 'NATIVE_GENERAL_COVENANT_UNSUPPORTED_CANDIDATE';
  const sectionReference = covenant.section_reference ?? null;
  const covenantObligor = covenant.covenant_obligor ?? null;
  const definitionCrossReferences = Array.isArray(covenant.definition_cross_references)
    ? covenant.definition_cross_references
    : [];
  const subjectId = mintSubjectId({
    kind: 'GENERAL_COVENANT',
    section_reference: sectionReference,
    covenant_obligor: covenantObligor,
    covenant_code: covenantCode,
    quote: covenant.quote,
  });
  return {
    kind: 'claim',
    proposal_kind: GENERAL_COVENANT_PROPOSAL_KIND,
    subject_occurrence_id: subjectId,
    claim_definition_key: claimDefinitionKey,
    claim_definition_version: 1,
    ordinal: ordinalFor(`${subjectId}:${claimDefinitionKey}`),
    state: 'PRESENT',
    raw_value: covenant.quote,
    canonical_value: covenantCode,
    attributes: {
      section_reference: sectionReference,
      covenant_obligor: covenantObligor,
      covenant_code: covenantCode,
      owner_id: GENERAL_COVENANT_FOLLOW_ON_OWNERS[covenantCode] || null,
      definition_cross_references: definitionCrossReferences,
    },
    allowed_attributes: [
      'section_reference', 'covenant_obligor', 'covenant_code', 'owner_id',
      'definition_cross_references',
    ],
    taxonomy_codes: GENERAL_COVENANT_CODES.includes(covenantCode)
      ? { covenant_code: covenantCode }
      : {},
    codebooks: { covenant_code: GENERAL_COVENANT_CODES },
    evidence: [evidence],
    extraction_version: RESPONSE_VERSION,
    normalisation_version: RESPONSE_VERSION,
    derivation_version: RESPONSE_VERSION,
  };
}

function shapeGeneralCovenantsProposals(parsed, sourceText) {
  const sourceBytes = Buffer.from(sourceText, 'utf8');
  const ordinalFor = makeOrdinalCounter();
  const dropped = [];
  const dropCounter = {
    record(reason, quote) {
      dropped.push({ reason, quote_preview: String(quote).slice(0, 120) });
    },
  };
  const proposals = [];
  const covenants = Array.isArray(parsed.general_covenants) ? parsed.general_covenants : [];
  for (const covenant of covenants) {
    const proposal = shapeGeneralCovenant(covenant, sourceBytes, ordinalFor, dropCounter);
    if (proposal) proposals.push(proposal);
  }
  const openWorldCandidates = Array.isArray(parsed.open_world_candidates) ? parsed.open_world_candidates : [];
  for (const candidate of openWorldCandidates) {
    const proposal = shapeOpenWorldCandidate(candidate, sourceBytes, ordinalFor, dropCounter);
    if (proposal) proposals.push(proposal);
  }
  return { proposals, evidence_residuals: dropped };
}

function shapeIocProposals(parsed, sourceText, governedScope = {}) {
  const sourceBytes = Buffer.from(sourceText, 'utf8');
  const ordinalFor = makeOrdinalCounter();
  const dropped = [];
  const dropCounter = { record(reason, quote) { dropped.push({ reason, quote_preview: String(quote).slice(0, 120) }); } };
  const proposals = [];
  for (const assertion of (Array.isArray(parsed.ioc_restriction_assertions) ? parsed.ioc_restriction_assertions : [])) {
    if (!assertion || typeof assertion !== 'object') continue;
    if (assertion.assertion_kind !== 'RESTRICTION_PRESENT') {
      const proposal = shapeOpenWorldCandidate({
        observed_quote: assertion.quote,
        why_unmapped: 'IOC_ASSERTION_KIND_UNADJUDICATED',
        nearest_concept: null,
      }, sourceBytes, ordinalFor, dropCounter);
      if (proposal) proposals.push(proposal);
      continue;
    }
    const evidence = evidenceFromQuote(sourceBytes, assertion.quote);
    if (!evidence) {
      if (assertion.quote) dropCounter.record('IOC_RESTRICTION_QUOTE_UNVERIFIED', assertion.quote);
      continue;
    }
    const subjectId = mintSubjectId({
      kind: 'IOC_RESTRICTION',
      section_reference: assertion.section_reference ?? null,
      restriction_category: assertion.restriction_category ?? null,
      covenant_side: governedScope.covenant_side ?? null,
      quote: assertion.quote ?? null,
    });
    proposals.push({
      kind: 'claim',
      proposal_kind: IOC_RESTRICTION_PROPOSAL_KIND,
      subject_occurrence_id: subjectId,
      claim_definition_key: IOC_RESTRICTION_CLAIM_KEY,
      claim_definition_version: 1,
      ordinal: ordinalFor(`${subjectId}:${IOC_RESTRICTION_CLAIM_KEY}`),
      state: 'PRESENT',
      raw_value: assertion.quote,
      canonical_value: null,
      attributes: {
        section_reference: assertion.section_reference ?? null,
        assertion_kind: assertion.assertion_kind ?? null,
        restriction_category: assertion.restriction_category ?? null,
        threshold_basis: assertion.threshold_basis ?? null,
        covenant_side: governedScope.covenant_side ?? null,
      },
      allowed_attributes: [
        'section_reference', 'assertion_kind', 'restriction_category', 'threshold_basis', 'covenant_side',
      ],
      taxonomy_codes: {},
      codebooks: { assertion_kind: IOC_ASSERTION_KINDS },
      evidence: [evidence],
      extraction_version: RESPONSE_VERSION,
      normalisation_version: RESPONSE_VERSION,
      derivation_version: RESPONSE_VERSION,
    });
  }
  for (const mechanic of (Array.isArray(parsed.ioc_mechanics) ? parsed.ioc_mechanics : [])) {
    const proposal = shapeIocMechanic(mechanic, sourceBytes, ordinalFor, dropCounter);
    if (proposal) proposals.push(proposal);
  }
  for (const candidate of (Array.isArray(parsed.open_world_candidates) ? parsed.open_world_candidates : [])) {
    const proposal = shapeOpenWorldCandidate(candidate, sourceBytes, ordinalFor, dropCounter);
    if (proposal) proposals.push(proposal);
  }
  return { proposals, evidence_residuals: dropped };
}

function shapeClosingConditionAssertion(assertion, sourceBytes, ordinalFor, dropCounter) {
  if (!assertion || typeof assertion !== 'object') return null;
  const evidence = evidenceFromQuote(sourceBytes, assertion.quote);
  if (!evidence) {
    if (assertion.quote) dropCounter.record('CLOSING_CONDITION_QUOTE_UNVERIFIED', assertion.quote);
    return null;
  }
  const assertionKind = assertion.assertion_kind ?? null;
  const subjectId = mintSubjectId({ kind: 'CLOSING_CONDITION_ASSERTION', section_reference: assertion.section_reference ?? null, assertion_kind: assertionKind, quote: assertion.quote ?? null });
  const crossReference = explicitClauseCrossReference(assertion);
  return {
    kind: 'claim', proposal_kind: CLOSING_CONDITION_PROPOSAL_KIND, subject_occurrence_id: subjectId,
    claim_definition_key: CLOSING_CONDITION_CLAIM_KEY, claim_definition_version: 1,
    ordinal: ordinalFor(`${subjectId}:${CLOSING_CONDITION_CLAIM_KEY}`), state: 'PRESENT', raw_value: assertion.quote,
    canonical_value: null,
    attributes: {
      section_reference: assertion.section_reference ?? null, assertion_kind: assertionKind,
      condition_obligor: assertion.condition_obligor ?? null, accuracy_standard: assertion.accuracy_standard ?? null,
      rep_side: assertion.rep_side ?? null, covered_scope_ref: assertion.covered_scope ?? null,
      scrape_quote: assertion.scrape_quote ?? null, mae_term_ref: assertion.mae_term ?? null,
      mae_party: assertion.mae_party ?? null, standard: assertion.standard ?? null,
      obligor_ref: assertion.obligor ?? null, approval_kind: assertion.approval_kind ?? null,
      approval_definition_ref: assertion.approval_definition ?? null,
      s4_component: assertion.s4_component ?? null, listing_venue_ref: assertion.listing_venue ?? null,
      certificate_side: assertion.certificate_side ?? null,
      certifying_party_ref: assertion.certifying_party ?? null,
      certified_condition_refs: Array.isArray(assertion.certified_condition_refs)
        ? assertion.certified_condition_refs : [],
      certificate_relationship_status: assertionKind === 'OFFICER_CERTIFICATE'
        && Array.isArray(assertion.certified_condition_refs)
        && assertion.certified_condition_refs.length > 0
        ? CERTIFICATE_RELATIONSHIP_STATUS.VERBATIM_SECTION_REFERENCES : null,
      causation_standard: assertion.causation_standard ?? null,
      breach_standard: assertion.breach_standard ?? null,
      threshold_role: assertion.threshold_role ?? null,
      burdensome_scope: assertion.burdensome_scope ?? null,
      explicit_clause_cross_reference: crossReference,
    },
    allowed_attributes: [
      'section_reference', 'assertion_kind', 'condition_obligor', 'accuracy_standard',
      'rep_side', 'covered_scope_ref', 'scrape_quote', 'mae_term_ref', 'mae_party',
      'standard', 'obligor_ref', 'approval_kind', 'approval_definition_ref',
      's4_component', 'listing_venue_ref', 'certificate_side', 'certifying_party_ref',
      'certified_condition_refs', 'certificate_relationship_status',
      'causation_standard', 'breach_standard', 'threshold_role', 'burdensome_scope',
      'explicit_clause_cross_reference',
    ],
    taxonomy_codes: assertionKind && CLOSING_CONDITION_ASSERTION_KINDS.includes(assertionKind) ? { assertion_kind: assertionKind } : {},
    codebooks: { assertion_kind: CLOSING_CONDITION_ASSERTION_KINDS }, evidence: [evidence],
    extraction_version: RESPONSE_VERSION, normalisation_version: RESPONSE_VERSION, derivation_version: RESPONSE_VERSION,
  };
}

function shapeClosingConditionProposals(parsed, sourceText) {
  const sourceBytes = Buffer.from(sourceText, 'utf8'); const ordinalFor = makeOrdinalCounter(); const dropped = [];
  const dropCounter = { record(reason, quote) { dropped.push({ reason, quote_preview: String(quote).slice(0, 120) }); } };
  const proposals = [];
  for (const assertion of (Array.isArray(parsed.closing_condition_assertions) ? parsed.closing_condition_assertions : [])) {
    const proposal = shapeClosingConditionAssertion(assertion, sourceBytes, ordinalFor, dropCounter);
    if (proposal) proposals.push(proposal);
  }
  for (const candidate of (Array.isArray(parsed.open_world_candidates) ? parsed.open_world_candidates : [])) {
    const proposal = shapeOpenWorldCandidate(candidate, sourceBytes, ordinalFor, dropCounter);
    if (proposal) proposals.push(proposal);
  }
  return { proposals, evidence_residuals: dropped };
}

function shapeProxyMeetingAssertion(assertion, sourceBytes, ordinalFor, dropCounter) {
  if (!assertion || typeof assertion !== 'object') return null;
  const evidence = evidenceFromQuote(sourceBytes, assertion.quote);
  if (!evidence) {
    if (assertion.quote) dropCounter.record('PROXY_MEETING_QUOTE_UNVERIFIED', assertion.quote);
    return null;
  }
  const assertionKind = assertion.assertion_kind ?? null;
  const attrs = {
    section_reference: assertion.section_reference ?? null,
    assertion_kind: assertionKind,
    anchor_kind: assertion.anchor_kind ?? null,
    day_kind: assertion.day_kind ?? null,
    limit_basis: assertion.limit_basis ?? null,
    control_party: assertion.control_party ?? null,
    consenting_party: assertion.consenting_party ?? null,
    reason_kind: assertion.reason_kind ?? null,
    meeting_ref: assertion.meeting_ref ?? null,
    document_ref: assertion.document_ref ?? null,
    obligated_party: assertion.obligated_party ?? null,
    adoption_mechanism: assertion.adoption_mechanism ?? null,
    adoption_timing: assertion.adoption_timing ?? null,
  };
  const subjectId = mintSubjectId({ kind: 'PROXY_MEETING_ASSERTION', ...attrs, quote: assertion.quote ?? null });
  return {
    kind: 'claim', proposal_kind: PROXY_MEETING_COVENANT_PROPOSAL_KIND,
    subject_occurrence_id: subjectId, claim_definition_key: PROXY_MEETING_COVENANT_CLAIM_KEY,
    claim_definition_version: 1, ordinal: ordinalFor(`${subjectId}:${PROXY_MEETING_COVENANT_CLAIM_KEY}`),
    state: 'PRESENT', raw_value: assertion.quote, canonical_value: null,
    attributes: attrs, allowed_attributes: Object.keys(attrs),
    taxonomy_codes: assertionKind && PROXY_MEETING_ASSERTION_KINDS.includes(assertionKind) ? { assertion_kind: assertionKind } : {},
    codebooks: { assertion_kind: PROXY_MEETING_ASSERTION_KINDS }, evidence: [evidence],
    extraction_version: RESPONSE_VERSION, normalisation_version: RESPONSE_VERSION, derivation_version: RESPONSE_VERSION,
  };
}

function shapeProxyMeetingProposals(parsed, sourceText) {
  const sourceBytes = Buffer.from(sourceText, 'utf8'); const ordinalFor = makeOrdinalCounter(); const dropped = [];
  const dropCounter = { record(reason, quote) { dropped.push({ reason, quote_preview: String(quote).slice(0, 120) }); } };
  const proposals = [];
  for (const assertion of (Array.isArray(parsed.proxy_meeting_assertions) ? parsed.proxy_meeting_assertions : [])) {
    const proposal = shapeProxyMeetingAssertion(assertion, sourceBytes, ordinalFor, dropCounter);
    if (proposal) proposals.push(proposal);
  }
  for (const candidate of (Array.isArray(parsed.open_world_candidates) ? parsed.open_world_candidates : [])) {
    const proposal = shapeOpenWorldCandidate(candidate, sourceBytes, ordinalFor, dropCounter);
    if (proposal) proposals.push(proposal);
  }
  return { proposals, evidence_residuals: dropped };
}

function shapeRegulatoryEffortsAssertion(assertion, sourceBytes, ordinalFor, dropCounter) {
  if (!assertion || typeof assertion !== 'object') return null;
  const evidence = evidenceFromQuote(sourceBytes, assertion.quote);
  if (!evidence) {
    if (assertion.quote) dropCounter.record('REGULATORY_EFFORTS_QUOTE_UNVERIFIED', assertion.quote);
    return null;
  }
  const attrs = {
    section_reference: assertion.section_reference ?? null,
    assertion_kind: assertion.assertion_kind ?? null,
    proposed_canonical_value: assertion.canonical_value ?? null,
    obligor_party_scope: assertion.obligor_party_scope ?? null,
    obligor_party: assertion.obligor_party ?? null,
    burden_term_ref: assertion.burden_term_ref ?? null,
    burden_baseline: assertion.burden_baseline ?? null,
    burden_baseline_ref: assertion.burden_baseline_ref ?? null,
    day_kind: assertion.day_kind ?? null,
    filing_regime_ref: assertion.filing_regime_ref ?? null,
    timing_relation: assertion.timing_relation ?? null,
    timing_trigger: assertion.timing_trigger ?? null,
    fixed_date_ref: assertion.fixed_date_ref ?? null,
    control_holder_party: assertion.control_holder_party ?? null,
    strategy_scope_ref: assertion.strategy_scope_ref ?? null,
    right_holder_party: assertion.right_holder_party ?? null,
    cooperation_scope_ref: assertion.cooperation_scope_ref ?? null,
    information_scope_ref: assertion.information_scope_ref ?? null,
    information_protection_kind: assertion.information_protection_kind ?? null,
    information_protection_kinds: Array.isArray(assertion.information_protection_kinds)
      ? assertion.information_protection_kinds : null,
    notification_event_ref: assertion.notification_event_ref ?? null,
    notification_timing_ref: assertion.notification_timing_ref ?? null,
    prohibited_action_ref: assertion.prohibited_action_ref ?? null,
    impairment_effect_ref: assertion.impairment_effect_ref ?? null,
    withdrawal_exception_ref: assertion.withdrawal_exception_ref ?? null,
    withdrawal_refile_period_days: assertion.withdrawal_refile_period_days ?? null,
    withdrawal_refile_day_kind: assertion.withdrawal_refile_day_kind ?? null,
  };
  const subjectId = mintSubjectId({ kind: 'REGULATORY_EFFORTS_ASSERTION', ...attrs, quote: assertion.quote });
  return {
    kind: 'claim', proposal_kind: REGULATORY_EFFORTS_PROPOSAL_KIND,
    subject_occurrence_id: subjectId, claim_definition_key: REGULATORY_EFFORTS_CLAIM_KEY,
    claim_definition_version: 1, ordinal: ordinalFor(`${subjectId}:${REGULATORY_EFFORTS_CLAIM_KEY}`),
    state: 'PRESENT', raw_value: assertion.quote, canonical_value: null, attributes: attrs,
    allowed_attributes: Object.keys(attrs),
    taxonomy_codes: attrs.assertion_kind && REGULATORY_ASSERTION_KINDS.includes(attrs.assertion_kind) ? { assertion_kind: attrs.assertion_kind } : {},
    codebooks: { assertion_kind: REGULATORY_ASSERTION_KINDS, obligor_party_scope: REGULATORY_OBLIGOR_SCOPES, day_kind: REGULATORY_DAY_KINDS, information_protection_kind: REGULATORY_INFORMATION_PROTECTION_KINDS, information_protection_kinds: REGULATORY_INFORMATION_PROTECTION_KINDS },
    evidence: [evidence], extraction_version: RESPONSE_VERSION, normalisation_version: RESPONSE_VERSION, derivation_version: RESPONSE_VERSION,
  };
}

function shapeRegulatoryEffortsProposals(parsed, sourceText) {
  const sourceBytes = Buffer.from(sourceText, 'utf8');
  const ordinalFor = makeOrdinalCounter();
  const dropped = [];
  const dropCounter = { record(reason, quote) { dropped.push({ reason, quote_preview: String(quote).slice(0, 120) }); } };
  const proposals = [];
  for (const assertion of (Array.isArray(parsed.regulatory_efforts_assertions) ? parsed.regulatory_efforts_assertions : [])) {
    const proposal = shapeRegulatoryEffortsAssertion(assertion, sourceBytes, ordinalFor, dropCounter);
    if (proposal) proposals.push(proposal);
  }
  for (const candidate of (Array.isArray(parsed.open_world_candidates) ? parsed.open_world_candidates : [])) {
    const proposal = shapeOpenWorldCandidate(candidate, sourceBytes, ordinalFor, dropCounter);
    if (proposal) proposals.push(proposal);
  }
  return { proposals, evidence_residuals: dropped };
}

function shapeConsiderationAssertion(assertion, sourceBytes, ordinalFor, dropCounter) {
  if (!assertion || typeof assertion !== 'object') return null;
  const evidence = evidenceFromQuote(sourceBytes, assertion.quote);
  if (!evidence) {
    if (assertion.quote) dropCounter.record('CONSIDERATION_QUOTE_UNVERIFIED', assertion.quote);
    return null;
  }
  const assertionKind = assertion.assertion_kind ?? null;
  const considerationTerm = assertion.consideration_term ?? null;
  const ratioTerm = assertion.ratio_term ?? null;
  const issuerStock = assertion.issuer_stock ?? null;
  const appraisalStatus = assertion.appraisal_status ?? null;
  const statute = assertion.statute ?? null;
  const sectionReference = assertion.section_reference ?? null;
  const subjectId = mintSubjectId({
    kind: 'CONSIDERATION_ASSERTION',
    section_reference: sectionReference,
    assertion_kind: assertionKind,
    consideration_term_ref: considerationTerm,
    ratio_term_ref: ratioTerm,
    issuer_stock_ref: issuerStock,
    appraisal_status: appraisalStatus,
    statute_ref: statute,
    quote: assertion.quote ?? null,
  });
  return {
    kind: 'claim',
    proposal_kind: CONSIDERATION_PROPOSAL_KIND,
    subject_occurrence_id: subjectId,
    claim_definition_key: CONSIDERATION_CLAIM_KEY,
    claim_definition_version: 1,
    ordinal: ordinalFor(`${subjectId}:${CONSIDERATION_CLAIM_KEY}`),
    state: 'PRESENT',
    raw_value: assertion.quote,
    canonical_value: null,
    attributes: {
      section_reference: sectionReference,
      assertion_kind: assertionKind,
      consideration_term_ref: considerationTerm,
      ratio_term_ref: ratioTerm,
      issuer_stock_ref: issuerStock,
      appraisal_status: appraisalStatus,
      statute_ref: statute,
    },
    allowed_attributes: [
      'section_reference', 'assertion_kind', 'consideration_term_ref',
      'ratio_term_ref', 'issuer_stock_ref', 'appraisal_status', 'statute_ref',
    ],
    taxonomy_codes: {
      ...(CONSIDERATION_ASSERTION_KINDS.includes(assertionKind)
        ? { assertion_kind: assertionKind } : {}),
      ...(APPRAISAL_STATUS_VALUES.includes(appraisalStatus)
        ? { appraisal_status: appraisalStatus } : {}),
    },
    codebooks: {
      assertion_kind: CONSIDERATION_ASSERTION_KINDS,
      appraisal_status: APPRAISAL_STATUS_VALUES,
    },
    evidence: [evidence],
    extraction_version: RESPONSE_VERSION,
    normalisation_version: RESPONSE_VERSION,
    derivation_version: RESPONSE_VERSION,
  };
}

function shapeConsiderationProposals(parsed, sourceText) {
  const sourceBytes = Buffer.from(sourceText, 'utf8');
  const ordinalFor = makeOrdinalCounter();
  const dropped = [];
  const dropCounter = {
    record(reason, quote) {
      dropped.push({ reason, quote_preview: String(quote).slice(0, 120) });
    },
  };
  const proposals = [];
  const assertions = Array.isArray(parsed.consideration_assertions)
    ? parsed.consideration_assertions
    : [];
  for (const assertion of assertions) {
    const proposal = shapeConsiderationAssertion(assertion, sourceBytes, ordinalFor, dropCounter);
    if (proposal) proposals.push(proposal);
  }
  for (const mechanic of (Array.isArray(parsed.consideration_mechanics)
    ? parsed.consideration_mechanics : [])) {
    const surface = CONSIDERATION_MECHANIC_SURFACES.includes(mechanic?.surface)
      ? mechanic.surface : 'UNCLASSIFIED_SURFACE';
    const exact = (value) => typeof value === 'string' && value.length > 0
      && typeof mechanic.quote === 'string' && mechanic.quote.includes(value) ? value : null;
    const exactList = (field) => Array.isArray(mechanic?.[field])
      ? mechanic[field].map(exact).filter(Boolean) : [];
    const alternatives = exactList('alternatives');
    const cashAlternatives = exactList('cash_alternatives');
    const stockAlternatives = exactList('stock_alternatives');
    const structuredMechanic = {
      surface,
      ...(alternatives.length ? { alternatives } : {}),
      ...(cashAlternatives.length ? { cash_alternatives: cashAlternatives } : {}),
      ...(stockAlternatives.length ? { stock_alternatives: stockAlternatives } : {}),
      ...Object.fromEntries(ELECTION_MECHANIC_FIELDS
        .filter((field) => !['alternatives', 'cash_alternatives', 'stock_alternatives'].includes(field))
        .map((field) => [field, exact(mechanic?.[field])]).filter(([, value]) => value)),
    };
    const proposal = shapeOpenWorldCandidate({
      observed_quote: mechanic?.quote,
      why_unmapped: `${surface}: ${mechanic?.detail || 'Consideration mechanism observed'}`,
      nearest_concept: null,
      structured_mechanic: structuredMechanic,
    }, sourceBytes, ordinalFor, dropCounter);
    if (proposal) proposals.push(proposal);
  }
  const openWorldCandidates = Array.isArray(parsed.open_world_candidates)
    ? parsed.open_world_candidates
    : [];
  for (const candidate of openWorldCandidates) {
    const proposal = shapeOpenWorldCandidate(candidate, sourceBytes, ordinalFor, dropCounter);
    if (proposal) proposals.push(proposal);
  }
  return { proposals, evidence_residuals: dropped };
}
function shapeProposals(parsed, sourceText) {
  const sourceBytes = Buffer.from(sourceText, 'utf8');
  const ordinalFor = makeOrdinalCounter();
  const dropped = [];
  const dropCounter = {
    record(reason, quote) {
      dropped.push({ reason, quote_preview: String(quote).slice(0, 120) });
    },
  };

  const proposals = [];
  for (const instance of parsed.representation_instances) {
    proposals.push(...shapeRepresentationInstance(instance, sourceBytes, ordinalFor, dropCounter));
  }
  for (const condition of parsed.bring_down_conditions) {
    proposals.push(...shapeBringDownCondition(condition, sourceBytes, ordinalFor, dropCounter));
  }
  for (const candidate of parsed.open_world_candidates) {
    const proposal = shapeOpenWorldCandidate(candidate, sourceBytes, ordinalFor, dropCounter);
    if (proposal) proposals.push(proposal);
  }
  const shareCountAssertions = Array.isArray(parsed[SHARE_COUNT_ASSERTIONS_KEY])
    ? parsed[SHARE_COUNT_ASSERTIONS_KEY]
    : [];
  const zeroShareCountAssertions = deriveZeroShareCountAssertions(parsed.representation_instances);
  const shareCountProposals = [];
  for (const assertion of [...shareCountAssertions, ...zeroShareCountAssertions]) {
    const proposal = shapeShareCountAssertion(assertion, sourceBytes, ordinalFor, dropCounter);
    if (proposal) shareCountProposals.push(proposal);
  }
  const seenShareCounts = new Set();
  for (const proposal of shareCountProposals) {
    const identity = shareCountProposalIdentity(proposal);
    if (identity && seenShareCounts.has(identity)) continue;
    if (identity) seenShareCounts.add(identity);
    proposals.push(proposal);
  }

  // Unverifiable evidence leaves as a typed residual, not a silent omission.
  // The model asserted something we could not evidence; that fact is carried
  // forward and bound into the receipt rather than discarded.
  return { proposals, evidence_residuals: dropped };
}

function representationSideFor(partyMaking) { if (typeof partyMaking !== 'string') return null; const target = /\b(?:company|target|seller)\b/i.test(partyMaking); const buyer = /\b(?:parent|buyer|acquir)/i.test(partyMaking); return target === buyer ? null : (target ? 'TARGET' : 'BUYER'); }
function shapeRepresentationQualifierProposals(parsed, sourceText) {
  const sourceBytes = Buffer.from(sourceText, 'utf8'); const ordinalFor = makeOrdinalCounter(); const dropped = []; const dropCounter = { record(reason, quote) { dropped.push({ reason, quote_preview: String(quote).slice(0, 120) }); } }; const proposals = [];
  for (const instance of (Array.isArray(parsed.representation_instances) ? parsed.representation_instances : [])) {
    const partyMaking = instance?.party_making ?? null;
    const side = representationSideFor(partyMaking);
    for (const qualifier of (Array.isArray(instance?.qualifiers) ? instance.qualifiers : [])) {
      const evidence = evidenceFromQuote(sourceBytes, qualifier?.quote);
      if (!evidence) {
        if (qualifier?.quote) dropCounter.record('REPRESENTATION_QUALIFIER_QUOTE_UNVERIFIED', qualifier.quote);
        continue;
      }
      const attachment = qualifier.attachment && typeof qualifier.attachment === 'object'
        ? qualifier.attachment : null;
      const subjectId = mintSubjectId({
        kind: 'REPRESENTATION_QUALIFIER',
        section_reference: instance?.section_reference ?? null,
        party_making: partyMaking,
        side,
        quote: qualifier.quote,
      });
      proposals.push({
        kind: 'claim',
        proposal_kind: REPRESENTATION_QUALIFIER_PROPOSAL_KIND,
        subject_occurrence_id: subjectId,
        claim_definition_key: REPRESENTATION_QUALIFIER_CLAIM_KEY,
        claim_definition_version: 1,
        ordinal: ordinalFor(`${subjectId}:${REPRESENTATION_QUALIFIER_CLAIM_KEY}`),
        state: 'PRESENT',
        raw_value: qualifier.quote,
        canonical_value: qualifier.code ?? null,
        attributes: {
          section_reference: instance?.section_reference ?? null,
          party_making: partyMaking,
          representation_side: side,
          qualifier_kind: qualifier.kind ?? null,
          attachment,
        },
        allowed_attributes: [
          'section_reference', 'party_making', 'representation_side', 'qualifier_kind', 'attachment',
        ],
        taxonomy_codes: qualifier.code ? { qualifier_code: qualifier.code } : {},
        codebooks: { qualifier_code: QUALIFIER_CODES },
        evidence: [evidence],
        extraction_version: RESPONSE_VERSION,
        normalisation_version: RESPONSE_VERSION,
        derivation_version: RESPONSE_VERSION,
      });
    }
  }
  for (const candidate of (Array.isArray(parsed.open_world_candidates) ? parsed.open_world_candidates : [])) { const proposal = shapeOpenWorldCandidate(candidate, sourceBytes, ordinalFor, dropCounter); if (proposal) proposals.push(proposal); }
  return { proposals, evidence_residuals: dropped };
}

const FAMILY_RESPONSE_SHAPERS = Object.freeze({
  CAPITALISATION: shapeProposals,
  TERMINATION_FEE: shapeTerminationFeeProposals,
  NO_SHOP: shapeNoShopProposals,
  MAE_DEFINITION: shapeMaeDefinitionProposals,
  TERMINATION: shapeTerminationProposals,
  MATERIAL_CONTRACTS: shapeMaterialContractsProposals,
  NO_OTHER_REPS_FRAUD: shapeNoOtherRepsFraudProposals,
  GENERAL_COVENANTS: shapeGeneralCovenantsProposals,
  INTERIM_OPERATING: shapeIocProposals,
  CLOSING_CONDITIONS: shapeClosingConditionProposals,
  PROXY_MEETING: shapeProxyMeetingProposals,
  ANTITRUST_REGULATORY: shapeRegulatoryEffortsProposals,
  MERGER_STRUCTURE_CLOSING: shapeMergerStructureProposals,
  REPRESENTATIONS: shapeRepresentationQualifierProposals,
  CONSIDERATION: shapeConsiderationProposals,
  FINANCING_COVENANTS: shapeFinancingFamilyProposals,
  GUARANTY_FINANCING_PARTY: shapeGuarantyFamilyProposals,
  EMPLOYEE_MATTERS: shapeEmployeeMattersFamilyProposals,
  DNO_INDEMNIFICATION: shapeDnoFamilyProposals,
  TAX_MATTERS: shapeTaxMattersFamilyProposals,
  DIVIDENDS: shapeDividendsFamilyProposals,
  APPRAISAL_DISSENTERS_RIGHTS: shapeAppraisalFamilyProposals,
  SPECIFIC_PERFORMANCE_REMEDIES: shapeSpecificPerformanceRemedyProposals,
  MISC_BOILERPLATE: shapeMiscBoilerplateProposals,
  KEY_DEFINED_TERMS: shapeDefinedTermsFamilyProposals,
});

// The live provider consumes this single adapter record. Prompt selection,
// response shape, and shaping must move together for each family.
const FAMILY_ADAPTERS = Object.freeze(Object.fromEntries(
  Object.entries(FAMILY_RESPONSE_SHAPERS).map(([family, shaper]) => [family, Object.freeze({
    family,
    prompt_builder: getProducerPromptModule(family),
    required_response_lists: REQUIRED_RESPONSE_LISTS_BY_FAMILY[family],
    response_shaper: shaper,
  })]),
));

function getFamilyAdapter(sectionFamily) {
  if (typeof sectionFamily !== 'string' || sectionFamily.length === 0) return null;
  const adapter = FAMILY_ADAPTERS[sectionFamily];
  if (!adapter || typeof adapter.prompt_builder !== 'function'
    || !Array.isArray(adapter.required_response_lists)
    || typeof adapter.response_shaper !== 'function') return null;
  return adapter;
}

function plainJsonObjectOrNull(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)
    || Object.getPrototypeOf(value) !== Object.prototype) return null;
  try {
    return JSON.parse(JSON.stringify(value));
  } catch {
    return null;
  }
}

function providerResponseMetadata(response) {
  const requestId = [
    response?.provider_request_id,
    response?.request_id,
    response?.requestId,
    response?.id,
  ].find((value) => typeof value === 'string' && value.length > 0) || null;
  const usage = plainJsonObjectOrNull(response?.provider_usage ?? response?.usage);
  return Object.freeze({
    ...(requestId === null ? {} : { provider_request_id: requestId }),
    ...(usage === null ? {} : { provider_usage: usage }),
  });
}

// ---------------------------------------------------------------------------
// Model call with bounded retry. Every failure mode -- transient call
// failure, malformed JSON, missing schema key, oversized response -- is
// caught here and either retried or converted to a typed failure. Nothing
// silently becomes an empty success.
// ---------------------------------------------------------------------------

async function callModelOnce({
  client,
  model,
  prompt,
  maxTokens,
  maxResponseChars,
  validateResponse = validateResponseShape,
}) {
  let resp;
  try {
    resp = await client.messages.create({
      model,
      max_tokens: maxTokens,
      messages: prompt.messages,
    });
  } catch (err) {
    throw new NativeProducerAnthropicError(
      'TRANSIENT_CALL_FAILED',
      `model call failed: ${err && err.message ? err.message : String(err)}`,
      { cause: err && err.message },
    );
  }

  const raw = (resp && Array.isArray(resp.content))
    ? resp.content.map((c) => c.text || '').join('')
    : '';

  if (raw.length > maxResponseChars) {
    throw new NativeProducerAnthropicError(
      'RESPONSE_TOO_LARGE',
      `model response (${raw.length} chars) exceeds the bounded maximum (${maxResponseChars} chars)`,
      { response_length: raw.length, max_response_chars: maxResponseChars },
    );
  }

  let parsed;
  try {
    parsed = JSON.parse(raw.replace(/^[\u0009\u000a\u000d\u0020]+|[\u0009\u000a\u000d\u0020]+$/g, ''));
  } catch {
    throw new NativeProducerAnthropicError(
      'MALFORMED_RESPONSE',
      'model response must be one complete literal JSON object with no prose or trailing bytes',
      { raw_length: raw.length, raw_response_text: raw },
    );
  }
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new NativeProducerAnthropicError(
      'MALFORMED_RESPONSE',
      'model response must be one complete literal JSON object',
      { raw_length: raw.length, raw_response_text: raw },
    );
  }
  try {
    validateResponse(parsed);
  } catch (error) {
    if (error instanceof NativeProducerAnthropicError) {
      throw new NativeProducerAnthropicError(
        error.code,
        error.message,
        { ...error.details, raw_length: raw.length, raw_response_text: raw },
      );
    }
    throw error;
  }
  return { parsed, raw, provider_metadata: providerResponseMetadata(resp) };
}

/**
 * @param {object} args
 * @param {string} [args.model]        model id; defaults to lib/model.js MODEL
 * @param {number} [args.maxRetries]   retries AFTER the first attempt (default 2)
 * @param {string} [args.apiKey]       Anthropic API key; falls back to ANTHROPIC_API_KEY
 * @param {object} [args.client]       injected Anthropic-shaped client (tests only --
 *                                     production callers omit this and a real client
 *                                     is constructed from apiKey)
 * @param {number} [args.maxTokens]    max_tokens for the model call (default 8000)
 * @param {number} [args.maxResponseChars] bounded response size (default 200000)
 * @param {boolean} [args.includeRawResponse] retain literal model output for a replay fixture
 * @returns {(input: {governed_scope: object, definitions: object, contract_bundle: object,
 *   section_family?: string}) =>
 *   Promise<object>} a function matching provider-interface.js's injected-provider signature
 */
function createAnthropicProvider({
  model = DEFAULT_MODEL,
  maxRetries = DEFAULT_MAX_RETRIES,
  apiKey,
  client,
  maxTokens = DEFAULT_MAX_TOKENS,
  maxResponseChars = DEFAULT_MAX_RESPONSE_CHARS,
  includeRawResponse = false,
} = {}) {
  if (!Number.isInteger(maxRetries) || maxRetries < 0) {
    throw new NativeProducerAnthropicError('INVALID_CONFIG', 'maxRetries must be a non-negative integer');
  }
  if (typeof includeRawResponse !== 'boolean') {
    throw new NativeProducerAnthropicError('INVALID_CONFIG', 'includeRawResponse must be a boolean');
  }

  let resolvedClient = client || null;

  function resolveClient() {
    if (resolvedClient) return resolvedClient;
    const key = apiKey || process.env.ANTHROPIC_API_KEY;
    if (!key) {
      throw new NativeProducerAnthropicError(
        'MISSING_API_KEY',
        'no Anthropic API key: pass apiKey, set ANTHROPIC_API_KEY, or inject a client for tests',
      );
    }
    // eslint-disable-next-line global-require
    const Anthropic = require('@anthropic-ai/sdk');
    resolvedClient = new Anthropic({ apiKey: key });
    return resolvedClient;
  }

  return async function anthropicProvider({
    governed_scope: governedScope,
    definitions,
    section_family: suppliedSectionFamily,
  } = {}) {
    requirePlainObject(governedScope, 'governed_scope');
    const definitionsObj = definitions && typeof definitions === 'object' ? definitions : {};
    const sectionFamily = suppliedSectionFamily === undefined
      ? 'CAPITALISATION'
      : suppliedSectionFamily;
    if (typeof sectionFamily !== 'string' || sectionFamily.length === 0) {
      throw new NativeProducerAnthropicError(
        'INVALID_SECTION_FAMILY',
        'section_family must be a non-empty string when supplied',
      );
    }
    const adapter = getFamilyAdapter(sectionFamily);
    if (!adapter) {
      throw new NativeProducerAnthropicError(
        'UNSUPPORTED_SECTION_FAMILY',
        `no live producer runtime is registered for section family ${JSON.stringify(sectionFamily)}`,
        { section_family: sectionFamily },
      );
    }

    const sourceText = governedScope.source_text;
    if (typeof sourceText !== 'string' || sourceText.length === 0) {
      throw new NativeProducerAnthropicError(
        'MISSING_SOURCE_TEXT',
        'governed_scope.source_text must be a non-empty string: this seam has no separate '
          + 'source-text field, so the CLI/caller must carry the admitted text on governed_scope',
      );
    }
    const knownDefinitions = Array.isArray(definitionsObj.known_definitions)
      ? definitionsObj.known_definitions
      : [];

    const prompt = bindNativePromptToGovernedScope({
      prompt: adapter.prompt_builder({
        source_text: sourceText,
        governed_scope: governedScope,
        known_definitions: knownDefinitions,
      }),
      governed_scope: governedScope,
    });

    const activeClient = resolveClient();
    const totalAttempts = maxRetries + 1;
    let lastError = null;
    let result = null;
    let attemptsUsed = 0;

    for (let attempt = 0; attempt < totalAttempts; attempt += 1) {
      attemptsUsed = attempt + 1;
      try {
        // eslint-disable-next-line no-await-in-loop
        result = await callModelOnce({
          client: activeClient,
          model,
          prompt,
          maxTokens,
          maxResponseChars,
          validateResponse: (parsed) => validateResponseLists(parsed, adapter.required_response_lists),
        });
        lastError = null;
        break;
      } catch (err) {
        lastError = err;
        // An oversized response is a bounded, structural failure -- retrying
        // the same prompt against the same document will not shrink it.
        if (err instanceof NativeProducerAnthropicError && err.code === 'RESPONSE_TOO_LARGE') {
          break;
        }
      }
    }

    if (lastError) {
      const rawResponse = lastError.details && typeof lastError.details.raw_response_text === 'string'
        ? lastError.details.raw_response_text
        : null;
      const failedProviderOutput = rawResponse === null ? null : Object.freeze({
        provider_id: PROVIDER_ID,
        model_id: model,
        prompt: prompt.messages,
        prompt_id: prompt.prompt_id,
        prompt_version: prompt.prompt_version,
        proposals: [],
        evidence_residuals: [],
        raw_response_length: rawResponse.length,
        raw_response_text: rawResponse,
        attempts: attemptsUsed,
      });
      throw new NativeProducerAnthropicError(
        lastError.code === 'RESPONSE_TOO_LARGE' ? 'RESPONSE_TOO_LARGE' : 'RETRIES_EXHAUSTED',
        `native producer model call failed after ${attemptsUsed} attempt(s): ${lastError.message}`,
        {
          attempts: attemptsUsed,
          last_code: lastError.code,
          last_details: lastError.details,
          ...(failedProviderOutput === null ? {} : { provider_output: failedProviderOutput }),
        },
      );
    }

    const { proposals, evidence_residuals: evidenceResiduals } =
      adapter.response_shaper(result.parsed, sourceText);

    return {
      provider_id: PROVIDER_ID,
      model_id: model,
      prompt: prompt.messages,
      prompt_id: prompt.prompt_id,
      prompt_version: prompt.prompt_version,
      proposals,
      evidence_residuals: evidenceResiduals,
      raw_response_length: result.raw.length,
      ...(includeRawResponse ? { raw_response_text: result.raw } : {}),
      ...result.provider_metadata,
      attempts: attemptsUsed,
    };
  };
}

module.exports = {
  PROVIDER_ID,
  RESPONSE_VERSION,
  NativeProducerAnthropicError,
  QUALIFIER_CLAIM_KEY,
  LIMB_ASSERTION_CLAIM_KEY,
  BRING_DOWN_TIER_CLAIM_KEY,
  OPEN_WORLD_CLAIM_KEY,
  SHARE_COUNT_CLAIM_KEY,
  SHARE_COUNT_PROPOSAL_KIND,
  SHARE_COUNT_KINDS,
  FEE_AMOUNT_CLAIM_KEY,
  FEE_AMOUNT_PROPOSAL_KIND,
  FEE_TRIGGER_CLAIM_KEY,
  FEE_TRIGGER_PROPOSAL_KIND,
  FEE_TAIL_PERIOD_CLAIM_KEY,
  FEE_TAIL_PERIOD_PROPOSAL_KIND,
  FEE_TRIGGER_CODES,
  FEE_SIDES,
  NO_SHOP_ACTION_CLAIM_KEY,
  NO_SHOP_EXCEPTION_PREREQUISITE_CLAIM_KEY,
  NO_SHOP_NOTICE_PERIOD_CLAIM_KEY,
  NO_SHOP_MATCH_PERIOD_CLAIM_KEY,
  NO_SHOP_REMATCH_PERIOD_CLAIM_KEY,
  NO_SHOP_WAVE_B_CLAIM_KEY,
  NO_SHOP_PROPOSAL_KIND,
  NO_SHOP_PERIOD_ROLE_TO_CLAIM_KEY,
  NO_SHOP_PERIOD_ROLES,
  NO_SHOP_ACTION_CODES,
  NO_SHOP_EXCEPTION_PREREQUISITE_CODES,
  NO_SHOP_WAVE_B_ASSERTION_KINDS,
  MAE_CARVEOUT_CLAIM_KEY,
  MAE_DEFINITION_PRONG_CLAIM_KEY,
  MAE_DISPROPORTIONALITY_CLAIM_KEY,
  MAE_DEFINITION_PROPOSAL_KIND,
  MAE_CARVEOUT_CODES,
  MAE_DEFINITION_PRONG_CODES,
  TERMINATION_RIGHT_CLAIM_KEY,
  TERMINATION_RIGHT_PROPOSAL_KIND,
  TERMINATION_TRIGGER_KINDS,
  TERMINATION_PARTY_SCOPES,
  TERMINATION_DAY_KINDS,
  TERMINATION_PERIOD_KINDS,
  TERMINATION_ASSERTION_KINDS,
  DEFINED_TERM_CLAIM_KEY,
  DEFINED_TERM_PROPOSAL_KIND,
  DEFINED_TERM_ASSERTION_KINDS,
  DEFINED_TERM_THRESHOLD_BASES,
  DEFINED_TERM_SUPERIOR_QUALIFIER_CODES,
  DEFINED_TERM_INTERVENING_EXCLUSION_CODES,
  DEFINED_TERM_STANDARD_CODES,
  DEFINED_TERM_PERSON_SOURCE_CODES,
  DEFINED_TERM_KNOWLEDGE_PARTIES,
  DEFINITION_ENVELOPE_KINDS,
  MATERIAL_CONTRACT_BUCKET_CLAIM_KEY,
  MATERIAL_CONTRACT_THRESHOLD_CLAIM_KEY,
  MATERIAL_CONTRACT_PROPOSAL_KIND,
  MATERIAL_CONTRACT_BUCKET_KINDS,
  MATERIAL_CONTRACT_THRESHOLD_KINDS,
  MATERIAL_CONTRACT_CADENCE_KINDS,
  GENERAL_COVENANT_CLAIM_KEYS,
  GENERAL_COVENANT_PROPOSAL_KIND,
  GENERAL_COVENANT_CODES,
  FINANCING_COVENANT_CLAIM_KEY,
  FINANCING_COVENANT_PROPOSAL_KIND,
  GUARANTY_CLAIM_KEY,
  GUARANTY_PROPOSAL_KIND,
  IOC_RESTRICTION_CLAIM_KEY,
  IOC_RESTRICTION_PROPOSAL_KIND,
  IOC_ASSERTION_KINDS,
  CLOSING_CONDITION_CLAIM_KEY,
  CLOSING_CONDITION_PROPOSAL_KIND,
  CLOSING_CONDITION_ASSERTION_KINDS,
  PROXY_MEETING_COVENANT_CLAIM_KEY,
  PROXY_MEETING_COVENANT_PROPOSAL_KIND,
  PROXY_MEETING_ASSERTION_KINDS,
  REGULATORY_EFFORTS_CLAIM_KEY,
  REGULATORY_EFFORTS_PROPOSAL_KIND,
  REGULATORY_ASSERTION_KINDS,
  REGULATORY_OBLIGOR_SCOPES,
  REGULATORY_DAY_KINDS,
  FAMILY_ADAPTERS,
  getFamilyAdapter,
  CONSIDERATION_CLAIM_KEY,
  CONSIDERATION_PROPOSAL_KIND,
  CONSIDERATION_ASSERTION_KINDS,
  APPRAISAL_STATUS_VALUES,
  REPRESENTATION_QUALIFIER_CLAIM_KEY,
  REPRESENTATION_QUALIFIER_PROPOSAL_KIND,
  MERGER_STRUCTURE_CLAIM_KEY,
  MERGER_STRUCTURE_PROPOSAL_KIND,
  SPECIFIC_PERFORMANCE_REMEDY_CLAIM_KEY,
  SPECIFIC_PERFORMANCE_REMEDY_PROPOSAL_KIND,
  MISC_BOILERPLATE_CLAIM_KEY,
  MISC_BOILERPLATE_PROPOSAL_KIND,
  STRUCTURE_SURFACES,
  REMEDY_ASSERTION_KINDS,
  SPECIFIC_PERFORMANCE_ASSERTION_KINDS,
  MISC_ASSERTION_KINDS,
  TAX_MATTERS_CLAIM_KEY,
  DIVIDENDS_CLAIM_KEY,
  APPRAISAL_CLAIM_KEY,
  EMPLOYEE_MATTERS_CLAIM_KEY,
  EMPLOYEE_MATTERS_PROPOSAL_KIND,
  DNO_CLAIM_KEY,
  DNO_PROPOSAL_KIND,
  shapeGovernedTaxMattersProposals,
  shapeGovernedDividendsProposals,
  shapeGovernedAppraisalProposals,
  shapeGovernedEmployeeMattersProposals,
  shapeGovernedDnoProposals,
  createAnthropicProvider,
  // Exported for the CLI and for tests that want to exercise shaping/parsing
  // directly without a network-shaped client.
  validateResponseShape,
  shapeProposals,
  shapeTerminationFeeProposals,
  shapeNoShopProposals,
  shapeNoShopWaveBAssertion,
  shapeMaeDefinitionProposals,
  shapeTerminationProposals,
  shapeMaterialContractsProposals,
  shapeGeneralCovenantsProposals,
  shapeIocProposals,
  shapeClosingConditionProposals,
  shapeProxyMeetingProposals,
  shapeRegulatoryEffortsProposals,
  shapeMergerStructureProposals,
  shapeRepresentationQualifierProposals,
  shapeSpecificPerformanceRemedyProposals,
  shapeMiscBoilerplateProposals,
  shapeConsiderationProposals,
  shapeGovernedFinancingProposals,
  shapeGovernedGuarantyProposals,
  shapeFinancingGuarantyProposals,
  shapeEmployeeDnoProposals,
  shapeTaxDividendAppraisalProposals,
  shapeRemediesMiscProposals,
  shapeKeyTermsMaeFollowOnProposals,
  shapeDefinedTermsProposals,
  normaliseDefinedTermIdentity,
  shapeNoOtherRepsFraudProposals,
  locateQuoteBytes,
  PROMPT_ID_REEXPORT: PROMPT_ID,
  PROMPT_VERSION_REEXPORT: PROMPT_VERSION,
};
