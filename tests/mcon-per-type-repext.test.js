const test = require('node:test');
const assert = require('node:assert/strict');

const { runExtractTypePhase } = require('../lib/parser-v2/run-extract.js');
const { toCompactSections } = require('../lib/parser-v2/snapshot.js');

const REP_TEXT =
  '3.13 Material Contracts. Section 3.13(a) of the Company Disclosure Letter contains a true, correct and complete list of all Material Contracts.';

const ROMAN_DEF_TEXT =
  '"Material Contract" means any of the following Contracts: ' +
  '(i) any "material contract" (as defined in Item 601(b)(10) of Regulation S-K promulgated by the SEC) with respect to the Company Group, taken as a whole; ' +
  '(ii) any material Contract with any of the top 20 suppliers to the Company Group, taken as a whole; ' +
  '(iii) any material Contract with any of the top 20 customers to the Company Group, taken as a whole; ' +
  '(iv) any Contract containing any covenant limiting the right of the Company Group to engage in any material line of business or containing any "most favored nation" or "exclusivity" provision; ' +
  '(v) any Contract relating to the disposition or acquisition of assets by the Company Group with a value greater than $15,000,000; ' +
  '(vi) any Contract pursuant to which a member of the Company Group has been granted or grants any license with respect to any material Intellectual Property; ' +
  '(vii) any mortgages, indentures, guarantees, loans or credit agreements relating to Indebtedness; and ' +
  '(viii) any Lease of real property material to the Company Group.';

const LETTERED_DEF_TEXT =
  '"Material Contracts" means any Contract: ' +
  '(a) required to be filed as a material contract pursuant to Item 601(b) of Regulation S-K; ' +
  '(b) involving aggregate payments in excess of $25,000,000; ' +
  '(c) evidencing Indebtedness; and ' +
  '(d) creating any joint venture or partnership.';

const MARKERED_ROMAN_DEF_TEXT =
  ROMAN_DEF_TEXT.replace('"Material Contract"', '[[DEFINED]]"Material Contract"[[/DEFINED]]');

function makeRepClient() {
  return {
    messages: {
      create: async () => ({
        content: [{
          text: JSON.stringify({
            results: [{
              idx: 0,
              code: 'REP-T-MATERIAL-CONTRACTS',
              category: 'Material Contracts',
              favorability: 'neutral',
              features: {
                materialContractsBuckets: null,
                sectionNumber: '3.13',
              },
              isNewCode: false,
            }],
          }),
        }],
      }),
    },
  };
}

function makeSb(metadata) {
  const captured = { insertedRows: [], dealUpdates: [] };

  const table = (name) => ({
    select() {
      this.action = 'select';
      return this;
    },
    update(payload) {
      this.action = 'update';
      this.payload = payload;
      return this;
    },
    delete() {
      this.action = 'delete';
      return this;
    },
    insert(rows) {
      captured.insertedRows.push(...(Array.isArray(rows) ? rows : [rows]));
      return {
        select: async () => ({
          data: (Array.isArray(rows) ? rows : [rows]).map((_, i) => ({ id: `inserted-${i}` })),
          error: null,
        }),
      };
    },
    eq() {
      if (this.action === 'update' && name === 'deals') {
        captured.dealUpdates.push(this.payload);
      }
      return this;
    },
    in() {
      return this;
    },
    order() {
      return Promise.resolve({ data: [], error: null });
    },
    single() {
      return Promise.resolve({ data: { id: 'deal-1', metadata }, error: null });
    },
    then(resolve) {
      if (name === 'provisions' && this.action === 'select') {
        return Promise.resolve({ data: [], error: null }).then(resolve);
      }
      return Promise.resolve({ data: null, error: null }).then(resolve);
    },
  });

  return {
    captured,
    from: table,
  };
}

async function runFixture(definitionText) {
  const classifiedSections = toCompactSections([{
    provision_type: 'REP-T',
    provisionCode: 'REP-T-MATERIAL-CONTRACTS',
    number: '3.13',
    title: 'Material Contracts',
    text: REP_TEXT,
    startChar: 100,
  }]);
  const metadata = {
    full_text: `ARTICLE I DEFINITIONS. ${definitionText}\n\nARTICLE III REPRESENTATIONS. ${REP_TEXT}`,
    classified_sections: classifiedSections,
  };
  const sb = makeSb(metadata);

  const result = await runExtractTypePhase({
    dealId: 'deal-1',
    type: 'REP-T',
    sb,
    client: makeRepClient(),
  });

  assert.equal(result.provisions_inserted, 1);
  const row = sb.captured.insertedRows.find((r) => r.category === 'Material Contracts');
  assert.ok(row, 'expected Material Contracts row to be inserted');
  return row.ai_metadata.features.materialContractsBuckets;
}

test('runExtractTypePhase stamps roman Material Contract buckets on per-type REP-T reprocess', async () => {
  const buckets = await runFixture(MARKERED_ROMAN_DEF_TEXT);
  assert.ok(Array.isArray(buckets), 'expected materialContractsBuckets array');
  assert.ok(buckets.length >= 7, `expected roman buckets to populate, got ${buckets.length}`);
  const codes = buckets.map((b) => b.code);
  assert.ok(codes.includes('SEC_ITEM_601'), `expected SEC_ITEM_601, got ${codes}`);
  assert.ok(codes.includes('EXCLUSIVITY_MFN'), `expected EXCLUSIVITY_MFN, got ${codes}`);
  assert.ok(codes.includes('INDEBTEDNESS'), `expected INDEBTEDNESS, got ${codes}`);
  assert.ok(codes.some((c) => c !== 'OTHER'), 'expected canonical coverage, not all OTHER');
});

test('runExtractTypePhase still stamps lettered Material Contract buckets on per-type REP-T reprocess', async () => {
  const buckets = await runFixture(LETTERED_DEF_TEXT);
  assert.ok(Array.isArray(buckets), 'expected materialContractsBuckets array');
  assert.equal(buckets.length, 4);
  assert.equal(buckets[0].code, 'SEC_ITEM_601');
  assert.equal(buckets[1].code, 'AGGREGATE_PAYMENTS');
  assert.equal(buckets[1].threshold, '$25,000,000');
  assert.equal(buckets[2].code, 'INDEBTEDNESS');
});
