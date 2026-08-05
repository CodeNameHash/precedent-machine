const test = require('node:test');
const assert = require('node:assert/strict');

const {
  AGREEMENT_REVISION,
  candidatePayload,
  chooseAgreementExhibit,
  discoverEdgarCandidates,
  exhibitScore,
  parseFilingDetailRows,
  processFilingHit,
  selectAgreementExhibit,
} = require('../lib/edgar-catalog');

// Exhibit descriptors marked REAL come from filings recorded in this
// repository. The Metsera pair is verbatim from
// evidence/process-intelligence/pilot/metsera-source-universe-manifest.json:
//   "d921605dex21.htm (EX-2.1, Agreement and Plan of Merger)"
//   "d50740dex21.htm (EX-2.1, Amendment No. 1 to Agreement and Plan of Merger)"
// Restatement descriptors are CONSTRUCTED: the corpus contains no restatement.

const BASE = '/Archives/edgar/data/2040807/000119312525273292';

function row({ sequence, description, document, type, size = '250000' }) {
  return `
    <tr>
      <td>${sequence}</td><td>${description}</td>
      <td><a href="${BASE}/${document}">${document}</a></td>
      <td>${type}</td><td>${size}</td>
    </tr>
  `;
}

function filingTable(exhibitRows) {
  return `
    <table class="tableFile">
      <tr><th>Seq</th><th>Description</th><th>Document</th><th>Type</th><th>Size</th></tr>
      ${row({ sequence: 1, description: 'FORM 8-K', document: 'd50740d8k.htm', type: '8-K', size: '5000' })}
      ${exhibitRows.join('\n')}
      ${row({ sequence: 9, description: 'Press release', document: 'ex99-1.htm', type: 'EX-99.1', size: '10000' })}
    </table>
  `;
}

// REAL descriptor: the Metsera amendment, EX-2.1 on the 8-K filed 10 Nov 2025.
const AMENDMENT_ROW = row({
  sequence: 2,
  description: 'Amendment No. 1 to Agreement and Plan of Merger',
  document: 'd50740dex21.htm',
  type: 'EX-2.1',
});

// REAL descriptor: the Metsera original agreement, EX-2.1 on the 8-K filed
// 22 Sep 2025. Filed here as EX-2.2 so both can sit in one table.
const ORIGINAL_ROW = row({
  sequence: 3,
  description: 'Agreement and Plan of Merger',
  document: 'd921605dex21.htm',
  type: 'EX-2.2',
});

// CONSTRUCTED.
const RESTATEMENT_ROW = row({
  sequence: 2,
  description: 'AMENDED AND RESTATED AGREEMENT AND PLAN OF MERGER',
  document: 'ex2-1.htm',
  type: 'EX-2.1',
});

// CONSTRUCTED: names a restatement and then an amendment, in that order.
const AMBIGUOUS_ROW = row({
  sequence: 2,
  description: 'Amended and Restated Agreement and Plan of Merger (Amendment No. 3)',
  document: 'ex2-1.htm',
  type: 'EX-2.1',
});

function longAgreementText(caption = 'AGREEMENT AND PLAN OF MERGER') {
  const articles = ['ARTICLE I THE MERGER', 'ARTICLE II EFFECT ON CAPITAL STOCK', 'ARTICLE III REPRESENTATIONS', 'ARTICLE IV COVENANTS', 'ARTICLE V CONDITIONS', 'ARTICLE VI TERMINATION'];
  return `<html><body>Exhibit 2.1 ${caption} by and among Big Buyer Inc. ("Parent"), Merger Sub Inc. ("Merger Sub") and Target Co. ("Company") dated July 1, 2026. TABLE OF CONTENTS ${articles.join(' ')} ${articles.map((a) => `${a} ${'The parties agree to customary merger covenants and conditions. '.repeat(20)}`).join(' ')}</body></html>`;
}

