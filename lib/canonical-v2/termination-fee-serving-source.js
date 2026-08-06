'use strict';

// Per-family serving switch, termination-fee family: the SERVER side.
//
// This module owns three things and nothing else:
//   1. the server-only env gate that decides whether Canonical V2 is allowed
//      to SERVE the termination-fee family at all (production unreachable);
//   2. the per-deal canonical termination-fee card source -- the registry of
//      deals that actually have canonical termination-fee data, and the real
//      projection run that turns each one into legacy-card-shaped cards;
//   3. the wire stamping that carries both to the browser, where
//      components/review/table-configs/termination-fees.config.js reads them.
//
// It deliberately does NOT touch CANONICAL_V2_REVIEW_ENABLED, market mode, or
// the row-binding path (lib/canonical-v2/review-row-binding.js). Those are a
// separate mechanism; this switch is per-family and avoids them entirely.
//
// It also never merges canonical cards into reviewDeal.cards. They travel on
// their OWN wire field, because a canonical card sitting beside a legacy TERMF
// card in one array is exactly the corruption the config's partition exists to
// prevent: combineTermfFeatures() object-merges same-named features and the
// resulting fee row becomes an order-dependent hybrid (canonical amount,
// legacy percentage, legacy deadline). Separate field, separate array,
// partition at the seam.

const crypto = require('node:crypto');

const { isPermittedCanonicalV2Runtime } = require('./feature-flags');
const { projectTerminationFeeProductSurfaces } = require('./termination-product-projection');
// Literal, static require() -- an ordinary module dependency edge Next
// bundles like any other code, not a runtime filesystem read. See the
// comment above QXO_EXCERPTS_TEXT below for why this replaced a
// fs.readFileSync() call.
const { TEXT: QXO_EXCERPTS_TEXT } = require('../../__fixtures__/canonical-v2/qxo-termination-fee-reviewed-excerpts.generated.js');

// Server-only, deliberately NOT a NEXT_PUBLIC_ variable: it must never be
// inlined into the client bundle. The browser only ever sees the derived
// boolean this module stamps onto the wire payload.
const CANONICAL_V2_TERMINATION_FEE_SERVING_ENV_KEY = 'CANONICAL_V2_TERMINATION_FEE_SERVING';

// Exact sentinel, never a truthy stand-in -- same idiom as
// lib/canonical-v2/dark-bridge-gate.js. An absent, empty, mistyped, or
// merely-truthy value ("1", "true", "on") is NOT enabled.
const CANONICAL_V2_TERMINATION_FEE_SERVING_ENABLED_VALUE = 'ENABLED_LOCAL_PREPRODUCTION';

// The two fields this module stamps onto the served reviewDeal.
// components/review/table-configs/termination-fees.config.js re-declares these
// exact strings (it is client-side and must not import this server module);
// tests/canonical-v2-termination-fee-serving-switch.test.js pins that the two
// declarations agree, so they cannot drift apart silently.
const CANONICAL_V2_TERMINATION_FEE_SERVING_FIELD = 'canonical_v2_termination_fee_serving_enabled';
const CANONICAL_V2_TERMINATION_FEE_CARDS_FIELD = 'canonical_v2_termination_fee_cards';

// Fourth mode: render BOTH sources on the page, side by side (Ben's ruling,
// 2026-08-05 -- V1's nine uncovered fields must stay visible, because a row
// that vanishes reads as "the agreement is silent"). Its own env key and its
// own wire field, deliberately NOT a widened value on the serving pair: the
// three existing modes must keep reading exactly the fields they read today,
// and a payload without this key must be bit-for-bit what they already handle.
//
// Strictly narrower than serving: compare needs the canonical cards, which only
// the serving gate stamps, so it is gated on serving being on as well.
const CANONICAL_V2_TERMINATION_FEE_COMPARE_ENV_KEY = 'CANONICAL_V2_TERMINATION_FEE_COMPARE';
const CANONICAL_V2_TERMINATION_FEE_COMPARE_ENABLED_VALUE = 'ENABLED_LOCAL_PREPRODUCTION';
const CANONICAL_V2_TERMINATION_FEE_COMPARE_FIELD = 'canonical_v2_termination_fee_compare_enabled';

