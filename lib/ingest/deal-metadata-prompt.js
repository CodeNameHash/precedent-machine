/* ─────────────────────────────────────────────────────────────────────────
   lib/ingest/deal-metadata-prompt.js: SHARED deal-metadata extraction used
   by scripts/ingest-local.js and by the from-url ingest path
   (lib/broad-corpus/contained-routes/from-url.js). The from-url path is
   currently dormant: pages/api/ingest/from-url.js resolves to a containment
   stub (503) rather than that handler (see that file's own header), so
   scripts/ingest-local.js is this module's only LIVE caller today; the
   second caller exists and is tested but is not reachable until that route
   is un-contained.

   Before this module existed the two pipelines carried near-duplicate copies
   of `extractDealMetadata` that had already started to drift (see
   docs/archive/handoffs/DEALS-INDEX-SPEC-2026-07-18.md item 1). Extracting the
   prompt + parsing + the sponsor/second-pass/profile/value logic here means
   a future prompt change can't land in one pipeline and not the other.

   Adds, on top of the original acquirer/target/signing_date/... extraction:

     1. `buyer_is_shell`: true when the filed acquirer reads as a newly
        formed vehicle (Parent/Holdco/Midco/Merger Sub naming pattern).
     2. A sponsor second pass: when buyer_is_shell is true and no sponsor
        name surfaced in the base extraction, scan the full agreement text
        for the limited-guarantee / equity-commitment-letter recitals and
        the notices section, and ask the model for a colloquial sponsor name
        to use as acquirer_display / ultimateParent.
     3. `buyer_profile` classification (financial vs strategic): financial
        iff buyer_is_shell AND the text recites fund-guarantor language
        (limited guarantee / equity commitment letter / "Guarantor").
     4. A value-derivation ladder, highest-priority tier first: (a) the
        agreement's own stated total value from the base extraction pass,
        used as-is, marked value_provenance.kind = 'stated_in_agreement';
        (b) otherwise per-share price × fully diluted share count when the
        agreement states both, marked 'derived_per_share'; (c) otherwise an
        optional caller-supplied press-release exhibit fetch (EX-99.1 from
        the same EDGAR filing index), marked 'press_release'; (d) otherwise
        'no_stated_value', never silent (a null value always carries a
        provenance explaining why).
        (a) is unguarded: nothing here sanity-checks the base pass's stated
        value against (b)'s derivation when both are present.

   `parent_entity` keeps its existing semantics (legal ultimate-parent
   entity), untouched by any of the above.
   ───────────────────────────────────────────────────────────────────────── */

const { MERGER_FORMS } = require('../taxonomy');
const { buildAdvisorsV2 } = require('../parser-v2/notice-advisors');

// Shared with the ingest-qa `buyer_display` gate and (once Package A lands)
// lib/query/types.js's resolveBuyerDisplay — a candidate name that reads as
// a transaction-only vehicle rather than an operating company or a market-
// recognizable sponsor name.
const SHELL_NAME_REGEX = /\b(parent|holdco|midco|bidco|topco|opco|merger\s+sub|acquisition(\s+co)?|buyer)\b/i;

function isShellName(name) {
  return typeof name === 'string' && SHELL_NAME_REGEX.test(name);
}

/* ── shell-piercing rule (Ben, 2026-07-18 review): pierce ONLY deal-formed
   SPVs, never real companies or pre-existing holdcos ───────────────────────
   A shell-shaped NAME (SHELL_NAME_REGEX) is only a hint. Before substituting
   a sponsor/ultimate-parent display name for it, the recitals/reps have to
   actually say the entity was formed FOR this transaction — the same
   principle that already correctly keeps "Stanley Martin Homes, LLC" (a
   real, pre-existing Daiwa House operating subsidiary) un-pierced despite
   sitting in the acquirer slot of a merger agreement. Piercing a name that
   merely LOOKS shell-shaped but is actually a real company would corrupt
   the display data worse than leaving the legal name showing. */