// CONSTRUCTED body, modelled on the standard form of a merger-agreement
// amendment: recitals identifying the agreement it changes, then operations.
function amendmentDocumentText() {
  return `<html><body>Exhibit 2.1 AMENDMENT NO. 1 TO AGREEMENT AND PLAN OF MERGER. This Amendment No. 1 to Agreement and Plan of Merger (this "Amendment"), dated as of November 7, 2025, is entered into by and among Pfizer Inc., a Delaware corporation ("Parent"), Mustang Merger Sub Inc. ("Merger Sub") and Metsera, Inc., a Delaware corporation (the "Company").
    WHEREAS, the parties are parties to that certain Agreement and Plan of Merger, dated as of September 21, 2025 (the "Merger Agreement");
    WHEREAS, Section 9.2 of the Merger Agreement permits amendment by a written instrument signed by each party;
    NOW, THEREFORE, the parties agree as follows:
    1. Amendment to Section 1.6. Section 1.6 of the Merger Agreement is hereby amended and restated in its entirety to read as follows: "The closing shall take place on the second business day following satisfaction of the conditions in Article VII."
    2. Amendment to Section 1.7. The reference to "$47.50" in Section 1.7(a) of the Merger Agreement is hereby deleted and replaced with "$65.60".
    3. No Other Amendments. Except as expressly amended by this Amendment, the Merger Agreement remains in full force and effect in accordance with its terms.
    ${'IN WITNESS WHEREOF, the parties have caused this Amendment to be executed by their duly authorised officers. '.repeat(6)}</body></html>`;
}

function mockResponse(status, body) {
  return {
    status,
    ok: status >= 200 && status < 300,
    headers: { get: () => null },
    async text() { return typeof body === 'string' ? body : JSON.stringify(body); },
    async json() { return typeof body === 'string' ? JSON.parse(body) : body; },
  };
}

function searchJson(accession, cik) {
  return {
    hits: {
      total: { value: 1 },
      hits: [{
        _id: `${accession}:d50740d8k.htm`,
        _source: {
          ciks: [cik],
          adsh: accession,
          file_date: '2025-11-10',
          form: '8-K',
          display_names: [`Metsera, Inc.  (CIK ${cik})`],
          items: ['1.01', '9.01'],
        },
      }],
    },
  };
}

function fetchImplFor({ table, documents }) {
  return async (url) => {
    const target = String(url);
    if (target.startsWith('https://efts.sec.gov')) return mockResponse(200, searchJson('0001193125-25-273292', '0002040807'));
    if (target.endsWith('-index.html')) return mockResponse(200, table);
    for (const [name, body] of Object.entries(documents)) {
      if (target.endsWith(`/${name}`)) return mockResponse(200, body);
    }
    throw new Error(`Unexpected URL ${target}`);
  };
}

async function runDiscovery(config) {
  return discoverEdgarCandidates({
    dryRun: true,
    limit: 1,
    retries: 0,
    baseDelayMs: 0,
    sleep: async () => {},
    fetchImpl: fetchImplFor(config),
  });
}

// --- the defect -----------------------------------------------------------

test('the exhibit score alone cannot separate the real Metsera amendment from an agreement', () => {
  const rows = parseFilingDetailRows(filingTable([AMENDMENT_ROW, ORIGINAL_ROW]));
  const amendment = rows.find((r) => r.document === 'd50740dex21.htm');
  const original = rows.find((r) => r.document === 'd921605dex21.htm');
  assert.equal(exhibitScore(amendment), exhibitScore(original));
  assert.equal(exhibitScore(amendment), 180);
});

// --- behaviour that must not change --------------------------------------

test('an ordinary agreement exhibit is still chosen, unchanged', () => {
  const rows = parseFilingDetailRows(filingTable([ORIGINAL_ROW]));
  const exhibit = chooseAgreementExhibit(rows);
  assert.equal(exhibit.type, 'EX-2.2');
  assert.equal(exhibit.description, 'Agreement and Plan of Merger');
  assert.match(exhibit.url, /d921605dex21\.htm$/);

  const selection = selectAgreementExhibit(rows);
  assert.equal(selection.exhibit, exhibit);
  assert.equal(selection.needs_human_review, false);
  assert.equal(selection.revision, AGREEMENT_REVISION.UNKNOWN);
  assert.deepEqual(selection.excluded, []);
});

