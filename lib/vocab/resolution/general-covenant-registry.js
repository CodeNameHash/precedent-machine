'use strict';
const { GENERAL_COVENANT_FOLLOW_ON_OWNERS } = require('../../canonical-v2/p0-product-surface-routing');
const { freeze, registryFingerprint } = require('./registry-fingerprint');
const VERSION = 'RESOLUTION_GENERAL_COVENANT_REGISTRY/V1';
const GENERAL_COVENANT_CODES = freeze(Object.keys(GENERAL_COVENANT_FOLLOW_ON_OWNERS).sort());
const GENERAL_COVENANT_CODE_PATTERNS = Object.freeze({
  'COV-16B': [
    /\bSection\s+16\b/i,
    /\bRule\s+16b-3\b/i,
    /\bshort-?swing\s+profit\b/i,
  ],
  // Modiv 5.9-family confidentiality/access covenant, confirmed against the
  // real quote ("give Parent and its authorized Representatives reasonable
  // access ... to all properties, facilities, personnel and books and
  // records") and its confidentiality sibling ("will hold ... in confidence
  // all documents and information ... pursuant to ... Mutual Non-Disclosure
  // Agreement").
  'COV-ACCESS': [
    /\breasonable\s+access\b/i,
    /\b(?:give|grant|provide|afford)\b[^.]{0,80}\baccess\b[^.]{0,80}\b(?:properties|personnel|books\s+and\s+records|records|information|facilities)\b/i,
    /\bhold\b[^.]{0,30}\bin\s+confidence\b/i,
    /\b(?:confidentiality|non-?disclosure)\s+agreement\b/i,
  ],
  'COV-CONSENT': [
    /\bthird[- ]party\s+consents?\b/i,
    /\b(?:deliver|obtain|use\s+(?:its|their)\s+(?:reasonable\s+)?(?:best\s+)?efforts\s+to\s+obtain)\b[^.]{0,80}\b(?:consents?|approvals?)\b[^.]{0,80}\b(?:required|necessary)\b/i,
    /\brequired\s+consents?\b/i,
  ],
  'COV-CVR': [
    /\bcontingent\s+value\s+rights?\b/i,
    /\bCVR\b/,
    /\bCVR\s+Agreement\b/i,
  ],
  'COV-DEBT': [
    /\bexisting\s+indebtedness\b/i,
    /\b(?:repay|redeem|discharge|satisfy)\b[^.]{0,60}\b(?:indebtedness|notes|credit\s+facility|credit\s+agreement)\b/i,
    /\bcredit\s+agreement\b/i,
  ],
  // COV-DELIST and COV-LIST share an owner_id (LISTING_DELISTING_COVENANTS)
  // but are opposite directions of the same transaction and must not share
  // a pattern: DELIST is the TARGET's shares coming OFF an exchange, LIST is
  // new (typically acquirer) shares going ON one.
  'COV-DELIST': [
    /\bdelist(?:ing)?\b/i,
    /\bderegist(?:er|ration)\b/i,
    /\bSection\s+12\(b\)\b/i,
  ],
  'COV-LIST': [
    /\b(?:approv(?:e|al)\s+for\s+listing|listed?)\b[^.]{0,60}\b(?:NYSE|Nasdaq|national\s+securities\s+exchange)\b/i,
    /\blisting\s+of\s+(?:the\s+)?(?:shares|stock)\b/i,
  ],
  'COV-FDACOMMS': [
    /\bFDA\b/,
    /\bFood\s+and\s+Drug\s+Administration\b/i,
  ],
  'COV-FURTHER': [
    /\bfurther\s+assurances?\b/i,
    /\bexecute(?:\s+and\s+deliver)?\b[^.]{0,40}\b(?:such\s+)?(?:other|further)\s+(?:documents|instruments|actions)\b/i,
  ],
  'COV-INDEMN': [
    /\bindemnif(?:y|ication)\b/i,
    /\bhold\s+harmless\b/i,
    /\bD\s*&\s*O\b/i,
    /\btail\s+(?:insurance|policy)\b/i,
  ],
  'COV-LITNOTIFY': [
    /\b(?:stockholder|transaction|securityholder)\s+litigation\b/i,
    /\b(?:Action|Proceeding|Legal\s+Proceeding)\b[^.]{0,60}\brelating\s+to\b[^.]{0,40}\b(?:this\s+Agreement|the\s+Mergers?|the\s+Transactions?)\b/i,
  ],
  // COV-MERGESUB is Merger Sub *compliance* (no other business, no assets/
  // liabilities, cause Merger Sub to perform) — not "any clause that lists
  // Merger Sub as a joint obligor next to shall". The retired
  // `Merger Sub … shall` proximity pattern false-fired on Rule 16b-3 and
  // publicity joint-obligor drafting (Step 2X-C held collisions; see
  // docs/codex-program/notes/step-2x-c-followup.md pairs 2 and 3).
  'COV-MERGESUB': [
    /\bMerger\s+Sub\s+shall\s+not\b/i,
    /\bMerger\s+Sub\s+shall\s+have\s+no\b/i,
    /\bMerger\s+Sub\b[^.]{0,100}\b(?:business\s+activities\s+other\s+than|no\s+assets|no\s+liabilities|wholly[- ]owned)\b/i,
    /\bcause\s+Merger\s+Sub\s+to\s+(?:perform|comply|fulfill)\b/i,
    /\bcause\s+(?:Merger\s+Sub(?:\s+(?:or|and)\s+(?:the\s+)?Surviving\s+Corporation)?|each\s+of\s+(?:the\s+)?Merger\s+Subsidiaries)\s*(?:,\s*as\s+applicable,?)?\s+to\s+(?:perform|comply|fulfil(?:l)?)\b/i,
  ],
  // Confirmed against all 7 modiv-general-covenants-20260807-replay
  // COV-NOTIFY candidates, every one of which opens "The Company shall give
  // prompt notice to Parent...".
  'COV-NOTIFY': [
    /\b(?:give|deliver)\s+(?:prompt|written)\s+notice\b/i,
    /\bpromptly\s+notify\b/i,
    /\bpromptly\s+(?:give|provide|deliver)\s+notice\b/i,
  ],
  'COV-PAYAGENT': [
    /\bPaying\s+Agent\b/,
    /\bExchange\s+Agent\b/,
    /\bDisbursing\s+Agent\b/,
  ],
  // Confirmed against both modiv-general-covenants-20260807-replay
  // COV-PUBLICITY candidates ("issuing any press release", "public
  // statement").
  'COV-PUBLICITY': [
    /\bpress\s+releases?\b/i,
    /\bpublic\s+(?:statements?|announcements?)\b/i,
    /\bpublicity\b/i,
  ],
  'COV-RESIGN': [
    /\bresign(?:ation)?\b[^.]{0,60}\b(?:director|officer)\b/i,
    /\b(?:director|officer)\b[^.]{0,60}\bresign(?:ation)?\b/i,
    /\bcause\b[^.]{0,60}\bto\s+resign\b/i,
  ],
  'COV-SECREPORT': [
    /\bpost[- ]closing\s+SEC\s+reports?\b.{0,100}\b(?:will|shall)\b.{0,250}\b(?:contain|comply|file|furnish|provide)\b/i,
    /\b(?:file|furnish|provide|deliver|prepare)\b[^.]{0,80}\b(?:Exchange\s+Act\s+reports?|SEC\s+filings?|periodic\s+reports?)\b/i,
  ],
  'COV-TAKEOVER': [
    /\btake\b[^.]{0,60}\baction\b[^.]{0,120}\bsubject\s+to\b[^.]{0,100}\bTakeover\s+Laws?\b/i,
    /\btake\b[^.]{0,60}\bsteps\b[^.]{0,100}\bexempt\b[^.]{0,160}\bfrom\s+(?:the\s+)?Takeover\s+Laws?\b/i,
  ],
});