// Affirmative "this entity was formed FOR the transaction" recital — the
// standard "Operations of the Buyer Parties" / "no prior operations" rep in
// the Parent/Merger Sub reps article (verified verbatim in the Superior
// Industries and European Wax Center agreements: "has been formed solely
// for the purpose of engaging in the Transactions").
const TRANSACTION_FORMED_RECITAL_RE = /(formed solely (for|for the purpose of)|organized solely (for|for the purpose of)|was formed solely for purposes of|has not conducted any (business|operations)|will have engaged in no other business|no prior operating history|newly formed (solely )?(for|to))/i;

// Affirmative signal the candidate is a REAL, pre-existing operating company
// or legitimate pre-existing holding company — e.g. a homebuilder describing
// its own business, or "a wholly owned subsidiary of X since <year>". When
// this fires on the candidate's own recital text, shell-piercing must NOT
// apply even if the name also matches SHELL_NAME_REGEX.
const PRE_EXISTING_ENTITY_RE = /(conducts?( its)? business|is engaged in the business of|has operated since|founded in \d{4}|an operating (company|subsidiary)|(?:a|an) (?:wholly[\s-]owned )?subsidiary of .{0,60} since \d{4})/i;

function hasTransactionFormationLanguage(text) {
  return TRANSACTION_FORMED_RECITAL_RE.test(String(text || ''));
}

function hasPreExistingEntityLanguage(text) {
  return PRE_EXISTING_ENTITY_RE.test(String(text || ''));
}

// shouldPierceShell(name, fullText) — the general decision function. Returns
// { pierce: boolean, reason: string }.
//   1. Name doesn't match the shell pattern at all -> never pierce.
//   2. fullText affirmatively describes the candidate as a real / pre-
//      existing business -> never pierce (the Stanley Martin principle).
//   3. fullText affirmatively states the candidate was formed for the
//      transaction -> pierce, high confidence.
//   4. Neither signal is present (or no fullText available) -> fall back to
//      the shell-name heuristic alone. This is the common case for sponsor-
//      SPV naming conventions (e.g. "BCPE ___ Buyer, Inc.", "Wildcat ___
//      Holdco") where the formation rep may be phrased unusually but the
//      naming convention plus an already-verified guarantor/equity-investor
//      recital elsewhere in the agreement establishes it as a deal vehicle.
function shouldPierceShell(name, fullText) {
  if (!isShellName(name)) return { pierce: false, reason: 'not-shell-shaped' };
  if (fullText && hasPreExistingEntityLanguage(fullText)) return { pierce: false, reason: 'pre-existing-entity-language' };
  if (fullText && hasTransactionFormationLanguage(fullText)) return { pierce: true, reason: 'transaction-formed-language' };
  return { pierce: true, reason: 'shell-name-heuristic (no formation/pre-existing language found in the checked text)' };
}

/* ── base extraction prompt (preamble) ──────────────────────────────────── */

function buildDealMetadataPrompt(preamble, mergerFormCodes = Object.keys(MERGER_FORMS)) {
  return `You are extracting structured metadata from the preamble of a merger or acquisition agreement.

Return ONLY a JSON object with these fields. Use null for any field you cannot determine confidently.

{
  "acquirer": "string — the buyer / parent entity legal name (e.g. 'Pfizer Inc.')",
  "target": "string — the target / company legal name (e.g. 'Metsera, Inc.')",
  "signing_date": "YYYY-MM-DD — the agreement signing/execution date from the preamble",
  "value_usd": number or null — total transaction equity value in USD if stated; otherwise null,
  "sector": "string — single short label like 'Biopharma', 'Technology', 'Financial Services'",
  "merger_form": "one of: ${mergerFormCodes.join(', ')} — pick the best match",
  "parent_entity": "string or null — the ULTIMATE PARENT on whose behalf the acquisition is made. NEVER the merger sub and NEVER an intermediate holding shell: if the signatory is a merger sub formed by a public parent for this transaction (e.g. 'Bespin Subsidiary, LLC' formed by 'AbbVie Inc.'), parent_entity is the parent ('AbbVie Inc.'), not the sub. If the filed acquirer already IS the ultimate parent (no separate parent named), repeat the acquirer's name here.",
  "target_entity": "string or null — the target's clean legal entity name (usually same as target)",
  "acquirer_display": "string or null — short colloquial/market name for the acquirer's ultimate parent with no Inc./Corp./LLC/L.P./plc suffix, e.g. 'AbbVie', 'Pfizer', 'Red Hat'",
  "target_display": "string or null — short colloquial/market name for the target with no Inc./Corp./LLC/L.P./plc suffix, e.g. 'Metsera'",
  "buyer_is_shell": true or false — true ONLY when the filed acquirer was FORMED FOR THIS TRANSACTION (recitals/reps state it has no prior operations, was organized/formed solely to effect the merger, or is a merger sub with no operating history). Naming alone (containing "Parent", "Holdco", "Midco", "Buyer", etc.) is a HINT, not proof — a PRE-EXISTING holding company or real operating entity that merely has one of these words in its name is NOT a shell, even if it is not independently famous (e.g. a target's own existing parent, or an existing subsidiary of a strategic acquirer). false whenever the filed acquirer is an existing operating company, an existing holding company that pre-dates this transaction, or already the known ultimate parent,
  "per_share_value_usd": number or null — the per-share cash-equivalent merger consideration if the preamble/Article 1 states one (for a pure cash deal, the per-share cash price; for stock-for-stock, null unless a cash-equivalent value is stated),
  "fully_diluted_shares": number or null — the fully diluted outstanding share count if stated in the preamble/recitals
}

Agreement text (preamble):
"""
${preamble}
"""

Return ONLY the JSON object, no prose, no markdown fence.`;
}