function ownEnvValue(env, key) {
  if (!env || typeof env !== 'object') return undefined;
  return Object.prototype.hasOwnProperty.call(env, key) ? env[key] : undefined;
}

// Fail closed, in every direction:
//   - a missing argument, an explicit `undefined`, or a non-object env -> false
//     (arguments.length is checked because a default parameter cannot tell an
//     omitted argument from an explicit undefined; see dark-bridge-gate.js);
//   - an inherited (prototype-chain) property -> false, so a polluted
//     Object.prototype can never manufacture the sentinel;
//   - anything other than the exact sentinel string -> false;
//   - any runtime the shared Canonical V2 allowlist does not permit -> false.
//     That allowlist admits only a Vercel preview deployment or a genuinely
//     local runtime with NODE_ENV !== 'production'. This repo's authority for
//     production is NONE and this gate is how that stays true.
function isCanonicalV2TerminationFeeServingEnabled(env) {
  const resolvedEnv = arguments.length === 0 ? process.env : env;
  if (!resolvedEnv || typeof resolvedEnv !== 'object') return false;
  const value = ownEnvValue(resolvedEnv, CANONICAL_V2_TERMINATION_FEE_SERVING_ENV_KEY);
  if (value !== CANONICAL_V2_TERMINATION_FEE_SERVING_ENABLED_VALUE) return false;
  return isPermittedCanonicalV2Runtime(resolvedEnv);
}

// Fails closed exactly like the serving gate above, and additionally requires
// that gate: without it there are no canonical cards to compare against, and a
// "compare" table with one source would be a worse lie than either single mode.
function isCanonicalV2TerminationFeeCompareEnabled(env) {
  const resolvedEnv = arguments.length === 0 ? process.env : env;
  if (!resolvedEnv || typeof resolvedEnv !== 'object') return false;
  if (!isCanonicalV2TerminationFeeServingEnabled(resolvedEnv)) return false;
  return ownEnvValue(resolvedEnv, CANONICAL_V2_TERMINATION_FEE_COMPARE_ENV_KEY)
    === CANONICAL_V2_TERMINATION_FEE_COMPARE_ENABLED_VALUE;
}

// ---------------------------------------------------------------------------
// Per-deal canonical termination-fee source
// ---------------------------------------------------------------------------
//
// Canonical termination-fee data exists for a handful of deals, not the whole
// corpus, and producing more requires live extraction runs. The registry below
// is therefore deliberately small and keyed by the REAL deal UUID: a deal that
// is not in it has no canonical termination-fee data, which the config renders
// as a visible fall back to legacy -- never as an empty table.
//
// Each entry rebuilds its cards, on every call, from source text pinned by
// content hash and run through the family's OWN real projection
// (projectTerminationFeeProductSurfaces). Same construction as
// lib/canonical-v2/review-preview-assembly.js uses for the four dark-bridge
// families: a pinned scenario through the real pipeline, never a hand-rolled
// shortcut card.

const QXO_TOPBUILD_DEAL_ID = '7dc3a05f-b170-4d59-a255-b7103cca16e1';