test('a filing with no agreement exhibit is still skipped for the same reason', async () => {
  const table = `<table class="tableFile">${row({ sequence: 1, description: 'FORM 8-K', document: 'd50740d8k.htm', type: '8-K' })}${row({ sequence: 2, description: 'Press release', document: 'ex99-1.htm', type: 'EX-99.1' })}</table>`;
  const summary = await runDiscovery({ table, documents: {} });
  assert.equal(summary.skipped, 1);
  assert.equal(summary.candidates, 0);
  assert.equal(summary.needs_review, 0);
  assert.equal(summary.results[0].kind, 'skipped');
  assert.equal(summary.results[0].reason, 'no merger agreement exhibit found');
});

test('a too-short agreement still fails the minimum-length gate as before', async () => {
  // Classification now runs before the length check. An original that is too
  // short must still raise the same error rather than being diverted to review.
  const summary = await runDiscovery({
    table: filingTable([ORIGINAL_ROW]),
    documents: { 'd921605dex21.htm': '<html><body>Agreement and Plan of Merger by and among Big Buyer Inc. and Target Co.</body></html>', 'd50740d8k.htm': '<html><body>Item 1.01 Entry into a Material Definitive Agreement. Item 9.01</body></html>' },
  });
  assert.equal(summary.candidates, 0);
  assert.equal(summary.needs_review, 0);
  assert.equal(summary.errors.length, 1);
  assert.match(summary.errors[0].message, /agreement exhibit text too short/);
});

test('an original agreement produces exactly the candidate row it produced before', async () => {
  const summary = await runDiscovery({
    table: filingTable([ORIGINAL_ROW]),
    documents: { 'd921605dex21.htm': longAgreementText(), 'd50740d8k.htm': '<html><body>Item 1.01 Entry into a Material Definitive Agreement. On September 21, 2025, the parties entered into a merger agreement. Item 9.01</body></html>' },
  });

  assert.equal(summary.candidates, 1);
  assert.equal(summary.needs_review, 0);
  assert.equal(summary.restatements, 0);

  const result = summary.results[0];
  assert.equal(result.kind, 'candidate');
  assert.equal(result.agreement_revision, AGREEMENT_REVISION.ORIGINAL);
  assert.equal(result.candidate.status, 'pending');
  assert.equal(result.candidate.review_notes, undefined);

  const payload = candidatePayload(result.candidate);
  assert.equal(payload.status, 'pending');
  assert.equal(Object.hasOwn(payload, 'review_notes'), false);
  assert.deepEqual(Object.keys(payload).sort(), [
    'acquirer_name', 'agreement_exhibit_url', 'agreement_text_hash', 'announced_at',
    'cik', 'deal_value_usd', 'filed_by_party', 'filing_accession', 'filing_date',
    'form_type', 'status', 'target_name',
  ]);
});

// --- amendments -----------------------------------------------------------

test('the real Metsera amendment is never chosen as the agreement', () => {
  const rows = parseFilingDetailRows(filingTable([AMENDMENT_ROW, ORIGINAL_ROW]));
  const selection = selectAgreementExhibit(rows);

  assert.equal(selection.exhibit.document, 'd921605dex21.htm');
  assert.equal(selection.excluded.length, 1);
  assert.equal(selection.excluded[0].row.document, 'd50740dex21.htm');
  assert.equal(selection.excluded[0].revision, AGREEMENT_REVISION.AMENDMENT);
  assert.equal(chooseAgreementExhibit(rows).document, 'd921605dex21.htm');
});

test('a filing whose only agreement-shaped exhibit is an amendment chooses nothing', () => {
  const rows = parseFilingDetailRows(filingTable([AMENDMENT_ROW]));
  assert.equal(chooseAgreementExhibit(rows), null);

  const selection = selectAgreementExhibit(rows);
  assert.equal(selection.exhibit, null);
  assert.equal(selection.revision, AGREEMENT_REVISION.AMENDMENT);
  assert.equal(selection.needs_human_review, true);
  assert.equal(selection.review_exhibit.document, 'd50740dex21.htm');
  assert.match(selection.reason, /amendment/i);
});

