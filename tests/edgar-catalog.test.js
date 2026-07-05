const test = require('node:test');
const assert = require('node:assert/strict');
const {
  chooseAgreementExhibit,
  discoverEdgarCandidates,
  fetchWithRetry,
  parseFilingDetailRows,
  storeCandidate,
} = require('../lib/edgar-catalog');

function mockResponse(status, body, headers = {}) {
  const normalizedHeaders = Object.fromEntries(
    Object.entries(headers).map(([k, v]) => [k.toLowerCase(), v]),
  );
  return {
    status,
    ok: status >= 200 && status < 300,
    headers: {
      get(name) {
        return normalizedHeaders[String(name).toLowerCase()] || null;
      },
    },
    async text() {
      return typeof body === 'string' ? body : JSON.stringify(body);
    },
    async json() {
      return typeof body === 'string' ? JSON.parse(body) : body;
    },
  };
}

function searchHit(accession, cik, filedBy) {
  return {
    _id: `${accession}:primary.htm`,
    _source: {
      ciks: [cik],
      adsh: accession,
      file_date: '2026-07-01',
      form: '8-K',
      display_names: [`${filedBy}  (CIK ${cik})`],
      items: ['1.01', '9.01'],
    },
  };
}

function filingTable(exhibitHref = '/Archives/edgar/data/2/000000000226000002/good_ex2-1.htm') {
  return `
    <table class="tableFile">
      <tr><th>Seq</th><th>Description</th><th>Document</th><th>Type</th><th>Size</th></tr>
      <tr>
        <td>1</td><td>FORM 8-K</td>
        <td><a href="/Archives/edgar/data/2/000000000226000002/primary.htm">primary.htm</a></td>
        <td>8-K</td><td>5000</td>
      </tr>
      <tr>
        <td>2</td><td>EXHIBIT 2.1 Agreement and Plan of Merger</td>
        <td><a href="${exhibitHref}">good_ex2-1.htm</a></td>
        <td>EX-2.1</td><td>250000</td>
      </tr>
      <tr>
        <td>3</td><td>Press release</td>
        <td><a href="/Archives/edgar/data/2/000000000226000002/ex99-1.htm">ex99-1.htm</a></td>
        <td>EX-99.1</td><td>10000</td>
      </tr>
    </table>
  `;
}

function longAgreementText() {
  const lead = 'Agreement and Plan of Merger by and among Big Buyer Inc. ("Parent"), Merger Sub Inc. ("Merger Sub") and Target Co. ("Company") dated July 1, 2026. ';
  return `<html><body>${lead}${'The parties agree to customary merger covenants and conditions. '.repeat(40)}</body></html>`;
}

test('filing detail parser selects merger agreement exhibit over press release', () => {
  const rows = parseFilingDetailRows(filingTable());
  const exhibit = chooseAgreementExhibit(rows);
  assert.equal(exhibit.type, 'EX-2.1');
  assert.equal(exhibit.description, 'EXHIBIT 2.1 Agreement and Plan of Merger');
  assert.match(exhibit.url, /good_ex2-1\.htm$/);
});

test('storeCandidate no-ops duplicate discovery by agreement hash', async () => {
  let insertCalled = false;
  const sb = {
    from(table) {
      assert.equal(table, 'deal_candidates');
      return {
        select() { return this; },
        eq(column, value) {
          assert.equal(column, 'agreement_text_hash');
          assert.equal(value, 'abc123');
          return this;
        },
        async maybeSingle() {
          return { data: { id: 'existing-id', status: 'pending' }, error: null };
        },
        insert() {
          insertCalled = true;
          return this;
        },
        single() {
          return { data: null, error: null };
        },
      };
    },
  };

  const result = await storeCandidate(sb, {
    cik: '0000000001',
    filing_accession: '0000000001-26-000001',
    filing_date: '2026-07-01',
    form_type: '8-K',
    agreement_exhibit_url: 'https://www.sec.gov/example.htm',
    agreement_text_hash: 'abc123',
  });

  assert.equal(result.action, 'duplicate');
  assert.equal(insertCalled, false);
});

test('discoverEdgarCandidates logs malformed filing and continues batch', async () => {
  const badAccession = '0000000001-26-000001';
  const goodAccession = '0000000002-26-000002';
  const searchJson = {
    hits: {
      total: { value: 2 },
      hits: [
        searchHit(badAccession, '0000000001', 'BAD TARGET INC'),
        searchHit(goodAccession, '0000000002', 'GOOD TARGET INC'),
      ],
    },
  };

  const fetchImpl = async (url) => {
    if (String(url).startsWith('https://efts.sec.gov')) return mockResponse(200, searchJson);
    if (String(url).includes(badAccession.replace(/-/g, ''))) return mockResponse(500, 'broken');
    if (String(url).endsWith(`${goodAccession}-index.html`)) return mockResponse(200, filingTable());
    if (String(url).endsWith('/primary.htm')) {
      return mockResponse(200, '<html><body>Item 1.01 Entry into a Material Definitive Agreement. On July 1, 2026, GOOD TARGET INC announced a transaction value of $1.5 billion. Item 9.01 Financial Statements.</body></html>');
    }
    if (String(url).endsWith('/good_ex2-1.htm')) return mockResponse(200, longAgreementText());
    throw new Error(`Unexpected URL ${url}`);
  };

  const summary = await discoverEdgarCandidates({
    dryRun: true,
    limit: 2,
    retries: 0,
    baseDelayMs: 0,
    sleep: async () => {},
    fetchImpl,
  });

  assert.equal(summary.scanned, 2);
  assert.equal(summary.candidates, 1);
  assert.equal(summary.errors.length, 1);
  assert.match(summary.errors[0].message, /HTTP 500/);
  assert.equal(summary.results.length, 1);
  assert.equal(summary.results[0].kind, 'candidate');
  assert.equal(summary.results[0].candidate.filing_accession, goodAccession);
  assert.equal(summary.results[0].candidate.deal_value_usd, 1500000000);
  assert.match(summary.results[0].candidate.agreement_text_hash, /^[a-f0-9]{64}$/);
});

test('fetchWithRetry backs off on SEC rate limit and then succeeds', async () => {
  let calls = 0;
  const sleeps = [];
  const fetchImpl = async () => {
    calls += 1;
    if (calls === 1) return mockResponse(429, 'slow down');
    return mockResponse(200, 'ok');
  };

  const response = await fetchWithRetry('https://www.sec.gov/example', {
    fetchImpl,
    baseDelayMs: 25,
    sleep: async (ms) => { sleeps.push(ms); },
  });

  assert.equal(await response.text(), 'ok');
  assert.equal(calls, 2);
  assert.deepEqual(sleeps, [25]);
});