function extractJson(raw) {
  const jsonMatch = String(raw || '{}').match(/\{[\s\S]*\}/);
  if (!jsonMatch) throw new Error('Metadata extraction did not return JSON');
  return JSON.parse(jsonMatch[0]);
}

function parseDealMetadataResponse(raw) {
  const parsed = extractJson(raw);
  return {
    acquirer: parsed.acquirer || null,
    target: parsed.target || null,
    signing_date: parsed.signing_date || null,
    value_usd: typeof parsed.value_usd === 'number' ? parsed.value_usd : null,
    sector: parsed.sector || null,
    merger_form: parsed.merger_form || null,
    parent_entity: parsed.parent_entity || null,
    target_entity: parsed.target_entity || null,
    acquirer_display: parsed.acquirer_display || null,
    target_display: parsed.target_display || null,
    buyer_is_shell: parsed.buyer_is_shell === true,
    per_share_value_usd: typeof parsed.per_share_value_usd === 'number' ? parsed.per_share_value_usd : null,
    fully_diluted_shares: typeof parsed.fully_diluted_shares === 'number' ? parsed.fully_diluted_shares : null,
  };
}

/* ── sponsor second pass ────────────────────────────────────────────────── */

// Keywords whose surrounding text is likely to name the sponsor even when
// the preamble only names the acquisition vehicle: limited-guarantee /
// equity-commitment-letter recitals and the notices section.
const SPONSOR_KEYWORDS = [
  /Guarantors?\b/g,
  /Equity Investors?\b/g,
  /equity commitment letter/gi,
  /limited guarantee/gi,
  /\bc\/o\b/g,
];

const EXCERPT_RADIUS = 500;
const EXCERPT_CAP = 8000;

// Pure, deterministic: scan `fullText` for the sponsor keywords above and
// return up to EXCERPT_CAP chars of ±EXCERPT_RADIUS windows around each hit,
// deduplicated/merged where windows overlap. Returns null if nothing found.
function buildSponsorExcerpt(fullText, opts = {}) {
  const text = String(fullText || '');
  const radius = opts.radius || EXCERPT_RADIUS;
  const cap = opts.cap || EXCERPT_CAP;
  if (!text) return null;

  const windows = [];
  for (const re of SPONSOR_KEYWORDS) {
    re.lastIndex = 0;
    let m;
    while ((m = re.exec(text))) {
      const start = Math.max(0, m.index - radius);
      const end = Math.min(text.length, m.index + m[0].length + radius);
      windows.push([start, end]);
      if (re.lastIndex === m.index) re.lastIndex += 1; // guard zero-width
    }
  }
  if (windows.length === 0) return null;

  windows.sort((a, b) => a[0] - b[0]);
  const merged = [];
  for (const [start, end] of windows) {
    const last = merged[merged.length - 1];
    if (last && start <= last[1]) last[1] = Math.max(last[1], end);
    else merged.push([start, end]);
  }

  let out = '';
  for (const [start, end] of merged) {
    if (out.length >= cap) break;
    const chunk = text.slice(start, end);
    out += (out ? '\n---\n' : '') + chunk;
  }
  return out.slice(0, cap).trim() || null;
}

