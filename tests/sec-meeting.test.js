const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');

const { buildFeatureInstructions } = require('../lib/parser-v2/extract');
const { FEATURES, getFeaturesForType } = require('../lib/rubric');
const { validateFeatures } = require('../lib/feature-validation');

let secMeeting;
test.before(async () => {
  secMeeting = await import(path.join('..', 'lib', 'sec-meeting.js'));
});

const SEC_KEYS = [
  'proxyFilingDeadline',
  'mailingDeadline',
  'meetingDeadline',
  'adjournmentRights',
  'meetingControlNotes',
];

const SEC_PROMPT_BLOCK = `SEC FILING / MEETING MECHANICS (COV-PROXY / COV-MEETING sections ONLY; all fields null elsewhere):
- proxyFilingDeadline: the deadline to FILE the Proxy Statement (or S-4). Capture the verbatim sentence in "text"; parse "days"/"unit" ONLY when the agreement states a numeric deadline ("within ten (10) Business Days after the date of this Agreement" → days 10, unit BUSINESS_DAYS, trigger AGREEMENT_DATE). "as promptly as reasonably practicable" alone → days null.
- mailingDeadline: when mailing to stockholders must COMMENCE, with its trigger event (SEC clearance / expiry of the 10-day no-comment window / S-4 effectiveness). Same parsing discipline.
- meetingDeadline: when the stockholders meeting must be convened/held, with trigger (typically within N days of mailing or effectiveness).
- adjournmentRights: one entry PER PARTY that can cause adjournment/postponement. reasons drawn ONLY from the enumerated grounds in the text (absence of quorum; insufficient votes; supplemental disclosure required by Law; OTHER with verbatim). Capture numeric limits exactly: number of adjournments, days per adjournment, aggregate cap. NEVER invent numbers; a right with no stated limit keeps nulls.
- Every "text" field is VERBATIM from the source — no summarizing at this layer.`;

function provision(code, features) {
  return {
    id: code,
    type: 'COV',
    code,
    ai_metadata: { code, features },
  };
}

test('FEATURES registers exact SEC filing / meeting fields for COV-PROXY and COV-MEETING', () => {
  for (const code of ['COV-PROXY', 'COV-MEETING']) {
    const keys = FEATURES[code].map((f) => f.key);
    assert.deepEqual(keys, SEC_KEYS, `${code} schema should only contain SEC filing / meeting fields`);
    const resolved = getFeaturesForType('COV', code).map((f) => f.key);
    assert.deepEqual(resolved, SEC_KEYS, `${code} resolved schema should only contain SEC filing / meeting fields`);
  }
});

test('COV prompt includes the SEC filing / meeting mechanics block verbatim', () => {
  const instr = buildFeatureInstructions('COV');
  assert.ok(instr.includes(SEC_PROMPT_BLOCK), 'COV prompt missing exact SEC filing / meeting block');
  for (const key of SEC_KEYS) assert.match(instr, new RegExp(key), key);
});

test('validateFeatures accepts populated COV-PROXY SEC filing / meeting shapes without unknown-key warnings', () => {
  const features = {
    canonicalCode: 'COV-PROXY',
    proxyFilingDeadline: {
      text: 'The Company shall file the Proxy Statement with the SEC within ten (10) Business Days after the date of this Agreement.',
      days: 10,
      unit: 'BUSINESS_DAYS',
      trigger: 'AGREEMENT_DATE',
    },
    mailingDeadline: {
      text: 'The Company shall commence mailing the Proxy Statement as promptly as practicable after clearance by the SEC.',
      days: null,
      unit: null,
      trigger: 'SEC_CLEARANCE',
    },
    meetingDeadline: {
      text: 'The Company shall hold the Company Stockholders Meeting within forty (40) days after mailing the Proxy Statement.',
      days: 40,
      unit: 'CALENDAR_DAYS',
      trigger: 'MAILING',
    },
    adjournmentRights: [{
      party: 'MUTUAL',
      reasons: [{ code: 'INSUFFICIENT_VOTES', label: 'Insufficient votes', text: 'to solicit additional proxies' }],
      maxAdjournments: 2,
      maxDaysPerAdjournment: 10,
      maxDaysTotal: 20,
      text: 'The Company may adjourn the Company Stockholders Meeting up to two times for up to ten days each.',
    }],
    meetingControlNotes: 'The Company may not postpone the meeting without Parent consent except as required by Law.',
  };
  const { errors, warnings } = validateFeatures('COV', features);
  assert.deepEqual(errors, []);
  assert.deepEqual(warnings.filter((w) => w.kind === 'unknown-key'), []);
});

