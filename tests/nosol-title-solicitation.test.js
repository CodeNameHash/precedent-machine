/* Tests for the NOSOL "no title match" fix (Fable spec):
     1. Bare \bsolicitation\b (no "no-"/"non-" prefix required) and
        \bacquisition proposals?\b title triggers — Frontier/Verizon titles
        its no-shop "Solicitation; Change in Recommendation", which the
        prior no[\s-]*(?:solicitation|shop) pattern could not match.
     2. A content-signal fallback (NOSOL_CONTENT_RE) for sections whose
        title matches no NOSOL pattern at all but whose body carries the
        operative "shall not ... solicit ... Acquisition Proposal" covenant
        — SecureWorks/Sophos's no-shop (nominal section 6.02) never became
        its own classified section; Phase-1 segmentation folded it into the
        PRECEDING "Conduct of the Company" (IOC-T) section. The fallback
        only fires for COV/MISC/IOC-T/IOC-B — see the widened-guard comment
        in lib/parser-v2/classify.js Pass 2.8 for the corpus-wide evidence
        behind including IOC-T/IOC-B.
   A negative case is included: an ordinary covenant section that must NOT
   flip to NOSOL just because it uses the word "solicit" in passing.
   Run: npm test */
const test = require('node:test');
const assert = require('node:assert/strict');
const { tryDeterministic, classifySections, NOSOL_CONTENT_RE } = require('../lib/parser-v2/classify');

const sec = (number, title, text) => ({
  number, title, heading: title,
  articleNumber: number.split('.')[0], startChar: 0,
  text: text || `Section ${number} ${title}. ${'Substantive obligations of the parties follow herein. '.repeat(10)}`,
});

test('title variant: "Solicitation; Change in Recommendation" (Frontier/Verizon 5.02) -> NOSOL', () => {
  assert.equal(tryDeterministic(sec('5.02', 'Solicitation; Change in Recommendation'), 'COV').type, 'NOSOL');
  // Also true with no article context at all.
  assert.equal(tryDeterministic(sec('5.02', 'Solicitation; Change in Recommendation'), null).type, 'NOSOL');
});

test('title variant: bare "Solicitation" -> NOSOL', () => {
  assert.equal(tryDeterministic(sec('6.1', 'Solicitation'), 'COV').type, 'NOSOL');
});

test('title variant: "Acquisition Proposals; Change in Recommendation" (already covered by pre-existing acquisition-proposals pattern) -> NOSOL', () => {
  assert.equal(tryDeterministic(sec('6.02', 'Acquisition Proposals; Change in Recommendation'), 'COV').type, 'NOSOL');
});

test('NOSOL-M / NOSOL-B still win over the generic bare-solicitation rule for party-scoped titles', () => {
  assert.equal(tryDeterministic(sec('6.4', 'No Solicitation by Parent'), 'COV').type, 'NOSOL-B');
  assert.equal(tryDeterministic(sec('6.4', 'Mutual Non-Solicitation'), 'COV').type, 'NOSOL-M');
});

test('content fallback: NOSOL_CONTENT_RE matches the SecureWorks-style operative covenant', () => {
  const body = 'the Acquired Companies shall not, and shall not authorize their Representatives to, ' +
    '(i) initiate, solicit, facilitate or knowingly encourage the making of any Acquisition Proposal, ' +
    '(ii) other than informing Third Parties of the existence of these provisions.';
  assert.match(body, NOSOL_CONTENT_RE);
});

test('content fallback via classifySections: a no-shop covenant merged into an IOC-T "Conduct of the Company" section flips to NOSOL', async () => {
  const noShopBody = 'During the Pre-Closing Period, the Company shall conduct its business in the ordinary course. ' +
    'Separately, the Acquired Companies shall not, and shall not authorize their Representatives to, ' +
    '(i) initiate, solicit, facilitate or knowingly encourage the making of any Acquisition Proposal, ' +
    '(ii) engage in discussions regarding any Acquisition Proposal.';
  const sections = [sec('6.01', 'Conduct of the Company', noShopBody)];
  const articles = [{ number: '6', title: 'COVENANTS' }];
  const classified = await classifySections(sections, articles, null);
  assert.equal(classified[0].provisionType, 'NOSOL');
  assert.equal(classified[0].classifiedBy, 'nosol-content-fallback');
});

test('content fallback via classifySections: fires for a plain COV/MISC section too', async () => {
  const noShopBody = 'The Company agrees not to, directly or indirectly, ' +
    'solicit, initiate or knowingly encourage the submission of any Acquisition Proposal from any Person.';
  const sections = [sec('9.4', 'Miscellaneous Covenants', noShopBody)];
  const articles = [{ number: '9', title: 'MISCELLANEOUS' }];
  const classified = await classifySections(sections, articles, null);
  assert.equal(classified[0].provisionType, 'NOSOL');
});

test('negative case: an ordinary covenant that merely mentions "solicit" in passing must NOT flip to NOSOL', async () => {
  const proxyBody = 'The Company shall convene and hold a meeting of its stockholders for the purpose of ' +
    'obtaining the Company Stockholder Approval, and the Company shall solicit proxies from its stockholders ' +
    'in accordance with applicable Law and the rules of the NYSE. This covenant does not restrict any ' +
    'Acquisition Proposal discussion and stands entirely apart from Section 6.02.' +
    ' Additional routine housekeeping provisions follow. '.repeat(5);
  const sections = [sec('6.5', 'Stockholders Meeting', proxyBody)];
  const articles = [{ number: '6', title: 'COVENANTS' }];
  const classified = await classifySections(sections, articles, null);
  assert.notEqual(classified[0].provisionType, 'NOSOL');
  assert.equal(classified[0].provisionType, 'COV');
  assert.equal(classified[0].provisionCode, 'COV-MEETING');
});

test('negative case: NOSOL_CONTENT_RE does not match ordinary "shall not" boilerplate without the solicit+Acquisition-Proposal proximity', () => {
  const boilerplate = 'The Company shall not amend its certificate of incorporation without Parent\'s consent. ' +
    'Nothing herein shall be construed as a solicitation of any securities offering under the Securities Act.';
  assert.doesNotMatch(boilerplate, NOSOL_CONTENT_RE);
});

test('negative case: content fallback never overrides a more-specific type (REP-T)', async () => {
  const noShopLikeBody = 'The Company represents that it shall not, and shall not permit any Subsidiary to, ' +
    'solicit, initiate or knowingly encourage the submission of any Acquisition Proposal, except as set forth on Schedule 3.1.';
  const sections = [sec('3.1', 'Absence of Certain Changes', noShopLikeBody)];
  const articles = [{ number: '3', title: 'REPRESENTATIONS AND WARRANTIES OF THE COMPANY' }];
  const classified = await classifySections(sections, articles, null);
  assert.equal(classified[0].provisionType, 'REP-T');
});