function buildSponsorPrompt(dealLabel, excerpt) {
  return `You are identifying the sponsor (private equity fund / financial buyer) behind a shell acquisition vehicle in an M&A agreement.

The deal as filed: ${dealLabel}. The filed acquirer is a newly formed vehicle (Parent/Holdco/Midco/Merger Sub); the excerpts below are drawn from the limited-guarantee / equity-commitment-letter recitals and the notices section, where the sponsor fund is typically named as Guarantor or Equity Investor.

Return ONLY a JSON object:
{
  "sponsor_name": "string or null — short colloquial/market name of the sponsor fund with no 'Fund', 'L.P.', roman numeral, or legal suffix, e.g. 'Bain Capital', 'Silver Lake', 'General Atlantic'. If multiple sponsors, return the lead/first-named one. null if no sponsor name is identifiable from the excerpts."
}

Excerpts:
"""
${excerpt}
"""

Return ONLY the JSON object, no prose, no markdown fence.`;
}

function parseSponsorResponse(raw) {
  const parsed = extractJson(raw);
  return { sponsor_name: parsed.sponsor_name || null };
}

/* ── law firms (metadata.law_firms) ─────────────────────────────────────────
   Ben (deals-index round, 2026-07-19): persist target-side / acquirer-side
   outside counsel at INGEST time, not only via the post-hoc
   scripts/backfill-advisors.js pass. Metadata extraction runs BEFORE
   provisions are classified, so there is no MISC-NOTICES provision yet to
   feed the deterministic parser (lib/parser-v2/notice-advisors.js) the
   normal way — instead this carves a Notices-section-shaped excerpt out of
   the raw agreement text (same excerpt-then-parse pattern as the sponsor
   second pass above) and hands buildAdvisorsV2() that excerpt as a single
   synthetic "provision". buildAdvisorsV2 is REUSED as-is (same deterministic
   party-block segmentation + firm/lawyer capture scripts/backfill-advisors.js
   already relies on), so ingest-time and backfill-time extraction can never
   drift on what counts as a firm.

   metadata.law_firms = { target: [...], acquirer: [...] } — plain arrays of
   verbatim firm names, deliberately separate from metadata.advisors_v2
   (which also carries per-lawyer names + the raw block capture); this key
   exists purely so "does this deal have law firms on record" is a flat,
   ingest-time fact instead of something only the backfill script produces.
   ───────────────────────────────────────────────────────────────────────── */

const NOTICES_HEADING_RE = /\bNotices\b/;
const IF_TO_RE = /if\s+to\b/i;
const NOTICES_EXCERPT_CAP = 6000;

// Pure, deterministic: find a Notices-section-shaped window in `fullText`.
// Prefers the text starting at a "Notices" heading whose first "if to"
// party block follows within a few thousand characters (skips false-positive
// "notices" mentions elsewhere in the agreement that aren't the Notices
// article); falls back to the first bare "if to ... :" header found anywhere
// if no heading match qualifies. Returns null when neither is found.
function buildNoticesExcerpt(fullText, opts = {}) {
  const text = String(fullText || '');
  const cap = opts.cap || NOTICES_EXCERPT_CAP;
  if (!text) return null;

  const headingRe = new RegExp(NOTICES_HEADING_RE.source, 'g');
  let start = null;
  let m;
  while ((m = headingRe.exec(text))) {
    const window = text.slice(m.index, m.index + 3000);
    if (IF_TO_RE.test(window)) { start = m.index; break; }
  }
  if (start == null) {
    const ifTo = text.match(IF_TO_RE);
    if (ifTo) start = ifTo.index;
  }
  if (start == null) return null;
  return text.slice(start, start + cap);
}