// VERCEL FILE TRACING (production incident, 2026-08-05, and its follow-up
// the same day): this module used to read __fixtures__/canonical-v2/qxo-
// termination-fee-reviewed-excerpts.txt at REQUEST time via
// fs.readFileSync(path.join(__dirname, '..', '..', ...relativeParts)), with
// relativeParts arriving through a function parameter. Next's static file
// tracer (@vercel/nft) only follows literal require()/import edges and
// simple same-scope path expressions -- a path assembled from a spread
// parameter bound at a distant call site is invisible to it -- so the file
// was silently excluded from the /api/review/[id]/cards Vercel function
// bundle even though it is committed and .vercelignore allows it through.
// Local runs (dev, npm start, node --test) never noticed because they read
// the full repo checkout with no pruning.
//
// The first fix attempt added an experimental.outputFileTracingIncludes
// entry to next.config.js force-including the .txt for this route. That
// entry was confirmed correctly written (right route key, right relative
// path, present in the deployed commit) and STILL failed in production --
// the served page kept reporting the FAILED state below. Root cause of the
// second failure was not chased down further (diminishing returns chasing
// nft's tracer internals); what matters is the class of bug: any mechanism
// that depends on Next's tracer noticing a runtime fs.readFileSync() is
// fragile in a way that is hard to prove correct short of a live deploy.
//
// The fix that replaced both attempts: stop reading a file at request time
// at all. QXO_EXCERPTS_TEXT above is a plain, literal, top-level require()
// of a generated JS module (__fixtures__/canonical-v2/qxo-termination-fee-
// reviewed-excerpts.generated.js) -- the exact mechanism review-preview-
// assembly.js already uses successfully, on this SAME route, for its four
// __fixtures__/canonical-v2/preview/*.json requires. A require()'d module is
// not "traced" at all; it is an ordinary code dependency that Next's bundler
// resolves and inlines at build time, so there is no runtime file read left
// for a tracer to miss. The .generated.js file is mechanically derived from
// the .txt (the single reviewed source of truth) by scripts/generate-qxo-
// termination-fee-excerpt-module.js; tests/qxo-termination-fee-excerpt-
// module.test.js fails if the two ever disagree. See that script's header
// for the regeneration command.
//
// The failure this produced, both times: the read/require threw or was
// missing, canonicalTerminationFeeCardsForDeal() caught it and returned [],
// and the served page told a reviewer "Canonical V2 has no termination-fee
// data for this deal" -- false; the data exists and is registered below, the
// deployment just could not read it. describeCanonicalTerminationFeeSource()
// below reports that distinction explicitly (state FAILED, never silently
// folded into NOT_REGISTERED) regardless of which layer the read/require
// failed at, which is why that reporting needed no change here.

// Pinned digest of the reviewed excerpt text. The excerpts are quoted verbatim
// from the filed agreement (EDGAR accession 0001104659-26-045111, Ex. 2.1,
// §§6.2, 6.4 and 6.5(b)); the same digest is independently pinned by
// __fixtures__/canonical-v2/qxo-termination-fee-row.js, which reads the .txt
// directly at test time rather than through QXO_EXCERPTS_TEXT above. Both
// pins ultimately check against the one .txt (this one via the generated
// module the drift test ties to it; that one via a direct read), so neither
// can silently serve or fixture text it has not verified -- if the .txt ever
// changes without both pins being updated, whichever one is stale throws
// rather than serving the old text as if it still matched.
const QXO_EXCERPTS_SHA256 = 'a23116053df1e9d8a741f13e514558905c5dbe67e016c6fb54bf0d51adfab9c2';

// The fee amount, and the six trigger grounds, exactly as encoded in
// __fixtures__/canonical-v2/qxo-termination-fee-row.js (SPEC-QXO-TERMF-
// AMENDMENT-2026-07-23 Step 2, binding). Every string below is located in the
// hash-verified excerpt text at build time and must be present AND unique
// there -- a quote that has drifted throws, and the caller degrades to legacy
// rather than serving unverified evidence.
const QXO_FEE_AMOUNT_QUOTE = '"Company Termination Fee" shall mean a cash amount equal to $600,000,000.';
const QXO_FEE_AMOUNT_USD = '600000000';

