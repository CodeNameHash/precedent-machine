const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const read = (...parts) => fs.readFileSync(path.join(root, ...parts), 'utf8');

test('Phase A artefacts exist', () => {
  for (const file of [
    'scripts/canonical-sweep/ioc-other-exclusions.js',
    'scripts/canonical-sweep/rw-sec-filings-portions-excluded.js',
    'scripts/canonical-sweep/rw-general-lookback-scopes.js',
    'reports/canonical-sweep/ioc-other-exclusions.md',
    'reports/canonical-sweep/rw-sec-filings-portions-excluded.md',
    'reports/canonical-sweep/rw-general-lookback-scopes.md',
    'lib/vocab/ioc-categories.js',
    'lib/vocab/ioc-components.js',
    'lib/vocab/ioc-other-exclusions.js',
    'lib/vocab/rw-sec-filings-portions-excluded.js',
    'lib/vocab/rw-general-lookback-scopes.js',
    'supabase/wp-review-strict-v1.sql',
  ]) {
    assert.ok(fs.existsSync(path.join(root, file)), `${file} should exist`);
  }
});

test('Phase A migration contains the locked tables and columns', () => {
  const sql = read('supabase', 'wp-review-strict-v1.sql');
  for (const needle of [
    'consideration_type_canonical',
    'outside_date_specs',
    'absence_of_certain_changes',
    'stockholder_approval',
    'adjournment_rights',
    'closing_conditions',
    'bring_down_reps_scope',
    'cvr_entitlement',
  ]) {
    assert.ok(sql.includes(needle), `migration includes ${needle}`);
  }
});

test('IOC explicit headings resolve to canonical categories before inference', () => {
  const { explicitIocCategory } = require('../lib/parser-v2/classify.js');
  assert.equal(
    explicitIocCategory({
      title: 'Section 5.01(d). Dividends and Distributions',
      text: 'Section 5.01(d). Dividends and Distributions. The Company shall not declare dividends.',
    }),
    'DIVIDENDS_DISTRIBUTIONS',
  );
});

test('Employee Equity renderer is a strict five-column table and hides backend fields', () => {
  const src = read('components', 'review', 'ConsiderationTables.js');
  for (const header of ['Equity Type', 'Consideration', 'Vesting Treatment', 'CVR Entitlement', 'Notes']) {
    assert.ok(src.includes(`>${header}<`), `header ${header} present`);
  }
  assert.match(src, /data-testid="employee-equity-table"/);
  assert.doesNotMatch(src, /Cash Formula/);
  assert.doesNotMatch(src, /Source Span/);
  assert.doesNotMatch(src, /Own Subprovision/);
});

test('Consideration badge is wired to the deal header and no legacy prefix remains', () => {
  const review = read('pages', 'review', '[id].js');
  const consid = read('components', 'review', 'ConsiderationTables.js');
  assert.match(review, /<ConsiderationBadge deal=\{deal\} provisions=\{provisions\}/);
  assert.match(consid, /data-testid="consideration-badge"/);
  assert.doesNotMatch(consid, /Consideration:\s*\{headlineTypeLabel\}/);
  assert.doesNotMatch(review, /Consideration:\s*Cash/);
});

test('ProvisionSubRowTable is used for Antitrust and SEC meeting tables', () => {
  const review = read('pages', 'review', '[id].js');
  const sec = read('components', 'review', 'SecMeetingTable.js');
  assert.match(review, /testId="antitrust-substantive-table"/);
  assert.match(review, /at-pull-refile-row/);
  assert.match(review, /data-testid="summary"/);
  assert.match(review, /data-testid="show-full-toggle"/);
  assert.match(sec, /<ProvisionSubRowTable/);
  assert.match(sec, /testId="sec-filing-section"/);
});

test('Outside Date strict pill row is wired into Termination and Antitrust', () => {
  const src = read('pages', 'review', '[id].js');
  assert.match(src, /function OutsideDatePillRow/);
  assert.match(src, /data-testid="outside-date-row"/);
  assert.match(src, /\$\{baseMonths\} mo/);
  assert.match(src, /\$\{extensionMonths\} mo/);
  assert.match(src, /AUTOMATIC/);
  assert.match(src, /other conditions capable of satisfaction/);
  assert.match(src, /Applicable outside date/);
  assert.match(src, /outsideDatePillSpec/);
});