// meta: the base-pass parsed metadata (acquirer/target/parent_entity/
// target_entity/acquirer_display/target_display) — buildAdvisorsV2's side-
// attribution needs these to tell buyer blocks from seller blocks.
function extractLawFirms(fullText, meta) {
  const excerpt = buildNoticesExcerpt(fullText);
  if (!excerpt) return { target: [], acquirer: [] };
  const dealShape = {
    acquirer: meta.acquirer || null,
    target: meta.target || null,
    metadata: {
      parent_entity: meta.parent_entity || null,
      acquirer_display: meta.acquirer_display || null,
      target_entity: meta.target_entity || null,
      target_display: meta.target_display || null,
    },
  };
  let v2 = null;
  try {
    v2 = buildAdvisorsV2([{ id: null, full_text: excerpt }], dealShape);
  } catch {
    return { target: [], acquirer: [] };
  }
  if (!v2) return { target: [], acquirer: [] };
  return { target: v2.seller_firms || [], acquirer: v2.buyer_firms || [] };
}

/* ── buyer_profile classification ───────────────────────────────────────── */

// Same recital language the sponsor excerpt scans for is also the signal
// for financial-vs-strategic: a shell buyer backed by a limited guarantee /
// equity commitment letter from fund guarantors is a sponsor take-private.
const GUARANTEE_LANGUAGE_RE = /(limited guarantee|equity commitment letter|Equity Investors?\b)/i;

function detectGuaranteeLanguage(fullText) {
  return GUARANTEE_LANGUAGE_RE.test(String(fullText || ''));
}

function classifyBuyerProfile({ buyerIsShell, hasGuaranteeLanguage }) {
  return buyerIsShell && hasGuaranteeLanguage ? 'financial' : 'strategic';
}

/* ── value derivation ───────────────────────────────────────────────────── */

function derivePerShareValue({ perShareValueUsd, fullyDilutedShares }) {
  if (typeof perShareValueUsd !== 'number' || !Number.isFinite(perShareValueUsd) || perShareValueUsd <= 0) return null;
  if (typeof fullyDilutedShares !== 'number' || !Number.isFinite(fullyDilutedShares) || fullyDilutedShares <= 0) return null;
  return Math.round(perShareValueUsd * fullyDilutedShares);
}

function buildValueProvenance(kind, opts = {}) {
  const out = { kind, set_at: opts.set_at || new Date().toISOString() };
  if (opts.set_by) out.set_by = opts.set_by;
  if (opts.source_url) out.source_url = opts.source_url;
  if (opts.note) out.note = opts.note;
  if (opts.quote) out.quote = opts.quote;
  return out;
}

// Orchestrates the three-tier value-derivation ladder. `fetchPressRelease`
// is an optional async (meta) => { value_usd, source_url, quote } | null
// hook the caller (ingest-local.js / from-url.js) can wire to a real EDGAR
// EX-99.1 fetch; when absent or it returns null, falls through to (c).
async function deriveValue(meta, opts = {}) {
  if (typeof meta.value_usd === 'number' && meta.value_usd > 0) {
    return {
      value_usd: meta.value_usd,
      value_provenance: buildValueProvenance('stated_in_agreement', {
        set_by: 'ingest_metadata',
        source_url: opts.sourceUrl || null,
      }),
    };
  }

  const derived = derivePerShareValue({
    perShareValueUsd: meta.per_share_value_usd,
    fullyDilutedShares: meta.fully_diluted_shares,
  });
  if (derived) {
    return {
      value_usd: derived,
      value_provenance: buildValueProvenance('derived_per_share', {
        set_by: 'ingest_metadata',
        source_url: opts.sourceUrl || null,
        note: `${meta.per_share_value_usd}/sh × ${meta.fully_diluted_shares} fully diluted shares`,
      }),
    };
  }

  if (typeof opts.fetchPressRelease === 'function') {
    try {
      const pr = await opts.fetchPressRelease(meta);
      if (pr && typeof pr.value_usd === 'number' && pr.value_usd > 0) {
        return {
          value_usd: pr.value_usd,
          value_provenance: buildValueProvenance('press_release', {
            set_by: 'ingest_press_release_fetch',
            source_url: pr.source_url || null,
            quote: pr.quote || null,
          }),
        };
      }
    } catch {
      // Best effort — fall through to no_stated_value rather than fail ingest.
    }
  }

  return {
    value_usd: null,
    value_provenance: buildValueProvenance('no_stated_value', { set_by: 'ingest_metadata' }),
  };
}

