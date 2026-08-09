'use strict';
const { freeze, registryFingerprint } = require('./registry-fingerprint');
const MATERIAL_CONTRACT_BUCKET_META = {
  AGGREGATE_PAYMENTS: {
    label: 'Contracts above an aggregate-payments threshold',
    // The original two synonyms both require "aggregate" immediately
    // adjacent to "payment(s)". Real drafting routinely separates them
    // across a sentence ("payment obligations ... in excess of $200,000 in
    // the aggregate"), so a co-occurrence check (either word order, within
    // one sentence via the `[^.]` bound) is added as a third alternative.
    // Modiv 3.17(b)(xiii), confirmed against the real quote. Hostile-tested
    // against "the aggregate number of shares outstanding..." and "Parent
    // shall make payment within five Business Days...", neither of which
    // carries both words in one sentence, so neither false-fires.
    synonyms: [
      /aggregate\s+payments?/i,
      /annual\s+payments?/i,
      /(?:aggregate\b[^.]{0,120}\bpayments?\b|payments?\b[^.]{0,120}\baggregate\b)/i,
    ],
  },
  INDEBTEDNESS: {
    label: 'Indebtedness contracts',
    synonyms: [/indebtedness/i, /credit\s+agreement/i, /loan\s+agreement/i],
  },
  JV_PARTNERSHIPS: {
    label: 'Joint ventures / partnerships',
    synonyms: [/joint\s+venture/i, /partnership/i, /\bjv\b/i],
  },
  MA_AGREEMENTS: {
    label: 'M&A / acquisition agreements',
    // The original two synonyms require "agreement" as the tail noun.
    // Modiv 3.17(b)(v) describes the same concept as a "transaction"
    // ("relate to an acquisition, divestiture, merger or similar
    // transaction"), which is standard drafting variation, not a different
    // concept. Widened to accept "transaction" alongside "agreement", and
    // to admit "divestiture" as a same-bucket lead word. Hostile-tested
    // against isolated uses of "acquisition"/"merger" with no nearby
    // agreement/transaction noun (e.g. "has not effected any acquisition of
    // real property"), which do not match.
    synonyms: [
      /acquisition\s+agreement/i,
      /merger\s+agreement/i,
      /\b(?:acquisition|divestiture|merger)\b[^.]{0,30}\b(?:agreement|transaction)s?\b/i,
    ],
  },
  IP_LICENSES_IN: {
    label: 'Inbound IP licenses',
    // "in-bound" (hyphenated) is Modiv's own spelling (3.17(b)(x)) and does
    // not match \binbound\b's implicit closed-compound assumption, since
    // \s+ does not match a hyphen. Made hyphen-tolerant.
    synonyms: [
      /in-?bound\s+licens/i,
      /licens(?:es?|ed)\s+(?:from|in)/i,
      /\b(?:the\s+)?Company(?:\s+or\s+any\s+of\s+the\s+Company\s+Subsidiaries)?\b[^.]{0,140}\blicenses,\s+acquires\s+or\s+is\s+otherwise\s+permitted\s+to\s+use\s+the\s+Intellectual\s+Property\s+of\s+any\s+third\s+party\b/i,
    ],
  },
  IP_LICENSES_OUT: {
    label: 'Outbound IP licenses',
    // Same hyphen gap as IP_LICENSES_IN, mirrored: Modiv 3.17(b)(x) says
    // "out-bound licenses".
    synonyms: [
      /out-?bound\s+licens/i,
      /licens(?:es?|ed)\s+(?:to|out)/i,
      /\ba\s+third\s+party\s+licenses\s+or\s+is\s+otherwise\s+permitted\s+to\s+use\s+any\s+Company\s+Intellectual\s+Property\b/i,
    ],
  },
  SUPPLY: {
    label: 'Supplier agreements',
    synonyms: [/supply\s+agreement/i, /supplier\s+contracts?/i, /purchase,?\s+sale\s+or\s+lease\s+of\s+goods/i],
  },
  MANUFACTURE: {
    label: 'Manufacturing agreements',
    synonyms: [/manufacturing\s+agreement/i, /\bcmo\b/i, /contract\s+manufactur/i],
  },
  DISTRIBUTION: {
    label: 'Distribution / reseller agreements',
    synonyms: [/distribution\s+agreement/i, /reseller/i],
  },
  COLLABORATION: {
    label: 'Collaboration / R&D agreements',
    synonyms: [/collaboration/i, /research\s+(?:and\s+)?development\s+agreement/i],
  },
  SETTLEMENT: {
    label: 'Settlement / consent agreements',
    // The original synonym requires "settlement agreement" as a bigram.
    // Modiv 3.17(b)(viii) drafts the same concept as "the settlement (or
    // proposed settlement) of any pending or threatened suit or
    // proceeding" -- no "agreement" tail noun, and a parenthetical aside
    // ("(or proposed settlement)") sits between "settlement" and "of any
    // pending", so an adjacency-anchored pattern (e.g. requiring "of"
    // directly after "settlement") still misses it. Used a bounded
    // same-sentence co-occurrence instead: "settlement" and
    // "pending"/"threatened" within 60 characters, `[^.]` bounding it to
    // one sentence. Verified against the real quote (not just a hand-typed
    // paraphrase) after an earlier version of this pattern was written
    // against the wrong test string and passed a test that the real quote
    // then failed -- re-tested directly against
    // resolution.json's actual raw_value before landing this version.
    // Hostile-tested against "the settlement date for the securities
    // transaction", "purchase price settlement occurs at Closing", and "a
    // settlement agreement with a former employee regarding a compensation
    // dispute" (a real settlement agreement, but with neither
    // "pending" nor "threatened" in the same sentence) -- none match.
    synonyms: [
      /settlement\s+agreement/i,
      /consent\s+decree/i,
      /settlement\b[^.]{0,60}\b(?:pending|threatened)\b/i,
    ],
  },
  NONCOMPETE: {
    label: 'Non-competition / non-solicitation agreements',
    synonyms: [
      /non[\s-]*compet/i,
      /non[\s-]*solicit/i,
      /restrictive\s+covenant/i,
      /\b(?:restricts?|limits?)\b[^.]{0,100}\b(?:right|ability)\b[^.]{0,160}\bto\s+compete\b/i,
      /\bprohibit(?:s|ed|ing)?\b[^.]{0,100}\bfrom\s+competing\b/i,
      /\bcovenants?\b[^.]{0,120}\blimit\b[^.]{0,120}\b(?:type\s+of\s+business\s+in\s+which[^.]{0,160}\bmay\s+engage|manner\s+in\s+which[^.]{0,160}\bmay\s+(?:so\s+)?engage\s+in\s+(?:any\s+)?business)\b/i,
    ],
  },
  REAL_ESTATE: {
    label: 'Real estate leases',
    // The original two synonyms require the literal phrases "real estate"
    // or "lease agreement". Modiv 3.17(b)(ii)/(vi) uses neither: "Company
    // Space Lease, Ground Lease or Company Lease" for leaseholds, and "any
    // real property with a fair market value in excess of $200,000" for
    // owned real property. "Space lease" and "ground lease" are standard
    // real-estate-industry lease terms-of-art (not Modiv-specific defined
    // terms -- the defined-term wrapper "Company Space Lease" still
    // contains the generic phrase); "real property" is the standard legal
    // term for the underlying REAL_ESTATE concept, distinct from "personal
    // property" (hostile-tested: "the Company owns no material personal
    // property" does not match).
    synonyms: [
      /real\s+estate/i,
      /lease\s+agreement/i,
      /\b(?:space\s+lease|ground\s+lease|real\s+property)\b/i,
    ],
  },
  EMPLOYMENT_KEY: {
    label: 'Key employment / executive agreements',
    synonyms: [/employment\s+agreement/i, /executive\s+agreement/i],
  },
  GOVERNMENT_CONTRACTS: {
    label: 'Government contracts',
    synonyms: [/government\s+contracts?/i, /\bgwac\b/i, /federal\s+contracts?/i],
  },
  // ── Additional canonical buckets to close the 16→21 gap. PW-style material-
  //    contracts reps routinely enumerate these as discrete sub-clauses; they
  //    previously collapsed into OTHER. ──
  AFFILIATE_TRANSACTIONS: {
    label: 'Affiliate / related-party transactions',
    synonyms: [/affiliate\s+(?:transaction|agreement|contract)/i, /related[\s-]*party/i, /interested\s+party\s+transaction/i],
  },
  EXCLUSIVITY_MFN: {
    label: 'Exclusivity / most-favored-nation / standstill',
    synonyms: [/exclusivity/i, /most[\s-]*favored[\s-]*nation/i, /\bmfn\b/i, /standstill/i, /exclusive\s+dealing/i],
  },
  CAPEX_COMMITMENTS: {
    label: 'Capital expenditure commitments',
    synonyms: [/capital\s+expenditure/i, /\bcapex\b/i, /capital\s+commitment/i],
  },
  DATA_PRIVACY: {
    label: 'Data privacy / security agreements',
    synonyms: [/data\s+(?:privacy|security|protection)/i, /data\s+processing\s+agreement/i, /\bdpa\b/i],
  },
  VOTING_REGISTRATION_RIGHTS: {
    label: 'Voting / registration-rights / stockholder agreements',
    synonyms: [/voting\s+agreement/i, /registration\s+rights/i, /stockholders?\s+agreement/i, /shareholders?\s+agreement/i],
  },
  // ── Item-601 catch-all + pharma/biotech-specific buckets. Material-contracts
  //    reps in life-sciences deals enumerate these as discrete sub-clauses. ──
  SEC_ITEM_601: {
    label: 'SEC Item 601(b) contracts',
    synonyms: [/601\s*\(\s*b\s*\)/i, /item\s+601/i, /regulation\s+s-?k/i, /required\s+to\s+be\s+filed.{0,40}material\s+contract/i],
  },
  IP_DEVELOPMENT: {
    label: 'IP development contracts',
    synonyms: [/development\s+contract/i, /\bdeveloped\b[^.]{0,60}(?:solely\s+or\s+jointly|for\s+or\s+at\s+the\s+direction)/i, /intellectual\s+property[^.]{0,60}develop/i],
  },
  SINGLE_SOURCE: {
    label: 'Single source procurement contracts',
    synonyms: [/single[\s-]*source/i, /sole[\s-]*source/i, /procurement\s+of\s+materials/i],
  },
  CRO: {
    label: 'Clinical research organization contracts',
    synonyms: [/contract\s+research\s+organization/i, /\bcro\b/i, /clinical\s+stud(?:y|ies)/i, /clinical\s+trial/i],
  },
  MA_ONGOING_OBLIGATIONS: {
    label: 'M&A agreements with ongoing obligations',
    // "Earn-out" is the standard term-of-art for this exact bucket (it is
    // in the bucket's own label) but was missing from the synonym list
    // entirely. Modiv 3.17(b)(v): "continuing indemnification, guarantee,
    // 'earn-out' or other contingent payment obligations". Hyphen-tolerant
    // for the same reason as the IP_LICENSES synonyms above.
    synonyms: [/milestone\s+(?:or\s+similar\s+)?payment/i, /\broyalt/i, /continuing\s+obligations\s+or\s+interests/i, /future\s+payment\s+obligations/i, /earn-?out/i],
  },
  ROFR_ROFN: {
    label: 'Agreements with ROFO/ROFN',
    synonyms: [/rights?\s+of\s+first\s+(?:refusal|offer|negotiation)/i, /\brofr\b/i, /\brofn\b/i, /\brofo\b/i],
  },
  HEDGING: {
    label: 'Hedging and derivative contracts',
    synonyms: [/hedg/i, /\bswap\b/i, /\bcollar\b/i, /\bderivative/i],
  },
  EMPLOYEE_LOANS: {
    label: 'Employee loans and advances',
    synonyms: [/loan\s+or\s+advance/i, /advance[^.]{0,40}employee/i, /employee\s+loan/i],
  },
  OTHER: {
    label: 'Other material contracts',
    synonyms: [],
  },
};
const MATERIAL_CONTRACT_BUCKET_CODES = freeze(Object.fromEntries(Object.entries(MATERIAL_CONTRACT_BUCKET_META).map(([code, entry]) => [code, entry.label])));
const VERSION = 'RESOLUTION_MATERIAL_CONTRACT_REGISTRY/V1';
const MATERIAL_CONTRACT_BUCKET_KINDS = freeze(Object.keys(MATERIAL_CONTRACT_BUCKET_CODES).filter((code) => code !== 'OTHER').sort());
const MATERIAL_CONTRACT_THRESHOLD_KINDS = freeze(['ANY', 'PERCENT', 'TOP_N', 'USD']);
const MATERIAL_CONTRACT_CADENCE_KINDS = freeze(['AGGREGATE', 'ANNUAL', 'PER_DAY', 'PER_EVENT', 'PER_MONTH', 'SPECIFIED_YEAR']);
const MATERIAL_CONTRACT_NUMBER_WORD = '(?:one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve|'
  + 'thirteen|fourteen|fifteen|sixteen|seventeen|eighteen|nineteen|twenty|thirty|forty|fifty|sixty|seventy|'
  + 'eighty|ninety|hundred|thousand|million|billion)';