test('an amendment is recorded for a human instead of ingested as an agreement', async () => {
  const summary = await runDiscovery({
    table: filingTable([AMENDMENT_ROW]),
    documents: { 'd50740dex21.htm': amendmentDocumentText(), 'd50740d8k.htm': '<html><body>Item 1.01 Entry into a Material Definitive Agreement. On November 7, 2025 the parties amended the merger agreement. Item 9.01</body></html>' },
  });

  assert.equal(summary.needs_review, 1);
  assert.equal(summary.skipped, 0);
  assert.equal(summary.errors.length, 0);

  const result = summary.results[0];
  assert.equal(result.kind, 'review');
  assert.equal(result.agreement_revision, AGREEMENT_REVISION.AMENDMENT);
  assert.equal(result.candidate.status, 'needs_review');
  assert.match(result.candidate.review_notes, /Held for review/);
  assert.match(result.candidate.review_notes, /Amendment parsing is not built/);
  assert.equal(result.candidate.agreement_exhibit_url.endsWith('/d50740dex21.htm'), true);

  const payload = candidatePayload(result.candidate);
  assert.equal(payload.status, 'needs_review');
  assert.match(payload.review_notes, /amendment/i);
});

test('an amendment filed under a bare descriptor is caught after the text is fetched', async () => {
  const bareRow = row({ sequence: 2, description: 'EX-2.1', document: 'd50740dex21.htm', type: 'EX-2.1' });
  const rows = parseFilingDetailRows(filingTable([bareRow]));
  // Nothing in the title gives it away, so it is chosen at selection time.
  assert.equal(chooseAgreementExhibit(rows).document, 'd50740dex21.htm');

  const summary = await runDiscovery({
    table: filingTable([bareRow]),
    documents: { 'd50740dex21.htm': amendmentDocumentText(), 'd50740d8k.htm': '<html><body>Item 1.01 Entry into a Material Definitive Agreement. Item 9.01</body></html>' },
  });

  assert.equal(summary.needs_review, 1);
  assert.equal(summary.results[0].kind, 'review');
  assert.equal(summary.results[0].agreement_revision, AGREEMENT_REVISION.AMENDMENT);
});

test('an agreement filed alongside an amendment is ingested, and says so', async () => {
  const summary = await runDiscovery({
    table: filingTable([AMENDMENT_ROW, ORIGINAL_ROW]),
    documents: {
      'd921605dex21.htm': longAgreementText(),
      'd50740dex21.htm': amendmentDocumentText(),
      'd50740d8k.htm': '<html><body>Item 1.01 Entry into a Material Definitive Agreement. Item 9.01</body></html>',
    },
  });

  const result = summary.results[0];
  assert.equal(result.kind, 'candidate');
  assert.equal(result.agreement_revision, AGREEMENT_REVISION.ORIGINAL);
  assert.equal(result.candidate.agreement_exhibit_url.endsWith('/d921605dex21.htm'), true);
  assert.equal(result.excluded_exhibits.length, 1);
  assert.equal(result.excluded_exhibits[0].revision, AGREEMENT_REVISION.AMENDMENT);
  assert.match(result.candidate.review_notes, /also contains an amendment that was not ingested/);
  assert.match(result.candidate.review_notes, /Amendment No\. 1 to Agreement and Plan of Merger/);
  assert.equal(result.candidate.status, 'pending');
});

// --- restatements ---------------------------------------------------------

test('a restatement is chosen, and flagged as a restatement', async () => {
  const rows = parseFilingDetailRows(filingTable([RESTATEMENT_ROW]));
  const selection = selectAgreementExhibit(rows);
  assert.equal(selection.exhibit.document, 'ex2-1.htm');
  assert.equal(selection.revision, AGREEMENT_REVISION.AMENDED_AND_RESTATED);
  assert.equal(selection.needs_human_review, false);

  const summary = await runDiscovery({
    table: filingTable([RESTATEMENT_ROW]),
    documents: { 'ex2-1.htm': longAgreementText('AMENDED AND RESTATED AGREEMENT AND PLAN OF MERGER'), 'd50740d8k.htm': '<html><body>Item 1.01 Entry into a Material Definitive Agreement. Item 9.01</body></html>' },
  });

  assert.equal(summary.candidates, 1);
  assert.equal(summary.restatements, 1);
  assert.equal(summary.needs_review, 0);

  const result = summary.results[0];
  assert.equal(result.kind, 'candidate');
  assert.equal(result.agreement_revision, AGREEMENT_REVISION.AMENDED_AND_RESTATED);
  assert.equal(result.candidate.status, 'pending');
  assert.match(result.candidate.review_notes, /supersedes an earlier agreement/i);
  assert.match(candidatePayload(result.candidate).review_notes, /restatement/i);
});