const QXO_TRIGGERS = Object.freeze([
  Object.freeze({
    // §6.4(a)(i)(A) -- adverse recommendation change (immediate-pay pathway).
    code: 'CHANGE_IN_RECOMMENDATION_TERMINATION',
    quote: 'the Company Board shall have made a Company Adverse Recommendation Change',
  }),
  Object.freeze({
    // §6.2(c) -- Company stockholder vote failure (tail-only in this deal).
    code: 'STOCKHOLDER_APPROVAL_FAILURE_TERMINATION',
    quote: 'the Company Stockholder Approval shall not have been obtained by reason of the failure to obtain the required vote at the Company Stockholder Meeting duly convened (or any adjournment or postponement thereof)',
  }),
  // The next two entries are the SAME §4.3 no-solicitation-breach ground
  // reached by two pathways, so they carry the same trigger code and the
  // projection's by-code dedupe collapses them into one trigger. The dedupe
  // keeps the LAST value seen for a code, so the tail gateway is listed first
  // and the direct §6.4(a)(ii) right second: the direct right is the better
  // evidence for the resulting pill.
  Object.freeze({
    // §6.5(b)(iii)(C)(1) -- the §4.3 ground via the general-breach gateway.
    code: 'NO_SOLICIT_BREACH_TERMINATION',
    quote: "by Parent pursuant to the provisions of Section 6.4(b) in respect of a (1) breach of the Company's obligations under Section 4.3 (and the Company Stockholder Approval shall not theretofore have been obtained)",
  }),
  Object.freeze({
    // §6.4(a)(ii) -- material breach of the §4.3 no-solicitation covenant.
    code: 'NO_SOLICIT_BREACH_TERMINATION',
    quote: 'the Company or any of its Representatives (acting on behalf of the Company) materially breaches its obligations under Section 4.3 and, in the case of this clause (ii), such breach is not curable or, if curable is not cured prior to the earlier of (A) the fifth business day after written notice thereof is given by Parent to the Company and (B) the date that is three business days prior to the Outside Date',
  }),
  Object.freeze({
    // §6.5(b)(iii)(C)(2) -- general covenant/agreement breach gateway. The
    // ground text is ambiguous on its own (it also appears in the (x)
    // disambiguation gloss), so it is located within a unique longer anchor.
    code: 'COUNTERPARTY_COVENANT_BREACH_TERMINATION',
    quote: 'a breach of any other covenant or agreement of this Agreement',
    anchor: 'or (2) a breach of any other covenant or agreement of this Agreement or (D) by Parent pursuant to the provisions of Section 6.4(a)(i)(B)',
  }),
  Object.freeze({
    // §6.5(b)(iii)(D) -- intervening-event recommendation change.
    code: 'INTERVENING_EVENT_RECOMMENDATION_CHANGE_TERMINATION',
    quote: '(D) by Parent pursuant to the provisions of Section 6.4(a)(i)(B) (and the Company Stockholder Approval shall not theretofore have been obtained)',
  }),
]);

function assertUniqueQuote(text, quote, label) {
  const first = text.indexOf(quote);
  if (first < 0) throw new Error(`canonical termination-fee ${label} quote not found in pinned source`);
  if (text.indexOf(quote, first + 1) >= 0) throw new Error(`canonical termination-fee ${label} quote is ambiguous`);
  return quote;
}

function assertQuoteWithinAnchor(text, anchor, quote, label) {
  assertUniqueQuote(text, anchor, `${label} anchor`);
  if (!anchor.includes(quote)) throw new Error(`canonical termination-fee ${label} quote not found within its anchor`);
  return quote;
}

// Pure -- no I/O. Takes text already in memory (QXO_EXCERPTS_TEXT, loaded via
// the literal require() above) and verifies it against the pin before
// anything is built from it. This is the one piece of the old readPinnedSource()
// that had to survive the file-tracing fix intact: a require() guarantees the
// TEXT is present, but says nothing about whether it is the text that was
// actually reviewed, which is what the digest check is for. Exported so
// tests/canonical-v2-termination-fee-serving-switch.test.js can prove a
// genuine mismatch is still caught, against this real function rather than a
// simulated error.
function verifyPinnedExcerptText(text, expectedSha256, label) {
  const digest = crypto.createHash('sha256').update(Buffer.from(text, 'utf8')).digest('hex');
  if (digest !== expectedSha256) {
    throw new Error(`canonical termination-fee ${label} source digest mismatch`);
  }
  return text;
}