test('Reps bring-down, stockholder approval, and MAE strict hooks are present', () => {
  const src = read('pages', 'review', '[id].js');
  assert.match(src, /All reps not otherwise specified/);
  assert.match(src, /data-testid=\{rowTestId\}/);
  assert.match(src, /bring-down-reps-company/);
  assert.match(src, /stockholder-approval-row/);
  assert.match(src, /data-testid="vote-standard-pill"/);
  assert.match(src, /data-testid=\{isParent \? 'mae-parent-section' : 'mae-company-section'\}/);
  assert.match(src, /no Parent MAE defined in this agreement/);
  assert.match(src, /data-testid="mae-test"/);
});

test('Employee Benefits uses strict shared table and party attribution in term cell', () => {
  const src = read('components', 'review', 'EmployeeBenefitsTable.js');
  assert.match(src, /<ProvisionSubRowTable/);
  assert.match(src, /testId="employee-benefits-table"/);
  assert.match(src, /headerLeft="Term"/);
  assert.match(src, /headerRight="Provision"/);
  assert.match(src, /Company pre-closing/);
  assert.match(src, /emp-benefits-precluding-arrangements/);
});

test('Material Contracts is pinned to a 40 percent term column', () => {
  const src = read('pages', 'review', '[id].js');
  assert.match(src, /data-testid="material-contracts-table"/);
  assert.match(src, /data-testid="col-term"[^>]+style=\{\{ width: '40%' \}\}/);
});

test('No strict banned strings remain in review surfaces', () => {
  const files = [
    read('pages', 'review', '[id].js'),
    ...fs.readdirSync(path.join(root, 'components', 'review'))
      .filter((file) => /\.(js|jsx)$/.test(file))
      .map((file) => read('components', 'review', file)),
  ];
  const banned = [
    'Extracted Term',
    'Question',
    'Answer',
    'Consideration: Cash',
    'Mergers, Acquisitions, Dispositions',
    'Acquisitions / business combinations',
    'does buyer',
    'Cash Formula',
    'Source Span',
    'Own Subprovision',
  ];
  for (const content of files) {
    for (const phrase of banned) {
      assert.ok(!content.includes(phrase), `banned string remains: ${phrase}`);
    }
  }
});

test('No banned visible table headers remain in review surfaces', () => {
  const files = [
    ['pages/review/[id].js', read('pages', 'review', '[id].js')],
    ...fs.readdirSync(path.join(root, 'components', 'review'))
      .filter((file) => /\.(js|jsx)$/.test(file))
      .map((file) => [`components/review/${file}`, read('components', 'review', file)]),
  ];
  const bannedHeader = />\s*(Extracted Term|Question|Answer|Feature|Value|Category|Right|Key Terms|Standard \/ Detail|Details|Covenant|Restriction|Components|Exceptions|Trigger|Who Can Terminate|Fee|Item)\s*<\/th>/;
  for (const [file, content] of files) {
    assert.doesNotMatch(content, bannedHeader, `${file} has a banned visible header`);
  }
});

test('R&W look-back renderer rejects decimal or overlong month counts', () => {
  const src = read('pages', 'review', '[id].js');
  const start = src.indexOf('function formatLookbackYears(months)');
  const body = src.slice(start, src.indexOf('function computeLookbackText', start));
  assert.match(body, /!Number\.isInteger\(m\) \|\| m > 240/);
  assert.doesNotMatch(body, /toFixed\(1\)/);
});

test('Sidebar has no pill rendering and distinguishes canonicality', () => {
  const src = read('components', 'review', 'Sidebar.js');
  assert.match(src, /data-testid="sidebar-nav"/);
  assert.match(src, /sidebar-item-canonical-sample/);
  assert.match(src, /sidebar-item-non-canonical-sample/);
  assert.doesNotMatch(src, /className="pill"/);
});