// --- ambiguity ------------------------------------------------------------

test('an ambiguous top-ranked exhibit fails closed instead of falling through to the next rank', () => {
  const rows = parseFilingDetailRows(filingTable([AMBIGUOUS_ROW, ORIGINAL_ROW]));
  const ambiguous = rows.find((r) => r.document === 'ex2-1.htm');
  const clean = rows.find((r) => r.document === 'd921605dex21.htm');
  assert.ok(exhibitScore(ambiguous) > exhibitScore(clean), 'the ambiguous exhibit must outrank the clean one');

  const selection = selectAgreementExhibit(rows);
  assert.equal(selection.exhibit, null, 'must not resolve the ambiguity by taking the next rank');
  assert.equal(selection.revision, AGREEMENT_REVISION.AMBIGUOUS);
  assert.equal(selection.needs_human_review, true);
  assert.equal(selection.review_exhibit.document, 'ex2-1.htm');
  assert.equal(chooseAgreementExhibit(rows), null);
});

test('an ambiguous exhibit is reported to a human rather than ingested', async () => {
  const summary = await runDiscovery({
    table: filingTable([AMBIGUOUS_ROW]),
    documents: { 'ex2-1.htm': longAgreementText('AMENDED AND RESTATED AGREEMENT AND PLAN OF MERGER'), 'd50740d8k.htm': '<html><body>Item 1.01 Entry into a Material Definitive Agreement. Item 9.01</body></html>' },
  });

  assert.equal(summary.needs_review, 1);
  assert.equal(summary.restatements, 0);
  const result = summary.results[0];
  assert.equal(result.kind, 'review');
  assert.equal(result.agreement_revision, AGREEMENT_REVISION.AMBIGUOUS);
  assert.equal(result.candidate.status, 'needs_review');
  assert.match(result.candidate.review_notes, /Held for review/);
});

test('a title that claims an amendment over a full agreement body is ambiguous, not ingested', async () => {
  const summary = await runDiscovery({
    table: filingTable([AMENDMENT_ROW]),
    documents: { 'd50740dex21.htm': longAgreementText(), 'd50740d8k.htm': '<html><body>Item 1.01 Entry into a Material Definitive Agreement. Item 9.01</body></html>' },
  });

  assert.equal(summary.needs_review, 1);
  assert.equal(summary.results[0].agreement_revision, AGREEMENT_REVISION.AMBIGUOUS);
  assert.match(summary.results[0].candidate.review_notes, /complete agreement/i);
});

// --- the failure this prevents -------------------------------------------

test('processFilingHit never returns an amendment as a candidate agreement', async () => {
  const processed = await processFilingHit(
    { cik: '0002040807', filing_accession: '0001193125-25-273292', filing_date: '2025-11-10', form_type: '8-K', primary_document: 'd50740d8k.htm', filed_by_party: 'Metsera, Inc.' },
    {
      retries: 0,
      baseDelayMs: 0,
      sleep: async () => {},
      fetchImpl: fetchImplFor({
        table: filingTable([AMENDMENT_ROW]),
        documents: { 'd50740dex21.htm': amendmentDocumentText(), 'd50740d8k.htm': '<html><body>Item 1.01 Entry into a Material Definitive Agreement. Item 9.01</body></html>' },
      }),
    },
  );

  assert.notEqual(processed.kind, 'candidate');
  assert.equal(processed.kind, 'review');
  assert.equal(processed.classification.is_agreement_document, false);
});