function feeParty() {
  return { role: 'FEE_PAYER', value: 'COMPANY', capacity: 'TARGET' };
}

function resolvedEntry({ provisionId, definition, conceptKey, sectionRef, value, quote, ordinal }) {
  return {
    resolved_claim_definition_key: definition,
    concept_key: conceptKey,
    section_reference: sectionRef,
    party: feeParty(),
    provision_instance: {
      provision_instance_id: provisionId,
      party: feeParty(),
    },
    claim: {
      claim_revision_id: `${provisionId}:${definition}:${ordinal}`,
      canonical_value: value,
      raw_value: quote,
      attributes: {},
    },
  };
}

// QXO / TopBuild, Company Termination Fee only. The reviewed packet that
// produced this encoding is explicitly seller-side: there is no Parent /
// reverse fee, no expense-reimbursement cap, no sole-remedy claim and no
// late-payment-interest claim in it. That is a COVERAGE boundary, not a
// finding about the agreement -- the config renders every uncovered surface as
// "Not yet extracted", never as absent.
function buildQxoTopBuildTerminationFeeCards(dealId) {
  const text = verifyPinnedExcerptText(QXO_EXCERPTS_TEXT, QXO_EXCERPTS_SHA256, 'QXO/TopBuild');
  const provisionId = 'canonical-v2:termf:qxo-topbuild:company-termination-fee';

  const amountQuote = assertUniqueQuote(text, QXO_FEE_AMOUNT_QUOTE, 'fee amount');
  const resolved = [
    resolvedEntry({
      provisionId,
      definition: 'TERMINATION_FEE_AMOUNT',
      conceptKey: 'TERMF-TARGET',
      sectionRef: '6.5(b)',
      value: QXO_FEE_AMOUNT_USD,
      quote: amountQuote,
      ordinal: 0,
    }),
  ];

  QXO_TRIGGERS.forEach((trigger, index) => {
    const quote = trigger.anchor
      ? assertQuoteWithinAnchor(text, trigger.anchor, trigger.quote, `trigger ${trigger.code}`)
      : assertUniqueQuote(text, trigger.quote, `trigger ${trigger.code}`);
    resolved.push(resolvedEntry({
      provisionId,
      definition: 'TERMINATION_FEE_TRIGGER',
      conceptKey: 'TERMF-TARGET',
      sectionRef: '6.5(b)',
      value: trigger.code,
      quote,
      ordinal: index + 1,
    }));
  });

  return projectTerminationFeeProductSurfaces({
    resolution: { resolved, open_world: [] },
    deal_id: dealId,
  }).cards;
}

const CANONICAL_TERMINATION_FEE_SOURCES = Object.freeze({
  [QXO_TOPBUILD_DEAL_ID]: buildQxoTopBuildTerminationFeeCards,
});

// The wire field carrying the outcome below. Same shape family as
// lib/canonical-v2/review-preview-assembly.js's CANONICAL_V2_PREVIEW_STATE /
// PREVIEW_STATUS_FIELD -- that module hit the identical "swallow every
// error, return the untouched deal" defect for its four dark-bridge
// families and was changed to report distinct outcome states instead of a
// silent no-op. This module follows the same approach rather than inventing
// a third shape.
const CANONICAL_V2_TERMINATION_FEE_SOURCE_STATUS_FIELD = 'canonical_v2_termination_fee_source_status';
const TERMINATION_FEE_SOURCE_STATUS_SCHEMA = 'CANONICAL_V2_TERMINATION_FEE_SOURCE_STATUS/V1';

