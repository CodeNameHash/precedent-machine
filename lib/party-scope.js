// Canonical party derivation from a provision type/code/subtype token.
//
// Party is encoded as a hyphen/underscore segment in provision types and
// codes: IOC-T / REP-B / COND-S / TERMR-M / TERMF-TARGET / COV-SHAPRV-PARENT.
// This is the single source of truth for turning such a token into a canonical
// party_scope. Used at write time (lib/parser-v2/store-cards.js, off the rich
// prov.type like IOC-B) and at render time (components/review/table-configs/
// card-utils.js, off the card subtype). Returns null when no party token is
// present so callers can apply their own default.
//
// NOTE: the stored provision_cards.party_scope is a uniform 'MUTUAL' default
// (store-cards historically hardcoded it), so the CODE token — not the stored
// scope — is the reliable signal for existing data.

const BUYER_SEGS = new Set(['B', 'P', 'PARENT', 'BUYER', 'ACQUIRER', 'SUB', 'MERGERSUB']);
const TARGET_SEGS = new Set(['T', 'S', 'TARGET', 'SELLER', 'COMPANY']);
const MUTUAL_SEGS = new Set(['M', 'MUTUAL', 'BOTH']);

// Returns a canonical scope: 'PARENT' | 'COMPANY' | 'MUTUAL' | null.
// (PARENT covers the buyer/acquirer side — acquirer === Parent in these deals.)
function partyScopeFromCode(code) {
  const segs = String(code || '').toUpperCase().split(/[-_]/).filter(Boolean);
  if (segs.some((s) => BUYER_SEGS.has(s))) return 'PARENT';
  if (segs.some((s) => TARGET_SEGS.has(s))) return 'COMPANY';
  if (segs.some((s) => MUTUAL_SEGS.has(s))) return 'MUTUAL';
  return null;
}

// Human-facing label for a canonical scope (or a raw stored scope value).
const PARTY_SIDE_LABELS = {
  PARENT: 'Buyer / Parent',
  BUYER: 'Buyer / Parent',
  ACQUIRER: 'Buyer / Parent',
  MERGER_SUB: 'Buyer / Parent',
  COMPANY: 'Target / Company',
  TARGET: 'Target / Company',
  SELLER: 'Target / Company',
  MUTUAL: 'Mutual / Either Party',
  BOTH: 'Mutual / Either Party',
};

function partyLabel(scope) {
  return PARTY_SIDE_LABELS[String(scope || '').toUpperCase()] || null;
}

module.exports = { partyScopeFromCode, partyLabel, PARTY_SIDE_LABELS };
