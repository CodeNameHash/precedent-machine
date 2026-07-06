/* Audit-2 item 4 — conditions polish, inside CanonicalConditionDetails
   (pages/review/[id].js). JSX, not directly importable under node:test —
   pinned via source text (documented convention, see
   tests/fb3-chrome.test.js's header).

   (a) antitrust condition (COND-M-REG, label "Antitrust"): renders HSR +
       any scheduled antitrust approvals as TWO SEPARATE pills from the
       antitrustApprovals tagged-item list, with no section/schedule
       reference visible in the pill text (cite is hover-only, via Pill's
       `quote` prop) and no separate "Schedule reference" sub-row.
   (b) stockholder-approval condition (COND-M-STOCKHOLDER): shows the vote
       standard from the approvalDefinition feature (DEF-stamped by
       linkStockholderApprovalDefinition) — core clipped text visible,
       full verbatim on hover, nothing asserted when the feature is absent. */
const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('path');
const fs = require('fs');

const REVIEW_PATH = path.join(__dirname, '..', 'pages', 'review', '[id].js');
const src = fs.readFileSync(REVIEW_PATH, 'utf8');

function branchBody(marker, len = 1800) {
  const idx = src.indexOf(marker);
  assert.ok(idx > -1, `expected to find "${marker}"`);
  return src.slice(idx, idx + len);
}

/* ── (a) antitrust: two pills, no cite, no schedule-reference row ── */

test('isAntitrust matches only the "Antitrust" condition row label, not a Stockholder Approval row', () => {
  const body = branchBody('const isAntitrust =', 120);
  assert.match(body, /\/\^Antitrust\$\/i/);
});

test('the antitrust branch reads antitrustApprovals and renders one Pill per tagged item', () => {
  const body = branchBody('if (isAntitrust) {', 1400);
  assert.match(body, /f\.antitrustApprovals/);
  assert.match(body, /tagged\.map\(\(item, i\) => \(/);
  assert.match(body, /<Pill/);
});

test('the antitrust pill label comes from resolveTaggedLabel (plain-English, no cite) and the cite only ever reaches the hover quote prop', () => {
  const body = branchBody('if (isAntitrust) {', 1400);
  assert.match(body, /text=\{resolveTaggedLabel\('antitrustApprovals', item\) \|\| item\.code\}/);
  assert.match(body, /quote=\{typeof item\.text === 'string' \? item\.text : null\}/);
});

test('the antitrust branch does not fall through to a Schedule reference sub-row when tagged items are present', () => {
  const body = branchBody('if (isAntitrust) {', 1400);
  // The pills branch must `return` before ever reaching conditionDetailLines
  // (the generic path that produces the "Schedule reference" line).
  const returnIdx = body.indexOf('return (');
  const conditionDetailLinesIdx = body.indexOf('conditionDetailLines');
  assert.ok(returnIdx > -1, 'expected an early return for the tagged-items case');
  assert.ok(conditionDetailLinesIdx === -1, 'the antitrust pills branch itself must not reference conditionDetailLines');
});

/* ── (b) stockholder approval: approvalDefinition core + hover verbatim ── */

test('isStockholderApproval matches the Stockholder Approval condition rows', () => {
  const body = branchBody('const isStockholderApproval =', 120);
  assert.match(body, /Stockholder Approval/i);
});

test('the stockholder-approval branch reads approvalDefinition and renders core (clipped) + hover verbatim', () => {
  const body = branchBody('if (isStockholderApproval) {', 2000);
  assert.match(body, /f\.approvalDefinition/);
  assert.match(body, /<HoverSource quote=\{def\}>\{truncateAtWordBoundary\(def, 160\)\}<\/HoverSource>/);
  assert.match(body, /data-testid="vote-standard-pill"/);
});

test('the stockholder-approval branch renders nothing asserted (no fabricated vote standard) when approvalDefinition is absent', () => {
  const body = branchBody('if (isStockholderApproval) {', 1200);
  assert.match(body, /if \(!def\) \{/);
  assert.match(body, /CONDITION_ABSENT_COPY/);
  assert.doesNotMatch(body, /majority of the outstanding/i, 'must never hardcode a fallback vote standard');
});