// Three states, not four: unlike review-preview-assembly.js there is no
// separate gate-refused state here -- attachCanonicalTerminationFeeServing()'s
// early return above already handles gate-off with a byte-identical no-op --
// so every state below is reached only once the gate is confirmed on.
const TERMINATION_FEE_SOURCE_STATE = Object.freeze({
  // No builder registered for this deal at all. Expected and common (only a
  // handful of deals carry canonical termination-fee data) and renders the
  // existing "Canonical V2 has no termination-fee data for this deal"
  // fallback, because that sentence is TRUE for these deals.
  NOT_REGISTERED: 'NOT_REGISTERED',
  // A builder is registered and ran to completion. cardCount may
  // legitimately be 0 -- that is still a successful attach, not a failure.
  ATTACHED: 'ATTACHED',
  // A builder IS registered but threw -- the file-tracing incident documented
  // above QXO_EXCERPTS_SHA256, a sha256 digest mismatch, or a drifted/
  // ambiguous quote. This deal is NOT one with "no data": Canonical V2 has
  // data it could not read or verify. Must never render, or log, the same as
  // NOT_REGISTERED.
  FAILED: 'FAILED',
});

function describeSourceFailure(error) {
  const isError = error !== null && typeof error === 'object';
  return Object.freeze({
    error_name: isError && error.name ? String(error.name) : 'Error',
    error_code: isError && error.code !== undefined && error.code !== null ? String(error.code) : null,
    error_message: isError && error.message ? String(error.message) : String(error),
  });
}

function buildSourceOutcome({ state, cardCount = 0, failure = null }) {
  return Object.freeze({
    schema_version: TERMINATION_FEE_SOURCE_STATUS_SCHEMA,
    state,
    card_count: cardCount,
    failure,
  });
}

// The one place a per-deal source is actually resolved. Looks up the
// registry, runs the builder, and reports WHICH of the three states above
// happened -- never just an array a caller has to guess the meaning of.
// `sources` defaults to the real registry and exists only so tests can
// inject a synthetic entry (an always-throwing builder shaped like an
// unreadable file or a digest mismatch) without touching the real QXO
// fixture or the filesystem -- same injection shape as review-preview-
// assembly.js's `fixtures` override.
function describeCanonicalTerminationFeeSource(dealId, { sources = CANONICAL_TERMINATION_FEE_SOURCES } = {}) {
  if (typeof dealId !== 'string' || !dealId) {
    return { cards: [], outcome: buildSourceOutcome({ state: TERMINATION_FEE_SOURCE_STATE.NOT_REGISTERED }) };
  }
  const build = Object.prototype.hasOwnProperty.call(sources, dealId) ? sources[dealId] : null;
  if (typeof build !== 'function') {
    return { cards: [], outcome: buildSourceOutcome({ state: TERMINATION_FEE_SOURCE_STATE.NOT_REGISTERED }) };
  }
  try {
    const built = build(dealId);
    const cards = Array.isArray(built) ? built : [];
    return { cards, outcome: buildSourceOutcome({ state: TERMINATION_FEE_SOURCE_STATE.ATTACHED, cardCount: cards.length }) };
  } catch (error) {
    return {
      cards: [],
      outcome: buildSourceOutcome({ state: TERMINATION_FEE_SOURCE_STATE.FAILED, failure: describeSourceFailure(error) }),
    };
  }
}

// A registered-but-failed source is reported to the server log, the same
// channel review-preview-assembly.js's reportOutcome() uses and for the same
// reason: on a Vercel preview this is the one place a verifier can see WHY
// without a debugger, and it is the only channel that survives a caller that
// looks at nothing but the rendered page. Silent for NOT_REGISTERED/ATTACHED
// -- NOT_REGISTERED is the common case for nearly every deal in the corpus,
// and logging it on every request would bury the one log line that matters.
// Injectable so tests can assert the report happened without spraying the
// real console.
function reportTerminationFeeSourceFailure(logger, dealId, outcome) {
  if (outcome.state !== TERMINATION_FEE_SOURCE_STATE.FAILED) return;
  const sink = logger || console;
  const line = `[canonical-v2-termination-fee-source] FAILED deal_id=${dealId}`;
  if (typeof sink.error === 'function') sink.error(line, JSON.stringify(outcome));
}