test('secMeetingDisplayState builds rows from a realistic proxy / meeting fixture', () => {
  const fixture = [provision('COV-PROXY', {
    proxyFilingDeadline: {
      text: 'The Company shall file the Proxy Statement with the SEC within ten (10) Business Days after the date of this Agreement.',
      days: 10,
      unit: 'BUSINESS_DAYS',
      trigger: 'AGREEMENT_DATE',
    },
    mailingDeadline: {
      text: 'The Company shall commence mailing the Proxy Statement after SEC clearance.',
      days: null,
      unit: null,
      trigger: 'SEC_CLEARANCE',
    },
    meetingDeadline: {
      text: 'The Company shall hold the Company Stockholders Meeting within forty (40) days after mailing the Proxy Statement.',
      days: 40,
      unit: 'CALENDAR_DAYS',
      trigger: 'MAILING',
    },
    adjournmentRights: [{
      party: 'MUTUAL',
      reasons: [
        { code: 'QUORUM_ABSENT', label: 'Quorum absent', text: 'if a quorum is not present' },
        { code: 'INSUFFICIENT_VOTES', label: 'Insufficient votes', text: 'to solicit additional proxies' },
      ],
      maxAdjournments: 2,
      maxDaysPerAdjournment: 10,
      maxDaysTotal: 20,
      text: 'The parties may mutually agree to adjourn the meeting up to two times for up to ten days each.',
    }],
  })];

  const state = secMeeting.secMeetingDisplayState(fixture);
  assert.equal(state.collapsed, false);
  assert.equal(secMeeting.formatDeadline(state.summary.proxyFilingDeadline), '10 business days after agreement date');
  assert.equal(secMeeting.formatDeadline(state.summary.meetingDeadline), '40 calendar days after mailing');
  assert.equal(state.summary.mailingDeadline.trigger, 'SEC_CLEARANCE');
  assert.equal(state.summary.adjournmentRights[0].party, 'MUTUAL');
  assert.deepEqual(secMeeting.formatAdjournmentLimits(state.summary.adjournmentRights[0]), [
    '2 adjournments',
    '10 days each',
    '20 days total',
  ]);
  assert.ok(state.rows.some((row) => row.label === 'Adjournment rights - Mutual'));
});

test('secMeetingDisplayState omits Company from the adjournment-rights row title', () => {
  const state = secMeeting.secMeetingDisplayState([provision('COV-MEETING', {
    adjournmentRights: [{
      party: 'COMPANY',
      reasons: [{ code: 'INSUFFICIENT_VOTES', label: 'Insufficient votes', text: 'to solicit additional proxies' }],
      text: 'The Company may adjourn the Company Stockholders Meeting to solicit additional proxies.',
    }],
  })]);
  assert.ok(state.rows.some((row) => row.label === 'Adjournment rights'));
  assert.ok(!state.rows.some((row) => /Adjournment rights - Company/.test(row.label)));
});

test('secMeetingDisplayState returns collapsed no-data line for all-null fixture', () => {
  const state = secMeeting.secMeetingDisplayState([provision('COV-PROXY', {
    proxyFilingDeadline: null,
    mailingDeadline: null,
    meetingDeadline: null,
    adjournmentRights: [],
    meetingControlNotes: null,
  })]);
  assert.equal(state.collapsed, true);
  assert.equal(state.collapsedText, 'SEC Filing / Meeting Requirements — no data extracted');
  assert.deepEqual(state.rows, []);
});

test('SecMeetingTable component uses HoverSource and the collapsed no-data copy', () => {
  const src = fs.readFileSync(path.join(__dirname, '..', 'components', 'review', 'SecMeetingTable.js'), 'utf8');
  assert.match(src, /export function SecMeetingTable/);
  assert.match(src, /HoverSource/);
  assert.match(src, /state\.collapsedText/);
  assert.match(src, />Term</);
  assert.match(src, />Provision</);
  assert.doesNotMatch(src, /Extracted term/);
});