/**
 * Lex specialis for genuine dual-coding (Ben, 2026-08-08): when a clause is
 * both a general notice obligation and a litigation-notice obligation, the
 * more specific code wins — one row, COV-LITNOTIFY. Not a pattern bug; a
 * taxonomy precedence. Loser is suppressed for double-fire / collision
 * purposes so the claim resolves rather than holding forever.
 *
 * Trade-off accepted: a cross-deal query for bare "notice obligations"
 * keyed only on COV-NOTIFY will miss these rows unless the query surface
 * later includes LITNOTIFY in that family.
 */
const GENERAL_COVENANT_SPECIFICITY_PRECEDENCE = Object.freeze([
  Object.freeze({ winner: 'COV-LITNOTIFY', loser: 'COV-NOTIFY' }),
]);const FINGERPRINT_INPUT_V1 = freeze({ version: VERSION, codes: GENERAL_COVENANT_CODES, owners: GENERAL_COVENANT_FOLLOW_ON_OWNERS, code_patterns: GENERAL_COVENANT_CODE_PATTERNS, specificity_precedence: GENERAL_COVENANT_SPECIFICITY_PRECEDENCE, near_miss_anchor: ['covenant'] });
const DIGEST = registryFingerprint(FINGERPRINT_INPUT_V1);
module.exports = freeze({ VERSION, GENERAL_COVENANT_CODES, GENERAL_COVENANT_FOLLOW_ON_OWNERS, GENERAL_COVENANT_CODE_PATTERNS, GENERAL_COVENANT_SPECIFICITY_PRECEDENCE, FINGERPRINT_INPUT_V1, DIGEST });