// Returns the canonical termination-fee cards for a deal, or [] when the deal
// has none OR its source is registered but failed to load/verify. Never
// throws -- unchanged from before. What changed is that the failure is no
// longer invisible: describeCanonicalTerminationFeeSource() above records
// which of the two happened, and attachCanonicalTerminationFeeServing() below
// stamps that distinction onto the wire instead of discarding it here.
function canonicalTerminationFeeCardsForDeal(dealId, options) {
  return describeCanonicalTerminationFeeSource(dealId, options).cards;
}

// Stamps the served reviewDeal with the switch state, the deal's canonical
// termination-fee cards, and the outcome that produced them.
//
// Gate off: returns the SAME reviewDeal reference, untouched -- no field added,
// nothing built, so the wire payload and every downstream row are byte-
// identical to a build that never had this switch.
//
// Gate on: stamps the boolean `true`, the (possibly empty) card array, and
// the source status. An empty array is stamped deliberately: the config
// needs to distinguish "the switch is on but this deal has no canonical
// data" (fall back to legacy, visibly) from "the switch is off" (legacy,
// silently) -- and now also from "the switch is on, this deal HAS canonical
// data, and Canonical V2 could not read or verify it" (fall back to legacy,
// visibly, with a DIFFERENT message and a server-side log line).
function attachCanonicalTerminationFeeServing(reviewDeal, { env, logger, sources } = {}) {
  const resolvedEnv = env || process.env;
  if (!isCanonicalV2TerminationFeeServingEnabled(resolvedEnv)) return reviewDeal;
  if (!reviewDeal || typeof reviewDeal !== 'object') return reviewDeal;
  const { cards, outcome } = describeCanonicalTerminationFeeSource(reviewDeal.dealId, { sources });
  reportTerminationFeeSourceFailure(logger, reviewDeal.dealId, outcome);
  return {
    ...reviewDeal,
    [CANONICAL_V2_TERMINATION_FEE_SERVING_FIELD]: true,
    [CANONICAL_V2_TERMINATION_FEE_CARDS_FIELD]: cards,
    [CANONICAL_V2_TERMINATION_FEE_SOURCE_STATUS_FIELD]: outcome,
    // Added ONLY when compare is on. Absent otherwise, so the three existing
    // modes see the same payload keys they see today.
    ...(isCanonicalV2TerminationFeeCompareEnabled(resolvedEnv)
      ? { [CANONICAL_V2_TERMINATION_FEE_COMPARE_FIELD]: true }
      : {}),
  };
}

module.exports = {
  CANONICAL_V2_TERMINATION_FEE_CARDS_FIELD,
  CANONICAL_V2_TERMINATION_FEE_COMPARE_ENABLED_VALUE,
  CANONICAL_V2_TERMINATION_FEE_COMPARE_ENV_KEY,
  CANONICAL_V2_TERMINATION_FEE_COMPARE_FIELD,
  CANONICAL_V2_TERMINATION_FEE_SERVING_ENABLED_VALUE,
  CANONICAL_V2_TERMINATION_FEE_SERVING_ENV_KEY,
  CANONICAL_V2_TERMINATION_FEE_SERVING_FIELD,
  CANONICAL_V2_TERMINATION_FEE_SOURCE_STATUS_FIELD,
  QXO_TOPBUILD_DEAL_ID,
  TERMINATION_FEE_SOURCE_STATE,
  attachCanonicalTerminationFeeServing,
  canonicalTerminationFeeCardsForDeal,
  describeCanonicalTerminationFeeSource,
  isCanonicalV2TerminationFeeCompareEnabled,
  isCanonicalV2TerminationFeeServingEnabled,
  verifyPinnedExcerptText,
};