/* ── orchestrator ────────────────────────────────────────────────────────── */

// client.messages.create({model, max_tokens, messages}) — the one method
// every pipeline backend (Anthropic SDK client or the subscription CLI
// clients in lib/llm-cli-client.js) implements.
async function extractDealMetadata(client, text, opts = {}) {
  const model = opts.model || 'meta';
  const preamble = String(text || '').substring(0, 10000);
  const prompt = buildDealMetadataPrompt(preamble, opts.mergerFormCodes);
  const resp = await client.messages.create({ model, max_tokens: 600, messages: [{ role: 'user', content: prompt }] });
  const raw = (resp.content && resp.content[0] && resp.content[0].text) || '{}';
  const meta = parseDealMetadataResponse(raw);

  // Shell-piercing decision (general rule, Ben 2026-07-18): pierce ONLY
  // deal-formed SPVs, never real companies or pre-existing holdcos. A
  // shell-shaped NAME is a hint, not proof — this checks the full agreement
  // text for an affirmative "pre-existing entity" signal (never pierce,
  // Stanley Martin principle) before falling back to the naming heuristic.
  const pierceDecision = shouldPierceShell(meta.acquirer, text);
  meta.shell_piercing_signal = pierceDecision.reason;

  // Sponsor second pass: only when the filed buyer reads as a shell, the
  // pierce decision doesn't rule it out as a pre-existing entity, AND the
  // base pass didn't already land on a non-shell display name.
  if (meta.buyer_is_shell && pierceDecision.pierce && (!meta.acquirer_display || isShellName(meta.acquirer_display))) {
    const excerpt = buildSponsorExcerpt(text);
    if (excerpt) {
      try {
        const sponsorPrompt = buildSponsorPrompt(`${meta.acquirer || '?'} / ${meta.target || '?'}`, excerpt);
        const sponsorResp = await client.messages.create({ model, max_tokens: 200, messages: [{ role: 'user', content: sponsorPrompt }] });
        const sponsorRaw = (sponsorResp.content && sponsorResp.content[0] && sponsorResp.content[0].text) || '{}';
        const { sponsor_name } = parseSponsorResponse(sponsorRaw);
        if (sponsor_name && !isShellName(sponsor_name)) {
          meta.acquirer_display = sponsor_name;
          meta.ultimateParent = sponsor_name;
          meta.sponsor_second_pass = true;
        }
      } catch {
        // Best effort — leave acquirer_display as the base pass produced it.
      }
    }
  }

  // Law firms (metadata.law_firms) — deterministic, no extra LLM call.
  meta.law_firms = extractLawFirms(text, meta);

  const hasGuaranteeLanguage = detectGuaranteeLanguage(text);
  // A confirmed pre-existing/operating entity can't be classified financial
  // off the buyer_is_shell signal alone — buyer_profile still respects the
  // pierce decision so a real company with guarantee-adjacent language
  // elsewhere in the agreement doesn't get mislabeled a sponsor take-private.
  meta.buyer_profile = classifyBuyerProfile({
    buyerIsShell: meta.buyer_is_shell && pierceDecision.pierce,
    hasGuaranteeLanguage,
  });

  const valueResult = await deriveValue(meta, {
    sourceUrl: opts.sourceUrl,
    fetchPressRelease: opts.fetchPressRelease,
  });
  meta.value_usd = valueResult.value_usd;
  meta.value_provenance = valueResult.value_provenance;

  return meta;
}

module.exports = {
  SHELL_NAME_REGEX,
  isShellName,
  TRANSACTION_FORMED_RECITAL_RE,
  PRE_EXISTING_ENTITY_RE,
  hasTransactionFormationLanguage,
  hasPreExistingEntityLanguage,
  shouldPierceShell,
  buildDealMetadataPrompt,
  parseDealMetadataResponse,
  buildSponsorExcerpt,
  buildSponsorPrompt,
  parseSponsorResponse,
  buildNoticesExcerpt,
  extractLawFirms,
  detectGuaranteeLanguage,
  classifyBuyerProfile,
  derivePerShareValue,
  buildValueProvenance,
  deriveValue,
  extractDealMetadata,
};