const MATERIAL_CONTRACT_NUMBER_WORD_RUN = `${MATERIAL_CONTRACT_NUMBER_WORD}(?:[\\s-]+${MATERIAL_CONTRACT_NUMBER_WORD})*`;
const MATERIAL_CONTRACT_ANY_THRESHOLD_CONTRADICTION = new RegExp(
  '\\$[\\d,]+(?:\\.\\d+)?' // digit dollar: "$200,000"
  + `|${MATERIAL_CONTRACT_NUMBER_WORD_RUN}\\s+dollars\\b` // word-numeral dollar: "two hundred fifty thousand dollars"
  + '|\\d{1,3}(?:\\.\\d+)?\\s?%' // digit percent: "5%"
  + `|${MATERIAL_CONTRACT_NUMBER_WORD_RUN}\\s+percent\\b` // word-numeral percent: "five percent"
  + '|\\btop\\s+\\d+\\b' // digit top-N: "top 10"
  + '|\\btop\\s+(?:ten|fifteen|twenty|twenty-five|thirty|forty|fifty)\\b' // word top-N: "top ten"
  + `|\\b${MATERIAL_CONTRACT_NUMBER_WORD}\\s+largest\\b` // "ten largest customers"
  + '|\\blargest\\b', // bare superlative marker: "the largest customers"
  'i',
);

const FINGERPRINT_INPUT_V1 = freeze({ version: VERSION, bucket_meta: MATERIAL_CONTRACT_BUCKET_META, bucket_kinds: MATERIAL_CONTRACT_BUCKET_KINDS, threshold_kinds: MATERIAL_CONTRACT_THRESHOLD_KINDS, cadence_kinds: MATERIAL_CONTRACT_CADENCE_KINDS, any_threshold_contradiction: MATERIAL_CONTRACT_ANY_THRESHOLD_CONTRADICTION, near_miss_anchor: ['material', 'contract'] });
const DIGEST = registryFingerprint(FINGERPRINT_INPUT_V1);
module.exports = freeze({ VERSION, MATERIAL_CONTRACT_BUCKET_META, MATERIAL_CONTRACT_BUCKET_CODES, MATERIAL_CONTRACT_BUCKET_KINDS, MATERIAL_CONTRACT_THRESHOLD_KINDS, MATERIAL_CONTRACT_CADENCE_KINDS, MATERIAL_CONTRACT_ANY_THRESHOLD_CONTRADICTION, FINGERPRINT_INPUT_V1, DIGEST });
